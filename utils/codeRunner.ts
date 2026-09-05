import { TestCase, TestResult } from '../types';

const MAX_CODE_LENGTH = 50_000;
const EXECUTION_TIMEOUT_MS = 3_000;

export const detectJavascriptEntryPoint = (code: string) => {
  const declaration = code.match(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (declaration) return declaration[1];
  const assignment = code.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/);
  return assignment?.[1] || null;
};

const workerPrelude = String.raw`
'use strict';
const splitTopLevel = (input) => {
  const chunks = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '[' || char === '{' || char === '(') depth += 1;
    else if (char === ']' || char === '}' || char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      chunks.push(input.slice(start, index));
      start = index + 1;
    }
  }
  chunks.push(input.slice(start));
  return chunks.map(value => value.trim()).filter(Boolean);
};

const assignmentValue = (input) => {
  let depth = 0;
  let quote = '';
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '[' || char === '{' || char === '(') depth += 1;
    else if (char === ']' || char === '}' || char === ')') depth -= 1;
    else if (char === '=' && depth === 0) return input.slice(index + 1).trim();
  }
  return input.trim();
};

const parseValue = (input) => {
  const value = assignmentValue(input);
  try { return JSON.parse(value); }
  catch {
    if (value === 'undefined') return undefined;
    throw new Error('Test input is not valid JSON: ' + value);
  }
};

const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = normalize(value[key]);
      return result;
    }, {});
  }
  return value;
};

const display = (value) => {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); }
  catch { return String(value); }
};
`;

export const buildJavascriptWorkerSource = (code: string, functionName: string) => workerPrelude + `
self.onmessage = async (event) => {
  const tests = event.data.tests;
  try {
    const candidate = (() => {
${code}
      return typeof ${functionName} === 'function' ? ${functionName} : null;
    })();
    if (!candidate) throw new Error('Function ${functionName} was not defined.');

    const results = [];
    for (const test of tests) {
      const startedAt = performance.now();
      try {
        const args = splitTopLevel(test.input).map(parseValue);
        const expected = parseValue(test.expectedOutput);
        const actual = await candidate(...args);
        results.push({
          testId: test.id,
          passed: JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected)),
          actualOutput: display(actual),
          runtimeMs: Math.max(0.01, performance.now() - startedAt),
          memoryKb: 0,
        });
      } catch (error) {
        results.push({
          testId: test.id,
          passed: false,
          actualOutput: 'Error',
          runtimeMs: Math.max(0.01, performance.now() - startedAt),
          memoryKb: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    self.postMessage({ results });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};`;

export const runJavascriptTests = (code: string, tests: TestCase[]): Promise<TestResult[]> => {
  if (typeof Worker === 'undefined') {
    return Promise.reject(new Error('This browser does not support isolated code workers.'));
  }
  if (!code.trim()) return Promise.reject(new Error('Write a solution before running tests.'));
  if (code.length > MAX_CODE_LENGTH) {
    return Promise.reject(new Error(`Solutions are limited to ${MAX_CODE_LENGTH.toLocaleString()} characters.`));
  }

  const functionName = detectJavascriptEntryPoint(code);
  if (!functionName) {
    return Promise.reject(new Error('Define a named JavaScript function before running tests.'));
  }

  const workerSource = buildJavascriptWorkerSource(code, functionName);

  return new Promise((resolve, reject) => {
    const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    const dispose = () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
    const timeout = window.setTimeout(() => {
      dispose();
      reject(new Error(`Execution exceeded ${EXECUTION_TIMEOUT_MS / 1000} seconds and was stopped.`));
    }, EXECUTION_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<{ results?: TestResult[]; error?: string }>) => {
      window.clearTimeout(timeout);
      dispose();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.results || []);
    };
    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      dispose();
      reject(new Error(event.message || 'The JavaScript solution could not be compiled.'));
    };
    worker.postMessage({ tests });
  });
};
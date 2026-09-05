import { CodingProblem, TestCase } from '../types';

const text = (value: unknown, label: string, maxLength: number) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is missing.`);
  return value.trim().slice(0, maxLength);
};

export const validateCodingProblem = (value: unknown): CodingProblem => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The generated coding problem is invalid.');
  }
  const raw = value as Record<string, unknown>;
  const initialCode = raw.initialCode && typeof raw.initialCode === 'object'
    ? raw.initialCode as Record<string, unknown>
    : {};
  const javascript = text(initialCode.javascript, 'JavaScript starter code', 20_000);
  const tests: TestCase[] = Array.isArray(raw.testCases)
    ? raw.testCases.slice(0, 20).map((test, index) => {
        if (!test || typeof test !== 'object') throw new Error(`Test ${index + 1} is invalid.`);
        const item = test as Record<string, unknown>;
        return {
          id: typeof item.id === 'string' && item.id.trim() ? item.id.slice(0, 80) : `test-${index + 1}`,
          input: text(item.input, `Test ${index + 1} input`, 4_000),
          expectedOutput: text(item.expectedOutput, `Test ${index + 1} output`, 4_000),
          visible: item.visible !== false,
        };
      })
    : [];
  if (tests.length === 0) throw new Error('The generated problem has no tests.');

  const difficulty = raw.difficulty === 'Easy' || raw.difficulty === 'Hard' ? raw.difficulty : 'Medium';
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.slice(0, 100) : crypto.randomUUID(),
    title: text(raw.title, 'Problem title', 160),
    description: text(raw.description, 'Problem description', 12_000),
    difficulty,
    timeLimit: typeof raw.timeLimit === 'number' && Number.isFinite(raw.timeLimit)
      ? Math.max(5, Math.min(90, Math.round(raw.timeLimit)))
      : 20,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).slice(0, 8)
      : [],
    initialCode: { javascript },
    testCases: tests,
    expectedComplexity: typeof raw.expectedComplexity === 'string' ? raw.expectedComplexity.slice(0, 160) : 'Discuss time and space complexity.',
    hints: Array.isArray(raw.hints)
      ? raw.hints.filter((hint): hint is string => typeof hint === 'string' && Boolean(hint.trim())).slice(0, 6)
      : [],
  };
};
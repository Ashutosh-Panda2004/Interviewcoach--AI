import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';

const availablePort = () => new Promise<number>((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close(error => error ? reject(error) : resolve(port));
  });
});

const waitForServer = async (origin: string, processHandle: ChildProcess, output: () => string) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Integration server exited before readiness.\n${output()}`);
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Startup can be slower on Windows immediately after a build.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Integration server did not become ready.\n${output()}`);
};

test('real Gemini text and Live credentials work through the server boundary', {
  skip: apiKey ? false : 'Set GEMINI_API_KEY in .env to run the provider integration test.',
  timeout: 120_000,
}, async () => {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  let logs = '';
  const processHandle = spawn(process.execPath, ['dist/server.cjs'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), GEMINI_API_KEY: apiKey },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  processHandle.stdout?.on('data', chunk => { logs += chunk.toString(); });
  processHandle.stderr?.on('data', chunk => { logs += chunk.toString(); });

  try {
    await waitForServer(origin, processHandle, () => logs);

    const validation = await fetch(`${origin}/api/ai/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(validation.status, 200);
    const validationBody = await validation.json() as { ok: boolean; model: string };
    assert.equal(validationBody.ok, true);
    assert.ok(validationBody.model);

    const generation = await fetch(`${origin}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Reply with exactly INTERVIEWCOACH_OK.' }),
    });
    assert.equal(generation.status, 200);
    const generationBody = await generation.json() as { text: string };
    assert.match(generationBody.text, /INTERVIEWCOACH_OK/i);

    const live = await fetch(`${origin}/api/live/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(live.status, 200);
    const liveBody = await live.json() as { token: string; model: string };
    assert.ok(liveBody.token.length > 20);
    assert.notEqual(liveBody.token, apiKey);
    assert.ok(liveBody.model);
  } finally {
    processHandle.kill();
  }
});

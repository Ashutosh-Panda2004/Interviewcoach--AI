import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
let processHandle: ChildProcess;
let origin = '';
let serverOutput = '';
let serverError = '';
let serverExitCode: number | null = null;

const availablePort = () => new Promise<number>((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close(error => error ? reject(error) : resolve(port));
  });
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (serverExitCode !== null) {
      throw new Error(`Production server exited with ${serverExitCode}.\n${serverOutput}\n${serverError}`);
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The process may still be starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Production server did not become ready.\n${serverOutput}\n${serverError}`);
};

before(async () => {
  const port = await availablePort();
  origin = `http://127.0.0.1:${port}`;
  processHandle = spawn(process.execPath, ['dist/server.cjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
      AI_RATE_LIMIT: '2',
      LIVE_RATE_LIMIT: '2',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  processHandle.stdout?.on('data', chunk => { serverOutput += chunk.toString(); });
  processHandle.stderr?.on('data', chunk => { serverError += chunk.toString(); });
  processHandle.once('exit', code => { serverExitCode = code ?? -1; });
  await waitForServer();
});

after(() => {
  processHandle?.kill();
});

describe('production server', () => {
  test('serves health and SPA deep links', async () => {
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json() as { status: string }).status, 'ok');
    assert.equal(health.headers.get('x-powered-by'), null);
    assert.match(health.headers.get('content-security-policy') || '', /script-src 'self'/);
    assert.doesNotMatch(health.headers.get('content-security-policy') || '', /script-src[^;]*unsafe-inline/);

    const dashboard = await fetch(`${origin}/dashboard`);
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /<div id="root"><\/div>/);

    for (const route of ['/interview', '/practice', '/open-source']) {
      const response = await fetch(`${origin}${route}`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /<div id="root"><\/div>/);
    }

    const serverBundle = await fetch(`${origin}/server.cjs`);
    assert.equal(serverBundle.status, 404);
    assert.doesNotMatch(await serverBundle.text(), /InterviewCoach server running/);

    const missingAsset = await fetch(`${origin}/assets/not-a-real-bundle`);
    assert.equal(missingAsset.status, 404);
    assert.match(missingAsset.headers.get('content-type') || '', /application\/json/);
  });

  test('returns explicit API errors', async () => {
    const missing = await fetch(`${origin}/api/missing`);
    assert.equal(missing.status, 404);

    const insecureByok = await fetch(`${origin}/api/ai/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gemini-API-Key': 'not-a-real-key-but-long-enough-for-validation',
        'X-Forwarded-Host': 'public.example',
        'X-Forwarded-Proto': 'http',
      },
      body: '{}',
    });
    assert.equal(insecureByok.status, 400);
    assert.match((await insecureByok.json() as { error: string }).error, /HTTPS connection is required/i);

    const malformed = await fetch(`${origin}/api/ai/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Invalid JSON request body.' });

    const oversized = await fetch(`${origin}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'x'.repeat(1_100_000) }),
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), { error: 'Request body is too large.' });

    const generation = await fetch(`${origin}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    });
    assert.equal(generation.status, 503);
    assert.match((await generation.json() as { error: string }).error, /not configured/i);

    const validation = await fetch(`${origin}/api/ai/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(validation.status, 503);
    assert.match((await validation.json() as { error: string }).error, /not configured/i);

    const rateLimited = await fetch(`${origin}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello again' }),
    });
    assert.equal(rateLimited.status, 429);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const live = await fetch(`${origin}/api/live/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(live.status, 503);
    }
    const liveRateLimited = await fetch(`${origin}/api/live/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(liveRateLimited.status, 429);

    const config = await fetch(`${origin}/api/config`);
    assert.equal(config.status, 200);
    assert.equal((await config.json() as { aiConfigured: boolean }).aiConfigured, false);
  });
});

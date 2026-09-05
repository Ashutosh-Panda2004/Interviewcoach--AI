import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import vm from 'node:vm';
import { parseJsonObject } from '../utils/json';
import { validateReport } from '../utils/reportValidation';
import { validateCodingProblem } from '../utils/codingProblemValidation';
import { buildJavascriptWorkerSource, detectJavascriptEntryPoint, runJavascriptTests } from '../utils/codeRunner';
import { getSessionApiKey, setSessionApiKey } from '../utils/aiClient';
import { getInterviewHistory, saveInterviewResult } from '../utils/storage';
import {
  ACTIVE_INTERVIEW_KEY,
  compactActiveInterview,
  loadActiveInterview,
  saveActiveInterview,
  type ActiveInterviewSnapshot,
} from '../utils/activeSessionStorage';
import {
  createBaselineProfile,
  scoreDiagnostic,
  updateProfileFromSystemDesignScore,
} from '../utils/skillScoring';
import {
  loadActivePracticeSession,
  savePracticeSession,
} from '../utils/practiceStorage';
import { setResourceReviewed } from '../utils/resourceRanking';
import { urlToView, viewToUrl } from '../router';
import { randomizeBlindSettings } from '../utils/interviewSettings';
import { rankPracticeProblems } from '../utils/practiceProblemRanking';
import { hasCandidateResponse } from '../utils/feedbackEligibility';
import { appendCanvasSnapshot, type CanvasHistoryState } from '../utils/canvasHistory';
import {
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  fitViewportToNodes,
  screenToWorld,
  worldToScreen,
  zoomViewportAt,
} from '../utils/canvasViewport';
import { autoLayoutSystemDesign } from '../utils/canvasLayout';
import { analyzeSystemDesign } from '../utils/canvasBrainstorm';
import { buildSystemDesignSvg } from '../utils/systemDesignSvg';
import {
  AppView,
  DiagnosticQuestion,
  PracticeSession,
  SystemDesignScore,
} from '../types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  failWrites = false;

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.values.set(key, String(value));
  }
}

const localMemory = new MemoryStorage();
const sessionMemory = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: localMemory, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionMemory, configurable: true });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localMemory.failWrites = false;
  sessionMemory.failWrites = false;
});

const validReport = (score = 72) => ({
  composite: { score, stars: 4, confidence: 0.8, explanation: 'Evidence-backed result.' },
  dimensions: {
    communication: { score, confidence: 0.8, breakdown: { wpm: 120, clarity: score, fillerFrequency: 20, pacing: score } },
    technical: { score, confidence: 0.8, breakdown: { depth: score, accuracy: score, terminology: score } },
    structure: { score, confidence: 0.8, breakdown: { starMethod: score, coherence: score, conciseness: score } },
    problemSolving: null,
    behavioral: null,
    delivery: null,
    resumeFit: null,
  },
  strengths: [],
  improvements: [],
  perQuestion: [],
  actionPlan: [],
  summary: 'A specific session summary.',
});

describe('feedback validation', () => {
  test('requires a non-empty candidate response before analysis', () => {
    assert.equal(hasCandidateResponse([]), false);
    assert.equal(hasCandidateResponse([{ speaker: 'agent', text: 'Tell me about yourself.', timestamp: 1 }]), false);
    assert.equal(hasCandidateResponse([{ speaker: 'user', text: '   ', timestamp: 2 }]), false);
    assert.equal(hasCandidateResponse([{ speaker: 'user', text: 'I led the migration.', timestamp: 3 }]), true);
  });

  test('preserves legitimate zero scores and actual metadata', () => {
    const report = validateReport(validReport(0), {
      role: 'Analyst',
      durationMinutes: 2.5,
      difficulty: 'Hard',
      resumeUploaded: false,
    });

    assert.equal(report.composite.score, 0);
    assert.equal(report.dimensions.communication.score, 0);
    assert.equal(report.meta.duration_minutes, 2.5);
    assert.equal(report.meta.difficulty_final, 5);
  });

  test('rejects malformed reports instead of inventing scores', () => {
    assert.throws(
      () => validateReport({ ...validReport(), composite: {} }, {
        role: 'Engineer',
        durationMinutes: 1,
        difficulty: 'Medium',
        resumeUploaded: false,
      }),
      /composite\.score must be a number/,
    );
  });

  test('keeps valid resume analysis and drops out-of-range highlights', () => {
    const source = {
      ...validReport(),
      resumeAnalysis: {
        text: 'Built resilient APIs',
        highlights: [
          { id: 'valid', start: 0, end: 5, type: 'strength', reason: 'Specific verb' },
          { id: 'invalid', start: 10, end: 500, type: 'weakness', reason: 'Out of range' },
        ],
        topicConfidence: [{ topic: 'APIs', score: 80, delivery: 70 }],
        missingKeywords: ['observability'],
      },
    };
    const report = validateReport(source, {
      role: 'Engineer',
      durationMinutes: 10,
      difficulty: 'Medium',
      resumeUploaded: true,
    });

    assert.equal(report.resumeAnalysis?.highlights.length, 1);
    assert.equal(report.resumeAnalysis?.topicConfidence[0].score, 80);
  });
});

describe('generated coding problems', () => {
  test('normalizes an executable JavaScript challenge', () => {
    const problem = validateCodingProblem({
      title: 'Add values',
      description: 'Return the sum.',
      difficulty: 'Impossible',
      timeLimit: 500,
      tags: ['arrays'],
      initialCode: { javascript: 'function add(a, b) {\n  return 0;\n}' },
      testCases: [{ input: 'a=1, b=2', expectedOutput: '3', visible: true }],
    });

    assert.equal(problem.difficulty, 'Medium');
    assert.equal(problem.timeLimit, 90);
    assert.equal(problem.testCases.length, 1);
  });

  test('rejects challenges without runnable tests', () => {
    assert.throws(() => validateCodingProblem({
      title: 'Broken',
      description: 'No tests',
      initialCode: { javascript: 'function broken() {}' },
      testCases: [],
    }), /no tests/i);
  });
});

describe('JavaScript runner entry detection', () => {
  test('detects synchronous, async, and assigned named entries', () => {
    assert.equal(detectJavascriptEntryPoint('function solve(value) { return value; }'), 'solve');
    assert.equal(detectJavascriptEntryPoint('async function solve(value) { return value; }'), 'solve');
    assert.equal(detectJavascriptEntryPoint('const solve = async (value) => value;'), 'solve');
  });

  test('rejects code without a named entry point', () => {
    assert.equal(detectJavascriptEntryPoint('(() => 42)();'), null);
  });

  test('executes sync and async solutions against structured tests', async () => {
    const execute = async (code: string) => {
      const entry = detectJavascriptEntryPoint(code);
      assert.ok(entry);
      let payload: any;
      const self = { postMessage: (value: unknown) => { payload = value; } };
      const context = vm.createContext({ self, performance, JSON, Error, String, Object, Array, Math });
      vm.runInContext(buildJavascriptWorkerSource(code, entry), context);
      await (self as any).onmessage({
        data: {
          tests: [
            { id: 'one', input: 'a=2, b=3', expectedOutput: '5', visible: true },
            { id: 'two', input: 'a=-1, b=1', expectedOutput: '0', visible: true },
          ],
        },
      });
      return payload.results;
    };

    const outcomes = (results: any[]) => Array.from(results, result => Boolean(result.passed));
    assert.deepEqual(outcomes(await execute('function add(a, b) { return a + b; }')), [true, true]);
    assert.deepEqual(outcomes(await execute('async function add(a, b) { return a + b; }')), [true, true]);
    assert.deepEqual(outcomes(await execute('function add() { return 99; }')), [false, false]);
  });

  test('terminates a Worker that does not respond', async () => {
    const originalWindow = (globalThis as any).window;
    const originalWorker = (globalThis as any).Worker;
    class HangingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage() {}
      terminate() {}
    }
    (globalThis as any).window = { setTimeout, clearTimeout };
    (globalThis as any).Worker = HangingWorker;
    try {
      await assert.rejects(
        runJavascriptTests('function solve(value) { return value; }', [
          { id: 'one', input: '1', expectedOutput: '1', visible: true },
        ]),
        /exceeded 3 seconds/,
      );
    } finally {
      (globalThis as any).window = originalWindow;
      (globalThis as any).Worker = originalWorker;
    }
  });
});

describe('API key privacy', () => {
  test('stores BYOK credentials in session storage only', () => {
    setSessionApiKey('AIzaSy-example-session-only-key');
    assert.equal(getSessionApiKey(), 'AIzaSy-example-session-only-key');
    assert.equal(localStorage.getItem('user_custom_gemini_api_key'), null);
  });

  test('migrates and deletes legacy persistent keys', () => {
    localStorage.setItem('user_custom_gemini_api_key', 'legacy-key-value-with-enough-length');
    assert.equal(getSessionApiKey(), 'legacy-key-value-with-enough-length');
    assert.equal(localStorage.getItem('user_custom_gemini_api_key'), null);
  });
});

describe('long interview recovery', () => {
  const snapshot = (): ActiveInterviewSnapshot => ({
    transcripts: Array.from({ length: 1_300 }, (_, index) => ({
      speaker: index % 2 ? 'agent' as const : 'user' as const,
      text: `Turn ${index} ${'detail '.repeat(20)}`,
      timestamp: Date.now() + index,
    })),
    elapsedTime: 1_800,
    activeMode: 'CONVERSATION',
    codingProblems: [],
    currentProblemIndex: 0,
    settings: {
      role: 'Software Engineer',
      experienceLevel: 'Mid-Level',
      focusArea: 'Architecture',
      duration: 30,
      difficulty: 'Medium',
      interviewType: 'Practice Interview',
      personality: 'Neutral Professional',
    },
    timestamp: Date.now() - 1_000,
  });

  test('bounds transcript recovery data for a 30-minute session', () => {
    const compacted = compactActiveInterview(snapshot());
    assert.equal(compacted.elapsedTime, 1_800);
    assert.equal(compacted.transcripts.length, 1_200);
    assert.match(compacted.transcripts[0].text, /Turn 100/);
  });

  test('falls back to session storage when local quota is unavailable', () => {
    localMemory.failWrites = true;
    assert.equal(saveActiveInterview(snapshot()), true);
    assert.equal(localStorage.getItem(ACTIVE_INTERVIEW_KEY), null);
    assert.ok(sessionStorage.getItem(ACTIVE_INTERVIEW_KEY));
    assert.equal(loadActiveInterview()?.settings.duration, 30);
  });
});

describe('interview history persistence', () => {
  test('returns null instead of throwing when browser quota is unavailable', () => {
    localMemory.failWrites = true;
    const report = validateReport(validReport(), {
      role: 'Engineer',
      durationMinutes: 30,
      difficulty: 'Medium',
      resumeUploaded: false,
    });

    assert.equal(saveInterviewResult(report), null);
    assert.deepEqual(getInterviewHistory(), []);
  });

  test('retains only the latest 100 interview reports', () => {
    const report = validateReport(validReport(), {
      role: 'Engineer',
      durationMinutes: 30,
      difficulty: 'Medium',
      resumeUploaded: false,
    });
    for (let index = 0; index < 105; index += 1) {
      assert.ok(saveInterviewResult({ ...report, summary: `Session ${index}` }));
    }
    const history = getInterviewHistory();
    assert.equal(history.length, 100);
    assert.equal(history[0].feedback.summary, 'Session 104');
    assert.equal(history[99].feedback.summary, 'Session 5');
  });
});

describe('practice scoring and persistence', () => {
  test('does not score skipped diagnostic questions as incorrect', async () => {
    const questions: DiagnosticQuestion[] = [
      { id: 'answered', type: 'mcq', topic: 'scalability', prompt: 'A', options: ['x'], correctOption: 0 },
      { id: 'skipped', type: 'mcq', topic: 'scalability', prompt: 'B', options: ['x'], correctOption: 0 },
    ];
    const profile = await scoreDiagnostic(questions, [
      { questionId: 'answered', topic: 'scalability', type: 'mcq', selectedOption: 0 },
    ]);

    assert.equal(profile.topicScores.scalability, 100);
  });

  test('deduplicates repeated practice-session updates', () => {
    const baseline = createBaselineProfile();
    const score: SystemDesignScore = {
      scalabilityScore: 80,
      reliabilityScore: 70,
      dataConsistencyAwareness: 60,
      securityAwareness: 50,
      tradeoffArticulation: 75,
      missedConsiderations: [],
      strengths: [],
    };
    const once = updateProfileFromSystemDesignScore(baseline, 'session-1', score);
    const twice = updateProfileFromSystemDesignScore(once, 'session-1', score);

    assert.equal(twice.sessionHistory.length, 1);
    assert.deepEqual(twice.topicScores, once.topicScores);
  });

  test('clears the active pointer when a practice session completes', () => {
    const session: PracticeSession = {
      id: 'practice-1',
      problemId: 'url-shortener',
      diagramState: { nodes: [], edges: [], lastModified: Date.now() },
      coachTips: [],
      status: 'in-progress',
      timerEnabled: false,
      startedAt: Date.now(),
    };
    savePracticeSession(session);
    assert.equal(loadActivePracticeSession()?.id, session.id);

    savePracticeSession({ ...session, status: 'completed', completedAt: Date.now() });
    assert.equal(loadActivePracticeSession(), null);
  });

  test('returns false instead of throwing when optional practice storage is blocked', () => {
    localMemory.failWrites = true;
    const session: PracticeSession = {
      id: 'blocked-practice',
      problemId: 'url-shortener',
      diagramState: { nodes: [], edges: [], lastModified: Date.now() },
      coachTips: [],
      status: 'in-progress',
      timerEnabled: false,
      startedAt: Date.now(),
    };
    assert.equal(savePracticeSession(session), false);
    assert.equal(setResourceReviewed('resource-1', true), false);
  });

  test('rejects profile updates when browser storage is blocked', async () => {
    const baseline = createBaselineProfile();
    localMemory.failWrites = true;
    await assert.rejects(
      scoreDiagnostic([
        { id: 'one', type: 'mcq', topic: 'caching', prompt: 'One', options: ['yes'], correctOption: 0 },
      ], [
        { questionId: 'one', topic: 'caching', type: 'mcq', selectedOption: 0 },
      ]),
      /storage is unavailable/i,
    );
    assert.throws(() => updateProfileFromSystemDesignScore(baseline, 'blocked-session', {
      scalabilityScore: 50,
      reliabilityScore: 50,
      dataConsistencyAwareness: 50,
      securityAwareness: 50,
      tradeoffArticulation: 50,
      missedConsiderations: [],
      strengths: [],
    }), /storage is unavailable/i);
  });

  test('rejects baseline profile creation when browser storage is blocked', () => {
    localMemory.failWrites = true;
    assert.throws(() => createBaselineProfile('blocked-user'), /storage is unavailable/i);
  });
});

describe('routing and JSON extraction', () => {
  test('maps all public routes deterministically', () => {
    assert.equal(urlToView('/'), AppView.LANDING);
    assert.equal(urlToView('/interview'), AppView.INTERVIEW);
    assert.equal(urlToView('/practice'), AppView.PRACTICE_ARENA);
    assert.equal(urlToView('/dashboard'), AppView.DASHBOARD);
    assert.equal(urlToView('/open-source'), AppView.OPEN_SOURCE);
    assert.equal(viewToUrl(AppView.INTERVIEW), '/interview');
    assert.equal(viewToUrl(AppView.OPEN_SOURCE), '/open-source');
    assert.equal(viewToUrl(AppView.PRACTICE_ARENA), '/practice');
  });

  test('extracts a JSON object from fenced model output', () => {
    assert.deepEqual(parseJsonObject<{ ok: boolean }>('```json\n{"ok":true}\n```'), { ok: true });
  });
});

describe('session recommendations', () => {
  test('blind mode stays inside supported settings and excludes short sessions', () => {
    assert.deepEqual(randomizeBlindSettings(() => 0), {
      interviewType: 'Actual Interview',
      personality: 'Neutral Professional',
      difficulty: 'Easy',
      duration: 15,
    });
    assert.deepEqual(randomizeBlindSettings(() => 0.999999), {
      interviewType: 'Practice Interview',
      personality: 'Friendly Conversational',
      difficulty: 'Hard',
      duration: 30,
    });
  });

  test('ranks problems that overlap weak topics first and removes freeform', () => {
    const profile = createBaselineProfile();
    profile.topicScores = { ...profile.topicScores, caching: 10, messaging: 15, security: 20 };
    const templates = [
      { id: 'generic', title: 'Generic', promptText: 'Generic', difficulty: 'Easy' as const, suggestedComponents: [], topics: ['databases' as const] },
      { id: 'targeted', title: 'Targeted', promptText: 'Targeted', difficulty: 'Medium' as const, suggestedComponents: [], topics: ['caching' as const, 'messaging' as const] },
      { id: 'freeform', title: 'Freeform', promptText: 'Freeform', difficulty: 'Easy' as const, suggestedComponents: [] },
    ];
    const ranked = rankPracticeProblems(templates, profile);
    assert.equal(ranked[0].id, 'targeted');
    assert.equal(ranked.some(template => template.id === 'freeform'), false);
  });
});

describe('canvas history', () => {
  const snapshot = (index: number) => ({
    nodes: [{ id: `node-${index}`, componentType: 'client', label: `Node ${index}`, position: { x: index, y: index } }],
    edges: [],
  });

  test('caps history at 60 snapshots and retains the newest state', () => {
    let state: CanvasHistoryState = { history: [snapshot(0)], index: 0 };
    for (let index = 1; index <= 70; index += 1) state = appendCanvasSnapshot(state, snapshot(index));
    assert.equal(state.history.length, 60);
    assert.equal(state.history[0].nodes[0].id, 'node-11');
    assert.equal(state.history[59].nodes[0].id, 'node-70');
    assert.equal(state.index, 59);
  });

  test('drops the redo branch after editing an undone state', () => {
    let state: CanvasHistoryState = { history: [snapshot(0)], index: 0 };
    state = appendCanvasSnapshot(state, snapshot(1));
    state = appendCanvasSnapshot(state, snapshot(2));
    state = { ...state, index: 1 };
    state = appendCanvasSnapshot(state, snapshot(3));
    assert.deepEqual(state.history.map(item => item.nodes[0].id), ['node-0', 'node-1', 'node-3']);
    assert.equal(state.index, 2);
  });
});

describe('canvas viewport', () => {
  test('round-trips coordinates and keeps the zoom anchor fixed', () => {
    const viewport = { x: 80, y: 40, zoom: 1 };
    const world = screenToWorld({ x: 280, y: 190 }, viewport);
    assert.deepEqual(world, { x: 200, y: 150 });
    assert.deepEqual(worldToScreen(world, viewport), { x: 280, y: 190 });

    const zoomed = zoomViewportAt(viewport, 2, { x: 280, y: 190 });
    assert.deepEqual(worldToScreen(world, zoomed), { x: 280, y: 190 });
    assert.equal(zoomed.zoom, 2);
    assert.equal(zoomViewportAt(viewport, 99, { x: 0, y: 0 }).zoom, MAX_CANVAS_ZOOM);
    assert.equal(zoomViewportAt(viewport, 0.01, { x: 0, y: 0 }).zoom, MIN_CANVAS_ZOOM);
  });

  test('fits diagram bounds without mutating node coordinates', () => {
    const nodes = [
      { id: 'a', componentType: 'client', label: 'Client', position: { x: 100, y: 80 } },
      { id: 'b', componentType: 'sql_database', label: 'Database', position: { x: 900, y: 620 } },
    ];
    const before = JSON.stringify(nodes);
    const viewport = fitViewportToNodes(nodes, { width: 800, height: 500 }, { width: 150, height: 68 });

    assert.ok(viewport.zoom < 1);
    assert.equal(JSON.stringify(nodes), before);
    const first = worldToScreen(nodes[0].position, viewport);
    const second = worldToScreen({ x: 1050, y: 688 }, viewport);
    assert.ok(first.x >= 0 && first.y >= 0);
    assert.ok(second.x <= 800 && second.y <= 500);
  });
});

describe('advanced canvas utilities', () => {
  test('scores architecture coverage and improves as boundaries are added', () => {
    const initial = analyzeSystemDesign([
      { id: 'client', componentType: 'client', label: 'Client', position: { x: 0, y: 0 } },
    ], []);
    const complete = analyzeSystemDesign([
      { id: 'client', componentType: 'client', label: 'Client', position: { x: 0, y: 0 } },
      { id: 'gateway', componentType: 'api_gateway', label: 'Gateway', position: { x: 200, y: 0 } },
      { id: 'service', componentType: 'microservice', label: 'Service', position: { x: 400, y: 0 } },
      { id: 'database', componentType: 'sql_database', label: 'Database', position: { x: 600, y: 0 } },
      { id: 'cache', componentType: 'cache', label: 'Cache', position: { x: 600, y: 120 } },
    ], [
      { id: 'one', source: 'client', target: 'gateway', direction: 'oneway' },
      { id: 'two', source: 'gateway', target: 'service', direction: 'oneway' },
      { id: 'three', source: 'service', target: 'database', direction: 'oneway' },
    ]);

    assert.ok(initial.score < complete.score);
    assert.equal(complete.score, 100);
    assert.equal(initial.suggestions.some(suggestion => suggestion.componentType === 'client'), false);
  });

  test('changes suggestions by stress lens without repeating existing components', () => {
    const nodes = [
      { id: 'client', componentType: 'client', label: 'Client', position: { x: 0, y: 0 } },
      { id: 'service', componentType: 'microservice', label: 'Service', position: { x: 200, y: 0 } },
      { id: 'database', componentType: 'sql_database', label: 'Database', position: { x: 400, y: 0 } },
      { id: 'auth', componentType: 'auth_service', label: 'Auth', position: { x: 200, y: 120 } },
    ];
    const traffic = analyzeSystemDesign(nodes, [], 'traffic');
    const security = analyzeSystemDesign(nodes, [], 'security');

    assert.ok(traffic.suggestions.some(suggestion => suggestion.componentType === 'rate_limiter'));
    assert.ok(traffic.suggestions.some(suggestion => suggestion.componentType === 'cache'));
    assert.ok(security.suggestions.some(suggestion => suggestion.componentType === 'firewall'));
    assert.equal(security.suggestions.some(suggestion => suggestion.componentType === 'auth_service'), false);
  });

  test('auto-layout orders connected nodes into stable columns', () => {
    const nodes = [
      { id: 'db', componentType: 'sql_database', label: 'Database', position: { x: 0, y: 0 } },
      { id: 'client', componentType: 'client', label: 'Client', position: { x: 0, y: 0 } },
      { id: 'api', componentType: 'api_gateway', label: 'API', position: { x: 0, y: 0 } },
    ];
    const laidOut = autoLayoutSystemDesign(nodes, [
      { id: 'one', source: 'client', target: 'api', direction: 'oneway' },
      { id: 'two', source: 'api', target: 'db', direction: 'oneway' },
    ]);
    const byId = new Map(laidOut.map(node => [node.id, node]));
    assert.ok(byId.get('client')!.position.x < byId.get('api')!.position.x);
    assert.ok(byId.get('api')!.position.x < byId.get('db')!.position.x);
    assert.deepEqual(nodes.map(node => node.position), [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
  });

  test('exports labels, notes, directions, and XML-sensitive text as SVG', () => {
    const svg = buildSystemDesignSvg({
      nodes: [
        { id: 'a', componentType: 'client', label: 'Client <web>', position: { x: 0, y: 0 }, notes: 'HTTPS & auth' },
        { id: 'b', componentType: 'api_gateway', label: 'Gateway', position: { x: 240, y: 0 } },
      ],
      edges: [{ id: 'edge', source: 'a', target: 'b', label: 'request & response', direction: 'bidirectional' }],
      lastModified: 1,
    }, 'Checkout <v2>');

    assert.match(svg, /Checkout &lt;v2&gt;/);
    assert.match(svg, /Client &lt;web&gt;/);
    assert.match(svg, /HTTPS &amp; auth/);
    assert.match(svg, /request &amp; response/);
    assert.match(svg, /marker-start="url\(#arrow\)"/);
  });
});

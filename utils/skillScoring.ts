// utils/skillScoring.ts
// Diagnostic scoring and skill profile updates for Practice Arena.
import {
  DiagnosticAnswer,
  DiagnosticQuestion,
  SkillProfile,
  SkillTopic,
  SystemDesignScore,
} from '../types';
import { generateAiContent } from './aiClient';
import { parseJsonObject } from './json';

export const SKILL_TOPICS: SkillTopic[] = [
  'scalability',
  'databases',
  'caching',
  'messaging',
  'security',
  'networking',
  'consistency',
  'api_design',
];

export const TOPIC_LABELS: Record<SkillTopic, string> = {
  scalability: 'Scalability',
  databases: 'Databases',
  caching: 'Caching',
  messaging: 'Messaging',
  security: 'Security',
  networking: 'Networking/CDN',
  consistency: 'Consistency',
  api_design: 'API Design',
};

const emptyScores = (): Record<SkillTopic, number> =>
  SKILL_TOPICS.reduce((acc, topic) => ({ ...acc, [topic]: 45 }), {} as Record<SkillTopic, number>);

const clamp = (value: any): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return 45;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

export const loadSkillProfile = (userId = 'default_user'): SkillProfile | null => {
  try {
    const raw = localStorage.getItem(`practice_arena_skill_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveSkillProfile = (profile: SkillProfile): boolean => {
  try {
    localStorage.setItem(`practice_arena_skill_profile_${profile.userId}`, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
};

// Creates a neutral, balanced profile so a user can skip the diagnostic entirely
// and still get sensible recommendations that calibrate as they practice.
export const createBaselineProfile = (userId = 'default_user'): SkillProfile => {
  const existing = loadSkillProfile(userId);
  if (existing) return existing;
  const profile: SkillProfile = {
    userId,
    topicScores: emptyScores(),
    lastDiagnosticAt: 0,
    sessionHistory: [],
    summary: "You skipped the diagnostic — that's completely fine. We'll begin with a balanced plan and fine-tune it as you practice.",
  };
  if (!saveSkillProfile(profile)) {
    throw new Error('Browser storage is unavailable. Allow site storage to save your diagnostic profile.');
  }
  return profile;
};

export const getWeakTopics = (profile: SkillProfile, count = 3): SkillTopic[] =>
  [...SKILL_TOPICS]
    .sort((a, b) => (profile.topicScores[a] || 0) - (profile.topicScores[b] || 0))
    .slice(0, count);

const scoreMcqAnswers = (questions: DiagnosticQuestion[], answers: DiagnosticAnswer[]) => {
  const totals: Partial<Record<SkillTopic, { correct: number; total: number }>> = {};
  for (const question of questions.filter(q => q.type === 'mcq')) {
    const answer = answers.find(a => a.questionId === question.id);
    if (answer?.selectedOption === undefined) continue;
    const bucket = totals[question.topic] || { correct: 0, total: 0 };
    bucket.total += 1;
    if (answer?.selectedOption === question.correctOption) bucket.correct += 1;
    totals[question.topic] = bucket;
  }
  return totals;
};

const heuristicFreeTextScores = (questions: DiagnosticQuestion[], answers: DiagnosticAnswer[]) => {
  const scores: Partial<Record<SkillTopic, number[]>> = {};
  for (const question of questions.filter(q => q.type === 'freetext')) {
    const answer = answers.find(a => a.questionId === question.id)?.text || '';
    if (!answer.trim()) continue;
    const words = answer.trim().split(/\s+/).filter(Boolean).length;
    const conceptHits = [
      /trade.?off/i,
      /replica|replication|shard|partition/i,
      /latency|throughput|bottleneck/i,
      /consistency|stale|invalidation/i,
      /retry|queue|async|idempot/i,
      /auth|token|rate.?limit|permission/i,
      /cache|cdn/i,
    ].filter(pattern => pattern.test(answer)).length;
    const score = Math.min(85, 25 + words * 3 + conceptHits * 8);
    scores[question.topic] = [...(scores[question.topic] || []), score];
  }
  return scores;
};

export const scoreDiagnostic = async (
  questions: DiagnosticQuestion[],
  answers: DiagnosticAnswer[],
  userId = 'default_user'
): Promise<SkillProfile> => {
  const mcq = scoreMcqAnswers(questions, answers);
  const heuristic = heuristicFreeTextScores(questions, answers);
  let aiScores: Partial<Record<SkillTopic, number>> = {};
  let summary = '';

  const freeTextAnswers = answers.filter(a => a.type === 'freetext' && a.text?.trim());
  if (freeTextAnswers.length > 0) {
    try {
      const prompt = `You are scoring a low-pressure system design diagnostic. Return ONLY JSON.
Topics: ${SKILL_TOPICS.join(', ')}.
Score each topic 0-100 using the free-text answers. Be constructive; this is for learning, not pass/fail.

Questions and answers:
${questions
  .filter(q => q.type === 'freetext')
  .map(q => `${q.topic} | ${q.prompt}\nAnswer: ${answers.find(a => a.questionId === q.id)?.text || '(blank)'}`)
  .join('\n\n')}

Shape:
{
  "topicScores": { "scalability": number, "databases": number, "caching": number, "messaging": number, "security": number, "networking": number, "consistency": number, "api_design": number },
  "summary": "3-4 constructive sentences"
}`;
      const result = await generateAiContent({
        prompt,
        responseMimeType: 'application/json',
      });
      if (result.text) {
        const parsed = parseJsonObject<{ topicScores?: Partial<Record<SkillTopic, number>>; summary?: unknown }>(result.text);
        aiScores = parsed.topicScores || {};
        summary = typeof parsed.summary === 'string' ? parsed.summary : '';
      }
    } catch (err) {
      console.warn('Diagnostic AI scoring unavailable; using local scoring fallback.', err);
    }
  }

  const topicScores = emptyScores();
  for (const topic of SKILL_TOPICS) {
    const pieces: number[] = [];
    const mcqBucket = mcq[topic];
    if (mcqBucket?.total) pieces.push((mcqBucket.correct / mcqBucket.total) * 100);
    if (heuristic[topic]?.length) pieces.push(heuristic[topic]!.reduce((a, b) => a + b, 0) / heuristic[topic]!.length);
    if (aiScores[topic] !== undefined) pieces.push(clamp(aiScores[topic]));
    topicScores[topic] = pieces.length ? clamp(pieces.reduce((a, b) => a + b, 0) / pieces.length) : topicScores[topic];
  }

  if (!summary) {
    const weak = [...SKILL_TOPICS].sort((a, b) => topicScores[a] - topicScores[b]).slice(0, 2).map(t => TOPIC_LABELS[t]);
    const strong = [...SKILL_TOPICS].sort((a, b) => topicScores[b] - topicScores[a]).slice(0, 2).map(t => TOPIC_LABELS[t]);
    summary = `You're building from a solid starting point in ${strong.join(' and ')}. The next best practice areas are ${weak.join(' and ')}, where targeted examples will help your diagrams become easier to justify. Use the resources below, then apply one idea immediately on the canvas.`;
  }

  const profile: SkillProfile = {
    userId,
    topicScores,
    lastDiagnosticAt: Date.now(),
    sessionHistory: loadSkillProfile(userId)?.sessionHistory || [],
    summary,
  };
  if (!saveSkillProfile(profile)) {
    throw new Error('Browser storage is unavailable. Allow site storage to save your diagnostic profile.');
  }
  return profile;
};

export const updateProfileFromSystemDesignScore = (
  profile: SkillProfile,
  sessionId: string,
  score: SystemDesignScore
): SkillProfile => {
  if (profile.sessionHistory.some(item => item.sessionId === sessionId)) return profile;
  const mapped: Partial<Record<SkillTopic, number>> = {
    scalability: score.scalabilityScore,
    databases: Math.round((score.reliabilityScore + score.dataConsistencyAwareness) / 2),
    consistency: score.dataConsistencyAwareness,
    security: score.securityAwareness,
    api_design: score.tradeoffArticulation,
  };

  const nextScores = { ...profile.topicScores };
  const deltaByTopic: Partial<Record<SkillTopic, number>> = {};
  for (const [topic, value] of Object.entries(mapped) as [SkillTopic, number][]) {
    const before = nextScores[topic] || 45;
    const after = clamp(before * 0.75 + value * 0.25);
    nextScores[topic] = after;
    deltaByTopic[topic] = after - before;
  }

  const next: SkillProfile = {
    ...profile,
    topicScores: nextScores,
    sessionHistory: [{ sessionId, date: Date.now(), deltaByTopic }, ...profile.sessionHistory].slice(0, 40),
  };
  if (!saveSkillProfile(next)) {
    throw new Error('Browser storage is unavailable. Allow site storage to save your practice progress.');
  }
  return next;
};

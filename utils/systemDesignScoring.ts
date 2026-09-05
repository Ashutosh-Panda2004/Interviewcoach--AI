// utils/systemDesignScoring.ts
// -----------------------------------------------------------------------------
// End-of-session structured evaluation of a system design diagram.
// Sends the serialized diagram + transcript to Gemini and requests a strict
// JSON SystemDesignScore object.
// -----------------------------------------------------------------------------

import { SystemDesignState, SystemDesignScore, TranscriptionItem } from '../types';
import { serializeState } from './systemDesignSerializer';
import { generateAiContent } from './aiClient';
import { parseJsonObject } from './json';

export interface ScoreOptions {
  scenario?: string;
  experienceLevel?: string;
}

const clamp = (v: any): number => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const localScore = (state: SystemDesignState, transcripts: TranscriptionItem[]): SystemDesignScore => {
  const types = new Set(state.nodes.map(node => node.componentType));
  const connectedNodes = new Set(state.edges.flatMap(edge => [edge.source, edge.target])).size;
  const coverage = state.nodes.length ? connectedNodes / state.nodes.length : 0;
  const hasScale = types.has('load_balancer') || types.has('cdn') || types.has('cache');
  const hasReliability = types.has('message_queue') || types.has('pub_sub') || types.has('load_balancer');
  const hasData = types.has('sql_database') || types.has('nosql_database');
  const hasSecurity = types.has('auth_service') || types.has('firewall') || types.has('rate_limiter');
  const spokenWords = transcripts
    .filter(item => item.speaker === 'user')
    .reduce((total, item) => total + item.text.trim().split(/\s+/).filter(Boolean).length, 0);
  const base = Math.min(60, state.nodes.length * 6 + state.edges.length * 4);

  return {
    scalabilityScore: clamp(base + (hasScale ? 25 : 0)),
    reliabilityScore: clamp(base + (hasReliability ? 25 : 0)),
    dataConsistencyAwareness: clamp(base + (hasData ? 20 : 0)),
    securityAwareness: clamp(base + (hasSecurity ? 30 : 0)),
    tradeoffArticulation: clamp(Math.min(80, spokenWords / 2)),
    missedConsiderations: [
      !hasScale && 'Show how the design handles traffic growth.',
      !hasReliability && 'Address failure recovery and asynchronous work.',
      !hasData && 'Choose a data store and explain the consistency model.',
      !hasSecurity && 'Add authentication, authorization, or abuse protection.',
      coverage < 0.8 && 'Connect isolated components into complete request paths.',
    ].filter((value): value is string => Boolean(value)),
    strengths: [
      state.nodes.length >= 4 && 'The design identifies several distinct responsibilities.',
      coverage >= 0.8 && 'Most components participate in a clear data flow.',
    ].filter((value): value is string => Boolean(value)),
  };
};

/**
 * Evaluate the final diagram and the candidate's verbal reasoning.
 * Never throws — returns a safe default on any failure.
 */
export const scoreSystemDesign = async (
  state: SystemDesignState,
  transcripts: TranscriptionItem[],
  opts: ScoreOptions = {}
): Promise<SystemDesignScore> => {
  const fallback = localScore(state, transcripts);
  try {
    const diagram = serializeState(state);
    const transcript = transcripts
      .slice(-80)
      .map(t => `${t.speaker === 'user' ? 'CANDIDATE' : 'INTERVIEWER'}: ${t.text}`)
      .join('\n')
      .slice(0, 40000);

    const scenario = opts.scenario || 'a system design problem';

    const prompt = `You are a staff-level engineer grading a system design interview.
Scenario: ${scenario}
Seniority: ${opts.experienceLevel || 'Mid-Level'}

FINAL DIAGRAM (structured): ${diagram}

TRANSCRIPT (verbal reasoning):
${transcript || '(no transcript captured)'}

Evaluate the design and the candidate's spoken reasoning. Reward explaining WHY (tradeoffs), not just placing boxes. Penalize single points of failure, missing caching/scaling, weak data-consistency or security thinking.

Return ONLY a JSON object with this exact shape (numbers 0-100, arrays of short strings):
{
  "scalabilityScore": number,
  "reliabilityScore": number,
  "dataConsistencyAwareness": number,
  "securityAwareness": number,
  "tradeoffArticulation": number,
  "missedConsiderations": string[],
  "strengths": string[]
}`;

    const result = await generateAiContent({
      prompt,
      responseMimeType: 'application/json',
    });

    const parsed = parseJsonObject<Record<string, unknown>>(result.text);

    return {
      scalabilityScore: clamp(parsed.scalabilityScore),
      reliabilityScore: clamp(parsed.reliabilityScore),
      dataConsistencyAwareness: clamp(parsed.dataConsistencyAwareness),
      securityAwareness: clamp(parsed.securityAwareness),
      tradeoffArticulation: clamp(parsed.tradeoffArticulation),
      missedConsiderations: Array.isArray(parsed.missedConsiderations)
        ? parsed.missedConsiderations.filter((s: any) => typeof s === 'string').slice(0, 8)
        : [],
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.filter((s: any) => typeof s === 'string').slice(0, 8)
        : [],
    };
  } catch (err) {
    console.warn('AI system design scoring unavailable; using local rubric.', err);
    return fallback;
  }
};

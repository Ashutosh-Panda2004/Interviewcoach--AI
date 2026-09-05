// utils/practiceCoach.ts
// On-demand written coaching for Practice Arena.
import { CoachTip, PracticeSession, SystemDesignState, SystemDesignTemplate } from '../types';
import { serializeState } from './systemDesignSerializer';
import { generateAiContent } from './aiClient';
import { parseJsonObject } from './json';

export const askPracticeCoach = async (
  session: PracticeSession,
  diagramState: SystemDesignState,
  problem: SystemDesignTemplate
): Promise<CoachTip> => {
  const fallbackMessage = buildLocalTip(diagramState);
  try {
    const prompt = `You are a calm system design coach in a self-paced practice arena. The student explicitly clicked Ask Coach, so give written feedback.
Problem: ${problem.title}
Prompt: ${problem.promptText}
Diagram: ${serializeState(diagramState)}

Return ONLY JSON:
{
  "message": "2-4 concise coaching sentences. Mention one strength and one next action. No shame framing.",
  "relatedNodeId": "optional node id or empty string"
}`;
    const result = await generateAiContent({
      prompt,
      responseMimeType: 'application/json',
    });
    if (result.text) {
      const parsed = parseJsonObject<{ message?: unknown; relatedNodeId?: unknown }>(result.text);
      return {
        id: crypto.randomUUID(),
        sessionId: session.id,
        timestamp: Date.now(),
        trigger: 'on-demand',
        message: typeof parsed.message === 'string' && parsed.message.trim() ? parsed.message.trim() : fallbackMessage,
        relatedNodeId: typeof parsed.relatedNodeId === 'string' && parsed.relatedNodeId
          ? parsed.relatedNodeId
          : undefined,
      };
    }
  } catch (err) {
    console.warn('Practice coach unavailable; using local coaching fallback.', err);
  }

  return {
    id: crypto.randomUUID(),
    sessionId: session.id,
    timestamp: Date.now(),
    trigger: 'on-demand',
    message: fallbackMessage,
  };
};

const buildLocalTip = (state: SystemDesignState): string => {
  const types = new Set(state.nodes.map(n => n.componentType));
  if (state.nodes.length === 0) return 'Start with the main user/client and the first backend entry point. Once those are placed, connect the request path before adding data stores.';
  if (!types.has('load_balancer') && state.nodes.length >= 4) return 'You have a few moving parts now. A good next step is to show how traffic is distributed and what happens if one server fails.';
  if (!types.has('cache') && state.nodes.length >= 6) return 'The design is growing. Consider where a cache or CDN would reduce read latency, and be ready to explain the invalidation tradeoff.';
  if (!types.has('message_queue') && !types.has('pub_sub') && state.nodes.length >= 7) return 'Look for any slow or spiky work that does not need to block the user request. A queue or pub/sub path can make that tradeoff visible.';
  return 'The diagram has a reasonable shape. Your next improvement is to label one or two edges with the data flow or scale assumption so your tradeoffs are easier to defend.';
};

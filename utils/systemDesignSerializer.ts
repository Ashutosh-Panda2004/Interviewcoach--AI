// utils/systemDesignSerializer.ts
// -----------------------------------------------------------------------------
// Converts a structured diagram state / diff into a compact, human-readable
// description suitable for injecting into the Gemini Live conversational context.
// The structured text is the source of truth the model reasons over (a PNG
// snapshot, if sent, is only a visual sanity-check supplement).
// -----------------------------------------------------------------------------

import { SystemDesignState, SystemDesignDiff, SystemDesignNode, SystemDesignEdge } from '../types';

const nodeLabel = (node: SystemDesignNode | undefined): string =>
  node ? node.label || node.componentType.replace(/_/g, ' ') : 'unknown';

/**
 * Produce a full natural-language description of the current diagram.
 * Example: "Client -> Load Balancer -> Web Server -> Cache; Web Server -> SQL Database."
 */
export const serializeState = (state: SystemDesignState): string => {
  if (!state.nodes.length) return 'The canvas is currently empty.';

  const nodeMap = new Map(state.nodes.map(n => [n.id, n]));

  const componentList = state.nodes
    .map(n => nodeLabel(n))
    .join(', ');

  const connectionList = state.edges.length
    ? state.edges
        .map((e: SystemDesignEdge) => {
          const arrow = e.direction === 'bidirectional' ? '<->' : '->';
          const label = e.label ? ` [${e.label}]` : '';
          return `${nodeLabel(nodeMap.get(e.source))} ${arrow} ${nodeLabel(nodeMap.get(e.target))}${label}`;
        })
        .join('; ')
    : 'no connections drawn yet';

  const notes = state.nodes
    .filter(n => n.notes && n.notes.trim().length > 0)
    .map(n => `${nodeLabel(n)}: "${n.notes!.trim()}"`);

  let out = `Components (${state.nodes.length}): ${componentList}. Connections: ${connectionList}.`;
  if (notes.length) out += ` Candidate notes — ${notes.join('; ')}.`;
  return out;
};

/** Produce a short description of only what changed this turn. */
export const serializeDiff = (diff: SystemDesignDiff): string => {
  if (!diff.hasChanges) return '';

  const parts: string[] = [];

  if (diff.addedNodes.length) {
    parts.push(`added ${diff.addedNodes.map(n => nodeLabel(n)).join(', ')}`);
  }
  if (diff.removedNodes.length) {
    parts.push(`removed ${diff.removedNodes.map(n => nodeLabel(n)).join(', ')}`);
  }
  if (diff.relabeledNodes.length) {
    parts.push(
      `renamed ${diff.relabeledNodes.map(r => `"${r.from}" to "${r.to}"`).join(', ')}`
    );
  }
  if (diff.addedEdges.length) {
    parts.push(`${diff.addedEdges.length} new connection(s)`);
  }
  if (diff.removedEdges.length) {
    parts.push(`${diff.removedEdges.length} connection(s) removed`);
  }

  return parts.length ? `New this turn: ${parts.join('; ')}.` : '';
};

/**
 * Build the full context string injected into the live session as a silent
 * system event. Combines the current full state with the recent diff.
 */
export const buildDiagramContextMessage = (
  state: SystemDesignState,
  diff: SystemDesignDiff,
  isFirstSend: boolean
): string => {
  const full = serializeState(state);
  const change = isFirstSend ? '' : serializeDiff(diff);
  return `[SYSTEM_EVENT: SYSTEM_DESIGN_DIAGRAM_UPDATE] The candidate's system design diagram now looks like this. ${full} ${change} Glance at it like a whiteboard: acknowledge what is there and probe gaps (single points of failure, scaling bottlenecks, data consistency, security). Do NOT interrupt the candidate mid-sentence — weave this into your next natural turn.`.trim();
};

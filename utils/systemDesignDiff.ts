// utils/systemDesignDiff.ts
// -----------------------------------------------------------------------------
// Diffing logic between two system-design diagram states.
// Used to decide whether a change is worth sending to the live model, and to
// produce a compact "what changed this turn" summary for the serializer.
// -----------------------------------------------------------------------------

import { SystemDesignState, SystemDesignDiff } from '../types';

const EMPTY_STATE: SystemDesignState = { nodes: [], edges: [], lastModified: 0 };

/**
 * Compute a structured diff between a previous and current diagram state.
 * Node position changes are intentionally ignored (they are visual noise and
 * not semantically meaningful to the interviewer).
 */
export const diffSystemDesign = (
  prev: SystemDesignState | null,
  next: SystemDesignState
): SystemDesignDiff => {
  const previous = prev || EMPTY_STATE;

  const prevNodeMap = new Map(previous.nodes.map(n => [n.id, n]));
  const nextNodeMap = new Map(next.nodes.map(n => [n.id, n]));
  const prevEdgeMap = new Map(previous.edges.map(e => [e.id, e]));
  const nextEdgeMap = new Map(next.edges.map(e => [e.id, e]));

  const addedNodes = next.nodes.filter(n => !prevNodeMap.has(n.id));
  const removedNodes = previous.nodes.filter(n => !nextNodeMap.has(n.id));

  const relabeledNodes = next.nodes
    .filter(n => prevNodeMap.has(n.id) && prevNodeMap.get(n.id)!.label !== n.label)
    .map(n => ({ id: n.id, from: prevNodeMap.get(n.id)!.label, to: n.label }));

  const addedEdges = next.edges.filter(e => !prevEdgeMap.has(e.id));
  const removedEdges = previous.edges.filter(e => !nextEdgeMap.has(e.id));

  // Edge relabels are surfaced as removed+added for simplicity; catch pure label changes too.
  const relabeledEdges = next.edges.filter(
    e => prevEdgeMap.has(e.id) && prevEdgeMap.get(e.id)!.label !== e.label
  );

  const hasChanges =
    addedNodes.length > 0 ||
    removedNodes.length > 0 ||
    relabeledNodes.length > 0 ||
    addedEdges.length > 0 ||
    removedEdges.length > 0 ||
    relabeledEdges.length > 0;

  return {
    addedNodes,
    removedNodes,
    relabeledNodes,
    addedEdges: [...addedEdges, ...relabeledEdges.filter(e => !addedEdges.includes(e))],
    removedEdges,
    hasChanges,
  };
};

/** True when a diff is significant enough to bother sending to the model. */
export const isMeaningfulDiff = (diff: SystemDesignDiff): boolean => diff.hasChanges;

import { SystemDesignEdge, SystemDesignNode } from '../types';

export interface CanvasSnapshot {
  nodes: SystemDesignNode[];
  edges: SystemDesignEdge[];
}

export interface CanvasHistoryState {
  history: CanvasSnapshot[];
  index: number;
}

export const cloneCanvasSnapshot = (snapshot: CanvasSnapshot): CanvasSnapshot => ({
  nodes: snapshot.nodes.map(node => ({ ...node, position: { ...node.position } })),
  edges: snapshot.edges.map(edge => ({ ...edge })),
});

export const appendCanvasSnapshot = (
  state: CanvasHistoryState,
  snapshot: CanvasSnapshot,
  limit = 60,
): CanvasHistoryState => {
  const next = cloneCanvasSnapshot(snapshot);
  const current = state.history[state.index];
  if (current && JSON.stringify(current) === JSON.stringify(next)) return state;
  const history = [...state.history.slice(0, state.index + 1), next].slice(-Math.max(1, limit));
  return { history, index: history.length - 1 };
};

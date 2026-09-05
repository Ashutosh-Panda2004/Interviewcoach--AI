import { SystemDesignEdge, SystemDesignNode } from '../types';

const COLUMN_GAP = 260;
const ROW_GAP = 126;
const ORIGIN_X = 140;
const ORIGIN_Y = 120;

const snap = (value: number, grid = 20) => Math.round(value / grid) * grid;

export const autoLayoutSystemDesign = (
  nodes: SystemDesignNode[],
  edges: SystemDesignEdge[],
): SystemDesignNode[] => {
  if (nodes.length < 2) return nodes.map(node => ({ ...node, position: { ...node.position } }));

  const ids = new Set(nodes.map(node => node.id));
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]));

  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    outgoing.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  }

  const levels = new Map<string, number>();
  const queue = nodes.filter(node => (incoming.get(node.id) || 0) === 0).map(node => node.id);
  if (!queue.length) queue.push(nodes[0].id);
  queue.forEach(id => levels.set(id, 0));

  while (queue.length) {
    const id = queue.shift()!;
    const level = levels.get(id) || 0;
    for (const target of outgoing.get(id) || []) {
      levels.set(target, Math.max(levels.get(target) || 0, level + 1));
      incoming.set(target, Math.max(0, (incoming.get(target) || 0) - 1));
      if (incoming.get(target) === 0) queue.push(target);
    }
  }

  let fallbackLevel = Math.max(0, ...levels.values());
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      fallbackLevel += 1;
      levels.set(node.id, fallbackLevel);
    }
  }

  const groups = new Map<number, SystemDesignNode[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) || 0;
    groups.set(level, [...(groups.get(level) || []), node]);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [level, group] of [...groups.entries()].sort(([a], [b]) => a - b)) {
    const height = Math.max(0, (group.length - 1) * ROW_GAP);
    group
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((node, index) => {
        positions.set(node.id, {
          x: snap(ORIGIN_X + level * COLUMN_GAP),
          y: snap(ORIGIN_Y - height / 2 + index * ROW_GAP),
        });
      });
  }

  const minY = Math.min(...[...positions.values()].map(position => position.y));
  const yOffset = minY < 40 ? 40 - minY : 0;
  return nodes.map(node => {
    const position = positions.get(node.id) || node.position;
    return { ...node, position: { x: position.x, y: position.y + yOffset } };
  });
};

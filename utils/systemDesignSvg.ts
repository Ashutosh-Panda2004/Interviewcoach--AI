import { SystemDesignState } from '../types';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 76;
const PADDING = 64;

const xml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export const buildSystemDesignSvg = (state: SystemDesignState, title = 'System Design'): string => {
  const nodes = state.nodes;
  const minX = nodes.length ? Math.min(...nodes.map(node => node.position.x)) : 0;
  const minY = nodes.length ? Math.min(...nodes.map(node => node.position.y)) : 0;
  const maxX = nodes.length ? Math.max(...nodes.map(node => node.position.x + NODE_WIDTH)) : 640;
  const maxY = nodes.length ? Math.max(...nodes.map(node => node.position.y + NODE_HEIGHT)) : 360;
  const width = Math.max(640, maxX - minX + PADDING * 2);
  const height = Math.max(360, maxY - minY + PADDING * 2 + 44);
  const offsetX = PADDING - minX;
  const offsetY = PADDING + 44 - minY;
  const map = new Map(nodes.map(node => [node.id, node]));

  const edges = state.edges.map(edge => {
    const source = map.get(edge.source);
    const target = map.get(edge.target);
    if (!source || !target) return '';
    const x1 = source.position.x + offsetX + NODE_WIDTH / 2;
    const y1 = source.position.y + offsetY + NODE_HEIGHT / 2;
    const x2 = target.position.x + offsetX + NODE_WIDTH / 2;
    const y2 = target.position.y + offsetY + NODE_HEIGHT / 2;
    const markerStart = edge.direction === 'bidirectional' ? ' marker-start="url(#arrow)"' : '';
    const label = edge.label
      ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" class="edge-label">${xml(edge.label)}</text>`
      : '';
    return `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#arrow)"${markerStart}/>${label}</g>`;
  }).join('');

  const nodeMarkup = nodes.map(node => {
    const x = node.position.x + offsetX;
    const y = node.position.y + offsetY;
    const note = node.notes?.trim()
      ? `<text x="${x + 14}" y="${y + 51}" class="note">${xml(node.notes.trim().slice(0, 72))}</text>`
      : '';
    return `<g><rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="6"/><text x="${x + 14}" y="${y + 30}" class="label">${xml(node.label)}</text>${note}</g>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#70e1c1"/></marker></defs>
  <style>svg{background:#0d1113}line{stroke:#70e1c1;stroke-width:2}rect{fill:#172023;stroke:#64736f;stroke-width:1.5}.title{fill:#f4f7f6;font:600 22px Georgia,serif}.label{fill:#f4f7f6;font:600 13px sans-serif}.note{fill:#8a9995;font:10px sans-serif}.edge-label{fill:#c8d1ce;font:10px sans-serif;text-anchor:middle}</style>
  <text x="${PADDING}" y="36" class="title">${xml(title)}</text>
  ${edges}${nodeMarkup}
</svg>`;
};

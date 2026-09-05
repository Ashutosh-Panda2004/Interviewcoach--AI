import { SystemDesignNode } from '../types';

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_CANVAS_ZOOM = 0.35;
export const MAX_CANVAS_ZOOM = 2.5;

export const clampCanvasZoom = (zoom: number) =>
  Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, zoom));

export const screenToWorld = (point: Point, viewport: CanvasViewport): Point => ({
  x: (point.x - viewport.x) / viewport.zoom,
  y: (point.y - viewport.y) / viewport.zoom,
});

export const worldToScreen = (point: Point, viewport: CanvasViewport): Point => ({
  x: point.x * viewport.zoom + viewport.x,
  y: point.y * viewport.zoom + viewport.y,
});

export const zoomViewportAt = (
  viewport: CanvasViewport,
  requestedZoom: number,
  anchor: Point,
): CanvasViewport => {
  const zoom = clampCanvasZoom(requestedZoom);
  const worldAnchor = screenToWorld(anchor, viewport);
  return {
    zoom,
    x: anchor.x - worldAnchor.x * zoom,
    y: anchor.y - worldAnchor.y * zoom,
  };
};

export const fitViewportToNodes = (
  nodes: SystemDesignNode[],
  canvas: { width: number; height: number },
  node: { width: number; height: number },
  padding = 72,
): CanvasViewport => {
  if (!nodes.length || canvas.width <= 0 || canvas.height <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const minX = Math.min(...nodes.map(item => item.position.x));
  const minY = Math.min(...nodes.map(item => item.position.y));
  const maxX = Math.max(...nodes.map(item => item.position.x + node.width));
  const maxY = Math.max(...nodes.map(item => item.position.y + node.height));
  const contentWidth = Math.max(node.width, maxX - minX);
  const contentHeight = Math.max(node.height, maxY - minY);
  const zoom = clampCanvasZoom(Math.min(
    (canvas.width - padding * 2) / contentWidth,
    (canvas.height - padding * 2) / contentHeight,
    1.35,
  ));

  return {
    zoom,
    x: (canvas.width - contentWidth * zoom) / 2 - minX * zoom,
    y: (canvas.height - contentHeight * zoom) / 2 - minY * zoom,
  };
};
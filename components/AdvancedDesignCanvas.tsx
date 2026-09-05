// World-space architecture editor with independent viewport state. Diagram
// coordinates remain stable while users zoom, pan, fit, arrange, and export.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  BrainCircuit,
  CircleHelp,
  Copy,
  FileJson,
  Grid3X3,
  ImageDown,
  Link2,
  Maximize2,
  Minus,
  MousePointer2,
  Move,
  PanelLeftOpen,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  SystemDesignComponentDef,
  SystemDesignEdge,
  SystemDesignNode,
  SystemDesignState,
} from '../types';
import componentsData from '../data/system-design-components.json';
import SystemDesignPalette from './SystemDesignPalette';
import { resolveSystemDesignIcon } from '../utils/systemDesignIcons';
import {
  appendCanvasSnapshot,
  cloneCanvasSnapshot,
  type CanvasSnapshot,
} from '../utils/canvasHistory';
import {
  fitViewportToNodes,
  screenToWorld,
  zoomViewportAt,
  type CanvasViewport,
} from '../utils/canvasViewport';
import { autoLayoutSystemDesign } from '../utils/canvasLayout';
import { analyzeSystemDesign, type BrainstormLens } from '../utils/canvasBrainstorm';
import { buildSystemDesignSvg } from '../utils/systemDesignSvg';

const COMPONENTS = componentsData as SystemDesignComponentDef[];
const COMPONENT_MAP = new Map(COMPONENTS.map(component => [component.id, component]));

const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;
const WORLD_WIDTH = 4_200;
const WORLD_HEIGHT = 3_000;
const GRID_SIZE = 20;
const DEFAULT_STARTER = ['client', 'api_gateway', 'microservice', 'cache', 'sql_database'];

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const snap = (value: number, enabled: boolean) => enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;

interface AdvancedDesignCanvasProps {
  scenarioTitle?: string;
  suggestedComponents?: string[];
  initialState?: SystemDesignState | null;
  onStateChange?: (state: SystemDesignState) => void;
}

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface ConnectState {
  sourceId: string;
  cursor: { x: number; y: number };
}

interface PanState {
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
}

const AdvancedDesignCanvas: React.FC<AdvancedDesignCanvasProps> = ({
  scenarioTitle,
  suggestedComponents = [],
  initialState,
  onStateChange,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [nodes, setNodes] = useState<SystemDesignNode[]>(initialState?.nodes ?? []);
  const [edges, setEdges] = useState<SystemDesignEdge[]>(initialState?.edges ?? []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [canvasMessage, setCanvasMessage] = useState<string | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 32, y: 32, zoom: 1 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [brainstormOpen, setBrainstormOpen] = useState(false);
  const [brainstormLens, setBrainstormLens] = useState<BrainstormLens>('balanced');
  const [spacePressed, setSpacePressed] = useState(false);
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);

  const historyRef = useRef<CanvasSnapshot[]>([
    cloneCanvasSnapshot({ nodes: initialState?.nodes ?? [], edges: initialState?.edges ?? [] }),
  ]);
  const historyIndexRef = useRef(0);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringHistoryRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const connectRef = useRef<ConnectState | null>(null);
  const viewportRef = useRef(viewport);
  const spacePressedRef = useRef(false);
  const didInitialFitRef = useRef(false);
  const previousCanvasSizeRef = useRef({ width: 0, height: 0 });

  viewportRef.current = viewport;
  connectRef.current = connect;
  spacePressedRef.current = spacePressed;

  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  const selectedEdge = edges.find(edge => edge.id === selectedEdgeId);
  const brainstorm = useMemo(
    () => analyzeSystemDesign(nodes, edges, brainstormLens, scenarioTitle),
    [brainstormLens, edges, nodes, scenarioTitle],
  );
  const canUndo = historyRevision >= 0 && historyIndexRef.current > 0;
  const canRedo = historyRevision >= 0 && historyIndexRef.current < historyRef.current.length - 1;

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  useEffect(() => {
    onStateChangeRef.current?.({ nodes, edges, lastModified: Date.now() });
  }, [nodes, edges]);

  useEffect(() => {
    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      return;
    }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      const appended = appendCanvasSnapshot(
        { history: historyRef.current, index: historyIndexRef.current },
        { nodes, edges },
      );
      if (appended.history === historyRef.current) return;
      historyRef.current = appended.history;
      historyIndexRef.current = appended.index;
      setHistoryRevision(value => value + 1);
    }, 280);
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    };
  }, [nodes, edges]);

  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const worldPoint = useCallback((clientX: number, clientY: number) =>
    screenToWorld(canvasPoint(clientX, clientY), viewportRef.current), [canvasPoint]);

  const fitView = useCallback((targetNodes = nodes) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setViewport(fitViewportToNodes(
      targetNodes,
      { width: rect.width, height: rect.height },
      { width: NODE_WIDTH, height: NODE_HEIGHT },
    ));
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0]?.contentRect;
      if (!bounds) return;
      setCanvasSize({ width: bounds.width, height: bounds.height });
      const previous = previousCanvasSizeRef.current;
      const substantialResize = previous.width > 0 && (
        Math.abs(previous.width - bounds.width) > 120 ||
        Math.abs(previous.height - bounds.height) > 120
      );
      if (nodes.length && bounds.width > 0 && bounds.height > 0 && (!didInitialFitRef.current || substantialResize)) {
        didInitialFitRef.current = true;
        setViewport(fitViewportToNodes(
          nodes,
          { width: bounds.width, height: bounds.height },
          { width: NODE_WIDTH, height: NODE_HEIGHT },
        ));
      }
      previousCanvasSizeRef.current = { width: bounds.width, height: bounds.height };
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [nodes]);

  const resetViewport = useCallback(() => setViewport({ x: 32, y: 32, zoom: 1 }), []);

  const changeZoom = useCallback((requestedZoom: number, anchor?: { x: number; y: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = anchor || { x: rect.width / 2, y: rect.height / 2 };
    setViewport(current => zoomViewportAt(current, requestedZoom, point));
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const anchor = canvasPoint(event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * 0.0014);
    setViewport(current => zoomViewportAt(current, current.zoom * factor, anchor));
  }, [canvasPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const placeNode = useCallback((componentType: string, x: number, y: number) => {
    const definition = COMPONENT_MAP.get(componentType);
    if (!definition) return;
    const position = {
      x: clamp(snap(x - NODE_WIDTH / 2, gridEnabled), 0, WORLD_WIDTH - NODE_WIDTH),
      y: clamp(snap(y - NODE_HEIGHT / 2, gridEnabled), 0, WORLD_HEIGHT - NODE_HEIGHT),
    };
    const node: SystemDesignNode = {
      id: uid(),
      componentType,
      label: definition.label,
      position,
      notes: definition.defaultNotes,
    };
    setNodes(current => [...current, node]);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setBrainstormOpen(false);
  }, [gridEnabled]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const componentType = event.dataTransfer.getData('application/sd-component');
    if (!componentType) return;
    const point = worldPoint(event.clientX, event.clientY);
    placeNode(componentType, point.x, point.y);
  }, [placeNode, worldPoint]);

  const handleTapPlace = useCallback((componentType: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const center = screenToWorld({ x: rect.width / 2, y: rect.height / 2 }, viewportRef.current);
    const index = nodes.length;
    const column = index % 3;
    const row = Math.floor(index / 3) % 4;
    placeNode(componentType, center.x + (column - 1) * 190, center.y + (row - 1.5) * 108);
    setPaletteOpen(false);
  }, [nodes.length, placeNode]);

  const addBrainstormComponent = useCallback((componentType: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const definition = COMPONENT_MAP.get(componentType);
    if (!rect || !definition) return;
    const point = screenToWorld({ x: rect.width * 0.5, y: rect.height * 0.5 }, viewportRef.current);
    const offset = (nodes.length % 4) * 24;
    placeNode(componentType, point.x + offset, point.y + offset);
    setCanvasMessage(`${definition.label} added from Architecture Brainstorm.`);
  }, [nodes.length, placeNode]);

  const startPan = useCallback((event: React.PointerEvent | PointerEvent) => {
    panRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: viewportRef.current.x,
      originY: viewportRef.current.y,
    };
  }, []);

  const handleSurfacePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || tool === 'pan' || spacePressedRef.current) {
      event.preventDefault();
      startPan(event);
      return;
    }
    if (event.target === event.currentTarget || (event.target as HTMLElement).dataset.canvasWorld === 'true') {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [startPan, tool]);

  const handleNodePointerDown = useCallback((event: React.PointerEvent, node: SystemDesignNode) => {
    if (renamingId) return;
    if (event.button === 1 || tool === 'pan' || spacePressedRef.current) {
      event.stopPropagation();
      startPan(event);
      return;
    }
    if (event.button !== 0) return;
    event.stopPropagation();
    const point = worldPoint(event.clientX, event.clientY);
    dragRef.current = {
      nodeId: node.id,
      offsetX: point.x - node.position.x,
      offsetY: point.y - node.position.y,
    };
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setBrainstormOpen(false);
  }, [renamingId, startPan, tool, worldPoint]);

  const handleConnectStart = useCallback((event: React.PointerEvent, nodeId: string) => {
    event.stopPropagation();
    const cursor = worldPoint(event.clientX, event.clientY);
    const state = { sourceId: nodeId, cursor };
    connectRef.current = state;
    setConnect(state);
  }, [worldPoint]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (panRef.current) {
        const pan = panRef.current;
        setViewport(current => ({
          ...current,
          x: pan.originX + event.clientX - pan.startClientX,
          y: pan.originY + event.clientY - pan.startClientY,
        }));
        return;
      }

      const point = worldPoint(event.clientX, event.clientY);
      if (dragRef.current) {
        const drag = dragRef.current;
        setNodes(current => current.map(node => node.id === drag.nodeId ? {
          ...node,
          position: {
            x: clamp(snap(point.x - drag.offsetX, gridEnabled), 0, WORLD_WIDTH - NODE_WIDTH),
            y: clamp(snap(point.y - drag.offsetY, gridEnabled), 0, WORLD_HEIGHT - NODE_HEIGHT),
          },
        } : node));
      } else if (connectRef.current) {
        setConnect(current => current ? { ...current, cursor: point } : current);
      }
    };

    const handleUp = (event: PointerEvent) => {
      panRef.current = null;
      dragRef.current = null;
      if (!connectRef.current) return;
      const point = worldPoint(event.clientX, event.clientY);
      const source = connectRef.current.sourceId;
      const target = nodes.find(node =>
        point.x >= node.position.x && point.x <= node.position.x + NODE_WIDTH &&
        point.y >= node.position.y && point.y <= node.position.y + NODE_HEIGHT,
      );
      if (target && target.id !== source) {
        setEdges(current => {
          const duplicate = current.some(edge => edge.source === source && edge.target === target.id);
          if (duplicate) return current;
          return [...current, { id: uid(), source, target: target.id, direction: 'oneway' }];
        });
      }
      connectRef.current = null;
      setConnect(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [gridEnabled, nodes, worldPoint]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(current => current.filter(node => node.id !== nodeId));
    setEdges(current => current.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
  }, []);

  const duplicateNode = useCallback((nodeId: string) => {
    const source = nodes.find(node => node.id === nodeId);
    if (!source) return;
    const duplicate: SystemDesignNode = {
      ...source,
      id: uid(),
      label: `${source.label} copy`.slice(0, 80),
      position: {
        x: clamp(source.position.x + 40, 0, WORLD_WIDTH - NODE_WIDTH),
        y: clamp(source.position.y + 40, 0, WORLD_HEIGHT - NODE_HEIGHT),
      },
    };
    setNodes(current => [...current, duplicate]);
    setSelectedNodeId(duplicate.id);
    setSelectedEdgeId(null);
    setBrainstormOpen(false);
  }, [nodes]);

  const startRename = useCallback((node: SystemDesignNode) => {
    setRenamingId(node.id);
    setRenameValue(node.label);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const label = renameValue.trim();
    setNodes(current => current.map(node => node.id === renamingId
      ? { ...node, label: label || node.label }
      : node));
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, renamingId]);

  const toggleEdgeDirection = useCallback((edgeId: string) => {
    setEdges(current => current.map(edge => edge.id === edgeId
      ? { ...edge, direction: edge.direction === 'oneway' ? 'bidirectional' : 'oneway' }
      : edge));
  }, []);

  const restoreHistory = useCallback((index: number) => {
    const snapshot = historyRef.current[index];
    if (!snapshot) return;
    restoringHistoryRef.current = true;
    historyIndexRef.current = index;
    const clone = cloneCanvasSnapshot(snapshot);
    setNodes(clone.nodes);
    setEdges(clone.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setHistoryRevision(value => value + 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) restoreHistory(historyIndexRef.current - 1);
  }, [restoreHistory]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) restoreHistory(historyIndexRef.current + 1);
  }, [restoreHistory]);

  const autoLayout = useCallback(() => {
    const laidOut = autoLayoutSystemDesign(nodes, edges);
    setNodes(laidOut);
    setCanvasMessage('Architecture arranged by request flow.');
    window.setTimeout(() => fitView(laidOut), 50);
  }, [edges, fitView, nodes]);

  const addStarterComponents = useCallback(() => {
    const componentIds = (suggestedComponents.length ? suggestedComponents : DEFAULT_STARTER)
      .filter(id => COMPONENT_MAP.has(id))
      .slice(0, 9);
    if (!componentIds.length) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const center = screenToWorld({ x: rect.width / 2, y: rect.height / 2 }, viewportRef.current);
    const added = componentIds.map((componentType, index) => {
      const definition = COMPONENT_MAP.get(componentType)!;
      const column = index % 3;
      const row = Math.floor(index / 3);
      return {
        id: uid(),
        componentType,
        label: definition.label,
        notes: definition.defaultNotes,
        position: {
          x: clamp(snap(center.x + (column - 1) * 220, gridEnabled), 0, WORLD_WIDTH - NODE_WIDTH),
          y: clamp(snap(center.y + (row - 1) * 130, gridEnabled), 0, WORLD_HEIGHT - NODE_HEIGHT),
        },
      } satisfies SystemDesignNode;
    });
    setNodes(current => [...current, ...added]);
    setSelectedNodeId(added[0]?.id || null);
    setCanvasMessage(`Added ${added.length} suggested components. Connect them to define the request flow.`);
  }, [gridEnabled, suggestedComponents]);

  const clearCanvas = useCallback(() => {
    if (nodes.length && !window.confirm('Clear every component and connection from this design?')) return;
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [nodes.length]);

  const downloadBlob = useCallback((contents: BlobPart, type: string, extension: string) => {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const base = (scenarioTitle || 'system-design')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'system-design';
    link.href = url;
    link.download = `${base}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }, [scenarioTitle]);

  const exportJson = useCallback(() => {
    downloadBlob(
      JSON.stringify({ nodes, edges, lastModified: Date.now() }, null, 2),
      'application/json',
      'json',
    );
    setCanvasMessage('Design JSON exported.');
  }, [downloadBlob, edges, nodes]);

  const exportSvg = useCallback(() => {
    downloadBlob(
      buildSystemDesignSvg({ nodes, edges, lastModified: Date.now() }, scenarioTitle),
      'image/svg+xml',
      'svg',
    );
    setCanvasMessage('Presentation-ready SVG exported.');
  }, [downloadBlob, edges, nodes, scenarioTitle]);

  const importCanvas = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1_000_000) {
      setCanvasMessage('Import files are limited to 1 MB.');
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as Partial<SystemDesignState>;
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('Invalid design format.');
      const importedNodes = parsed.nodes.slice(0, 100).filter(node =>
        node && typeof node.id === 'string' && typeof node.componentType === 'string' &&
        typeof node.label === 'string' && Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y),
      ).map(node => ({
        ...node,
        label: node.label.slice(0, 80),
        notes: typeof node.notes === 'string' ? node.notes.slice(0, 500) : undefined,
        position: {
          x: clamp(node.position.x, 0, WORLD_WIDTH - NODE_WIDTH),
          y: clamp(node.position.y, 0, WORLD_HEIGHT - NODE_HEIGHT),
        },
      }));
      const ids = new Set(importedNodes.map(node => node.id));
      const importedEdges = parsed.edges.slice(0, 200).filter(edge =>
        edge && typeof edge.id === 'string' && ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target,
      ).map(edge => ({
        ...edge,
        label: typeof edge.label === 'string' ? edge.label.slice(0, 80) : undefined,
        direction: edge.direction === 'bidirectional' ? 'bidirectional' as const : 'oneway' as const,
      }));
      if (importedNodes.length !== parsed.nodes.length) throw new Error('Some imported components were invalid.');
      setNodes(importedNodes);
      setEdges(importedEdges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setCanvasMessage(`Imported ${importedNodes.length} components and ${importedEdges.length} connections.`);
      window.setTimeout(() => fitView(importedNodes), 50);
    } catch (error) {
      setCanvasMessage(error instanceof Error ? error.message : 'Could not import this design.');
    }
  }, [fitView]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setSpacePressed(true);
        return;
      }
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (command && event.key.toLowerCase() === 'd' && selectedNodeId) {
        event.preventDefault();
        duplicateNode(selectedNodeId);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId) {
        event.preventDefault();
        deleteNode(selectedNodeId);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdgeId) {
        event.preventDefault();
        setEdges(current => current.filter(edge => edge.id !== selectedEdgeId));
        setSelectedEdgeId(null);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        changeZoom(viewportRef.current.zoom + 0.15);
      } else if (event.key === '-') {
        event.preventDefault();
        changeZoom(viewportRef.current.zoom - 0.15);
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        fitView();
      } else if (event.key === '0') {
        event.preventDefault();
        resetViewport();
      } else if (event.key.toLowerCase() === 'v') {
        setTool('select');
      } else if (event.key.toLowerCase() === 'h') {
        setTool('pan');
      } else if (event.key.toLowerCase() === 'g') {
        setGridEnabled(value => !value);
      } else if (event.key.toLowerCase() === 'b') {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setShortcutHelpOpen(false);
        setBrainstormOpen(value => !value);
      } else if (event.key === 'Escape') {
        setConnect(null);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setShortcutHelpOpen(false);
        setBrainstormOpen(false);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [changeZoom, deleteNode, duplicateNode, fitView, redo, resetViewport, selectedEdgeId, selectedNodeId, undo]);

  const nodeCenter = (node: SystemDesignNode) => ({
    x: node.position.x + NODE_WIDTH / 2,
    y: node.position.y + NODE_HEIGHT / 2,
  });
  const connectSource = connect ? nodes.find(node => node.id === connect.sourceId) : null;

  const minimap = useMemo(() => {
    const viewLeft = -viewport.x / viewport.zoom;
    const viewTop = -viewport.y / viewport.zoom;
    const viewWidth = canvasSize.width / viewport.zoom;
    const viewHeight = canvasSize.height / viewport.zoom;
    const minX = Math.min(viewLeft, ...nodes.map(node => node.position.x), 0) - 80;
    const minY = Math.min(viewTop, ...nodes.map(node => node.position.y), 0) - 80;
    const maxX = Math.max(viewLeft + viewWidth, ...nodes.map(node => node.position.x + NODE_WIDTH), 800) + 80;
    const maxY = Math.max(viewTop + viewHeight, ...nodes.map(node => node.position.y + NODE_HEIGHT), 500) + 80;
    const width = maxX - minX;
    const height = maxY - minY;
    const scale = Math.min(170 / width, 106 / height);
    const offsetX = (180 - width * scale) / 2;
    const offsetY = (116 - height * scale) / 2;
    return { minX, minY, scale, offsetX, offsetY, viewLeft, viewTop, viewWidth, viewHeight };
  }, [canvasSize, nodes, viewport]);

  const handleMiniMapClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mapX = (event.clientX - rect.left) * (180 / rect.width);
    const mapY = (event.clientY - rect.top) * (116 / rect.height);
    const worldX = minimap.minX + (mapX - minimap.offsetX) / minimap.scale;
    const worldY = minimap.minY + (mapY - minimap.offsetY) / minimap.scale;
    setViewport(current => ({
      ...current,
      x: canvasSize.width / 2 - worldX * current.zoom,
      y: canvasSize.height / 2 - worldY * current.zoom,
    }));
  }, [canvasSize, minimap]);

  const cursorClass = panRef.current || spacePressed
    ? 'cursor-grabbing'
    : tool === 'pan'
      ? 'cursor-grab'
      : 'cursor-default';

  return (
    <div className="advanced-design-canvas relative flex h-full w-full overflow-hidden border border-slate-700 bg-slate-950">
      {paletteOpen && (
        <button
          aria-label="Close component palette"
          className="absolute inset-0 z-30 bg-slate-950/70 sm:hidden"
          onClick={() => setPaletteOpen(false)}
        />
      )}
      <div className={`${paletteOpen ? 'block' : 'hidden'} absolute inset-y-0 left-0 z-40 w-60 shrink-0 sm:relative sm:inset-auto sm:z-auto sm:block sm:w-56`}>
        <button
          className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center border border-slate-700 bg-slate-900 text-slate-400 sm:hidden"
          onClick={() => setPaletteOpen(false)}
          aria-label="Close component drawer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <SystemDesignPalette suggested={suggestedComponents} onTapPlace={handleTapPlace} />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="advanced-canvas-toolbar flex min-h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-800 bg-slate-900/95 px-2 py-1.5 custom-scrollbar">
          <button onClick={() => { setPaletteOpen(true); setBrainstormOpen(false); }} className="canvas-icon-button sm:hidden" title="Components" aria-label="Open component palette">
            <PanelLeftOpen />
          </button>
          <div className="canvas-segmented" role="group" aria-label="Canvas tool">
            <button data-active={tool === 'select'} onClick={() => setTool('select')} title="Select tool (V)" aria-label="Select tool" aria-pressed={tool === 'select'}><MousePointer2 /></button>
            <button data-active={tool === 'pan'} onClick={() => setTool('pan')} title="Pan tool (H or Space)" aria-label="Pan tool" aria-pressed={tool === 'pan'}><Move /></button>
          </div>
          <div className="min-w-[9rem] flex-1 truncate text-[10px] text-slate-500">
            {connect
              ? 'Release over a component to connect'
              : `${nodes.length} component${nodes.length === 1 ? '' : 's'} · ${edges.length} connection${edges.length === 1 ? '' : 's'}`}
          </div>
          <button onClick={addStarterComponents} className="canvas-icon-button" title="Add suggested components" aria-label="Add suggested components"><Sparkles /></button>
          <button
            data-active={brainstormOpen}
            onClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
              setShortcutHelpOpen(false);
              setBrainstormOpen(value => !value);
            }}
            className="canvas-icon-button"
            title="Architecture brainstorm (B)"
            aria-label="Open architecture brainstorm"
            aria-pressed={brainstormOpen}
          >
            <BrainCircuit />
          </button>
          <button onClick={autoLayout} disabled={nodes.length < 2} className="canvas-icon-button" title="Auto-layout by request flow (L)" aria-label="Auto-layout diagram"><WandSparkles /></button>
          <button data-active={gridEnabled} onClick={() => setGridEnabled(value => !value)} className="canvas-icon-button" title="Toggle snap grid (G)" aria-label="Toggle snap grid" aria-pressed={gridEnabled}><Grid3X3 /></button>
          <span className="canvas-toolbar-divider" />
          <button onClick={undo} disabled={!canUndo} className="canvas-icon-button" title="Undo (Ctrl+Z)" aria-label="Undo canvas change"><Undo2 /></button>
          <button onClick={redo} disabled={!canRedo} className="canvas-icon-button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo canvas change"><Redo2 /></button>
          <input ref={importInputRef} type="file" accept="application/json,.json" aria-label="Choose design JSON file" className="hidden" onChange={importCanvas} />
          <button onClick={() => importInputRef.current?.click()} className="canvas-icon-button" title="Import JSON" aria-label="Import design JSON"><Upload /></button>
          <button onClick={exportJson} disabled={!nodes.length} className="canvas-icon-button" title="Export JSON" aria-label="Export design JSON"><FileJson /></button>
          <button onClick={exportSvg} disabled={!nodes.length} className="canvas-icon-button" title="Export SVG" aria-label="Export design SVG"><ImageDown /></button>
          <button onClick={() => { setBrainstormOpen(false); setShortcutHelpOpen(value => !value); }} className="canvas-icon-button" title="Keyboard shortcuts" aria-label="Show canvas shortcuts"><CircleHelp /></button>
          {nodes.length > 0 && <button onClick={clearCanvas} className="canvas-icon-button danger" title="Clear canvas" aria-label="Clear canvas"><Trash2 /></button>}
        </div>

        <div
          ref={canvasRef}
          className={`relative flex-1 overflow-hidden touch-none ${cursorClass}`}
          onDragOver={event => event.preventDefault()}
          onDrop={handleDrop}
          onPointerDown={handleSurfacePointerDown}
          style={{
            backgroundColor: 'var(--bg-1)',
            backgroundImage: gridEnabled ? 'radial-gradient(circle, rgba(112,225,193,0.16) 1px, transparent 1px)' : 'none',
            backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }}
        >
          <div
            data-canvas-world="true"
            className="absolute left-0 top-0"
            style={{
              width: WORLD_WIDTH,
              height: WORLD_HEIGHT,
              transformOrigin: '0 0',
              transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
            }}
          >
            <svg className="absolute inset-0 pointer-events-none" width={WORLD_WIDTH} height={WORLD_HEIGHT}>
              <defs>
                <marker id="advanced-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#70e1c1" />
                </marker>
              </defs>
              {edges.map(edge => {
                const source = nodes.find(node => node.id === edge.source);
                const target = nodes.find(node => node.id === edge.target);
                if (!source || !target) return null;
                const start = nodeCenter(source);
                const end = nodeCenter(target);
                const selected = edge.id === selectedEdgeId;
                return (
                  <g key={edge.id} className="pointer-events-auto cursor-pointer">
                    <line
                      x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                      stroke="transparent" strokeWidth={18 / viewport.zoom}
                      onPointerDown={event => {
                        event.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                      onDoubleClick={event => {
                        event.stopPropagation();
                        toggleEdgeDirection(edge.id);
                      }}
                    />
                    <line
                      x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                      stroke={selected ? '#ff8a74' : '#70e1c1'}
                      strokeWidth={(selected ? 3 : 2) / viewport.zoom}
                      markerEnd="url(#advanced-arrow)"
                      markerStart={edge.direction === 'bidirectional' ? 'url(#advanced-arrow)' : undefined}
                      pointerEvents="none"
                    />
                    {edge.label && (
                      <text
                        x={(start.x + end.x) / 2}
                        y={(start.y + end.y) / 2 - 8}
                        fill="#c8d1ce"
                        fontSize={11 / viewport.zoom}
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {connect && connectSource && (
                <line
                  x1={nodeCenter(connectSource).x}
                  y1={nodeCenter(connectSource).y}
                  x2={connect.cursor.x}
                  y2={connect.cursor.y}
                  stroke="#ff8a74"
                  strokeWidth={2 / viewport.zoom}
                  strokeDasharray={`${6 / viewport.zoom} ${5 / viewport.zoom}`}
                />
              )}
            </svg>

            {nodes.map(node => {
              const definition = COMPONENT_MAP.get(node.componentType);
              const Icon = resolveSystemDesignIcon(definition?.icon);
              const selected = node.id === selectedNodeId;
              const renaming = node.id === renamingId;
              return (
                <div
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.label} component`}
                  onPointerDown={event => handleNodePointerDown(event, node)}
                  onDoubleClick={event => {
                    event.stopPropagation();
                    startRename(node);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') startRename(node);
                  }}
                  className={`advanced-canvas-node absolute select-none border bg-slate-800 ${selected ? 'selected' : ''}`}
                  style={{ left: node.position.x, top: node.position.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                >
                  <div className="flex h-full items-center gap-2.5 px-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center border border-emerald-500/20 bg-emerald-500/10">
                      <Icon className="h-4 w-4 text-emerald-300" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {renaming ? (
                        <input
                          autoFocus
                          aria-label={`Rename ${node.label}`}
                          value={renameValue}
                          onChange={event => setRenameValue(event.target.value)}
                          onBlur={commitRename}
                          onPointerDown={event => event.stopPropagation()}
                          onKeyDown={event => {
                            if (event.key === 'Enter') commitRename();
                            if (event.key === 'Escape') {
                              setRenamingId(null);
                              setRenameValue('');
                            }
                          }}
                          className="w-full border border-cyan-500/40 bg-slate-950 px-1.5 py-1 text-xs text-white outline-none"
                        />
                      ) : (
                        <>
                          <p className="truncate text-xs font-semibold text-white">{node.label}</p>
                          <p className="mt-1 truncate text-[9px] uppercase tracking-wider text-slate-500">{definition?.category || 'Component'}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    title="Drag to connect"
                    aria-label={`Connect from ${node.label}`}
                    onPointerDown={event => handleConnectStart(event, node.id)}
                    className="advanced-connect-handle absolute -right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border-2 border-slate-900 bg-emerald-500"
                  >
                    <Link2 className="h-2.5 w-2.5 text-white" />
                  </button>
                </div>
              );
            })}
          </div>

          {!nodes.length && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center">
              <div>
                <Sparkles className="mx-auto mb-4 h-8 w-8 text-cyan-400/50" />
                <p className="font-serif text-lg text-slate-300">{scenarioTitle ? `Design ${scenarioTitle}` : 'Start your architecture'}</p>
                <p className="mt-2 text-xs text-slate-500">Add a component or load the suggested starter set.</p>
              </div>
            </div>
          )}

          {canvasMessage && (
            <div role="status" className="absolute bottom-16 left-3 z-30 max-w-sm border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-300 shadow-xl">
              {canvasMessage}
              <button onClick={() => setCanvasMessage(null)} className="ml-2 text-slate-500 hover:text-white" aria-label="Dismiss message">×</button>
            </div>
          )}

          {brainstormOpen && (
            <aside
              onPointerDown={event => event.stopPropagation()}
              className="advanced-brainstorm-panel absolute bottom-12 left-2 right-2 z-30 max-h-[calc(100%-60px)] overflow-y-auto border border-slate-700 bg-slate-900/98 shadow-2xl sm:bottom-auto sm:left-auto sm:right-3 sm:top-3 sm:w-[340px]"
              aria-label="Architecture brainstorm"
            >
              <div className="brainstorm-header">
                <div>
                  <p>Architecture brainstorm</p>
                  <span>Design pulse</span>
                </div>
                <strong aria-label={`Design pulse ${brainstorm.score} out of 100`}>{brainstorm.score}</strong>
                <button onClick={() => setBrainstormOpen(false)} aria-label="Close architecture brainstorm"><X /></button>
              </div>
              <div className="brainstorm-meter" aria-hidden="true"><i style={{ width: `${brainstorm.score}%` }} /></div>
              <p className="brainstorm-summary">{brainstorm.summary}</p>
              <div className="brainstorm-lenses" role="group" aria-label="Architecture stress lens">
                {([
                  ['balanced', 'Balanced'],
                  ['traffic', 'Traffic'],
                  ['failure', 'Failure'],
                  ['security', 'Security'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    data-active={brainstormLens === value}
                    onClick={() => setBrainstormLens(value)}
                    aria-pressed={brainstormLens === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="brainstorm-suggestions">
                {brainstorm.suggestions.length ? brainstorm.suggestions.map(suggestion => {
                  const definition = COMPONENT_MAP.get(suggestion.componentType);
                  return (
                    <article key={suggestion.componentType}>
                      <div className="brainstorm-suggestion-meta">
                        <span>{suggestion.category}</span>
                        <span data-impact={suggestion.impact.toLowerCase()}>{suggestion.impact} impact</span>
                      </div>
                      <h3>{suggestion.title}</h3>
                      <p>{suggestion.rationale}</p>
                      <button
                        onClick={() => addBrainstormComponent(suggestion.componentType)}
                        aria-label={`Add ${definition?.label || suggestion.title}`}
                      >
                        <Plus /> Add {definition?.label || 'component'}
                      </button>
                    </article>
                  );
                }) : (
                  <div className="brainstorm-complete">
                    <Sparkles />
                    <p>No obvious gaps under this lens.</p>
                  </div>
                )}
              </div>
            </aside>
          )}

          {(selectedNode || selectedEdge) && (
            <aside
              onPointerDown={event => event.stopPropagation()}
              className="advanced-canvas-inspector absolute bottom-3 left-3 right-3 z-30 max-h-[58%] overflow-y-auto border border-slate-700 bg-slate-900/97 p-3 shadow-2xl backdrop-blur sm:bottom-auto sm:left-auto sm:right-3 sm:top-3 sm:w-72"
              aria-label={selectedNode ? 'Component properties' : 'Connection properties'}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{selectedNode ? 'Component' : 'Connection'}</p>
                <button onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }} className="text-slate-500 hover:text-white" aria-label="Close properties"><X className="h-4 w-4" /></button>
              </div>
              {selectedNode ? (
                <div className="space-y-3">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Name
                    <input value={selectedNode.label} maxLength={80} onChange={event => setNodes(current => current.map(node => node.id === selectedNode.id ? { ...node, label: event.target.value } : node))} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white" />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Design notes
                    <textarea value={selectedNode.notes || ''} maxLength={500} rows={4} onChange={event => setNodes(current => current.map(node => node.id === selectedNode.id ? { ...node, notes: event.target.value } : node))} className="mt-1 w-full resize-none border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => duplicateNode(selectedNode.id)} className="canvas-command-button"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                    <button onClick={() => deleteNode(selectedNode.id)} className="canvas-command-button danger"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  </div>
                </div>
              ) : selectedEdge ? (
                <div className="space-y-3">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Connection label
                    <input value={selectedEdge.label || ''} maxLength={80} placeholder="HTTPS, async, 10k req/s" onChange={event => setEdges(current => current.map(edge => edge.id === selectedEdge.id ? { ...edge, label: event.target.value } : edge))} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white" />
                  </label>
                  <button onClick={() => toggleEdgeDirection(selectedEdge.id)} className="canvas-command-button w-full"><ArrowLeftRight className="h-3.5 w-3.5" /> {selectedEdge.direction === 'oneway' ? 'Make bidirectional' : 'Make one-way'}</button>
                  <button onClick={() => { setEdges(current => current.filter(edge => edge.id !== selectedEdge.id)); setSelectedEdgeId(null); }} className="canvas-command-button danger w-full"><Trash2 className="h-3.5 w-3.5" /> Delete connection</button>
                </div>
              ) : null}
            </aside>
          )}

          <div className="advanced-zoom-controls absolute bottom-3 left-3 z-20 flex items-center border border-slate-700 bg-slate-900/95 shadow-xl">
            <button onClick={() => changeZoom(viewport.zoom - 0.15)} aria-label="Zoom out" title="Zoom out (-)"><Minus /></button>
            <button onClick={resetViewport} className="zoom-readout" aria-label="Reset zoom and pan" title="Reset view (0)">{Math.round(viewport.zoom * 100)}%</button>
            <button onClick={() => changeZoom(viewport.zoom + 0.15)} aria-label="Zoom in" title="Zoom in (+)"><Plus /></button>
            <span />
            <button onClick={() => fitView()} aria-label="Fit diagram to view" title="Fit diagram (F)"><Maximize2 /></button>
            <button onClick={resetViewport} aria-label="Reset canvas view" title="Reset view"><RotateCcw /></button>
          </div>

          {shortcutHelpOpen && (
            <div className="advanced-shortcuts absolute bottom-16 left-3 z-30 w-64 border border-slate-700 bg-slate-900/98 p-3 text-[11px] text-slate-300 shadow-2xl">
              <div className="mb-2 flex items-center justify-between"><strong>Canvas shortcuts</strong><button onClick={() => setShortcutHelpOpen(false)} aria-label="Close shortcut guide"><X className="h-3.5 w-3.5" /></button></div>
              <dl><dt>V / H</dt><dd>Select / pan</dd><dt>Space + drag</dt><dd>Temporary pan</dd><dt>Wheel / + / −</dt><dd>Zoom</dd><dt>F / 0</dt><dd>Fit / reset view</dd><dt>Ctrl + D</dt><dd>Duplicate component</dd><dt>Ctrl + Z</dt><dd>Undo</dd><dt>G / B</dt><dd>Grid / brainstorm</dd></dl>
            </div>
          )}

          {nodes.length > 0 && (
            <svg
              className="advanced-minimap absolute bottom-3 right-3 z-20 hidden h-[116px] w-[180px] cursor-crosshair border border-slate-700 bg-slate-950/95 shadow-xl md:block"
              viewBox="0 0 180 116"
              onClick={handleMiniMapClick}
              aria-label="Diagram minimap"
              role="img"
            >
              {edges.map(edge => {
                const source = nodes.find(node => node.id === edge.source);
                const target = nodes.find(node => node.id === edge.target);
                if (!source || !target) return null;
                const start = nodeCenter(source);
                const end = nodeCenter(target);
                const mapPoint = (point: { x: number; y: number }) => ({
                  x: minimap.offsetX + (point.x - minimap.minX) * minimap.scale,
                  y: minimap.offsetY + (point.y - minimap.minY) * minimap.scale,
                });
                const a = mapPoint(start);
                const b = mapPoint(end);
                return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#64736f" strokeWidth="1" />;
              })}
              {nodes.map(node => (
                <rect
                  key={node.id}
                  x={minimap.offsetX + (node.position.x - minimap.minX) * minimap.scale}
                  y={minimap.offsetY + (node.position.y - minimap.minY) * minimap.scale}
                  width={Math.max(3, NODE_WIDTH * minimap.scale)}
                  height={Math.max(2, NODE_HEIGHT * minimap.scale)}
                  fill={node.id === selectedNodeId ? '#ff8a74' : '#65d59f'}
                  rx="1"
                />
              ))}
              <rect
                x={minimap.offsetX + (minimap.viewLeft - minimap.minX) * minimap.scale}
                y={minimap.offsetY + (minimap.viewTop - minimap.minY) * minimap.scale}
                width={Math.max(4, minimap.viewWidth * minimap.scale)}
                height={Math.max(4, minimap.viewHeight * minimap.scale)}
                fill="rgba(112,225,193,0.08)"
                stroke="#70e1c1"
                strokeWidth="1"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedDesignCanvas;

// components/SystemDesignPalette.tsx
// Left-side (or bottom-drawer on mobile) drag source of design components.
import React, { useMemo } from 'react';
import { SystemDesignComponentDef } from '../types';
import componentsData from '../data/system-design-components.json';
import { resolveSystemDesignIcon } from '../utils/systemDesignIcons';

const COMPONENTS = componentsData as SystemDesignComponentDef[];

interface SystemDesignPaletteProps {
  suggested?: string[]; // palette ids to highlight as scenario hints
  onTapPlace?: (componentId: string) => void; // touch fallback: tap to place
}

const SystemDesignPalette: React.FC<SystemDesignPaletteProps> = ({ suggested = [], onTapPlace }) => {
  const grouped = useMemo(() => {
    const map: Record<string, SystemDesignComponentDef[]> = {};
    COMPONENTS.forEach(c => {
      (map[c.category] = map[c.category] || []).push(c);
    });
    return map;
  }, []);

  const onDragStart = (e: React.DragEvent, componentId: string) => {
    e.dataTransfer.setData('application/sd-component', componentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const suggestedSet = new Set(suggested);

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-900/60 border-r border-slate-800 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-1">
        Components
      </div>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-3">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5 px-1">
            {category}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {items.map(item => {
              const Icon = resolveSystemDesignIcon(item.icon);
              const isSuggested = suggestedSet.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  onDragStart={e => onDragStart(e, item.id)}
                  onClick={() => onTapPlace?.(item.id)}
                  title={item.defaultNotes || item.label}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border text-center cursor-grab active:cursor-grabbing transition-all hover:scale-[1.03] ${
                    isSuggested
                      ? 'border-cyan-500/50 bg-cyan-500/5 hover:bg-cyan-500/10'
                      : 'border-slate-700/70 bg-slate-800/50 hover:bg-slate-700/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSuggested ? 'text-cyan-300' : 'text-slate-300'}`} />
                  <span className="text-[9px] leading-tight text-slate-300 break-words">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[9px] text-slate-600 px-1 mt-2 leading-relaxed">
        Drag onto the canvas, or tap to place. Drag from a node handle to connect. Select any item to edit its details.
      </p>
    </div>
  );
};

export default SystemDesignPalette;

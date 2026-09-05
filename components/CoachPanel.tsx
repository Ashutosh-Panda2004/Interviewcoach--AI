import React from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, Loader2, MessageSquare } from 'lucide-react';
import { CoachTip } from '../types';

interface CoachPanelProps {
  tips: CoachTip[];
  collapsed: boolean;
  asking: boolean;
  onToggle: () => void;
  onAsk: () => void;
}

const CoachPanel: React.FC<CoachPanelProps> = ({ tips, collapsed, asking, onToggle, onAsk }) => {
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-4 top-20 z-20 px-3 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl flex items-center text-xs font-bold"
        aria-label="Open coach panel"
      >
        <ChevronLeft className="w-4 h-4 mr-1" /> Coach
      </button>
    );
  }

  return (
    <aside className="practice-coach-panel w-80 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col h-full" aria-label="Practice coach">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-emerald-400" /> Coach Panel</h3>
          <p className="text-[10px] text-slate-500">Pull feedback when you want it.</p>
        </div>
        <button onClick={onToggle} className="p-1.5 rounded hover:bg-slate-800 text-slate-400" aria-label="Close coach panel"><ChevronRight className="w-4 h-4" /></button>
      </div>

      <div className="p-4 border-b border-slate-800">
        <button
          onClick={onAsk}
          disabled={asking}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center shadow-lg shadow-emerald-900/20"
        >
          {asking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lightbulb className="w-4 h-4 mr-2" />}
          {asking ? 'Coach is reading...' : 'Ask Coach'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {tips.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Lightbulb className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No tips yet.</p>
            <p className="text-xs mt-1">Ask when you want a fresh critique.</p>
          </div>
        ) : tips.map(tip => (
          <div key={tip.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">{tip.trigger === 'on-demand' ? 'Asked Coach' : 'Hint'}</span>
              <span className="text-[10px] text-slate-600">{new Date(tip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{tip.message}</p>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default CoachPanel;

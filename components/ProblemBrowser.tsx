import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, Target } from 'lucide-react';
import { SkillProfile, SkillTopic, SystemDesignTemplate } from '../types';
import templatesData from '../data/system-design-templates.json';
import { rankPracticeProblems } from '../utils/practiceProblemRanking';
import { TOPIC_LABELS } from '../utils/skillScoring';

const TEMPLATES = templatesData as SystemDesignTemplate[];

interface ProblemBrowserProps {
  profile: SkillProfile | null;
  onSelect: (template: SystemDesignTemplate) => void;
}

const ProblemBrowser: React.FC<ProblemBrowserProps> = ({ profile, onSelect }) => {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<'all' | SkillTopic>('all');

  const problems = useMemo(() => {
    const ranked = rankPracticeProblems(TEMPLATES, profile);
    return ranked.filter(problem => {
      const matchesQuery = !query || `${problem.title} ${problem.promptText}`.toLowerCase().includes(query.toLowerCase());
      const matchesTopic = topic === 'all' || (problem.topics || []).includes(topic);
      return matchesQuery && matchesTopic;
    });
  }, [profile, query, topic]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold mb-2">Apply</p>
          <h2 className="text-xl font-bold text-white">Choose a practice problem</h2>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              aria-label="Search practice problems"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search prompts"
              className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <select
            aria-label="Filter practice problems by topic"
            value={topic}
            onChange={e => setTopic(e.target.value as any)}
            className="w-full min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 sm:w-auto"
          >
            <option value="all">All topics</option>
            {Object.entries(TOPIC_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {problems.map(problem => (
          <button
            key={problem.id}
            onClick={() => onSelect(problem)}
            className="text-left bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 transition-all group"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="p-2 rounded-lg bg-slate-800 text-emerald-400"><Target className="w-4 h-4" /></div>
              <span className={`text-[10px] px-2 py-1 rounded-full ${problem.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400' : problem.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{problem.difficulty}</span>
            </div>
            <h3 className="font-bold text-white mb-2 group-hover:text-emerald-300">{problem.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-3">{problem.promptText}</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(problem.topics || []).slice(0, 3).map(t => <span key={t} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{TOPIC_LABELS[t]}</span>)}
            </div>
            <span className="text-xs text-emerald-400 font-semibold flex items-center">Start practice <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" /></span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProblemBrowser;

import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { RefreshCw, Sparkles } from 'lucide-react';
import { SkillProfile } from '../types';
import { getWeakTopics, TOPIC_LABELS, SKILL_TOPICS } from '../utils/skillScoring';

interface SkillReportProps {
  profile: SkillProfile;
  onRetake: () => void;
}

const SkillReport: React.FC<SkillReportProps> = ({ profile, onRetake }) => {
  const weakTopics = getWeakTopics(profile, 3);
  const chartData = SKILL_TOPICS.map(topic => ({
    topic: TOPIC_LABELS[topic],
    score: profile.topicScores[topic] || 0,
    fullMark: 100,
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold mb-2">Skill Report</p>
          <h2 className="text-xl font-bold text-white">Your current design map</h2>
        </div>
        <button onClick={onRetake} className="text-xs px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center">
          <RefreshCw className="w-3 h-3 mr-1.5" /> Retake
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-center">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius="72%">
              <PolarGrid stroke="#49473b" />
              <PolarAngleAxis dataKey="topic" tick={{ fill: '#999284', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64736f', fontSize: 10 }} />
              <Radar dataKey="score" stroke="#82aa91" fill="#82aa91" fillOpacity={0.22} />
              <Tooltip contentStyle={{ background: '#111719', border: '1px solid #3c4c50', color: '#c8d1ce', borderRadius: 3 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-start">
              <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 mr-2 shrink-0" />
              <p className="text-sm text-emerald-100 leading-relaxed">{profile.summary}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Suggested focus areas</p>
            <div className="flex flex-wrap gap-2">
              {weakTopics.map(topic => (
                <span key={topic} className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs">
                  {TOPIC_LABELS[topic]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillReport;

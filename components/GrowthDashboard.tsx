import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { SkillProfile } from '../types';

interface GrowthDashboardProps {
  profile: SkillProfile;
}

const GrowthDashboard: React.FC<GrowthDashboardProps> = ({ profile }) => {
  const data = [...profile.sessionHistory].reverse().map((entry, index) => ({
    name: `S${index + 1}`,
    scalability: entry.deltaByTopic.scalability ?? 0,
    databases: entry.deltaByTopic.databases ?? 0,
    security: entry.deltaByTopic.security ?? 0,
    consistency: entry.deltaByTopic.consistency ?? 0,
  }));

  if (data.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <h2 className="text-xl font-bold text-white flex items-center mb-4"><TrendingUp className="w-5 h-5 mr-2 text-emerald-400" /> Growth Trend</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2c2c26" />
            <XAxis dataKey="name" stroke="#64736f" fontSize={11} />
            <YAxis stroke="#64736f" fontSize={11} />
            <Tooltip contentStyle={{ background: '#111719', border: '1px solid #3c4c50', color: '#c8d1ce', borderRadius: 3 }} />
            <Line type="monotone" dataKey="scalability" stroke="#70e1c1" />
            <Line type="monotone" dataKey="databases" stroke="#897789" />
            <Line type="monotone" dataKey="security" stroke="#b88268" />
            <Line type="monotone" dataKey="consistency" stroke="#82aa91" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GrowthDashboard;

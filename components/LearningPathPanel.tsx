import React, { useState } from 'react';
import { BookOpen, ExternalLink, FileText, Github, PlaySquare, MousePointer2 } from 'lucide-react';
import { LearningResource, SkillProfile } from '../types';
import resourcesData from '../data/learning-resources.json';
import { rankResources, setResourceReviewed } from '../utils/resourceRanking';

const RESOURCES = resourcesData as LearningResource[];

const formatIcon = {
  video: PlaySquare,
  article: FileText,
  repo: Github,
  interactive: MousePointer2,
};

interface LearningPathPanelProps {
  profile: SkillProfile;
}

const LearningPathPanel: React.FC<LearningPathPanelProps> = ({ profile }) => {
  const [version, setVersion] = useState(0);
  const [storageWarning, setStorageWarning] = useState('');
  const ranked = rankResources(RESOURCES, profile, 5);

  const toggleReviewed = (resourceId: string, reviewed: boolean) => {
    if (!setResourceReviewed(resourceId, reviewed)) {
      setStorageWarning('This browser is blocking local storage, so reviewed status cannot be retained.');
      return;
    }
    setStorageWarning('');
    setVersion(current => current + 1);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center mb-4">
        <BookOpen className="w-5 h-5 text-emerald-400 mr-2" />
        <div>
          <h2 className="text-xl font-bold text-white">Curated Learning Path</h2>
          <p className="text-xs text-slate-500">Verified free resources. Open externally, learn, then come back.</p>
        </div>
      </div>

      {storageWarning && (
        <p role="alert" className="mb-4 border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          {storageWarning}
        </p>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {ranked.map(resource => {
          const Icon = formatIcon[resource.format];
          return (
            <div key={resource.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col min-h-48">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Icon className="w-4 h-4" />
                </div>
                <label className="flex items-center text-[10px] text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!resource.reviewed}
                    onChange={e => toggleReviewed(resource.id, e.target.checked)}
                    className="mr-1 accent-emerald-500"
                  />
                  Reviewed
                </label>
              </div>
              <h3 className="font-bold text-white text-sm leading-snug mb-1">{resource.title}</h3>
              <p className="text-xs text-slate-500 mb-3">{resource.source} • {resource.estimatedMinutes} min • {resource.difficulty}</p>
              <p className="text-xs text-slate-400 leading-relaxed flex-1">{resource.reason}</p>
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center justify-center px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Open externally <ExternalLink className="w-3 h-3 ml-1.5" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LearningPathPanel;

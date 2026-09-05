// utils/practiceProblemRanking.ts
import { SkillProfile, SkillTopic, SystemDesignTemplate } from '../types';
import { getWeakTopics } from './skillScoring';

export const rankPracticeProblems = (
  templates: SystemDesignTemplate[],
  profile: SkillProfile | null
): SystemDesignTemplate[] => {
  if (!profile) return templates.filter(t => t.id !== 'freeform');
  const weak = new Set<SkillTopic>(getWeakTopics(profile, 3));
  return [...templates]
    .filter(t => t.id !== 'freeform')
    .sort((a, b) => {
      const aScore = (a.topics || []).filter(t => weak.has(t)).length;
      const bScore = (b.topics || []).filter(t => weak.has(t)).length;
      return bScore - aScore;
    });
};

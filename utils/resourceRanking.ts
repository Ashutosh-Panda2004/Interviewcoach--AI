// utils/resourceRanking.ts
// Filters and ranks curated learning resources. The AI may rank/explain later,
// but URLs always come from the vetted static library.
import { LearningResource, RankedLearningResource, SkillProfile, SkillTopic } from '../types';
import { getWeakTopics, TOPIC_LABELS } from './skillScoring';

export const loadReviewedResourceIds = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem('practice_arena_reviewed_resources') || '[]'));
  } catch {
    return new Set();
  }
};

export const setResourceReviewed = (resourceId: string, reviewed: boolean): boolean => {
  const ids = loadReviewedResourceIds();
  if (reviewed) ids.add(resourceId);
  else ids.delete(resourceId);
  try {
    localStorage.setItem('practice_arena_reviewed_resources', JSON.stringify([...ids]));
    return true;
  } catch {
    return false;
  }
};

export const rankResources = (
  resources: LearningResource[],
  profile: SkillProfile,
  limit = 5
): RankedLearningResource[] => {
  const weakTopics = getWeakTopics(profile, 3);
  const reviewed = loadReviewedResourceIds();

  return resources
    .map(resource => {
      const overlap = resource.topics.filter(topic => weakTopics.includes(topic));
      const topicScore = overlap.length * 30;
      const beginnerBonus = resource.difficulty === 'beginner' ? 8 : resource.difficulty === 'intermediate' ? 5 : 0;
      const reviewedPenalty = reviewed.has(resource.id) ? -12 : 0;
      return { resource, overlap, score: topicScore + beginnerBonus + reviewedPenalty };
    })
    .filter(item => item.overlap.length > 0)
    .sort((a, b) => b.score - a.score || a.resource.estimatedMinutes - b.resource.estimatedMinutes)
    .slice(0, limit)
    .map(item => ({
      ...item.resource,
      reviewed: reviewed.has(item.resource.id),
      reason: `Useful now because it targets ${item.overlap.map(t => TOPIC_LABELS[t as SkillTopic]).join(', ')}.`,
    }));
};

// utils/feedbackEnhancements.ts
// Zero/low-cost feedback polish: decompression summary, STAR segmentation, study plan, streaks.
import { ComprehensiveAnalysisReport, TranscriptionItem } from '../types';

export interface StarAnalysisResult {
  situation: string;
  task: string;
  action: string;
  result: string;
  missing: string[];
}

export interface StreakStats {
  totalSessions: number;
  currentStreak: number;
  lastSessionDate: string | null;
}

const STREAK_KEY = 'interview_coach_streak_stats_v1';

export const buildDecompressionSummary = (report: ComprehensiveAnalysisReport): string[] => {
  const score = report.composite?.score || 50;
  const topStrength = report.strengths?.[0]?.point || 'You completed another deliberate practice session';
  const nextStep = report.improvements?.[0]?.title || 'Pick one answer and add more concrete examples next time';
  return [
    score >= 75 ? 'This session shows strong momentum.' : 'This session gives you clear practice signal.',
    topStrength,
    `Next focus: ${nextStep}.`,
  ];
};

export const analyzeStarFromTranscripts = (transcripts: TranscriptionItem[]): StarAnalysisResult => {
  const userText = transcripts.filter(t => t.speaker === 'user').map(t => t.text).join('\n');
  const sentences = userText.split(/(?<=[.!?])\s+/).filter(Boolean);
  const find = (patterns: RegExp[]) => sentences.find(sentence => patterns.some(p => p.test(sentence))) || '';
  const result = {
    situation: find([/situation|context|background|when i|during|in my project/i]),
    task: find([/task|goal|needed to|responsible|objective|had to/i]),
    action: find([/i built|i did|i implemented|i led|i used|my approach|we decided/i]),
    result: find([/result|impact|improved|reduced|increased|learned|outcome|achieved|saved/i]),
    missing: [] as string[],
  };
  if (!result.situation) result.missing.push('Situation');
  if (!result.task) result.missing.push('Task');
  if (!result.action) result.missing.push('Action');
  if (!result.result) result.missing.push('Result');
  return result;
};

export const buildStudyPlan = (report: ComprehensiveAnalysisReport): string[] => {
  const improvements = report.improvements || [];
  return improvements.slice(0, 3).map((item, index) => {
    const prefix = index === 0 ? 'Today' : index === 1 ? 'Next session' : 'This week';
    return `${prefix}: practice ${item.title.toLowerCase()} with one concrete example and one measurable outcome.`;
  });
};

export const updateStreakStats = (): StreakStats => {
  const today = new Date().toISOString().slice(0, 10);
  const existing = getStreakStats();
  if (existing.lastSessionDate === today) return existing;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const next: StreakStats = {
    totalSessions: existing.totalSessions + 1,
    currentStreak: existing.lastSessionDate === yesterday ? existing.currentStreak + 1 : 1,
    lastSessionDate: today,
  };
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    return existing;
  }
  return next;
};

export const getStreakStats = (): StreakStats => {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { totalSessions: 0, currentStreak: 0, lastSessionDate: null };
};

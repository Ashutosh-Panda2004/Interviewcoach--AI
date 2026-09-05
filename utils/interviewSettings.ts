import { InterviewSettings, InterviewType, InterviewerPersonality } from '../types';

const BLIND_TYPES: InterviewType[] = ['Actual Interview', 'Practice Interview'];
const BLIND_PERSONALITIES: InterviewerPersonality[] = [
  'Neutral Professional',
  'Very Strict',
  'Calm & Polite',
  'Highly Helpful',
  'Friendly Conversational',
];
const BLIND_DIFFICULTIES: InterviewSettings['difficulty'][] = ['Easy', 'Medium', 'Hard'];
const BLIND_DURATIONS = [15, 20, 30];

const pick = <T,>(values: readonly T[], random: () => number): T => {
  const index = Math.min(values.length - 1, Math.max(0, Math.floor(random() * values.length)));
  return values[index];
};

export interface BlindInterviewSettings {
  interviewType: InterviewType;
  personality: InterviewerPersonality;
  difficulty: InterviewSettings['difficulty'];
  duration: number;
}

export const randomizeBlindSettings = (random: () => number = Math.random): BlindInterviewSettings => ({
  interviewType: pick(BLIND_TYPES, random),
  personality: pick(BLIND_PERSONALITIES, random),
  difficulty: pick(BLIND_DIFFICULTIES, random),
  duration: pick(BLIND_DURATIONS, random),
});

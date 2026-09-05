import { CodingProblem, InterviewSettings, TranscriptionItem } from '../types';

export const ACTIVE_INTERVIEW_KEY = 'interview_coach_active_session';
const MAX_TRANSCRIPT_ITEMS = 1_200;
const MAX_TRANSCRIPT_CHARACTERS = 1_500_000;
const MAX_CODING_PROBLEMS = 20;

export interface ActiveInterviewSnapshot {
  transcripts: TranscriptionItem[];
  elapsedTime: number;
  activeMode: 'CONVERSATION' | 'CODING' | 'DESIGN';
  codingProblems: CodingProblem[];
  currentProblemIndex: number;
  settings: InterviewSettings;
  timestamp: number;
}

const isSnapshot = (value: unknown): value is ActiveInterviewSnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Partial<ActiveInterviewSnapshot>;
  return Boolean(
    snapshot.settings?.role &&
    Number.isFinite(snapshot.elapsedTime) &&
    Array.isArray(snapshot.transcripts) &&
    Array.isArray(snapshot.codingProblems) &&
    (snapshot.activeMode === 'CONVERSATION' || snapshot.activeMode === 'CODING' || snapshot.activeMode === 'DESIGN')
  );
};

const compactTranscripts = (items: TranscriptionItem[]) => {
  const retained: TranscriptionItem[] = [];
  let characters = 0;
  for (let index = items.length - 1; index >= 0 && retained.length < MAX_TRANSCRIPT_ITEMS; index -= 1) {
    const item = items[index];
    if (!item || (item.speaker !== 'user' && item.speaker !== 'agent') || typeof item.text !== 'string') continue;
    if (characters + item.text.length > MAX_TRANSCRIPT_CHARACTERS) break;
    retained.push({ speaker: item.speaker, text: item.text, timestamp: Number(item.timestamp) || Date.now() });
    characters += item.text.length;
  }
  return retained.reverse();
};

export const compactActiveInterview = (snapshot: ActiveInterviewSnapshot): ActiveInterviewSnapshot => ({
  ...snapshot,
  transcripts: compactTranscripts(snapshot.transcripts),
  codingProblems: snapshot.codingProblems.slice(-MAX_CODING_PROBLEMS),
  elapsedTime: Math.max(0, Math.floor(snapshot.elapsedTime)),
  currentProblemIndex: Math.max(0, Math.floor(snapshot.currentProblemIndex)),
  timestamp: Number(snapshot.timestamp) || Date.now(),
});

export const loadActiveInterview = (): ActiveInterviewSnapshot | null => {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem(ACTIVE_INTERVIEW_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (isSnapshot(parsed)) return compactActiveInterview(parsed);
      storage.removeItem(ACTIVE_INTERVIEW_KEY);
    } catch {
      try { storage.removeItem(ACTIVE_INTERVIEW_KEY); } catch { /* storage is unavailable */ }
    }
  }
  return null;
};

export const saveActiveInterview = (snapshot: ActiveInterviewSnapshot): boolean => {
  const serialized = JSON.stringify(compactActiveInterview({ ...snapshot, timestamp: Date.now() }));
  try {
    localStorage.setItem(ACTIVE_INTERVIEW_KEY, serialized);
    sessionStorage.removeItem(ACTIVE_INTERVIEW_KEY);
    return true;
  } catch {
    try { localStorage.removeItem(ACTIVE_INTERVIEW_KEY); } catch { /* storage is unavailable */ }
    try {
      sessionStorage.setItem(ACTIVE_INTERVIEW_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }
};

export const clearActiveInterview = () => {
  try { localStorage.removeItem(ACTIVE_INTERVIEW_KEY); } catch { /* storage is unavailable */ }
  try { sessionStorage.removeItem(ACTIVE_INTERVIEW_KEY); } catch { /* storage is unavailable */ }
};

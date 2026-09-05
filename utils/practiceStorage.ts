// utils/practiceStorage.ts
import { PracticeSession } from '../types';

const SESSION_PREFIX = 'practice_arena_session_';
const ACTIVE_KEY = 'practice_arena_active_session_id';

export const savePracticeSession = (session: PracticeSession): boolean => {
  try {
    localStorage.setItem(`${SESSION_PREFIX}${session.id}`, JSON.stringify(session));
    if (session.status === 'in-progress') localStorage.setItem(ACTIVE_KEY, session.id);
    else if (localStorage.getItem(ACTIVE_KEY) === session.id) localStorage.removeItem(ACTIVE_KEY);
    return true;
  } catch {
    return false;
  }
};

export const loadPracticeSession = (sessionId: string): PracticeSession | null => {
  try {
    const raw = localStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const loadActivePracticeSession = (): PracticeSession | null => {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    return id ? loadPracticeSession(id) : null;
  } catch {
    return null;
  }
};

export const clearActivePracticeSession = () => {
  try { localStorage.removeItem(ACTIVE_KEY); } catch { /* storage is unavailable */ }
};

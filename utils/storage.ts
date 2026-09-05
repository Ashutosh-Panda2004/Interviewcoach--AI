import { HistoryItem, ComprehensiveAnalysisReport } from '../types';
import { getSessionApiKey, setSessionApiKey } from './aiClient';

const STORAGE_KEY = 'interview_coach_history_v1';

const writeHistory = (history: HistoryItem[]): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
    return true;
  } catch {
    return false;
  }
};

// Synchronous fallback / local cache getter
export const getInterviewHistory = (): HistoryItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load local interview history", error);
    return [];
  }
};

// Kept asynchronous for API compatibility. Data is intentionally local-first
// until authenticated, per-user cloud sync is configured by a deployment.
export const getInterviewHistoryAsync = async (): Promise<HistoryItem[]> => {
  return getInterviewHistory();
};

// Save a new interview result to this browser only.
export const saveInterviewResult = (report: ComprehensiveAnalysisReport) => {
  try {
    if (!report?.meta || !Number.isFinite(report.composite?.score)) {
        console.warn("Attempted to save invalid report", report);
        return null;
    }

    const history = getInterviewHistory();
    const compositeScore = Math.max(0, Math.min(100, Math.round(report.composite.score)));
    const duration = Number.isFinite(report.meta.duration_minutes) ? Math.max(0, report.meta.duration_minutes) : 0;
    const role = report.meta.role || "Unknown Role";

    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      role: role,
      score: compositeScore, 
      duration: duration,
      feedback: report,
      isMock: false 
    };

    // Save to local cache
    if (!writeHistory([newItem, ...history])) return null;

    return newItem;
  } catch (error) {
    console.error("Failed to save interview result", error);
    return null;
  }
};

// Add history items (including local development/demo items).
export const addHistoryItems = async (items: HistoryItem[]): Promise<HistoryItem[]> => {
    try {
        const history = getInterviewHistory();
        const realHistory = history.filter(item => item.isMock !== true);
        const updatedHistory = [...items, ...realHistory];
        
        // Save locally
        if (!writeHistory(updatedHistory)) return history;

        return updatedHistory;
    } catch (error) {
        console.error("Failed to add history items", error);
        return [];
    }
};

// Remove mock items from local history.
export const removeMockItems = async (): Promise<HistoryItem[]> => {
    try {
        const history = getInterviewHistory();
        const mockItems = history.filter(item => item.isMock === true);
        const realHistory = history.filter(item => item.isMock !== true);
        
        // Update local cache
        if (!writeHistory(realHistory)) return history;

        return realHistory;
    } catch (error) {
        console.error("Failed to remove mock items", error);
        return [];
    }
};

// Clear local history.
export const clearHistory = async () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage is unavailable */ }
};

// API keys are deliberately scoped to the current tab and never written to
// localStorage or a remote database.
export const saveCustomApiKey = async (_userId: string, key: string) => {
  setSessionApiKey(key);
};

export const getCustomApiKey = async (_userId: string): Promise<string> => getSessionApiKey();

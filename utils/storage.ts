

import { HistoryItem, ComprehensiveAnalysisReport } from '../types';

const STORAGE_KEY = 'interview_coach_history_v1';

export const saveInterviewResult = (report: ComprehensiveAnalysisReport) => {
  try {
    if (!report || !report.meta) {
        console.warn("Attempted to save invalid report", report);
        return null;
    }

    const history = getInterviewHistory();
    
    // SAFETY FIX: Handle cases where the LLM returns incomplete data (e.g., short interviews)
    // Use optional chaining and default values aggressively
    const compositeScore = (report.composite && typeof report.composite.score === 'number') ? report.composite.score : 50;
    const duration = report.meta.duration_minutes || 0;
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

    const updatedHistory = [newItem, ...history];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    return newItem;
  } catch (error) {
    console.error("Failed to save interview result", error);
    return null;
  }
};

export const getInterviewHistory = (): HistoryItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load interview history", error);
    return [];
  }
};

export const addHistoryItems = (items: HistoryItem[]) => {
    try {
        const history = getInterviewHistory();
        const realHistory = history.filter(item => item.isMock !== true);
        const updatedHistory = [...items, ...realHistory];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        return updatedHistory;
    } catch (error) {
        console.error("Failed to add history items", error);
        return [];
    }
};

export const removeMockItems = () => {
    try {
        const history = getInterviewHistory();
        const realHistory = history.filter(item => item.isMock !== true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(realHistory));
        return realHistory;
    } catch (error) {
        console.error("Failed to remove mock items", error);
        return [];
    }
};

export const clearHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};
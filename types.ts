
export enum InterviewStatus {
  SETUP = 'SETUP',
  ACTIVE = 'ACTIVE',
  FEEDBACK = 'FEEDBACK',
}

export enum AppView {
  HOME = 'HOME',
  DASHBOARD = 'DASHBOARD',
  INTERVIEW = 'INTERVIEW'
}

export type InterviewType = 'Actual Interview' | 'Practice Interview';
export type InterviewerPersonality = 'Very Strict' | 'Calm & Polite' | 'Highly Helpful' | 'Neutral Professional' | 'Friendly Conversational';

export interface InterviewSettings {
  role: string;
  experienceLevel: 'Junior' | 'Mid-Level' | 'Senior' | 'Executive';
  focusArea: string;
  resumeText?: string;
  duration: number; // Duration in minutes
  difficulty: 'Easy' | 'Medium' | 'Hard';
  interviewType: InterviewType;
  personality: InterviewerPersonality;
  isBlindMode?: boolean;
  isDemoMode?: boolean; // Added for Demo Mode
  // Optional fields for extended internal compatibility
  autoAdapt?: boolean;
  language?: string;
}

export interface TranscriptionItem {
  speaker: 'user' | 'agent';
  text: string;
  timestamp: number;
}

// --- DASHBOARD TYPES ---

export interface StrengthPoint {
  id: string;
  point: string;
  detail: string;
  evidence: string[]; 
  stability: number; 
}

export interface ImprovementPoint {
  id: string;
  title: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  trend: 'improving' | 'declining' | 'stagnant';
  dimension: string;
  evidence: string;
}

export interface ResumeHighlight {
  id: string;
  start: number;
  end: number;
  type: 'strength' | 'weakness' | 'neutral' | 'missing';
  reason: string;
  suggestion?: string;
}

export interface ResumeAnalysis {
  text: string;
  highlights: ResumeHighlight[];
  topicConfidence: { topic: string; score: number; delivery: number }[];
  missingKeywords: string[];
  overallSummary?: string; 
}

export interface TokenUsage {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
}

export interface ComprehensiveAnalysisReport {
  meta: {
    candidateName: string | null;
    role: string;
    seniority: string | null;
    duration_minutes: number;
    difficulty_initial: number;
    difficulty_final: number;
    resume_uploaded: boolean;
    timestamp: string;
  };
  tokenUsage?: TokenUsage;
  composite: {
    score: number;
    stars: number;
    confidence: number;
    explanation: string;
  };
  dimensions: {
    communication: { score: number; confidence: number; breakdown: { wpm: number; clarity: number; fillerFrequency: number; pacing: number } };
    technical: { score: number; confidence: number; breakdown: { depth: number; accuracy: number; terminology: number } };
    structure: { score: number; confidence: number; breakdown: { starMethod: number; coherence: number; conciseness: number } };
    problemSolving: { score: number; confidence: number; breakdown: { analytical: number; creativity: number } } | null;
    behavioral: { score: number; confidence: number; breakdown: { empathy: number; teamwork: number; ownership: number } } | null;
    delivery: { score: number; confidence: number; breakdown: { confidence: number; tone: number } } | null;
    resumeFit: { score: number; confidence: number; breakdown: { consistency: number; impact: number } } | null;
  };
  strengths: StrengthPoint[];
  improvements: ImprovementPoint[];
  resumeAnalysis?: ResumeAnalysis;
  perQuestion: Array<{
      questionText: string;
      answerText: string;
      performanceScore: number;
      evaluation: "Strong" | "Good" | "Weak";
      feedback: string;
      suggestedAction: string;
      improvedSampleAnswer: string;
  }>;
  actionPlan: any[];
  summary: string; 
}

export interface HistoryItem {
  id: string;
  date: string;
  role: string;
  score: number;
  duration: number;
  feedback: ComprehensiveAnalysisReport;
  isMock?: boolean; 
}

// --- CODING WORKSPACE TYPES ---

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  visible: boolean;
}

export interface CodingProblem {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeLimit: number; // minutes
  tags: string[];
  initialCode: Record<string, string>; // language -> boilerplate
  testCases: TestCase[];
  expectedComplexity: string;
  hints: string[];
}

export interface TestResult {
  testId: string;
  passed: boolean;
  actualOutput: string;
  runtimeMs: number;
  memoryKb: number;
  error?: string;
}

export interface CodeSnapshot {
  id: string;
  timestamp: number;
  code: string;
  language: string;
  passed: boolean;
}

export enum InterviewStatus {
  SETUP = 'SETUP',
  HARDWARE_CHECK = 'HARDWARE_CHECK',
  ACTIVE = 'ACTIVE',
  FEEDBACK = 'FEEDBACK',
}

export enum AppView {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD',
  INTERVIEW = 'INTERVIEW',
  PRACTICE_ARENA = 'PRACTICE_ARENA',
  OPEN_SOURCE = 'OPEN_SOURCE'
}

export type InterviewType = 'Actual Interview' | 'Practice Interview';
export type InterviewerPersonality = 'Very Strict' | 'Calm & Polite' | 'Highly Helpful' | 'Neutral Professional' | 'Friendly Conversational';

export interface CompanyTrack {
  id: string;
  name: string;
  region: string;
  rounds: string[];
  tone: string;
  focusAreas: string[];
  sampleQuestions: string[];
}

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
  isCodingIntensive?: boolean; // NEW: Forces more coding questions
  // NEW: System Design Whiteboard mode
  sessionMode?: SessionMode; // 'Standard' | 'System Design'
  systemDesignScenarioId?: string; // references a template in system-design-templates.json
  systemDesignPrompt?: string; // custom scenario text when scenario is freeform/custom
  companyTrackId?: string;
  companyTrackName?: string;
  jobDescription?: string;
  // Optional fields for extended internal compatibility
  autoAdapt?: boolean;
  language?: string;
}

export type SessionMode = 'Standard' | 'System Design' | 'Campus Placement';

export interface TranscriptionItem {
  speaker: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export interface InterviewSessionResult {
  elapsedSeconds: number;
  systemDesign?: {
    state: SystemDesignState;
    scenario: string;
  };
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

// --- SYSTEM DESIGN WHITEBOARD TYPES ---

// A single component placed on the canvas.
export interface SystemDesignNode {
  id: string;
  componentType: string;   // references palette id, e.g. "load_balancer"
  label: string;           // user-editable display name
  position: { x: number; y: number };
  notes?: string;          // optional user annotation
}

// A directional connection between two nodes.
export interface SystemDesignEdge {
  id: string;
  source: string;   // node id
  target: string;   // node id
  label?: string;    // e.g. "async", "1000 req/s"
  direction: 'oneway' | 'bidirectional';
}

// The full structured state of the diagram at a point in time.
export interface SystemDesignState {
  nodes: SystemDesignNode[];
  edges: SystemDesignEdge[];
  lastModified: number; // timestamp
}

// An AI-authored marker anchored to a node (rendered on the annotation layer).
export interface AIAnnotation {
  id: string;
  nodeId: string;
  severity: 'info' | 'warning' | 'critical' | 'praise';
  message: string;
  createdAt: number;
  resolvedAt?: number;
}

// Palette entry loaded from /data/system-design-components.json.
export interface SystemDesignComponentDef {
  id: string;
  label: string;
  icon: string;      // lucide-react icon name
  category: string;
  defaultNotes?: string;
}

// Scenario template loaded from /data/system-design-templates.json.
export interface SystemDesignTemplate {
  id: string;
  title: string;
  promptText: string;
  suggestedComponents: string[]; // hint list of palette ids
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics?: SkillTopic[];
}

// A structured diff between two diagram states.
export interface SystemDesignDiff {
  addedNodes: SystemDesignNode[];
  removedNodes: SystemDesignNode[];
  relabeledNodes: { id: string; from: string; to: string }[];
  addedEdges: SystemDesignEdge[];
  removedEdges: SystemDesignEdge[];
  hasChanges: boolean;
}

// End-of-session structured evaluation of the design.
export interface SystemDesignScore {
  scalabilityScore: number;       // 0-100
  reliabilityScore: number;       // 0-100
  dataConsistencyAwareness: number;
  securityAwareness: number;
  tradeoffArticulation: number;   // did they explain WHY, not just WHAT
  missedConsiderations: string[];
  strengths: string[];
}

// --- PRACTICE ARENA TYPES ---

export type SkillTopic =
  | 'scalability'
  | 'databases'
  | 'caching'
  | 'messaging'
  | 'security'
  | 'networking'
  | 'consistency'
  | 'api_design';

export interface SkillProfile {
  userId: string;
  topicScores: Record<SkillTopic, number>;
  lastDiagnosticAt: number;
  sessionHistory: { sessionId: string; date: number; deltaByTopic: Partial<Record<SkillTopic, number>> }[];
  summary?: string;
}

export interface DiagnosticQuestion {
  id: string;
  type: 'mcq' | 'freetext';
  topic: SkillTopic;
  prompt: string;
  options?: string[];
  correctOption?: number;
}

export interface LearningResource {
  id: string;
  title: string;
  source: string;
  url: string;
  format: 'video' | 'article' | 'repo' | 'interactive';
  topics: SkillTopic[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
}

export interface RankedLearningResource extends LearningResource {
  reason: string;
  reviewed?: boolean;
}

export interface CoachTip {
  id: string;
  sessionId: string;
  timestamp: number;
  trigger: 'passive' | 'on-demand';
  message: string;
  relatedNodeId?: string;
}

export interface PracticeSession {
  id: string;
  problemId: string;
  diagramState: SystemDesignState;
  coachTips: CoachTip[];
  status: 'in-progress' | 'completed';
  timerEnabled: boolean;
  startedAt: number;
  completedAt?: number;
  score?: SystemDesignScore;
}

export interface DiagnosticAnswer {
  questionId: string;
  topic: SkillTopic;
  type: 'mcq' | 'freetext';
  selectedOption?: number;
  text?: string;
}
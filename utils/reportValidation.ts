import {
  ComprehensiveAnalysisReport,
  ImprovementPoint,
  ResumeAnalysis,
  ResumeHighlight,
  StrengthPoint,
} from '../types';

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown, label: string): UnknownRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return value as UnknownRecord;
};

const text = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

const number = (value: unknown, label: string, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  return Math.max(min, Math.min(max, value));
};

const optionalNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

const breakdown = <Key extends string>(value: unknown, keys: readonly Key[]): Record<Key, number> => {
  const source = value && typeof value === 'object' ? value as UnknownRecord : {};
  return keys.reduce<Record<Key, number>>((result, key) => {
    result[key] = optionalNumber(source[key], 0, 0, key === 'wpm' ? 300 : 100);
    return result;
  }, {} as Record<Key, number>);
};

const dimension = <Key extends string>(value: unknown, label: string, keys: readonly Key[]) => {
  const source = record(value, label);
  return {
    score: number(source.score, `${label}.score`, 0, 100),
    confidence: optionalNumber(source.confidence, 0, 0, 1),
    breakdown: breakdown(source.breakdown, keys),
  };
};

const optionalDimension = <Key extends string>(value: unknown, label: string, keys: readonly Key[]) =>
  value == null ? null : dimension(value, label, keys);

const stringArray = (value: unknown, limit = 12) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, limit)
    : [];

const strengths = (value: unknown): StrengthPoint[] =>
  Array.isArray(value) ? value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as UnknownRecord;
    const point = text(source.point);
    if (!point) return [];
    return [{
      id: text(source.id, `strength-${index}`),
      point,
      detail: text(source.detail),
      evidence: stringArray(source.evidence, 6),
      stability: optionalNumber(source.stability, 0, 0, 1),
    }];
  }).slice(0, 10) : [];

const improvements = (value: unknown): ImprovementPoint[] =>
  Array.isArray(value) ? value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as UnknownRecord;
    const title = text(source.title);
    if (!title) return [];
    const severity: ImprovementPoint['severity'] = source.severity === 'High' || source.severity === 'Low' ? source.severity : 'Medium';
    const trend: ImprovementPoint['trend'] = source.trend === 'improving' || source.trend === 'declining' ? source.trend : 'stagnant';
    return [{
      id: text(source.id, `improvement-${index}`),
      title,
      description: text(source.description),
      severity,
      trend,
      dimension: text(source.dimension, 'General'),
      evidence: text(source.evidence),
    }];
  }).slice(0, 10) : [];

const resumeAnalysis = (value: unknown): ResumeAnalysis | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as UnknownRecord;
  const resumeText = text(source.text);
  if (!resumeText) return undefined;
  const highlights: ResumeHighlight[] = Array.isArray(source.highlights)
    ? source.highlights.flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const highlight = item as UnknownRecord;
        if (
          typeof highlight.start !== 'number' || !Number.isFinite(highlight.start) ||
          typeof highlight.end !== 'number' || !Number.isFinite(highlight.end)
        ) return [];
        const start = Math.round(highlight.start);
        const end = Math.round(highlight.end);
        if (start < 0 || end <= start || end > resumeText.length) return [];
        const type: ResumeHighlight['type'] = highlight.type === 'strength' || highlight.type === 'weakness' || highlight.type === 'missing'
          ? highlight.type
          : 'neutral';
        return [{
          id: text(highlight.id, `highlight-${index}`),
          start,
          end,
          type,
          reason: text(highlight.reason),
          suggestion: text(highlight.suggestion) || undefined,
        }];
      }).slice(0, 40)
    : [];
  const topicConfidence = Array.isArray(source.topicConfidence)
    ? source.topicConfidence.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const topic = item as UnknownRecord;
        const name = text(topic.topic);
        if (!name) return [];
        return [{
          topic: name,
          score: optionalNumber(topic.score, 0, 0, 100),
          delivery: optionalNumber(topic.delivery, 0, 0, 100),
        }];
      }).slice(0, 20)
    : [];
  return {
    text: resumeText.slice(0, 100_000),
    highlights,
    topicConfidence,
    missingKeywords: stringArray(source.missingKeywords, 30),
    overallSummary: text(source.overallSummary) || undefined,
  };
};

interface ReportMetadata {
  role: string;
  durationMinutes: number;
  difficulty: string;
  resumeUploaded: boolean;
}

export const validateReport = (raw: unknown, metadata: ReportMetadata): ComprehensiveAnalysisReport => {
  const source = record(raw, 'report');
  const composite = record(source.composite, 'composite');
  const dimensions = record(source.dimensions, 'dimensions');
  const summary = text(source.summary);
  if (!summary) throw new Error('The report summary is missing.');

  const perQuestion: ComprehensiveAnalysisReport['perQuestion'] = Array.isArray(source.perQuestion)
    ? source.perQuestion.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const question = item as UnknownRecord;
        const questionText = text(question.questionText);
        if (!questionText) return [];
        const evaluation: ComprehensiveAnalysisReport['perQuestion'][number]['evaluation'] = question.evaluation === 'Strong' || question.evaluation === 'Good'
          ? question.evaluation
          : 'Weak';
        return [{
          questionText,
          answerText: text(question.answerText),
          performanceScore: optionalNumber(question.performanceScore, 0, 0, 100),
          evaluation,
          feedback: text(question.feedback),
          suggestedAction: text(question.suggestedAction),
          improvedSampleAnswer: text(question.improvedSampleAnswer),
        }];
      }).slice(0, 40)
    : [];

  return {
    meta: {
      candidateName: null,
      role: metadata.role,
      seniority: null,
      duration_minutes: Math.max(0, metadata.durationMinutes),
      difficulty_initial: metadata.difficulty === 'Easy' ? 1 : metadata.difficulty === 'Hard' ? 5 : 3,
      difficulty_final: metadata.difficulty === 'Easy' ? 1 : metadata.difficulty === 'Hard' ? 5 : 3,
      resume_uploaded: metadata.resumeUploaded,
      timestamp: new Date().toISOString(),
    },
    composite: {
      score: number(composite.score, 'composite.score', 0, 100),
      stars: Math.round(optionalNumber(composite.stars, 1, 1, 5)),
      confidence: optionalNumber(composite.confidence, 0, 0, 1),
      explanation: text(composite.explanation),
    },
    dimensions: {
      communication: dimension(dimensions.communication, 'dimensions.communication', ['wpm', 'clarity', 'fillerFrequency', 'pacing']),
      technical: dimension(dimensions.technical, 'dimensions.technical', ['depth', 'accuracy', 'terminology']),
      structure: dimension(dimensions.structure, 'dimensions.structure', ['starMethod', 'coherence', 'conciseness']),
      problemSolving: optionalDimension(dimensions.problemSolving, 'dimensions.problemSolving', ['analytical', 'creativity']),
      behavioral: optionalDimension(dimensions.behavioral, 'dimensions.behavioral', ['empathy', 'teamwork', 'ownership']),
      delivery: optionalDimension(dimensions.delivery, 'dimensions.delivery', ['confidence', 'tone']),
      resumeFit: optionalDimension(dimensions.resumeFit, 'dimensions.resumeFit', ['consistency', 'impact']),
    },
    strengths: strengths(source.strengths),
    improvements: improvements(source.improvements),
    resumeAnalysis: resumeAnalysis(source.resumeAnalysis),
    perQuestion,
    actionPlan: Array.isArray(source.actionPlan) ? source.actionPlan.slice(0, 20) : [],
    summary,
  };
};
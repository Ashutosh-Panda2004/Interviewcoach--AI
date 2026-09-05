import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, SkipForward } from 'lucide-react';
import { DiagnosticAnswer, DiagnosticQuestion, SkillProfile } from '../types';
import diagnosticData from '../data/diagnostic-questions.json';
import { scoreDiagnostic, TOPIC_LABELS } from '../utils/skillScoring';

const QUESTIONS = diagnosticData as DiagnosticQuestion[];

interface SkillDiagnosticProps {
  onComplete: (profile: SkillProfile) => void;
  onSkip?: () => void;
}

const SkillDiagnostic: React.FC<SkillDiagnosticProps> = ({ onComplete, onSkip }) => {
  const [answers, setAnswers] = useState<Record<string, DiagnosticAnswer>>({});
  const [isScoring, setIsScoring] = useState(false);
  const [scoringError, setScoringError] = useState('');

  const answeredCount = useMemo(() => QUESTIONS.filter(q => {
    const answer = answers[q.id];
    return q.type === 'mcq' ? answer?.selectedOption !== undefined : !!answer?.text?.trim();
  }).length, [answers]);

  const progress = Math.round((answeredCount / QUESTIONS.length) * 100);

  const updateMcq = (question: DiagnosticQuestion, selectedOption: number) => {
    setAnswers(prev => ({
      ...prev,
      [question.id]: { questionId: question.id, topic: question.topic, type: 'mcq', selectedOption },
    }));
  };

  const updateText = (question: DiagnosticQuestion, text: string) => {
    setAnswers(prev => ({
      ...prev,
      [question.id]: { questionId: question.id, topic: question.topic, type: 'freetext', text },
    }));
  };

  const submit = async () => {
    setIsScoring(true);
    setScoringError('');
    try {
      const profile = await scoreDiagnostic(QUESTIONS, Object.values(answers));
      onComplete(profile);
    } catch (error) {
      setScoringError(error instanceof Error ? error.message : 'Could not save your diagnostic profile.');
    } finally {
      setIsScoring(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto rise-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <span className="eyebrow">Optional · 2 minutes</span>
          <h1 className="display text-3xl md:text-4xl text-white mt-3 mb-3">Where should we start?</h1>
          <p className="max-w-xl leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            Answer what you can — skip anything you're unsure about. There's no score and no pass/fail;
            it simply helps tailor your resources and practice.
          </p>
        </div>
        {onSkip && (
          <button onClick={onSkip} className="btn btn-ghost shrink-0">
            <SkipForward className="w-4 h-4" /> Skip
          </button>
        )}
      </div>

      {/* Sticky progress */}
      <div className="sticky top-[72px] z-10 surface p-4 mb-6 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">{answeredCount}<span style={{ color: 'var(--ink-faint)' }}>/{QUESTIONS.length}</span></span>
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>answered</span>
        </div>
        <div className="flex-1 max-w-xs mx-4 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-4)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
        </div>
        <button
          onClick={submit}
          disabled={isScoring || answeredCount === 0}
          className="btn btn-primary"
        >
          {isScoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          {isScoring ? 'Building…' : 'See report'}
        </button>
      </div>

      {/* Questions */}
      {scoringError && (
        <div role="alert" className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {scoringError}
        </div>
      )}
      <div className="space-y-4">
        {QUESTIONS.map((question, index) => {
          const answered = !!answers[question.id];
          return (
            <div key={question.id} className="surface p-5 transition-all" style={answered ? { borderColor: 'var(--accent-line)' } : undefined}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--accent)' }}>
                    {String(index + 1).padStart(2, '0')} · {TOPIC_LABELS[question.topic]}
                  </p>
                  <h3 className="text-white font-semibold leading-snug text-[15px]">{question.prompt}</h3>
                </div>
                {answered && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--accent)' }} />}
              </div>

              {question.type === 'mcq' ? (
                <div className="grid md:grid-cols-2 gap-2">
                  {(question.options || []).map((option, optionIndex) => {
                    const selected = answers[question.id]?.selectedOption === optionIndex;
                    return (
                      <button
                        key={option}
                        onClick={() => updateMcq(question, optionIndex)}
                        className="text-left p-3.5 rounded-xl border text-sm transition-all"
                        style={selected
                          ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', color: 'var(--ink)' }
                          : { background: 'var(--bg-1)', borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  aria-label={`Answer for ${question.prompt}`}
                  value={answers[question.id]?.text || ''}
                  onChange={e => updateText(question, e.target.value)}
                  placeholder="A sentence or two is plenty — or leave it blank."
                  className="field resize-y"
                  style={{ minHeight: '96px' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        {onSkip ? (
          <button onClick={onSkip} className="btn btn-ghost">
            <SkipForward className="w-4 h-4" /> Skip and just practice
          </button>
        ) : <span />}
        <button
          onClick={submit}
          disabled={isScoring || answeredCount === 0}
          className="btn btn-primary btn-lg w-full sm:w-auto"
        >
          {isScoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          {isScoring ? 'Building your report…' : 'See my skill report'}
        </button>
      </div>
    </div>
  );
};

export default SkillDiagnostic;

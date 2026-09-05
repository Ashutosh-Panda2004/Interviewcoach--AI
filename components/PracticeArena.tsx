import React, { useMemo, useState } from 'react';
import { ArrowRight, Compass, PlayCircle, Sparkles, Target, BookOpen, TrendingUp, Rocket, ChevronRight } from 'lucide-react';
import { SkillProfile, SystemDesignTemplate } from '../types';
import SkillDiagnostic from './SkillDiagnostic';
import SkillReport from './SkillReport';
import LearningPathPanel from './LearningPathPanel';
import ProblemBrowser from './ProblemBrowser';
import PracticeCanvas from './PracticeCanvas';
import GrowthDashboard from './GrowthDashboard';
import { loadSkillProfile, createBaselineProfile } from '../utils/skillScoring';
import { rankPracticeProblems } from '../utils/practiceProblemRanking';
import { loadActivePracticeSession } from '../utils/practiceStorage';
import templatesData from '../data/system-design-templates.json';

const TEMPLATES = templatesData as SystemDesignTemplate[];

type ArenaStage = 'gate' | 'diagnostic' | 'hub' | 'canvas';

const STEPS = [
  { id: 'diagnose', label: 'Diagnose', icon: Compass, blurb: 'A quick, optional skill check' },
  { id: 'learn', label: 'Learn', icon: BookOpen, blurb: 'Curated free resources' },
  { id: 'practice', label: 'Practice', icon: Target, blurb: 'Untimed whiteboard + coach' },
  { id: 'grow', label: 'Grow', icon: TrendingUp, blurb: 'Track progress over time' },
];

const StepRail: React.FC<{ activeIndex: number }> = ({ activeIndex }) => (
  <div className="surface p-4 sm:p-5 rise-in">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {STEPS.map((step, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo';
        return (
          <div key={step.id} className="flex items-start gap-3">
            <span className="step-node" data-state={state}>
              {state === 'done' ? '✓' : index + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <step.icon className="w-3.5 h-3.5" style={{ color: state === 'todo' ? 'var(--ink-faint)' : 'var(--accent)' }} />
                <p className="text-sm font-bold" style={{ color: state === 'todo' ? 'var(--ink-muted)' : 'var(--ink)' }}>{step.label}</p>
              </div>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-faint)' }}>{step.blurb}</p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const PracticeArena: React.FC = () => {
  const [profile, setProfile] = useState<SkillProfile | null>(() => loadSkillProfile());
  const [stage, setStage] = useState<ArenaStage>(() => (loadSkillProfile() ? 'hub' : 'gate'));
  const [selectedProblem, setSelectedProblem] = useState<SystemDesignTemplate | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const activeSession = useMemo(() => loadActivePracticeSession(), [stage]);

  const resumeProblem = activeSession ? TEMPLATES.find(t => t.id === activeSession.problemId) : null;

  const handleSelectProblem = (problem: SystemDesignTemplate) => {
    setSelectedProblem(problem);
    setStage('canvas');
  };

  const handleSkipDiagnostic = () => {
    try {
      setProfile(createBaselineProfile());
      setStage('hub');
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : 'Could not save your starter practice profile.');
    }
  };

  const quickStart = () => {
    try {
      const p = profile || createBaselineProfile();
      const recommended = resumeProblem || rankPracticeProblems(TEMPLATES, p)[0] || TEMPLATES.find(t => t.id !== 'freeform');
      
      if (recommended) {
        setProfile(p);
        setSelectedProblem(recommended);
        setStage('canvas');
      } else {
        setProfile(p);
        setStage('hub');
      }
    } catch (error) {
      console.error('Error in quickStart:', error);
      setRenderError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Show error if render fails
  if (renderError) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-red-950/20 border border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-300 mb-2">Error in Practice Arena</h2>
          <p className="text-red-200 mb-4">{renderError}</p>
          <button 
            onClick={() => setRenderError(null)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold text-white"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ---- DIAGNOSTIC ----
  if (stage === 'diagnostic') {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <SkillDiagnostic
          onComplete={(nextProfile) => { setProfile(nextProfile); setStage('hub'); }}
          onSkip={handleSkipDiagnostic}
        />
      </div>
    );
  }

  // ---- PRACTICE CANVAS ----
  if (stage === 'canvas' && selectedProblem && profile) {
    return (
      <PracticeCanvas
        problem={selectedProblem}
        profile={profile}
        existingSession={activeSession?.problemId === selectedProblem.id ? activeSession : null}
        onBack={() => setStage('hub')}
        onComplete={(nextProfile) => { setProfile(nextProfile); setStage('hub'); }}
      />
    );
  }

  // ---- WELCOME GATE (first visit, fully skippable) ----
  if (stage === 'gate' || !profile) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-2xl mb-10 rise-in">
          <span className="eyebrow">Practice &amp; Learn</span>
          <h1 className="display text-4xl md:text-6xl text-white mt-4 mb-5">
            Your calm space to<br />get interview-ready.
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            No timer, no pressure. Diagnose where you stand, learn from vetted free resources, then
            practice with an on-demand coach — for any profession.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 stagger">
          <button
            onClick={() => setStage('diagnostic')}
            className="surface surface-hover text-left p-7 group"
            style={{ borderColor: 'var(--accent-line)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}>
                <Compass className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <span className="badge" style={{ color: 'var(--accent)', borderColor: 'var(--accent-line)' }}>Recommended</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Take a 2-minute diagnostic</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-muted)' }}>
              A short, no-pressure skill check so we can tailor resources and practice problems to you.
            </p>
            <span className="inline-flex items-center text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              Start diagnostic <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>

          <button
            onClick={handleSkipDiagnostic}
            className="surface surface-hover text-left p-7 group"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
                <Rocket className="w-5 h-5" style={{ color: 'var(--ink-soft)' }} />
              </div>
              <span className="badge">Skip for now</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Just start practicing</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-muted)' }}>
              Jump straight to the whiteboard. We'll begin with a balanced plan and calibrate as you go.
            </p>
            <span className="inline-flex items-center text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>
              Skip to practice <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>
        </div>

        <div className="mt-10">
          <StepRail activeIndex={0} />
        </div>
      </div>
    );
  }

  // ---- HUB ----
  const isBaseline = profile.lastDiagnosticAt === 0;
  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12 pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8 rise-in">
        <div>
          <span className="eyebrow">Practice &amp; Learn</span>
          <h1 className="display text-4xl md:text-5xl text-white mt-3 mb-3">Practice Arena</h1>
          <p className="max-w-xl leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            Diagnose, learn, apply on the whiteboard, and ask for feedback whenever you want — at your own pace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={() => setStage('diagnostic')} className="btn btn-secondary">
            <Compass className="w-4 h-4" /> {isBaseline ? 'Take Diagnostic' : 'Retake Diagnostic'}
          </button>
          <button onClick={quickStart} className="btn btn-primary">
            <PlayCircle className="w-4 h-4" /> {resumeProblem ? 'Resume Practice' : 'Quick Start'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <StepRail activeIndex={isBaseline ? 0 : 1} />
      </div>

      {isBaseline && (
        <div className="surface p-5 mb-6 flex items-start gap-3 rise-in" style={{ borderColor: 'var(--accent-line)', background: 'linear-gradient(180deg, var(--accent-soft), transparent 60%)' }}>
          <Sparkles className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            You're on a balanced starter plan. Take the quick diagnostic anytime to personalise your resources and
            problem recommendations — or just keep practicing and we'll learn your strengths automatically.
          </p>
        </div>
      )}

      {resumeProblem && (
        <button
          onClick={() => handleSelectProblem(resumeProblem)}
          className="surface surface-hover w-full text-left p-5 mb-6 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}>
              <PlayCircle className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>In progress</p>
              <p className="font-bold text-white">{resumeProblem.title}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--ink-muted)' }} />
        </button>
      )}

      <div className="grid xl:grid-cols-[1fr_1.1fr] gap-5 mb-6 stagger">
        <SkillReport profile={profile} onRetake={() => setStage('diagnostic')} />
        <LearningPathPanel profile={profile} />
      </div>

      <div className="mb-6 rise-in">
        <ProblemBrowser profile={profile} onSelect={handleSelectProblem} />
      </div>

      <GrowthDashboard profile={profile} />
    </div>
  );
};

export default PracticeArena;

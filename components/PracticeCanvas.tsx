import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Loader2, TimerReset } from 'lucide-react';
import { PracticeSession, SkillProfile, SystemDesignState, SystemDesignTemplate } from '../types';
import AdvancedDesignCanvas from './AdvancedDesignCanvas';
import CoachPanel from './CoachPanel';
import { askPracticeCoach } from '../utils/practiceCoach';
import { savePracticeSession } from '../utils/practiceStorage';
import { scoreSystemDesign } from '../utils/systemDesignScoring';
import { updateProfileFromSystemDesignScore } from '../utils/skillScoring';

const emptyState = (): SystemDesignState => ({ nodes: [], edges: [], lastModified: Date.now() });

interface PracticeCanvasProps {
  problem: SystemDesignTemplate;
  profile: SkillProfile;
  existingSession?: PracticeSession | null;
  onBack: () => void;
  onComplete: (profile: SkillProfile) => void;
}

const PracticeCanvas: React.FC<PracticeCanvasProps> = ({ problem, profile, existingSession, onBack, onComplete }) => {
  const [session, setSession] = useState<PracticeSession>(() =>
    existingSession && existingSession.problemId === problem.id
      ? existingSession
      : {
          id: crypto.randomUUID(),
          problemId: problem.id,
          diagramState: emptyState(),
          coachTips: [],
          status: 'in-progress',
          timerEnabled: false,
          startedAt: Date.now(),
        }
  );
  const [coachCollapsed, setCoachCollapsed] = useState(() => window.innerWidth < 1100);
  const [asking, setAsking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  // Latest diagram lives in a ref so canvas updates don't retrigger renders.
  const diagramRef = useRef<SystemDesignState>(session.diagramState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  const storageKey = useMemo(() => `practice_arena_canvas_${session.id}`, [session.id]);

  useEffect(() => {
    if (!savePracticeSession(session)) {
      setPersistenceWarning('Practice recovery storage is unavailable. Keep this page open until you finish.');
    } else {
      setPersistenceWarning(null);
    }
  }, [session]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.classList.add('practice-canvas-active');
    document.body.style.overflow = 'hidden';
    backButtonRef.current?.focus();
    return () => {
      document.body.classList.remove('practice-canvas-active');
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    if (!session.timerEnabled) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - session.startedAt) / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, [session.timerEnabled, session.startedAt]);

  useEffect(() => {
    const collapseCoachOnNarrowScreen = () => {
      if (window.innerWidth < 1100) setCoachCollapsed(true);
    };
    collapseCoachOnNarrowScreen();
    window.addEventListener('resize', collapseCoachOnNarrowScreen);
    return () => window.removeEventListener('resize', collapseCoachOnNarrowScreen);
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  const handleStateChange = (diagramState: SystemDesignState) => {
    diagramRef.current = diagramState;
    setCompletionError(null);
    // Debounce persistence to keep the canvas smooth while dragging.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSession(prev => ({ ...prev, diagramState }));
    }, 400);
  };

  const handleAskCoach = async () => {
    setAsking(true);
    const tip = await askPracticeCoach(session, diagramRef.current, problem);
    setSession(prev => ({ ...prev, coachTips: [tip, ...prev.coachTips] }));
    setAsking(false);
    setCoachCollapsed(false);
  };

  const handleDone = async () => {
    const finalState = diagramRef.current;
    if (finalState.nodes.length < 2 || finalState.edges.length < 1) {
      setCompletionError('Add at least two components and connect them before completing this practice.');
      return;
    }
    setCompletionError(null);
    setFinishing(true);
    try {
      const score = await scoreSystemDesign(finalState, [], {
        scenario: problem.promptText,
        experienceLevel: 'Practice',
      });
      const completed: PracticeSession = {
        ...session,
        diagramState: finalState,
        status: 'completed',
        completedAt: Date.now(),
        score,
      };
      if (!savePracticeSession(completed)) {
        throw new Error('Browser storage is unavailable. Allow site storage before completing this practice.');
      }
      const nextProfile = updateProfileFromSystemDesignScore(profile, completed.id, score);
      try { localStorage.removeItem(storageKey); } catch { /* cleanup is best effort */ }
      onComplete(nextProfile);
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'Could not complete this practice session.');
    } finally {
      setFinishing(false);
    }
  };

  const formattedTime = `${Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Practice canvas: ${problem.title}`} className="fixed inset-0 bg-slate-950 text-white z-50 flex flex-col animate-fade-in">
      <header className="min-h-16 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 px-3 py-2 shrink-0 sm:px-5">
        <div className="flex items-center min-w-0 flex-1">
          <button
            ref={backButtonRef}
            onClick={onBack}
            aria-label="Return to Practice Arena"
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white mr-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em]">
              Practice Arena
            </p>
            <h2 className="font-bold text-white truncate">{problem.title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() =>
              setSession(prev => ({
                ...prev,
                timerEnabled: !prev.timerEnabled,
                startedAt: prev.timerEnabled ? prev.startedAt : Date.now(),
              }))
            }
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center ${
              session.timerEnabled
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" /> {session.timerEnabled ? formattedTime : 'Timer Off'}
          </button>
          {session.timerEnabled && (
            <button
              onClick={() => {
                setElapsed(0);
                setSession(prev => ({ ...prev, startedAt: Date.now() }));
              }}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
              title="Reset timer"
            >
              <TimerReset className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleDone}
            disabled={finishing}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold flex items-center"
          >
            {finishing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            {finishing ? 'Scoring...' : 'Done'}
          </button>
        </div>
      </header>

      {/* Problem prompt strip */}
      <div className="shrink-0 bg-slate-900/50 border-b border-slate-800 px-5 py-2.5">
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
          <span className="text-slate-500 font-semibold uppercase tracking-wide text-[10px] mr-2">
            Prompt
          </span>
          {problem.promptText}
        </p>
      </div>

      {persistenceWarning && (
        <div role="alert" className="shrink-0 border-b border-amber-700/40 bg-amber-950/60 px-5 py-2 text-xs text-amber-100">
          {persistenceWarning}
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative">
        <main className="flex flex-1 min-w-0 flex-col p-3">
          {completionError && (
            <div role="alert" className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
              {completionError}
            </div>
          )}
          <div className="min-h-0 flex-1">
            <AdvancedDesignCanvas
              scenarioTitle={problem.title}
              suggestedComponents={problem.suggestedComponents}
              initialState={session.diagramState}
              onStateChange={handleStateChange}
            />
          </div>
        </main>
        {!coachCollapsed && (
          <button
            className="practice-coach-backdrop"
            onClick={() => setCoachCollapsed(true)}
            aria-label="Close coach panel"
          />
        )}
        <CoachPanel
          tips={session.coachTips}
          collapsed={coachCollapsed}
          asking={asking}
          onToggle={() => setCoachCollapsed(v => !v)}
          onAsk={handleAskCoach}
        />
      </div>
    </div>
  );
};

export default PracticeCanvas;

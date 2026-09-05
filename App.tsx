
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { InterviewSessionResult, InterviewStatus, InterviewSettings, TranscriptionItem, AppView } from './types';
import Navbar from './components/Navbar';
import SiteFooter from './components/SiteFooter';
import { ErrorBoundary } from './components/ErrorBoundary';
import { urlToView, viewToUrl, updateUrl, onUrlChange } from './router';
import { getLiveCredentials, type LiveCredentials } from './utils/aiClient';
import { clearActiveInterview, loadActiveInterview } from './utils/activeSessionStorage';

const Setup = lazy(() => import('./components/Setup'));
const LiveInterview = lazy(() => import('./components/LiveInterview'));
const Feedback = lazy(() => import('./components/Feedback'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const PracticeArena = lazy(() => import('./components/PracticeArena'));
const HardwareCheck = lazy(() => import('./components/HardwareCheck'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const OpenSourcePage = lazy(() => import('./components/OpenSourcePage'));

const PageLoader = () => (
  <div className="flex min-h-[420px] items-center justify-center" role="status" aria-label="Loading view">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
  </div>
);

const loadResumableSettings = (): InterviewSettings | null => {
  const session = loadActiveInterview();
  const isRecent = session && Date.now() - session.timestamp < 12 * 60 * 60 * 1000;
  if (!session || !isRecent || !session.settings?.role || !session.settings.duration) {
    clearActiveInterview();
    return null;
  }
  return session.settings;
};

function App() {
  const restoredSettings = useRef(loadResumableSettings()).current;
  // Routing State
  const [currentView, setCurrentView] = useState<AppView>(() => {
    return restoredSettings ? AppView.INTERVIEW : urlToView(window.location.pathname);
  });
  
  // Interview State
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>(
    restoredSettings ? InterviewStatus.HARDWARE_CHECK : InterviewStatus.SETUP
  );
  const [settings, setSettings] = useState<InterviewSettings | null>(restoredSettings);
  
  // Pre-filled settings for "Generate Session" feature from Dashboard
  const [initialSettings, setInitialSettings] = useState<Partial<InterviewSettings> | null>(null);
  
  const [transcripts, setTranscripts] = useState<TranscriptionItem[]>([]);
  const [sessionResult, setSessionResult] = useState<InterviewSessionResult | null>(null);
  const [liveCredentials, setLiveCredentials] = useState<LiveCredentials | null>(null);

  useEffect(() => {
    if (restoredSettings && window.location.pathname !== viewToUrl(AppView.INTERVIEW)) {
      window.history.replaceState({}, '', viewToUrl(AppView.INTERVIEW));
    }
  }, [restoredSettings]);

  // Listen to URL changes (browser back/forward)
  useEffect(() => {
    const unsubscribe = onUrlChange((view) => {
      if (interviewStatus === InterviewStatus.ACTIVE && view !== currentView) {
        if (!window.confirm('Leaving now will end your current interview session. Continue?')) {
          window.history.replaceState({}, '', viewToUrl(currentView));
          return;
        }
        clearActiveInterview();
        setInterviewStatus(InterviewStatus.SETUP);
      }
      setCurrentView(view);
    });
    return unsubscribe;
  }, [currentView, interviewStatus]);

  useEffect(() => {
    const titles: Record<AppView, string> = {
      [AppView.LANDING]: 'InterviewCoach — Open interview rehearsal studio',
      [AppView.INTERVIEW]: 'Compose an interview — InterviewCoach',
      [AppView.PRACTICE_ARENA]: 'Practice Arena — InterviewCoach',
      [AppView.DASHBOARD]: 'Progress — InterviewCoach',
      [AppView.OPEN_SOURCE]: 'Open source — InterviewCoach',
    };
    document.title = titles[currentView];
  }, [currentView]);

  const handleNavigate = (view: AppView) => {
    // If currently in an interview, confirm before leaving
    if (interviewStatus === InterviewStatus.ACTIVE && view !== AppView.INTERVIEW) {
      if (!window.confirm("Leaving now will end your current interview session. Continue?")) {
        return;
      }
      setInterviewStatus(InterviewStatus.SETUP);
    }
    setCurrentView(view);
    updateUrl(view);
  };

  // Called from Dashboard to start a focused session
  const handleStartFocusedSession = (focusSettings: Partial<InterviewSettings>) => {
      setInitialSettings(focusSettings);
      setInterviewStatus(InterviewStatus.SETUP);
      setCurrentView(AppView.INTERVIEW);
      updateUrl(AppView.INTERVIEW);
  };

  const handleStartInterview = (newSettings: InterviewSettings) => {
    clearActiveInterview();
    setSettings(newSettings);
    setInterviewStatus(InterviewStatus.HARDWARE_CHECK);
    setCurrentView(AppView.INTERVIEW);
    setInitialSettings(null); // Clear pre-fill
    updateUrl(AppView.INTERVIEW);
  };

  const handleHardwareConfirmed = async () => {
    const credentials = await getLiveCredentials();
    setLiveCredentials(credentials);
    setInterviewStatus(InterviewStatus.ACTIVE);
  };

  const handleHardwareCancel = () => {
    clearActiveInterview();
    setInterviewStatus(InterviewStatus.SETUP);
  };

  const handleEndInterview = (finalTranscripts: TranscriptionItem[], result: InterviewSessionResult) => {
    setTranscripts(finalTranscripts);
    setSessionResult(result);
    setInterviewStatus(InterviewStatus.FEEDBACK);
    // We stay in the 'Home/Interview' context to show feedback, 
    // user can manually navigate to Dashboard later.
  };

  const handleRestart = () => {
    setInterviewStatus(InterviewStatus.SETUP);
    setSettings(null);
    setTranscripts([]);
    setSessionResult(null);
    setLiveCredentials(null);
    clearActiveInterview();
    setCurrentView(AppView.INTERVIEW);
    updateUrl(AppView.INTERVIEW);
  };

  // SPECIAL CASE: Live Interview Mode (Full Screen, No Navbar)
  if (interviewStatus === InterviewStatus.ACTIVE && settings && liveCredentials) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <LiveInterview settings={settings} initialCredentials={liveCredentials} onEnd={handleEndInterview} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-transparent text-slate-200 selection:bg-cyan-500/30 flex flex-col">
        
        {/* Navigation */}
        <Navbar currentView={currentView} onNavigate={handleNavigate} />

        <main className="flex-1 w-full">
          <Suspense fallback={<PageLoader />}>

          {currentView === AppView.LANDING && (
            <LandingPage onNavigate={handleNavigate} />
          )}
          
          {/* VIEW: DASHBOARD */}
          {currentView === AppView.DASHBOARD && (
            <ErrorBoundary>
              <Dashboard onStartSession={handleStartFocusedSession} />
            </ErrorBoundary>
          )}

          {/* VIEW: PRACTICE ARENA */}
          {currentView === AppView.PRACTICE_ARENA && (
            <ErrorBoundary>
              <PracticeArena />
            </ErrorBoundary>
          )}

          {currentView === AppView.OPEN_SOURCE && (
            <OpenSourcePage onNavigate={handleNavigate} />
          )}

          {/* VIEW: INTERVIEW / HARDWARE / FEEDBACK */}
          {currentView === AppView.INTERVIEW && (
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
              
              {interviewStatus === InterviewStatus.SETUP && (
                <ErrorBoundary>
                  <Setup onStart={handleStartInterview} initialSettings={initialSettings} />
                </ErrorBoundary>
              )}

              {interviewStatus === InterviewStatus.HARDWARE_CHECK && settings && (
                <ErrorBoundary>
                  <HardwareCheck onCancel={handleHardwareCancel} onConfirmed={handleHardwareConfirmed} />
                </ErrorBoundary>
              )}

              {interviewStatus === InterviewStatus.FEEDBACK && (
                <ErrorBoundary>
                  <Feedback 
                    transcripts={transcripts} 
                    onRestart={handleRestart} 
                    resumeContext={settings?.resumeText}
                    sessionResult={sessionResult}
                    interviewSettings={settings ? {
                        role: settings.role,
                        difficulty: settings.difficulty,
                      duration: settings.duration,
                      companyTrackName: settings.companyTrackName,
                      jobDescription: settings.jobDescription
                    } : undefined}
                  />
                </ErrorBoundary>
              )}
            </div>
          )}
          </Suspense>
        </main>
        
        {interviewStatus === InterviewStatus.SETUP && currentView === AppView.INTERVIEW && (
            <footer className="text-center py-8 text-slate-600 text-sm border-t border-slate-900/50 mt-auto">
              <p>Audio performs best in Chrome or Edge with headphones.</p>
            </footer>
        )}
        {currentView !== AppView.INTERVIEW && (
          <SiteFooter onNavigate={handleNavigate} />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;

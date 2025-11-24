
import React, { useState } from 'react';
import { InterviewStatus, InterviewSettings, TranscriptionItem, AppView } from './types';
import Setup from './components/Setup';
import LiveInterview from './components/LiveInterview';
import Feedback from './components/Feedback';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';

function App() {
  // Routing State
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  
  // Interview State
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>(InterviewStatus.SETUP);
  const [settings, setSettings] = useState<InterviewSettings | null>(null);
  
  // Pre-filled settings for "Generate Session" feature from Dashboard
  const [initialSettings, setInitialSettings] = useState<Partial<InterviewSettings> | null>(null);
  
  const [transcripts, setTranscripts] = useState<TranscriptionItem[]>([]);

  const handleNavigate = (view: AppView) => {
    // If currently in an interview, confirm before leaving
    if (interviewStatus === InterviewStatus.ACTIVE && view !== AppView.INTERVIEW) {
      if (!window.confirm("Leaving now will end your current interview session. Continue?")) {
        return;
      }
      setInterviewStatus(InterviewStatus.SETUP);
    }
    setCurrentView(view);
  };

  // Called from Dashboard to start a focused session
  const handleStartFocusedSession = (focusSettings: Partial<InterviewSettings>) => {
      setInitialSettings(focusSettings);
      setInterviewStatus(InterviewStatus.SETUP);
      setCurrentView(AppView.HOME);
  };

  const handleStartInterview = (newSettings: InterviewSettings) => {
    setSettings(newSettings);
    setInterviewStatus(InterviewStatus.ACTIVE);
    setCurrentView(AppView.INTERVIEW); // Ensure we are in the interview context
    setInitialSettings(null); // Clear pre-fill
  };

  const handleEndInterview = (finalTranscripts: TranscriptionItem[]) => {
    setTranscripts(finalTranscripts);
    setInterviewStatus(InterviewStatus.FEEDBACK);
    // We stay in the 'Home/Interview' context to show feedback, 
    // user can manually navigate to Dashboard later.
  };

  const handleRestart = () => {
    setInterviewStatus(InterviewStatus.SETUP);
    setSettings(null);
    setTranscripts([]);
    setCurrentView(AppView.HOME);
  };

  // SPECIAL CASE: Live Interview Mode (Full Screen, No Navbar)
  if (interviewStatus === InterviewStatus.ACTIVE && settings) {
    return <LiveInterview settings={settings} onEnd={handleEndInterview} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30 flex flex-col">
      
      {/* Navigation */}
      <Navbar currentView={currentView} onNavigate={handleNavigate} />

      <main className="flex-1 w-full">
        
        {/* VIEW: DASHBOARD */}
        {currentView === AppView.DASHBOARD && (
          <Dashboard onStartSession={handleStartFocusedSession} />
        )}

        {/* VIEW: HOME / INTERVIEW / FEEDBACK */}
        {(currentView === AppView.HOME || currentView === AppView.INTERVIEW) && (
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            
            {interviewStatus === InterviewStatus.SETUP && (
              <Setup onStart={handleStartInterview} initialSettings={initialSettings} />
            )}

            {interviewStatus === InterviewStatus.FEEDBACK && (
              <Feedback 
                transcripts={transcripts} 
                onRestart={handleRestart} 
                resumeContext={settings?.resumeText}
                interviewSettings={settings ? {
                    role: settings.role,
                    difficulty: settings.difficulty,
                    duration: settings.duration
                } : undefined}
              />
            )}
          </div>
        )}
      </main>
      
      {interviewStatus === InterviewStatus.SETUP && currentView !== AppView.DASHBOARD && (
          <footer className="text-center py-8 text-slate-600 text-sm border-t border-slate-900/50 mt-auto">
            <p>Optimized for Chrome & Edge. Use headphones for the best audio experience.</p>
          </footer>
      )}
    </div>
  );
}

export default App;

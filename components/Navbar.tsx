import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Dumbbell,
  Github,
  Home,
  KeyRound,
  Menu,
  Mic2,
  X,
} from 'lucide-react';
import { AppView } from '../types';
import { getAiConfig, getSessionApiKey } from '../utils/aiClient';
import ApiKeyDialog from './ApiKeyDialog';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const navItems = [
  { id: AppView.LANDING, label: 'Home', icon: Home },
  { id: AppView.INTERVIEW, label: 'Interview', icon: Mic2 },
  { id: AppView.PRACTICE_ARENA, label: 'Practice', icon: Dumbbell },
  { id: AppView.DASHBOARD, label: 'Progress', icon: BarChart3 },
  { id: AppView.OPEN_SOURCE, label: 'Open source', icon: Github },
];

const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(() => getSessionApiKey());
  const [serverAiReady, setServerAiReady] = useState(false);

  useEffect(() => {
    getAiConfig()
      .then(config => setServerAiReady(config.aiConfigured))
      .catch(() => setServerAiReady(false));
  }, []);

  const navigate = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  const aiState = sessionKey ? 'Session key' : serverAiReady ? 'AI ready' : 'Connect AI';

  return (
    <>
      <nav className="legacy-nav" aria-label="Primary navigation">
        <div className="legacy-nav-inner">
          <button className="brand-lockup" onClick={() => navigate(AppView.LANDING)} aria-label="InterviewCoach home">
            <span className="brand-seal" aria-hidden="true">IC</span>
            <span>
              <strong>InterviewCoach</strong>
              <small>Open rehearsal studio</small>
            </span>
          </button>

          <div className="legacy-nav-links">
            {navItems.map(item => (
              <button
                key={item.id}
                className="legacy-nav-link"
                data-active={currentView === item.id}
                onClick={() => navigate(item.id)}
                aria-current={currentView === item.id ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="legacy-nav-actions">
            <button
              className="ai-access-button"
              data-ready={Boolean(sessionKey || serverAiReady)}
              onClick={() => setKeyDialogOpen(true)}
              aria-label={`AI access: ${aiState}`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>{aiState}</span>
            </button>
            <button
              className="mobile-menu-button"
              onClick={() => setMobileOpen(value => !value)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="mobile-nav-panel">
            {navItems.map(item => (
              <button
                key={item.id}
                data-active={currentView === item.id}
                onClick={() => navigate(item.id)}
              >
                <item.icon aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
            <button className="mobile-ai-link" onClick={() => { setMobileOpen(false); setKeyDialogOpen(true); }}>
              <KeyRound aria-hidden="true" />
              <span>{aiState}</span>
            </button>
          </div>
        )}
      </nav>

      {keyDialogOpen && (
        <ApiKeyDialog
          initialKey={sessionKey}
          serverAiReady={serverAiReady}
          onClose={() => setKeyDialogOpen(false)}
          onSaved={key => {
            setSessionKey(key);
          }}
        />
      )}
    </>
  );
};

export default Navbar;

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  X,
} from 'lucide-react';
import {
  ApiError,
  getSessionApiKey,
  setSessionApiKey,
  validateAiAccess,
} from '../utils/aiClient';

interface ApiKeyDialogProps {
  initialKey: string;
  serverAiReady: boolean;
  onClose: () => void;
  onSaved: (key: string) => void;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({
  initialKey,
  serverAiReady,
  onClose,
  onSaved,
}) => {
  const [key, setKey] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'success'>('idle');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && status !== 'checking') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, status]);

  const verifyAndSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = key.trim();
    const localHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!trimmed && !serverAiReady) {
      setError('Paste a Gemini API key to continue.');
      return;
    }
    if (trimmed && trimmed.length < 20) {
      setError('This key appears incomplete. Copy the full key from Google AI Studio.');
      return;
    }
    if (trimmed && !window.isSecureContext && !localHost) {
      setError('Open this site over HTTPS before entering an API key.');
      return;
    }

    const previousKey = getSessionApiKey();
    setError('');
    setStatus('checking');
    if (!setSessionApiKey(trimmed)) {
      setStatus('idle');
      setError('This browser is blocking session storage. Allow site storage, then retry.');
      return;
    }

    try {
      await validateAiAccess();
      onSaved(trimmed);
      setStatus('success');
      window.setTimeout(onClose, 900);
    } catch (validationError) {
      setSessionApiKey(previousKey);
      setStatus('idle');
      setError(validationError instanceof ApiError
        ? validationError.message
        : 'Could not verify this key. Check your connection and retry.');
    }
  };

  return (
    <div
      className="key-dialog-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget && status !== 'checking') onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-dialog-title"
        className="key-dialog"
      >
        <button className="key-dialog-close" onClick={onClose} aria-label="Close API key guide" disabled={status === 'checking'}>
          <X className="h-4 w-4" />
        </button>

        <div className="key-dialog-intro">
          <span className="key-dialog-mark"><KeyRound aria-hidden="true" /></span>
          <div>
            <p className="section-kicker">Private AI access</p>
            <h2 id="key-dialog-title">Connect Gemini in under a minute.</h2>
            <p>
              Google AI Studio issues the key. InterviewCoach keeps it only for this browser tab
              and verifies it before starting a session.
            </p>
          </div>
        </div>

        <ol className="key-steps">
          <li>
            <span>01</span>
            <div>
              <strong>Open Google AI Studio</strong>
              <p>Sign in with a Google account and open the API key page.</p>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Open AI Studio <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Create an API key</strong>
              <p>Choose <em>Create API key</em>, select a project if asked, then copy the result.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Verify it here</strong>
              <p>Paste the key below. A small request confirms that Gemini is available.</p>
            </div>
          </li>
        </ol>

        <form onSubmit={verifyAndSave} className="key-form">
          <label htmlFor="gemini-key">Gemini API key</label>
          <div className="key-input-wrap">
            <input
              ref={inputRef}
              id="gemini-key"
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={event => setKey(event.target.value)}
              placeholder={serverAiReady ? 'Optional: use your own key' : 'Paste the key from AI Studio'}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" onClick={() => setShowKey(value => !value)} aria-label={showKey ? 'Hide API key' : 'Show API key'}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p className="key-error" role="alert">{error}</p>}
          <div className="key-privacy">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            <span>Tab-only storage. Never written to interview history or a database.</span>
          </div>

          <div className="key-actions">
            {initialKey && (
              <button
                type="button"
                className="legacy-button legacy-button-quiet"
                onClick={() => {
                  if (!setSessionApiKey('')) {
                    setError('This browser is blocking session storage. Allow site storage, then retry.');
                    return;
                  }
                  setKey('');
                  onSaved('');
                  onClose();
                }}
                disabled={status === 'checking'}
              >
                Remove key
              </button>
            )}
            <button className="legacy-button legacy-button-primary" type="submit" disabled={status === 'checking' || status === 'success'}>
              {status === 'checking' && <Loader2 className="h-4 w-4 animate-spin" />}
              {status === 'success' && <Check className="h-4 w-4" />}
              {status === 'checking' ? 'Verifying access' : status === 'success' ? 'Gemini connected' : serverAiReady && !key.trim() ? 'Use server access' : 'Verify and use key'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default ApiKeyDialog;

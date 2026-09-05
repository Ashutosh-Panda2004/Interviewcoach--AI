export interface AiUsage {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
}

interface AiValidationResponse {
  ok: true;
  model: string;
}

export interface AiConfig {
  aiConfigured: boolean;
  textModel: string;
  liveModel: string;
  byokSupported: boolean;
}

interface GenerateOptions {
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  signal?: AbortSignal;
}

interface GenerateResponse {
  text: string;
  usage?: AiUsage;
}

export interface LiveCredentials {
  token: string;
  model: string;
}

const SESSION_KEY = 'interview_coach_session_api_key';
const LEGACY_KEY = 'user_custom_gemini_api_key';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const getSessionApiKey = () => {
  let current = '';
  try { current = sessionStorage.getItem(SESSION_KEY) || ''; } catch { /* session storage is unavailable */ }
  if (current) return current;

  let legacy = '';
  try { legacy = localStorage.getItem(LEGACY_KEY) || ''; } catch { /* local storage is unavailable */ }
  if (legacy) {
    try { sessionStorage.setItem(SESSION_KEY, legacy); } catch { return ''; }
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* legacy cleanup is best effort */ }
  }
  return legacy;
};

export const setSessionApiKey = (key: string) => {
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* legacy cleanup is best effort */ }
  const trimmed = key.trim();
  try {
    if (trimmed) sessionStorage.setItem(SESSION_KEY, trimmed);
    else sessionStorage.removeItem(SESSION_KEY);
    return true;
  } catch {
    return false;
  }
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  const sessionKey = getSessionApiKey();
  if (sessionKey) headers.set('X-Gemini-API-Key', sessionKey);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Cannot reach the application server. Check your connection and retry.', 0);
  }

  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    throw new ApiError(body.error || `Request failed with status ${response.status}.`, response.status);
  }
  return body as T;
};

export const getAiConfig = () => request<AiConfig>('/api/config');

export const generateAiContent = (options: GenerateOptions) =>
  request<GenerateResponse>('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      responseMimeType: options.responseMimeType,
    }),
    signal: options.signal,
  });

export const validateAiAccess = () =>
  request<AiValidationResponse>('/api/ai/validate', { method: 'POST', body: '{}' });

export const getLiveCredentials = () =>
  request<LiveCredentials>('/api/live/token', { method: 'POST', body: '{}' });

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { InterviewSessionResult, InterviewSettings, TranscriptionItem, TestResult, CodingProblem, SystemDesignState, SystemDesignTemplate } from '../types';
import { createPCM16Blob, decodeAudioData, base64ToUint8Array, downsampleTo16k } from '../utils/audioUtils';
import { constructInterviewSystemPrompt, constructCodingProblemPrompt } from '../utils/prompts';
import { ApiError, generateAiContent, getLiveCredentials, type LiveCredentials } from '../utils/aiClient';
import { parseJsonObject } from '../utils/json';
import { validateCodingProblem } from '../utils/codingProblemValidation';
import {
    clearActiveInterview,
    loadActiveInterview,
    saveActiveInterview,
    type ActiveInterviewSnapshot,
} from '../utils/activeSessionStorage';
import { diffSystemDesign, isMeaningfulDiff } from '../utils/systemDesignDiff';
import { buildDiagramContextMessage } from '../utils/systemDesignSerializer';
import systemDesignTemplates from '../data/system-design-templates.json';
import AudioVisualizer from './AudioVisualizer';
import CodeWorkspace from './CodeWorkspace';
import AdvancedDesignCanvas from './AdvancedDesignCanvas';
import { Mic, MicOff, PhoneOff, Clock, MessageSquare, RefreshCw, Sparkles, Radio, Code2, Loader2, Play, Pause, Power, Volume2, VolumeX, Network, AlertTriangle } from 'lucide-react';

interface LiveInterviewProps {
  settings: InterviewSettings;
    initialCredentials: LiveCredentials;
    onEnd: (transcripts: TranscriptionItem[], result: InterviewSessionResult) => void;
}

const PERSONALITY_VOICE_MAP: Record<string, string> = {
  'Neutral Professional': 'Aoede',
  'Very Strict': 'Fenrir',
  'Calm & Polite': 'Kore',
  'Highly Helpful': 'Aoede',
  'Friendly Conversational': 'Puck'
};

const PERSONA_DETAILS: Record<string, { name: string; role: string; desc: string; voice: string; avatarColor: string }> = {
  'Neutral Professional': { name: 'Sarah', role: 'Technical Recruiter', desc: 'Objective, structured, and professional.', voice: 'Aoede', avatarColor: 'from-cyan-500 to-blue-600' },
  'Very Strict': { name: 'Victor', role: 'Principal Architect', desc: 'Skeptical, blunt, and forensic. Probes deep into your logic.', voice: 'Fenrir', avatarColor: 'from-red-600 to-orange-700' },
  'Calm & Polite': { name: 'Clara', role: 'Engineering Manager', desc: 'Supportive, encouraging, and patient listener.', voice: 'Kore', avatarColor: 'from-emerald-500 to-teal-600' },
  'Highly Helpful': { name: 'Marcus', role: 'Senior Mentor', desc: 'Collaborative, guides you with hints, and focuses on practice.', voice: 'Aoede', avatarColor: 'from-purple-500 to-indigo-600' },
  'Friendly Conversational': { name: 'Penny', role: 'Staff Engineer', desc: 'Warm, conversational, and energetic peer-like interviewer.', voice: 'Puck', avatarColor: 'from-amber-400 to-pink-500' }
};

const FILLER_WORDS = ['um', 'uh', 'like', 'basically', 'actually', 'literally', 'essentially', 'you know'];
const countFillers = (text: string) => {
    const words = text.toLowerCase().split(/[^a-z']+/).filter(Boolean);
    return words.filter(w => FILLER_WORDS.includes(w)).length;
};

// System Design mode constants
const SD_TEMPLATES = systemDesignTemplates as SystemDesignTemplate[];
const MILESTONE_COMPONENTS = new Set(['sql_database', 'nosql_database', 'cache', 'load_balancer']);
const CHECKIN_PHRASES = ['what do you think', 'does this make sense', 'am i missing anything', 'how does this look', 'any feedback so far'];

const loadSavedDesign = (storageKey: string): SystemDesignState | null => {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as SystemDesignState;
        return Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) ? parsed : null;
    } catch {
        return null;
    }
};

// OPTIMIZED AudioWorklet: Buffers 4096 frames (approx 100-200ms) to prevent network flooding
const WORKLET_CODE = `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.idx = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const inputData = input[0];
      for (let i = 0; i < inputData.length; i++) {
        this.buffer[this.idx++] = inputData[i];
        if (this.idx >= this.bufferSize) {
          // Send a copy of the buffer to the main thread
          this.port.postMessage(this.buffer.slice());
          this.idx = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('recorder-processor', RecorderProcessor);
`;

const LiveInterview: React.FC<LiveInterviewProps> = ({ settings, initialCredentials, onEnd }) => {
    const [restoredSession] = useState(() => loadActiveInterview());
  // --- UI State ---
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'paused' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAudioContextSuspended, setIsAudioContextSuspended] = useState(false);
    const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  
  // History State (With storage restoration fallback)
  const [transcripts, setTranscripts] = useState<TranscriptionItem[]>(() => {
      return restoredSession?.transcripts ?? [];
  });
  
  // Real-time Streaming State
  const [realtimeTranscript, setRealtimeTranscript] = useState<{ speaker: 'user' | 'agent', text: string } | null>(null);

  // Elapsed Timer (With storage restoration fallback)
  const [elapsedTime, setElapsedTime] = useState<number>(() => {
      return restoredSession?.elapsedTime ?? 0;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // CODING INTERVIEW STATE (With storage restoration fallback)
  const [activeMode, setActiveMode] = useState<'CONVERSATION' | 'CODING' | 'DESIGN'>(() => {
      return restoredSession?.activeMode ?? (settings.sessionMode === 'System Design' ? 'DESIGN' : 'CONVERSATION');
  });
  const [codingProblems, setCodingProblems] = useState<CodingProblem[]>(() => {
      return restoredSession?.codingProblems ?? [];
  });
  const [currentProblemIndex, setCurrentProblemIndex] = useState<number>(() => {
      return restoredSession?.currentProblemIndex ?? 0;
  });
  const [isGeneratingProblem, setIsGeneratingProblem] = useState(false);
    const [problemGenerationError, setProblemGenerationError] = useState<string | null>(null);

  // --- SYSTEM DESIGN WHITEBOARD MODE ---
  const isSystemDesignMode = settings.sessionMode === 'System Design';
  const sdTemplate = SD_TEMPLATES.find(t => t.id === settings.systemDesignScenarioId);
  const sdScenarioTitle = sdTemplate?.title || 'System Design';
  const sdSuggested = sdTemplate?.suggestedComponents || [];
  const sdStorageKey = `interview_coach_sd_${settings.systemDesignScenarioId || 'freeform'}`;
    const systemDesignStateRef = useRef<SystemDesignState | null>(loadSavedDesign(sdStorageKey));
  const lastSentDesignStateRef = useRef<SystemDesignState | null>(null);
  const designFirstSentRef = useRef(false);
  const designInjectTimerRef = useRef<any>(null);
  const seenMilestoneRef = useRef<Set<string>>(new Set());
  
  // Real-time Speech Pacing Tracker States
  const [currentWpm, setCurrentWpm] = useState(0);
  const [currentFillerCount, setCurrentFillerCount] = useState(0);
  const [pacingState, setPacingState] = useState<'listening' | 'steady' | 'fast' | 'slow'>('listening');
  
  // Visualizer State (Decoupled from logic)
  const [inputAnalyserState, setInputAnalyserState] = useState<AnalyserNode | null>(null);
  const [outputAnalyserState, setOutputAnalyserState] = useState<AnalyserNode | null>(null);

  // Tab focus state
  const [isTabHidden, setIsTabHidden] = useState(false);
  const isTabHiddenRef = useRef(false);

  // --- Refs (Stable references for logic) ---
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const reconnectAttemptsRef = useRef(0);
  const isSessionConnectedRef = useRef(false);
  const isSessionPausedRef = useRef(false); // Tracks "Soft Pause" state
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);
  const isMicMutedRef = useRef(false);
  const transcriptsRef = useRef<TranscriptionItem[]>([]);
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const pendingUserTextRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const userSpeechStartTimeRef = useRef<number | null>(null);
  const rollingRmsRef = useRef<number[]>([]);
    const autoEndedRef = useRef(false);
    const initialCredentialsRef = useRef<LiveCredentials | null>(initialCredentials);
    const sessionSnapshotRef = useRef<ActiveInterviewSnapshot>({
        transcripts: restoredSession?.transcripts ?? [],
        elapsedTime: restoredSession?.elapsedTime ?? 0,
        activeMode: restoredSession?.activeMode ?? (settings.sessionMode === 'System Design' ? 'DESIGN' : 'CONVERSATION'),
        codingProblems: restoredSession?.codingProblems ?? [],
        currentProblemIndex: restoredSession?.currentProblemIndex ?? 0,
        settings,
        timestamp: Date.now(),
    });

  // LOGIC: Show banner if connected but no conversation has happened yet OR if context is suspended
  const showStartBanner = (status === 'connected' && transcripts.length === 0 && !realtimeTranscript) || isAudioContextSuspended;

    // Keep a cheap in-memory snapshot; persist it at a bounded cadence.
  useEffect(() => {
            sessionSnapshotRef.current = {
                transcripts,
                elapsedTime,
                activeMode,
                codingProblems,
                currentProblemIndex,
                settings,
                timestamp: Date.now(),
            };
  }, [transcripts, elapsedTime, activeMode, codingProblems, currentProblemIndex, settings]);

    useEffect(() => {
        const checkpoint = () => {
            const saved = saveActiveInterview(sessionSnapshotRef.current);
            setPersistenceWarning(current => saved ? null : current || 'Session recovery storage is full. The live interview can continue, but reload recovery is unavailable.');
        };
        checkpoint();
        const interval = window.setInterval(checkpoint, 5_000);
        return () => window.clearInterval(interval);
    }, []);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, realtimeTranscript, isSidebarOpen]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      // Pause timer when tab is hidden, paused, or not connected
      if (status === 'connected' && !isTabHiddenRef.current && !isSessionPausedRef.current) {
        setElapsedTime(prev => prev + 1);
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const disconnectSession = useCallback(async () => {
    isSessionConnectedRef.current = false;
    if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        try { session.close(); } catch (e) { console.warn("Failed to close session", e); }
        sessionPromiseRef.current = null;
    }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourcesRef.current.clear();
    if (outputContextRef.current) {
        nextStartTimeRef.current = outputContextRef.current.currentTime;
    }
  }, []);

  const fullCleanup = useCallback(() => {
    disconnectSession();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (workletNodeRef.current) {
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    if (inputContextRef.current?.state !== 'closed') inputContextRef.current?.close();
    if (outputContextRef.current?.state !== 'closed') outputContextRef.current?.close();
  }, [disconnectSession]);

  const triggerReconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    if (isSessionPausedRef.current) return; // Don't reconnect if manually paused
    const attempts = reconnectAttemptsRef.current;
    if (attempts >= 8) {
        setStatus('error');
        setError("Connection unstable. Please verify your network settings.");
        return;
    }
    setStatus('reconnecting');
    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(1.5, attempts), 12000);
    setTimeout(() => {
        if (isMountedRef.current) connectToGemini();
    }, delay);
  }, []);

  const connectToGemini = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isConnectingRef.current) return;
    if (!inputContextRef.current || !outputContextRef.current) return;

    isConnectingRef.current = true;

    try {
        const credentials = initialCredentialsRef.current || await getLiveCredentials();
        initialCredentialsRef.current = null;
        const ai = new GoogleGenAI({
            apiKey: credentials.token,
            httpOptions: { apiVersion: 'v1alpha' },
        });
        const outCtx = outputContextRef.current;
        const outAnalyser = outputAnalyserRef.current;

        const history = transcriptsRef.current;
        const pendingText = pendingUserTextRef.current;
        const isReconnection = history.length > 0 || !!pendingText;

        let contextString = '';
        if (isReconnection) {
            const recentHistory = history.slice(-50);
            contextString = recentHistory.map(t => `${t.speaker === 'user' ? 'CANDIDATE' : 'INTERVIEWER'}: ${t.text}`).join('\n');
            if (pendingText) contextString += `\nCANDIDATE (Interrupted): "${pendingText}..."`;
        }

        const systemInstruction = constructInterviewSystemPrompt(
            settings,
            settings.resumeText,
            undefined, // No resumeUrl provided
            isReconnection,
            contextString
        );

        const sessionPromise = ai.live.connect({
            model: credentials.model,
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.personality ? (PERSONALITY_VOICE_MAP[settings.personality] || 'Aoede') : 'Aoede' } },
                },
                systemInstruction: systemInstruction,
                inputAudioTranscription: {}, 
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: async () => {
                    if (!isMountedRef.current) return;
                    if (outCtx.state === 'suspended') {
                         setIsAudioContextSuspended(true);
                    } else {
                         nextStartTimeRef.current = outCtx.currentTime;
                    }
                    
                    setStatus('connected');
                    setError(null);
                    reconnectAttemptsRef.current = 0;
                    isSessionConnectedRef.current = true;
                    isConnectingRef.current = false;
                    isSessionPausedRef.current = false;
                    pendingUserTextRef.current = '';

                    // Silent Pulse to wake up the model immediately
                    const silentData = new Float32Array(160); // 10ms at 16kHz
                    const pcmBlob = createPCM16Blob(silentData);
                    sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (!isMountedRef.current) return;
                    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (base64Audio) {
                        try {
                            const audioData = base64ToUint8Array(base64Audio);
                            // Only force resume if NOT intentionally paused
                            if (outCtx.state === 'suspended' && !isSessionPausedRef.current && !isAudioContextSuspended) {
                                try { await outCtx.resume(); } catch {}
                            }
                            
                            const audioBuffer = await decodeAudioData(audioData, outCtx, 24000, 1);
                            const source = outCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            if (outAnalyser) {
                                source.connect(outAnalyser);
                                outAnalyser.connect(outCtx.destination);
                            } else {
                                source.connect(outCtx.destination);
                            }
                            
                            // Even if paused, we schedule the audio. It will "wait" in the timeline 
                            // because ctx.currentTime freezes when suspended. 
                            // This ensures seamless resume (no skipped words).
                            const currentTime = outCtx.currentTime;
                            const startTime = Math.max(nextStartTimeRef.current, currentTime);
                            source.start(startTime);
                            nextStartTimeRef.current = startTime + audioBuffer.duration;
                            sourcesRef.current.add(source);
                            source.onended = () => sourcesRef.current.delete(source);
                        } catch (err) {
                            console.error("Audio Processing Error:", err);
                        }
                    }
                    const serverContent = message.serverContent;
                    if (serverContent) {
                        if (serverContent.inputTranscription) {
                            if (!userSpeechStartTimeRef.current) {
                                userSpeechStartTimeRef.current = Date.now();
                            }
                            currentInputTranscriptionRef.current += serverContent.inputTranscription.text;
                            setRealtimeTranscript({ speaker: 'user', text: currentInputTranscriptionRef.current });

                            const text = currentInputTranscriptionRef.current;
                            const words = text.split(/\s+/).filter(Boolean);
                            const durationMs = Date.now() - userSpeechStartTimeRef.current;
                            const durationMins = durationMs / 1000 / 60;
                            const wpm = durationMins > 0.03 ? Math.round(words.length / durationMins) : 120;
                            const fillers = countFillers(text);

                            setCurrentWpm(wpm);
                            setCurrentFillerCount(fillers);

                            let pacing: 'steady' | 'fast' | 'slow' = 'steady';
                            if (wpm > 150) pacing = 'fast';
                            else if (wpm < 85) pacing = 'slow';
                            setPacingState(pacing);
                        }
                        if (serverContent.outputTranscription) {
                            currentOutputTranscriptionRef.current += serverContent.outputTranscription.text;
                            setRealtimeTranscript({ speaker: 'agent', text: currentOutputTranscriptionRef.current });
                        }
                        if (serverContent.turnComplete) {
                            const userText = currentInputTranscriptionRef.current.trim();
                            const agentText = currentOutputTranscriptionRef.current.trim();
                            
                            userSpeechStartTimeRef.current = null;
                            setPacingState('listening');
                            setCurrentWpm(0);
                            setCurrentFillerCount(0);

                            // Filter out any hidden trigger text if it somehow echoes back
                            if (userText && !userText.includes("User has connected") && !userText.includes("The user has joined") && !userText.includes("SYSTEM_EVENT")) {
                                setTranscripts(prev => [...prev, { speaker: 'user', text: userText, timestamp: Date.now() }]);

                                // System Design check-in trigger: candidate explicitly asks for feedback.
                                if (isSystemDesignMode) {
                                    const lower = userText.toLowerCase();
                                    if (CHECKIN_PHRASES.some(p => lower.includes(p))) {
                                        injectDiagramContext();
                                    }
                                }
                            }
                            if (agentText) {
                                setTranscripts(prev => [...prev, { speaker: 'agent', text: agentText, timestamp: Date.now() }]);
                            }
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                            setRealtimeTranscript(null);
                        }
                    }
                },
                onclose: async (event) => {
                    if (!isMountedRef.current) return;
                    isSessionConnectedRef.current = false;
                    isConnectingRef.current = false;
                    sessionPromiseRef.current = null;
                    
                    // If manually paused, we don't treat this as an error. 
                    // We just let the socket stay dead until user hits "Resume".
                    if (isSessionPausedRef.current) {
                        return;
                    }

                    if (event.reason && (event.reason.includes("Invalid argument") || event.reason.includes("Permission denied") || event.reason.includes("API key"))) {
                        setStatus('error');
                        setError(`Connection failed: ${event.reason}. Please check API key/permissions.`);
                        return;
                    }
                    if (currentInputTranscriptionRef.current) {
                        pendingUserTextRef.current = currentInputTranscriptionRef.current;
                        currentInputTranscriptionRef.current = '';
                        setRealtimeTranscript(null);
                    }
                    await disconnectSession();
                    triggerReconnect();
                },
                onerror: (err) => console.error("Session Error:", err)
            }
        });
        sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
        console.error("Connection Failed:", err);
        isConnectingRef.current = false;
        if (err instanceof ApiError && [400, 401, 403, 429, 503].includes(err.status)) {
            setStatus('error');
            setError(err.message);
            return;
        }
        triggerReconnect();
    }
  }, [settings, disconnectSession, triggerReconnect]);

  const resumeAudioContext = useCallback(async () => {
    if (outputContextRef.current?.state === 'suspended') {
        await outputContextRef.current.resume();
        setIsAudioContextSuspended(false);
    }
    if (inputContextRef.current?.state === 'suspended') {
        await inputContextRef.current.resume();
    }
  }, []);

  useEffect(() => {
    const handleVisibility = async () => {
      const isHidden = document.visibilityState === 'hidden';
      isTabHiddenRef.current = isHidden;
      setIsTabHidden(isHidden);
      
      if (isHidden) {
         // Soft pause voice capture by suspending audio contexts to save resources
         if (outputContextRef.current?.state === 'running') {
             try { await outputContextRef.current.suspend(); } catch {}
         }
         if (inputContextRef.current?.state === 'running') {
             try { await inputContextRef.current.suspend(); } catch {}
         }
      } else {
         if (!isSessionPausedRef.current) {
             if (outputContextRef.current?.state === 'suspended') {
                 try { await outputContextRef.current.resume(); } catch {}
                 setIsAudioContextSuspended(false);
             }
             if (inputContextRef.current?.state === 'suspended') {
                 try { await inputContextRef.current.resume(); } catch {}
             }
             // Reconnect if socket was killed or dropped while in background
             if (!isSessionConnectedRef.current && status !== 'connecting' && status !== 'paused' && status !== 'error') {
                 connectToGemini();
             }
         }
      }
    };

    const handlePageHide = () => {
            saveActiveInterview(sessionSnapshotRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handleVisibility);
    };
    }, [connectToGemini, status]);

  // Heartbeat every 15 seconds to detect silent socket death and keep connection alive
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      if (status === 'connected' && isSessionConnectedRef.current && sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
          try {
            // Send a tiny silent PCM block as a heartbeat keep-alive
            const silentData = new Float32Array(160).fill(0); // 10ms of silence
            const pcmBlob = createPCM16Blob(silentData);
            session.sendRealtimeInput({ media: pcmBlob });
          } catch (e) {
            console.error("Heartbeat failed, silent socket death detected:", e);
            isSessionConnectedRef.current = false;
            triggerReconnect();
          }
        }).catch(() => {});
      }
    }, 15000);

    return () => clearInterval(heartbeatInterval);
  }, [status, triggerReconnect]);

  useEffect(() => {
    isMountedRef.current = true;
    const initHardware = async () => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            
            // Allow native sample rate to avoid hardware failure, we will downsample manually
            const inCtx = new AudioContextClass(); 
            const outCtx = new AudioContextClass({ sampleRate: 24000 });
            
            inputContextRef.current = inCtx;
            outputContextRef.current = outCtx;

            const inAnalyser = inCtx.createAnalyser();
            inAnalyser.fftSize = 512;
            inputAnalyserRef.current = inAnalyser;
            
            const outAnalyser = outCtx.createAnalyser();
            outAnalyser.fftSize = 512;
            outputAnalyserRef.current = outAnalyser;
            
            setInputAnalyserState(inAnalyser);
            setOutputAnalyserState(outAnalyser);

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
            });
            if (!isMountedRef.current) return;
            streamRef.current = stream;
            
            const source = inCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            source.connect(inAnalyser);

            // Use AudioWorklet instead of deprecated ScriptProcessor for performance
            const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            
            try {
                await inCtx.audioWorklet.addModule(url);
                const workletNode = new AudioWorkletNode(inCtx, 'recorder-processor');
                workletNodeRef.current = workletNode;
                
                inAnalyser.connect(workletNode);
                workletNode.connect(inCtx.destination);
                
                workletNode.port.onmessage = (e) => {
                    if (!isSessionConnectedRef.current || !sessionPromiseRef.current) return;
                    
                    // Pause voice capture when tab is hidden
                    if (isTabHiddenRef.current) return;
                    
                    let inputData = e.data as Float32Array;
                    
                    // Calculate RMS of this chunk
                    let sum = 0;
                    for (let i = 0; i < inputData.length; i++) {
                        sum += inputData[i] * inputData[i];
                    }
                    const rms = Math.sqrt(sum / inputData.length);
                    
                    // Update rolling RMS window
                    const rollingRms = rollingRmsRef.current;
                    rollingRms.push(rms);
                    if (rollingRms.length > 4) {
                        rollingRms.shift();
                    }
                    
                    const avgRms = rollingRms.reduce((a, b) => a + b, 0) / rollingRms.length;
                    
                    // Interruption Logic (Barge-in):
                    // If average user voice level exceeds threshold AND AI is speaking (sound is playing),
                    // immediately stop all local playing sound nodes to cut off AI voice.
                    const isAiSpeaking = sourcesRef.current.size > 0 || currentOutputTranscriptionRef.current.length > 0;
                    if (avgRms > 0.015 && isAiSpeaking && !isMicMutedRef.current && !isSessionPausedRef.current) {
                        // 1. Instantly stop playing audio buffers
                        sourcesRef.current.forEach(source => {
                            try { source.stop(); } catch {}
                        });
                        sourcesRef.current.clear();
                        
                        // 2. Align nextStartTime to current output context timeline
                        if (outputContextRef.current) {
                            nextStartTimeRef.current = outputContextRef.current.currentTime;
                        }
                        
                        // 3. Reset agent response display so typing buffer is cleared
                        currentOutputTranscriptionRef.current = '';
                        setRealtimeTranscript(null);
                    }
                    
                    // LOGIC: Send silence if Muted OR Paused (Heartbeat to keep socket alive)
                    if (isMicMutedRef.current || isSessionPausedRef.current) {
                        inputData = new Float32Array(inputData.length).fill(0);
                    }
                    
                    // Downsample if native rate is different from 16000
                    const downsampled = downsampleTo16k(inputData, inCtx.sampleRate);
                    const pcmBlob = createPCM16Blob(downsampled);
                    
                    sessionPromiseRef.current.then((session) => {
                        try { session.sendRealtimeInput({ media: pcmBlob }); } catch {}
                    }).catch(() => {});
                };
            } catch (workletError) {
                console.error("Worklet failed, fallback needed?", workletError);
            }

            connectToGemini();
        } catch (e: any) {
            console.error("Hardware Init Failed:", e);
            setError("Could not access microphone. Please allow permissions.");
            setStatus('error');
        }
    };
    initHardware();
    return () => {
        isMountedRef.current = false;
        fullCleanup();
    };
  }, []);

  // --- Handlers ---
  const handlePause = async () => {
      isSessionPausedRef.current = true;
      setStatus('paused');
      // Soft Pause: Suspend output context immediately (stops playback instantly)
      // but keep socket open sending silence (via worklet logic)
      if (outputContextRef.current?.state === 'running') {
          await outputContextRef.current.suspend();
      }
  };

  const handleResume = async () => {
      isSessionPausedRef.current = false;
      
      // Resume playback immediately
      if (outputContextRef.current?.state === 'suspended') {
          await outputContextRef.current.resume();
      }

      // Check if socket died while we were paused (e.g. timeout)
      if (!isSessionConnectedRef.current) {
          setStatus('reconnecting');
          connectToGemini();
      } else {
          setStatus('connected');
      }
  };

  const handleEndSession = () => {
    const finalTranscripts = [...transcripts];
    const pending = currentInputTranscriptionRef.current || pendingUserTextRef.current;
    if (pending) finalTranscripts.push({ speaker: 'user', text: pending, timestamp: Date.now() });
    if (currentOutputTranscriptionRef.current) finalTranscripts.push({ speaker: 'agent', text: currentOutputTranscriptionRef.current, timestamp: Date.now() });
    
    // Clear persistent session state
    clearActiveInterview();
    codingProblems.forEach(p => {
        try { localStorage.removeItem(`interview_coach_code_${p.id}`); } catch { /* cleanup is best effort */ }
    });

    // System Design: hand the final diagram to the feedback screen for scoring.
    if (designInjectTimerRef.current) clearTimeout(designInjectTimerRef.current);
    try { localStorage.removeItem(sdStorageKey); } catch { /* cleanup is best effort */ }

    fullCleanup();
    const result: InterviewSessionResult = {
        elapsedSeconds: elapsedTime,
        systemDesign: isSystemDesignMode && systemDesignStateRef.current
            ? {
                state: systemDesignStateRef.current,
                scenario: settings.systemDesignPrompt || sdScenarioTitle,
              }
            : undefined,
    };
    onEnd(finalTranscripts, result);
  };

    useEffect(() => {
            const durationSeconds = Math.max(1, settings.duration) * 60;
            if (elapsedTime >= durationSeconds && !autoEndedRef.current) {
            autoEndedRef.current = true;
            handleEndSession();
            }
    }, [elapsedTime, settings.duration]);

  const handleStartReset = async () => {
      isSessionPausedRef.current = true; // Prevent auto-reconnect during cleanup
    clearActiveInterview();
      codingProblems.forEach(p => {
          try { localStorage.removeItem(`interview_coach_code_${p.id}`); } catch { /* cleanup is best effort */ }
      });
      await disconnectSession();
      setTranscripts([]);
      setRealtimeTranscript(null);
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';
      pendingUserTextRef.current = '';
      // Small delay to ensure socket closes
      setTimeout(() => {
          isSessionPausedRef.current = false;
          setStatus('connecting');
          connectToGemini();
      }, 500);
  };

  // --- Dynamic Problem Generation ---
  const generateCodingProblem = async () => {
      if (isGeneratingProblem) return;
      setIsGeneratingProblem(true);
    setProblemGenerationError(null);

      try {
          const previousTitles = codingProblems.map(p => p.title);
          const prompt = constructCodingProblemPrompt(settings, previousTitles);

          const result = await generateAiContent({
              prompt,
              responseMimeType: 'application/json',
          });

          if (result.text) {
              let problem: CodingProblem;
              try {
                  // Robust JSON cleaning to strip Markdown
                  problem = validateCodingProblem(parseJsonObject<unknown>(result.text));
              } catch (e) {
                  console.error("Invalid JSON from problem gen", e);
                  throw new Error("Failed to parse problem");
              }

              setCodingProblems(prev => {
                  const updated = [...prev, problem];
                  // If this was the first one added, set current index AND inform AI
                  if (prev.length === 0) {
                       setCurrentProblemIndex(0);
                       
                       // INJECT CONTEXT: Tell Live AI that user is now seeing a new problem
                       if (sessionPromiseRef.current) {
                            sessionPromiseRef.current.then(session => {
                                // Sending this as text input simulates a system event
                                session.sendRealtimeInput({
                                    text: `[SYSTEM EVENT: A new coding problem has been displayed to the user: "${problem.title}". Description: ${problem.description.substring(0, 200)}... The user is now reading it. Proceed by asking for their approach.]`
                                });
                            });
                       }
                  }
                  return updated;
              });
          }
      } catch (error) {
          console.error("Failed to generate coding problem", error);
          setProblemGenerationError(error instanceof Error ? error.message : 'Could not generate a coding problem.');
      } finally {
          setIsGeneratingProblem(false);
      }
  };

  // --- SYSTEM DESIGN: inject diagram context into the live session ---
  const injectDiagramContext = useCallback(() => {
      const state = systemDesignStateRef.current;
      if (!state || !sessionPromiseRef.current) return;
      const diff = diffSystemDesign(lastSentDesignStateRef.current, state);
      const isFirst = !designFirstSentRef.current;
      if (!isFirst && !isMeaningfulDiff(diff)) return;
      const message = buildDiagramContextMessage(state, diff, isFirst);
      sessionPromiseRef.current.then(session => {
          try { session.sendRealtimeInput({ text: message }); } catch {}
      }).catch(() => {});
      lastSentDesignStateRef.current = state;
      designFirstSentRef.current = true;
  }, []);

  const handleDesignStateChange = useCallback((state: SystemDesignState) => {
      systemDesignStateRef.current = state;
      try {
          localStorage.setItem(sdStorageKey, JSON.stringify(state));
      } catch {
          // Persistence failure should not interrupt the active interview.
      }

      // Milestone trigger: first time a must-address component appears, inject immediately.
      let milestoneHit = false;
      for (const node of state.nodes) {
          if (MILESTONE_COMPONENTS.has(node.componentType) && !seenMilestoneRef.current.has(node.componentType)) {
              seenMilestoneRef.current.add(node.componentType);
              milestoneHit = true;
          }
      }

      if (designInjectTimerRef.current) clearTimeout(designInjectTimerRef.current);

      if (milestoneHit) {
          injectDiagramContext();
          return;
      }

      // Idle-after-edit trigger: send once the diagram has been stable for ~5s.
      designInjectTimerRef.current = setTimeout(() => {
          injectDiagramContext();
      }, 5000);
    }, [injectDiagramContext, sdStorageKey]);

  const handleToggleDesignMode = () => {
      if (activeMode === 'DESIGN') {
          setActiveMode('CONVERSATION');
          setIsSidebarOpen(true);
      } else {
          setActiveMode('DESIGN');
          setIsSidebarOpen(false);
      }
  };

  const handleToggleCodingMode = async () => {
      if (activeMode === 'CONVERSATION') {
          setActiveMode('CODING');
          setIsSidebarOpen(false);
          
          // If we don't have problems yet, generate one
          if (codingProblems.length === 0) {
              await generateCodingProblem();
          }
      } else {
          setActiveMode('CONVERSATION');
          setIsSidebarOpen(true);
      }
  };

  const handleCodeRun = (code: string, results: TestResult[]) => {
      const problem = codingProblems[currentProblemIndex];
      if (!problem || !sessionPromiseRef.current) return;
      const passed = results.filter(result => result.passed).length;
      const summary = `[SYSTEM EVENT: The candidate ran code for "${problem.title}". ${passed}/${results.length} tests passed. Candidate code:\n${code.slice(0, 6000)}\nUse this evidence when coaching; do not reveal hidden test data.]`;
      sessionPromiseRef.current
          .then(session => session.sendRealtimeInput({ text: summary }))
          .catch(() => {});
  };

  const handleProblemComplete = () => {
      const currentProblem = codingProblems[currentProblemIndex];
      
      // Inject System Context for AI via session text input
      if (sessionPromiseRef.current) {
          sessionPromiseRef.current.then(session => {
              session.sendRealtimeInput({
                  text: `[SYSTEM_EVENT: User submitted solution for "${currentProblem.title}". Result: Submitted. Proceed to next question or wrap up coding section.]`
              });
          });
      }

      setTranscripts(prev => [
          ...prev, 
          { 
              speaker: 'user', // System disguised as user context
              text: `[SYSTEM_EVENT]: User submitted solution for "${currentProblem.title}".`, 
              timestamp: Date.now() 
          }
      ]);

      if (currentProblemIndex < codingProblems.length - 1) {
          setCurrentProblemIndex(prev => prev + 1);
      } else {
          // Ask user if they want another problem or finish
          const wantMore = window.confirm("Would you like to attempt another coding problem?");
          if (wantMore) {
              generateCodingProblem().then(() => {
                  setCurrentProblemIndex(prev => prev + 1);
              });
          } else {
              setActiveMode('CONVERSATION');
              setIsSidebarOpen(true);
          }
      }
  };

  const visualStatus = status === 'connected' ? 'Live Session' : status === 'paused' ? 'Session Paused' : status === 'reconnecting' ? 'Reconnecting...' : status === 'connecting' ? 'Connecting...' : 'Disconnected';
  const statusColor = status === 'connected' ? 'bg-green-500' : status === 'paused' ? 'bg-yellow-500' : status === 'error' ? 'bg-red-500' : 'bg-orange-500';
  const currentProblem = codingProblems[currentProblemIndex];
  const isSplitView = activeMode === 'CODING' || activeMode === 'DESIGN';
  const persona = PERSONA_DETAILS[settings.personality || 'Neutral Professional'] || PERSONA_DETAILS['Neutral Professional'];

  // Helper for input visualizer colors based on state
  const getInputVisualizerColor = () => {
    if (status === 'error') return '#ef4444'; // Red
    if (isMicMuted) return '#ef4444'; // Red
    if (status === 'paused') return '#eab308'; // Yellow
    return '#70e1c1';
  };

  return (
    <div className="live-interview fixed inset-0 bg-slate-950 text-white flex flex-col z-50 animate-fade-in">
            {persistenceWarning && (
                <div role="alert" className="absolute left-1/2 top-20 z-[70] w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 border border-amber-700/50 bg-amber-950/95 px-4 py-3 text-xs text-amber-100 shadow-xl">
                    {persistenceWarning}
                </div>
            )}
      
      {/* Header */}
            <header className="live-interview-header min-h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 absolute top-0 w-full z-10">
                <div className="live-persona flex min-w-0 items-center space-x-4">
          <div className="flex flex-col">
            <h2 className="font-semibold text-sm md:text-base leading-tight flex items-center">
              Interviewer: <span className="text-cyan-400 font-bold ml-1 mr-2">{persona.name}</span>
              <span className="hidden sm:inline px-2 py-0.5 bg-slate-800 border border-slate-700/50 rounded text-[9px] text-slate-400 font-bold uppercase tracking-wider">{persona.role}</span>
            </h2>
            <span className="text-[10px] text-slate-400 flex items-center mt-0.5">
              <div className={`w-2 h-2 rounded-full mr-2 ${statusColor} ${status === 'connected' ? 'animate-pulse' : ''}`} />
              {visualStatus}
            </span>
          </div>
        </div>

        <div className="live-session-tools flex items-center space-x-4">
            <div className="flex items-center bg-slate-800/50 rounded-full px-4 py-1.5 border border-slate-700/50">
                <Clock className="w-4 h-4 text-cyan-400 mr-2" />
                <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
            </div>
            <button 
                onClick={isSystemDesignMode ? handleToggleDesignMode : handleToggleCodingMode}
                className={`flex items-center px-3 py-1.5 rounded-lg border transition-all ${(activeMode === 'CODING' || activeMode === 'DESIGN') ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
            >
                {isSystemDesignMode ? <Network className="w-4 h-4 mr-2" /> : <Code2 className="w-4 h-4 mr-2" />}
                {isSystemDesignMode
                    ? (activeMode === 'DESIGN' ? 'Hide Whiteboard' : 'Open Whiteboard')
                    : (activeMode === 'CODING' ? 'Exit Editor' : 'Open Editor')}
            </button>
        </div>

        <div className="live-header-actions flex items-center space-x-2">
            <button onClick={handleStartReset} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Reset Session">
                <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg transition-colors ${isSidebarOpen ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-slate-800 text-slate-400'}`}>
                <MessageSquare className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Main Stage */}
    <div className="live-stage flex-1 flex pt-16 relative overflow-hidden">
        
        {/* LEFT / CENTER: Avatar OR Split View */}
        <div className={`relative transition-all duration-500 ${isSplitView ? 'hidden lg:flex lg:w-[35%] lg:flex-col border-r border-slate-800' : 'flex w-full flex-col items-center justify-center'}`}>
          
          {/* Real-time Speech Pacing HUD */}
          {status === 'connected' && (
              <div className="absolute top-4 left-4 z-30 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-xl px-4 py-2.5 flex items-center space-x-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-fade-in">
                  <div className="flex items-center space-x-2">
                      <div className="relative flex h-2 w-2">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              pacingState === 'fast' ? 'bg-amber-400' :
                              pacingState === 'slow' ? 'bg-blue-400' :
                              pacingState === 'steady' ? 'bg-teal-400' : 'bg-slate-500'
                          }`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${
                              pacingState === 'fast' ? 'bg-amber-500' :
                              pacingState === 'slow' ? 'bg-blue-500' :
                              pacingState === 'steady' ? 'bg-teal-500' : 'bg-slate-500'
                          }`}></span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pacing:</span>
                      <span className={`text-xs font-black uppercase tracking-wider ${
                          pacingState === 'fast' ? 'text-amber-500' :
                          pacingState === 'slow' ? 'text-blue-400' :
                          pacingState === 'steady' ? 'text-teal-400' : 'text-slate-400'
                      }`}>
                          {pacingState === 'fast' ? 'Too Fast' : pacingState === 'slow' ? 'Too Slow' : pacingState === 'steady' ? 'Steady' : 'Listening'}
                      </span>
                  </div>
                  {currentWpm > 0 && (
                      <div className="text-xs text-slate-300 font-mono border-l border-slate-800 pl-4">
                          <span className="text-[10px] text-slate-500 mr-1">RATE:</span>{currentWpm} <span className="text-[9px] text-slate-500">WPM</span>
                      </div>
                  )}
                  <div className="text-xs text-slate-300 font-mono border-l border-slate-800 pl-4 flex items-center">
                      <span className="text-[10px] text-slate-500 mr-1.5">FILLERS:</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded ${
                          currentFillerCount > 2 ? 'bg-amber-950/50 text-amber-400 border border-amber-800/30' : 'text-slate-300'
                      }`}>
                          {currentFillerCount}
                      </span>
                  </div>
              </div>
          )}
             
            {/* Avatar Container */}
            <div className={`relative flex items-center justify-center transition-all duration-500 ${isSplitView ? 'h-64 mt-4 scale-75' : 'w-full h-full'}`}>
                
                {/* START BANNER - Trigger Audio Resume on Click */}
                {showStartBanner && (
                    <div 
                        onClick={resumeAudioContext}
                        className="absolute z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-32 md:mt-40 animate-fade-in-up"
                    >
                        <div className="bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 text-cyan-50 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.2)] flex items-center space-x-3 cursor-pointer hover:bg-slate-800/80 transition-colors">
                            <div className="bg-cyan-500/20 p-2 rounded-full animate-pulse">
                                <Mic className="w-4 h-4 text-cyan-400" />
                            </div>
                            <span className="font-medium text-sm tracking-wide">
                                {isAudioContextSuspended ? "Click to Activate Audio" : <>Ready? Say <span className="text-cyan-400 font-bold">"Hello {persona.name}"</span></>}
                            </span>
                        </div>
                    </div>
                )}

                {/* Main Orb Visualizer */}
                <div className={`relative ${isSplitView ? 'w-48 h-48' : 'w-96 h-96'}`}>
                    <div className={`absolute inset-0 bg-cyan-500/10 blur-[100px] rounded-full ${status === 'connected' ? 'animate-pulse-slow' : ''}`} />
                    
                    {status === 'connecting' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                             <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
                             <p className="text-cyan-400 text-sm font-medium animate-pulse">Connecting to {persona.name}...</p>
                        </div>
                    ) : (
                        <AudioVisualizer analyser={outputAnalyserState} isActive={status === 'connected'} mode="orb" color={status === 'reconnecting' ? '#f4c45e' : status === 'paused' ? '#6eb8ff' : '#70e1c1'} />
                    )}
                </div>
            </div>

            {/* Self View (Moved in Coding Mode) */}
            <div className={`absolute transition-all duration-500 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-2xl z-20 ${isSplitView ? 'bottom-28 left-4 w-32 h-24' : 'bottom-32 right-8 w-48 h-32'}`}>
                <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                    <div className="w-full h-full opacity-100">
                         <AudioVisualizer 
                            analyser={inputAnalyserState} 
                            isActive={!isMicMuted && status === 'connected'} 
                            mode="bar" 
                            color={getInputVisualizerColor()} 
                        />
                    </div>
                    
                    {/* Visual Overlays for Mute/Pause states */}
                    <div className={`absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-300 ${isMicMuted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <MicOff className="w-8 h-8 text-red-500 drop-shadow-lg animate-pulse" />
                    </div>
                    
                    <div className={`absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-300 ${!isMicMuted && status === 'paused' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                         <Pause className="w-8 h-8 text-yellow-500 drop-shadow-lg" />
                    </div>
                </div>
            </div>

            {/* UNIFIED FLOATING CONTROL DOCK */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-2 rounded-2xl shadow-2xl flex items-center space-x-2 pointer-events-auto transform transition-all hover:scale-105 duration-200">
                    
                    {/* Toggle Mute */}
                    <button 
                        onClick={() => setIsMicMuted(!isMicMuted)} 
                        className={`p-4 rounded-xl transition-all duration-200 flex items-center justify-center group relative ${
                            isMicMuted 
                            ? 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/50' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                        title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                        {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>

                    {/* Play / Pause Toggle */}
                    <button 
                        onClick={status === 'paused' ? handleResume : handlePause}
                        className={`p-4 rounded-xl transition-all duration-200 flex items-center justify-center ${
                            status === 'paused'
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/50'
                            : 'bg-slate-800 hover:bg-slate-700 text-yellow-400'
                        }`}
                        title={status === 'paused' ? "Resume Session" : "Pause Session"}
                    >
                         {status === 'paused' ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
                    </button>

                    {/* End Session */}
                    <button 
                        onClick={handleEndSession}
                        className="p-4 rounded-xl bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-all duration-200 flex items-center justify-center border-l border-slate-700 ml-2"
                        title="End Interview"
                    >
                        <Power className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Pause Overlay (Main Screen) */}
            {status === 'paused' && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] animate-fade-in">
                    <div className="text-center p-8 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-2xl transform scale-105">
                        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <Pause className="w-8 h-8 text-yellow-500 fill-current" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-1">Session Paused</h3>
                        <p className="text-slate-400 mb-6 text-sm">Microphone and audio output are suspended.</p>
                        <button onClick={handleResume} className="px-8 py-3 bg-white text-slate-900 hover:bg-slate-200 rounded-xl font-bold text-lg shadow-xl transition-all transform hover:scale-105 flex items-center mx-auto">
                            <Play className="w-5 h-5 mr-2 fill-current" /> Resume
                        </button>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
                    <div className="text-center p-8 rounded-2xl bg-slate-900 border border-red-900/50 shadow-2xl max-w-md">
                        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                            <PhoneOff className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Connection Interrupted</h3>
                        <p className="text-slate-400 mb-6">{error || "The session disconnected unexpectedly."}</p>
                        <button onClick={handleResume} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg transition-all">
                            Reconnect Now
                        </button>
                    </div>
                </div>
            )}

        </div>

        {/* RIGHT: Coding Workspace */}
        {activeMode === 'CODING' && (
            <div className="flex-1 bg-slate-950 p-4 animate-fade-in h-full overflow-hidden flex items-center justify-center relative">
                
                {/* Ambient dynamic glow based on speech pacing */}
                <div className={`absolute inset-0 transition-all duration-700 pointer-events-none ${
                    pacingState === 'fast' ? 'bg-amber-500/[0.04] shadow-[inset_0_0_50px_rgba(245,158,11,0.05)]' :
                    pacingState === 'slow' ? 'bg-blue-500/[0.04] shadow-[inset_0_0_50px_rgba(59,130,246,0.05)]' :
                    pacingState === 'steady' ? 'bg-teal-500/[0.04] shadow-[inset_0_0_50px_rgba(20,184,166,0.05)]' :
                    'opacity-0'
                }`} />

                {isGeneratingProblem ? (
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white">Generating Challenge...</h3>
                        <p className="text-slate-400 text-sm mt-2">AI is crafting a {settings.difficulty} problem based on your focus area.</p>
                    </div>
                ) : currentProblem ? (
                    <CodeWorkspace 
                        problem={currentProblem} 
                        isLastProblem={false}
                        onCodeRun={handleCodeRun}
                        onComplete={handleProblemComplete}
                    />
                ) : (
                    <div className="max-w-sm text-center">
                        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                        <p className="text-white font-semibold mb-2">Coding challenge unavailable</p>
                        <p className="text-slate-400 text-sm mb-4">{problemGenerationError || 'No problem is loaded yet.'}</p>
                        <button onClick={generateCodingProblem} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold">Retry</button>
                    </div>
                )}
            </div>
        )}

        {/* RIGHT: System Design Whiteboard */}
        {activeMode === 'DESIGN' && (
            <div className="flex-1 bg-slate-950 p-4 animate-fade-in h-full overflow-hidden">
                <AdvancedDesignCanvas
                    scenarioTitle={sdScenarioTitle}
                    suggestedComponents={sdSuggested}
                    initialState={systemDesignStateRef.current}
                    onStateChange={handleDesignStateChange}
                />
            </div>
        )}

        {/* Transcript Sidebar */}
        <div className={`live-transcript bg-slate-900 border-l border-slate-800 transition-all duration-300 flex flex-col z-40 ${isSidebarOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full opacity-0 overflow-hidden'}`}>
             <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-center">
                <h3 className="font-semibold text-slate-200 text-sm">Transcript</h3>
                {realtimeTranscript && (
                     <div className="flex items-center space-x-2">
                         <div className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${realtimeTranscript.speaker === 'user' ? 'bg-cyan-400' : 'bg-purple-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${realtimeTranscript.speaker === 'user' ? 'bg-cyan-500' : 'bg-purple-500'}`}></span>
                         </div>
                         <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {realtimeTranscript.speaker === 'user' ? 'Listening' : `${persona.name} Thinking`}
                        </span>
                     </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                {transcripts.map((t, i) => (
                    <div key={i} className={`flex flex-col ${t.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-slate-500 mb-1 uppercase flex items-center">
                             {t.speaker === 'user' ? (
                                 <>You <Radio className="w-3 h-3 ml-1" /></>
                             ) : (
                                 <><Sparkles className="w-3 h-3 mr-1 text-cyan-400" /> {persona.name}</>
                             )}
                        </span>
                        <div className={`px-4 py-2 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-md ${t.speaker === 'user' ? 'bg-cyan-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-300 rounded-tl-none border border-slate-700'}`}>
                            {t.text}
                        </div>
                    </div>
                ))}
                
                {/* Real-time Typing Effect Bubble */}
                {realtimeTranscript && (
                    <div className={`flex flex-col ${realtimeTranscript.speaker === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                        <span className="text-[10px] text-slate-500 mb-1 uppercase flex items-center">
                             {realtimeTranscript.speaker === 'user' ? 'You' : persona.name}
                        </span>
                        <div className={`px-4 py-2 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-md opacity-80 ${realtimeTranscript.speaker === 'user' ? 'bg-cyan-600/50 text-white rounded-tr-none' : 'bg-slate-800/50 text-slate-300 rounded-tl-none border border-slate-700'}`}>
                            <span className="typing-effect">{realtimeTranscript.text}</span><span className="animate-pulse font-bold ml-1">|</span>
                        </div>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default LiveInterview;

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

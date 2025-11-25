
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { InterviewSettings, TranscriptionItem, TestResult, CodingProblem } from '../types';
import { createPCM16Blob, decodeAudioData, base64ToUint8Array, downsampleTo16k } from '../utils/audioUtils';
import { constructInterviewSystemPrompt, constructCodingProblemPrompt } from '../utils/prompts';
import AudioVisualizer from './AudioVisualizer';
import CodeWorkspace from './CodeWorkspace';
import { Mic, MicOff, PhoneOff, Clock, MessageSquare, RefreshCw, Sparkles, Radio, Code2, Loader2, Play, Pause, Power, Volume2, VolumeX } from 'lucide-react';

interface LiveInterviewProps {
  settings: InterviewSettings;
  onEnd: (transcripts: TranscriptionItem[]) => void;
}

const VOICE_NAME = 'Kore';
const AGENT_NAME = 'Sarah';

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

const LiveInterview: React.FC<LiveInterviewProps> = ({ settings, onEnd }) => {
  // --- UI State ---
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'paused' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAudioContextSuspended, setIsAudioContextSuspended] = useState(false);
  
  // History State
  const [transcripts, setTranscripts] = useState<TranscriptionItem[]>([]);
  
  // Real-time Streaming State
  const [realtimeTranscript, setRealtimeTranscript] = useState<{ speaker: 'user' | 'agent', text: string } | null>(null);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // CODING INTERVIEW STATE
  const [activeMode, setActiveMode] = useState<'CONVERSATION' | 'CODING'>('CONVERSATION');
  const [codingProblems, setCodingProblems] = useState<CodingProblem[]>([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [isGeneratingProblem, setIsGeneratingProblem] = useState(false);
  
  // Visualizer State (Decoupled from logic)
  const [inputAnalyserState, setInputAnalyserState] = useState<AnalyserNode | null>(null);
  const [outputAnalyserState, setOutputAnalyserState] = useState<AnalyserNode | null>(null);

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

  // LOGIC: Show banner if connected but no conversation has happened yet OR if context is suspended
  const showStartBanner = (status === 'connected' && transcripts.length === 0 && !realtimeTranscript) || isAudioContextSuspended;

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
      if (status === 'connected') {
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
        setError("Connection unstable. Please check your internet and reload.");
        return;
    }
    setStatus('reconnecting');
    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
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
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

        console.log("Initiating Gemini Session...");
        
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
                },
                systemInstruction: systemInstruction,
                inputAudioTranscription: {}, 
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: async () => {
                    if (!isMountedRef.current) return;
                    console.log("Session Connected.");
                    
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
                            currentInputTranscriptionRef.current += serverContent.inputTranscription.text;
                            setRealtimeTranscript({ speaker: 'user', text: currentInputTranscriptionRef.current });
                        }
                        if (serverContent.outputTranscription) {
                            currentOutputTranscriptionRef.current += serverContent.outputTranscription.text;
                            setRealtimeTranscript({ speaker: 'agent', text: currentOutputTranscriptionRef.current });
                        }
                        if (serverContent.turnComplete) {
                            const userText = currentInputTranscriptionRef.current.trim();
                            const agentText = currentOutputTranscriptionRef.current.trim();
                            // Filter out any hidden trigger text if it somehow echoes back
                            if (userText && !userText.includes("User has connected") && !userText.includes("The user has joined")) {
                                setTranscripts(prev => [...prev, { speaker: 'user', text: userText, timestamp: Date.now() }]);
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
                onclose: (event) => {
                    if (!isMountedRef.current) return;
                    console.log("Session Closed:", event.code);
                    isSessionConnectedRef.current = false;
                    isConnectingRef.current = false;
                    sessionPromiseRef.current = null;
                    
                    // If manually paused, we don't treat this as an error. 
                    // We just let the socket stay dead until user hits "Resume".
                    if (isSessionPausedRef.current) {
                        return;
                    }

                    if (event.reason && (event.reason.includes("Invalid argument") || event.reason.includes("Permission denied"))) {
                        setStatus('error');
                        setError(`Connection failed: ${event.reason}. Please check API permissions.`);
                        return;
                    }
                    if (currentInputTranscriptionRef.current) {
                        pendingUserTextRef.current = currentInputTranscriptionRef.current;
                        currentInputTranscriptionRef.current = '';
                        setRealtimeTranscript(null);
                    }
                    disconnectSession();
                    triggerReconnect();
                },
                onerror: (err) => console.error("Session Error:", err)
            }
        });
        sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
        console.error("Connection Failed:", err);
        isConnectingRef.current = false;
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
    isMountedRef.current = true;
    const initHardware = async () => {
        try {
            console.log("Initializing Audio Hardware...");
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
                    
                    let inputData = e.data as Float32Array;
                    
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
    fullCleanup();
    onEnd(finalTranscripts);
  };

  const handleStartReset = async () => {
      isSessionPausedRef.current = true; // Prevent auto-reconnect during cleanup
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

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const previousTitles = codingProblems.map(p => p.title);
          const prompt = constructCodingProblemPrompt(settings, previousTitles);

          const result = await ai.models.generateContent({
              model: 'gemini-2.0-flash-exp',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          if (result.text) {
              const problem: CodingProblem = JSON.parse(result.text);
              // Validate ID uniqueness
              if (!problem.id) problem.id = crypto.randomUUID();
              
              setCodingProblems(prev => [...prev, problem]);
              // If this is the first problem, we are ready to show it
              if (codingProblems.length === 0) {
                  setCurrentProblemIndex(0);
              }
          }
      } catch (error) {
          console.error("Failed to generate coding problem", error);
          // Use a fallback if generation fails, to not break flow
          // In real app, show toast error
      } finally {
          setIsGeneratingProblem(false);
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
      console.log("Code Run:", results);
      // In a real app, this context would be sent to the AI
  };

  const handleProblemComplete = () => {
      const currentProblem = codingProblems[currentProblemIndex];
      
      // Inject System Context for AI
      setTranscripts(prev => [
          ...prev, 
          { 
              speaker: 'user', // System disguised as user context
              text: `[SYSTEM_EVENT]: User submitted solution for "${currentProblem.title}". Result: Submitted. Proceed to next question or wrap up coding section.`, 
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

  // Helper for input visualizer colors based on state
  const getInputVisualizerColor = () => {
    if (status === 'error') return '#ef4444'; // Red
    if (isMicMuted) return '#ef4444'; // Red
    if (status === 'paused') return '#eab308'; // Yellow
    return '#22d3ee'; // Cyan (Active)
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col z-50 animate-fade-in">
      
      {/* Header */}
      <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 absolute top-0 w-full z-10">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <h2 className="font-semibold text-lg leading-tight flex items-center">
              Interviewer: <span className="text-cyan-400 ml-1">{AGENT_NAME}</span>
            </h2>
            <span className="text-xs text-slate-400 flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${statusColor} ${status === 'connected' ? 'animate-pulse' : ''}`} />
              {visualStatus}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-800/50 rounded-full px-4 py-1.5 border border-slate-700/50">
                <Clock className="w-4 h-4 text-cyan-400 mr-2" />
                <span className="font-mono font-medium">{formatTime(elapsedTime)}</span>
            </div>
            <button 
                onClick={handleToggleCodingMode}
                className={`flex items-center px-3 py-1.5 rounded-lg border transition-all ${activeMode === 'CODING' ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
            >
                <Code2 className="w-4 h-4 mr-2" />
                {activeMode === 'CODING' ? 'Exit Editor' : 'Open Editor'}
            </button>
        </div>

        <div className="flex items-center space-x-2">
            <button onClick={handleStartReset} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Reset Session">
                <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg transition-colors ${isSidebarOpen ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-slate-800 text-slate-400'}`}>
                <MessageSquare className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Main Stage */}
      <div className="flex-1 flex pt-16 relative overflow-hidden">
        
        {/* LEFT / CENTER: Avatar OR Split View */}
        <div className={`relative flex flex-col transition-all duration-500 ${activeMode === 'CODING' ? 'w-full lg:w-[35%] border-r border-slate-800' : 'w-full items-center justify-center'}`}>
             
            {/* Avatar Container */}
            <div className={`relative flex items-center justify-center transition-all duration-500 ${activeMode === 'CODING' ? 'h-64 mt-4 scale-75' : 'w-full h-full'}`}>
                
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
                                {isAudioContextSuspended ? "Click to Activate Audio" : <>Ready? Say <span className="text-cyan-400 font-bold">"Hello {AGENT_NAME}"</span></>}
                            </span>
                        </div>
                    </div>
                )}

                {/* Main Orb Visualizer */}
                <div className={`relative ${activeMode === 'CODING' ? 'w-48 h-48' : 'w-96 h-96'}`}>
                    <div className={`absolute inset-0 bg-cyan-500/10 blur-[100px] rounded-full ${status === 'connected' ? 'animate-pulse-slow' : ''}`} />
                    
                    {status === 'connecting' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                             <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
                             <p className="text-cyan-400 text-sm font-medium animate-pulse">Connecting to {AGENT_NAME}...</p>
                        </div>
                    ) : (
                        <AudioVisualizer analyser={outputAnalyserState} isActive={status === 'connected'} mode="orb" color={status === 'reconnecting' ? '#fbbf24' : status === 'paused' ? '#eab308' : '#22d3ee'} />
                    )}
                </div>
            </div>

            {/* Self View (Moved in Coding Mode) */}
            <div className={`absolute transition-all duration-500 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-2xl z-20 ${activeMode === 'CODING' ? 'bottom-28 left-4 w-32 h-24' : 'bottom-32 right-8 w-48 h-32'}`}>
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
            <div className="flex-1 bg-slate-950 p-4 animate-fade-in h-full overflow-hidden flex items-center justify-center">
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
                    <div className="text-slate-400">No problem loaded.</div>
                )}
            </div>
        )}

        {/* Transcript Sidebar */}
        <div className={`bg-slate-900 border-l border-slate-800 transition-all duration-300 flex flex-col z-40 ${isSidebarOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full opacity-0 overflow-hidden'}`}>
             <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-center">
                <h3 className="font-semibold text-slate-200 text-sm">Transcript</h3>
                {realtimeTranscript && (
                     <div className="flex items-center space-x-2">
                         <div className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${realtimeTranscript.speaker === 'user' ? 'bg-cyan-400' : 'bg-purple-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${realtimeTranscript.speaker === 'user' ? 'bg-cyan-500' : 'bg-purple-500'}`}></span>
                         </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {realtimeTranscript.speaker === 'user' ? 'Listening' : 'Sarah Thinking'}
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
                                 <><Sparkles className="w-3 h-3 mr-1" /> {AGENT_NAME}</>
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
                             {realtimeTranscript.speaker === 'user' ? 'You' : AGENT_NAME}
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

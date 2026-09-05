import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mic, Play, ShieldAlert, Volume2, XCircle } from 'lucide-react';

interface HardwareCheckProps {
  onCancel: () => void;
  onConfirmed: () => Promise<void>;
}

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onCancel, onConfirmed }) => {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'recording' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [level, setLevel] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const peakLevelRef = useRef(0);

  useEffect(() => () => cleanup(), []);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (audioContextRef.current?.state !== 'closed') {
      void audioContextRef.current?.close();
    }
    audioContextRef.current = null;
  };

  const runCheck = async () => {
    setStatus('requesting');
    setError('');
    setAudioUrl(null);
    setLevel(0);
    peakLevelRef.current = 0;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is not supported in this browser.');
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Audio recording is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio is not supported in this browser.');
      }
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => sum + Math.pow((value - 128) / 128, 2), 0) / data.length);
        const nextLevel = Math.min(100, Math.round(rms * 260));
        peakLevelRef.current = Math.max(peakLevelRef.current, nextLevel);
        setLevel(nextLevel);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      setStatus('recording');
      const supportedType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
        .find(type => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setLevel(0);
        if (peakLevelRef.current < 2) {
          setStatus('error');
          setError('No microphone signal was detected. Check the selected input device, speak clearly, and retry.');
          await ctx.close();
          audioContextRef.current = null;
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('ready');
        await ctx.close();
        audioContextRef.current = null;
      };
      recorder.start();
      window.setTimeout(() => recorder.state === 'recording' && recorder.stop(), 2200);
    } catch (err: any) {
      setStatus('error');
      const browser = navigator.userAgent.includes('Firefox') ? 'Firefox' : navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Safari' : 'Chrome/Edge';
      setError(err instanceof Error && /not supported/.test(err.message)
        ? err.message
        : `Microphone access failed. In ${browser}, allow microphone permission from the address-bar site settings, then try again.`);
      cleanup();
    }
  };

  const startInterview = async () => {
    setStarting(true);
    setError('');
    try {
      cleanup();
      await onConfirmed();
    } catch (startError) {
      setStatus('error');
      setError(startError instanceof Error ? startError.message : 'The live interview service is unavailable.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-[700px] flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
            <Mic className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Hardware Check</h1>
          <p className="text-slate-400">Confirm your microphone before the live interview starts. Your short test recording stays on this device.</p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-300">Input level</span>
            <span className="text-xs text-slate-500">Speak for two seconds</span>
          </div>
          <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 transition-all" style={{ width: `${level}%` }} />
          </div>
        </div>

        {audioUrl && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center text-emerald-300 text-sm"><Volume2 className="w-4 h-4 mr-2" /> Playback your mic sample</div>
            <audio src={audioUrl} controls className="h-9 max-w-[280px]" />
          </div>
        )}

        {status === 'error' && (
          <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-5 flex items-start text-red-200 text-sm">
            <ShieldAlert className="w-4 h-4 mr-2 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center">
            <XCircle className="w-4 h-4 mr-2" /> Back
          </button>
          {status !== 'ready' ? (
            <button onClick={runCheck} disabled={status === 'requesting' || status === 'recording'} className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold flex items-center justify-center">
              {status === 'requesting' || status === 'recording' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {status === 'recording' ? 'Recording...' : 'Run Mic Check'}
            </button>
          ) : (
            <button onClick={startInterview} disabled={starting} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center justify-center">
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {starting ? 'Checking AI...' : 'Start Interview'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HardwareCheck;

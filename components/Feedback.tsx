

import React, { useEffect, useState, useRef } from 'react';
import { ComprehensiveAnalysisReport, InterviewSessionResult, TranscriptionItem } from '../types';
import { saveInterviewResult } from '../utils/storage';
import { FEEDBACK_SYSTEM_PROMPT, constructFeedbackUserPrompt } from '../utils/prompts';
import { analyzeStarFromTranscripts, buildDecompressionSummary, buildStudyPlan, updateStreakStats } from '../utils/feedbackEnhancements';
import { generateAiContent } from '../utils/aiClient';
import { parseJsonObject } from '../utils/json';
import { validateReport } from '../utils/reportValidation';
import { serializeState } from '../utils/systemDesignSerializer';
import { hasCandidateResponse } from '../utils/feedbackEligibility';
import { 
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip
} from 'recharts';
import { 
    Cpu, RefreshCcw, CheckCircle2, AlertTriangle, Lightbulb, Activity, BarChart2, Zap, Clock, Hash, AlertOctagon, BookOpen, ListChecks 
} from 'lucide-react';

interface FeedbackProps {
  transcripts: TranscriptionItem[];
  onRestart: () => void;
  resumeContext?: string;
    sessionResult?: InterviewSessionResult | null;
  interviewSettings?: {
      role: string;
      difficulty: string;
      duration: number;
            companyTrackName?: string;
            jobDescription?: string;
  };
}

const Feedback: React.FC<FeedbackProps> = ({ transcripts, onRestart, resumeContext, interviewSettings, sessionResult }) => {
    const candidateResponded = hasCandidateResponse(transcripts);
  const [analysis, setAnalysis] = useState<ComprehensiveAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generationError, setGenerationError] = useState<string | null>(null);
    const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasSavedRef = useRef(false);

  const retryReportSave = () => {
      if (!analysis) return;
      const saved = saveInterviewResult(analysis);
      if (!saved) {
          setPersistenceWarning('Browser storage is still unavailable. Download the report before leaving this page.');
          return;
      }
      updateStreakStats();
      setPersistenceWarning(null);
  };

  const downloadReport = () => {
      if (!analysis) return;
      const file = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `interviewcoach-report-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
  };

  useEffect(() => {
        const controller = new AbortController();
    const generateFeedback = async () => {
      try {
                setLoading(true);
                setGenerationError(null);
            if (!candidateResponded) {
                setAnalysis(null);
                setGenerationError('No candidate response was captured, so no score was generated or saved.');
                return;
            }
        
        // Convert transcripts to string, handle empty case
        let conversationText = "";
        let isTranscriptEmpty = false;

        if (transcripts && transcripts.length > 0) {
             conversationText = transcripts
                .map((t) => `[${t.timestamp}] ${t.speaker.toUpperCase()}: ${t.text}`)
                .join('\n');
        } else {
             isTranscriptEmpty = true;
             conversationText = "(No spoken conversation detected. The candidate connected but did not speak.)";
        }
            
        // Removed the "generate a baseline report" instruction.
        const artifacts = [
            isTranscriptEmpty ? "SYSTEM NOTE: No speech was captured. Keep confidence low and do not infer unobserved skills." : "",
            sessionResult?.systemDesign
                ? `FINAL SYSTEM DESIGN:\nScenario: ${sessionResult.systemDesign.scenario}\n${serializeState(sessionResult.systemDesign.state)}`
                : "",
        ].filter(Boolean).join('\n\n');

        const userPrompt = constructFeedbackUserPrompt(interviewSettings, resumeContext, conversationText, artifacts);

        const response = await generateAiContent({
          prompt: userPrompt,
          systemInstruction: FEEDBACK_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          signal: controller.signal,
        });

        if (response.text) {
            const rawResult = parseJsonObject<unknown>(response.text);
            const result = validateReport(rawResult, {
                role: interviewSettings?.role || 'Unknown Role',
                durationMinutes: Math.round(((sessionResult?.elapsedSeconds ?? 0) / 60) * 10) / 10,
                difficulty: interviewSettings?.difficulty || 'Medium',
                resumeUploaded: Boolean(resumeContext?.trim()),
            });

            if (response.usage) {
                result.tokenUsage = response.usage;
            }

            setAnalysis(result);
            
            if (!hasSavedRef.current) {
                if(result && result.composite) {
                    const saved = saveInterviewResult(result);
                    if (saved) {
                        updateStreakStats();
                        setPersistenceWarning(null);
                    } else {
                        setPersistenceWarning('Your report is ready, but this browser blocked local storage. Export or review it before leaving this page.');
                    }
                    hasSavedRef.current = true;
                }
            }
                }

      } catch (e) {
        console.error("Feedback generation failed", e);
                if (!controller.signal.aborted) {
                        setAnalysis(null);
                        setGenerationError(e instanceof Error ? e.message : 'Feedback generation failed.');
                }
      } finally {
                if (!controller.signal.aborted) setLoading(false);
      }
    };

        generateFeedback();
        return () => controller.abort();
    }, [attempt]);

  if (loading) return (
      <div className="flex flex-col items-center justify-center min-h-[600px] space-y-8 animate-fade-in">
          <div className="relative w-32 h-32">
              <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
              <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-cyan-400 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-4 bg-cyan-950/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <Cpu className="w-12 h-12 text-cyan-400 animate-pulse" />
              </div>
          </div>
          <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Synthesizing Analysis</h2>
              <p className="text-cyan-400 font-mono text-sm animate-pulse">Processing Conversation • Computing Scores • Generating Insights</p>
          </div>
      </div>
  );

  if (!analysis) return (
      <div className="min-h-[520px] flex items-center justify-center px-4">
          <div className="surface max-w-lg p-8 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Feedback could not be generated</h2>
              <p className="text-sm text-slate-400 mb-6">{generationError || 'The AI service returned an invalid report. No score was saved.'}</p>
              <div className="flex justify-center gap-3">
                  {candidateResponded && <button onClick={() => setAttempt(value => value + 1)} className="btn btn-primary">Retry analysis</button>}
                  <button onClick={onRestart} className="btn btn-secondary">New session</button>
              </div>
          </div>
      </div>
  );

  const dims = analysis.dimensions;
  
  // Safe default for Radar data
  const radarData = [
      { subject: 'Comm', A: dims.communication?.score ?? 0, fullMark: 100 },
      { subject: 'Tech', A: dims.technical?.score ?? 0, fullMark: 100 },
      { subject: 'Structure', A: dims.structure?.score ?? 0, fullMark: 100 },
      { subject: 'Problem', A: dims.problemSolving?.score ?? 0, fullMark: 100 },
      { subject: 'Behavioral', A: dims.behavioral?.score ?? 0, fullMark: 100 },
      { subject: 'Delivery', A: dims.delivery?.score ?? 0, fullMark: 100 },
  ];

  const compositeScore = analysis.composite?.score ?? 50;
  const compositeStars = analysis.composite?.stars ?? 3;
    const isLowConfidence = (analysis.composite?.confidence ?? 1) < 0.4;
    const decompression = buildDecompressionSummary(analysis);
    const starAnalysis = analyzeStarFromTranscripts(transcripts);
    const studyPlan = buildStudyPlan(analysis);

  return (
    <div className="feedback-page max-w-7xl mx-auto pb-20 animate-fade-in">

      {persistenceWarning && (
          <div role="alert" className="mb-6 flex flex-col gap-3 border border-amber-700/40 bg-amber-950/30 p-4 text-sm text-amber-100 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-start">
                  <AlertTriangle className="mr-3 mt-0.5 h-4 w-4 shrink-0" />
                  {persistenceWarning}
              </div>
              <div className="flex gap-2">
                  <button onClick={retryReportSave} className="legacy-button legacy-button-quiet">Retry save</button>
                  <button onClick={downloadReport} className="legacy-button legacy-button-primary">Download report</button>
              </div>
          </div>
      )}
      
      {/* HEADER & STATS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
         <div>
            <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold text-white">{analysis.meta?.role || 'Interview'} Report</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${compositeScore >= 80 ? 'bg-green-500/20 text-green-400' : compositeScore >= 60 ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {compositeScore >= 80 ? 'Strong Candidate' : compositeScore >= 60 ? 'Potential' : 'Needs Work'}
                </span>
            </div>
            <div className="flex items-center space-x-4 text-slate-400 text-sm font-mono">
                <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {analysis.meta?.duration_minutes || 0}m</span>
                <span className="flex items-center"><Activity className="w-3 h-3 mr-1"/> {analysis.meta?.difficulty_final || 3}/5 Diff</span>
                {analysis.tokenUsage && (
                    <span className="flex items-center text-cyan-600" title="API Tokens Used">
                        <Hash className="w-3 h-3 mr-1"/> {analysis.tokenUsage.totalTokens.toLocaleString()} toks
                    </span>
                )}
            </div>
         </div>
         <div className="flex space-x-3">
            <button onClick={onRestart} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors border border-slate-700 flex items-center shadow-lg">
                <RefreshCcw className="w-4 h-4 mr-2" /> New Session
            </button>
         </div>
      </div>

      {isLowConfidence && (
          <div className="mb-8 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl flex items-start animate-fade-in">
              <AlertOctagon className="w-5 h-5 text-amber-500 mr-3 mt-0.5 shrink-0" />
              <div>
                  <h4 className="text-amber-400 font-bold text-sm">Low Data Confidence</h4>
                  <p className="text-amber-200/70 text-sm mt-1">
                      The interview session was brief. Scores are estimated baselines.
                  </p>
              </div>
          </div>
      )}

    <div className="mb-8 bg-slate-900 border border-cyan-500/20 rounded-3xl p-6 shadow-xl">
          <p className="text-[10px] text-cyan-300 font-bold uppercase tracking-[0.2em] mb-3">Quick Debrief</p>
          <div className="grid md:grid-cols-3 gap-3">
              {decompression.map((line, index) => (
                  <div key={index} className="bg-slate-950/60 border border-slate-800/70 rounded-2xl p-4 text-sm text-slate-200 leading-relaxed">
                      {line}
                  </div>
              ))}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-6">
            
            {/* SCORE CARD */}
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 text-center shadow-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Composite Score</p>
                <div className="text-7xl font-black text-white mb-2 tracking-tighter group-hover:scale-105 transition-transform duration-500">
                    {compositeScore}
                </div>
                <div className="flex justify-center space-x-1.5 mb-6">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${i < compositeStars ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-slate-800'}`} />
                    ))}
                </div>
                <p className="text-sm text-slate-400 italic px-4 leading-relaxed">"{analysis.composite?.explanation || 'Assessment complete.'}"</p>
            </div>

            {/* RADAR CHART */}
            <div className="bg-slate-900 rounded-3xl p-4 border border-slate-800 h-80 shadow-xl relative">
                <p className="absolute top-4 left-0 w-full text-center text-xs font-bold text-slate-500 uppercase">Skill Dimensions</p>
                <div className="w-full h-full min-h-[250px] min-w-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="54%" outerRadius="70%" data={radarData}>
                            <PolarGrid stroke="#49473b" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#999284', fontSize: 11, fontWeight: 600 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Score" dataKey="A" stroke="#70e1c1" strokeWidth={2} fill="#70e1c1" fillOpacity={0.28} />
                            <Tooltip contentStyle={{ backgroundColor: '#111719', borderColor: '#3c4c50', borderRadius: '3px' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* STRENGTHS LIST */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                <div className="space-y-6">
                    <div>
                        <h4 className="text-sm font-bold text-green-400 uppercase tracking-wide mb-3 flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Key Strengths
                        </h4>
                        {(analysis.strengths && analysis.strengths.length > 0) ? (
                            <ul className="space-y-2">
                                {analysis.strengths.slice(0, 3).map((str, i) => (
                                    <li key={i} className="text-sm text-slate-300 flex items-start">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 mr-2 shrink-0" />
                                        {str.point}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-500 italic">No specific strengths detected in this session.</p>
                        )}
                    </div>
                    <div className="w-full h-px bg-slate-800" />
                    <div>
                        <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wide mb-3 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2" /> Areas for Growth
                        </h4>
                         {(analysis.improvements && analysis.improvements.length > 0) ? (
                            <ul className="space-y-2">
                                {analysis.improvements.slice(0, 3).map((imp, i) => (
                                    <li key={i} className="text-sm text-slate-300 flex items-start">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 mr-2 shrink-0" />
                                        {imp.title}
                                    </li>
                                ))}
                            </ul>
                         ) : (
                            <p className="text-sm text-slate-500 italic">No specific improvements detected in this session.</p>
                         )}
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-8">
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl">
                <h3 className="text-xl font-bold text-white mb-4">Executive Summary</h3>
                <p className="text-slate-300 leading-loose text-base">{analysis.summary || 'No summary available.'}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center"><ListChecks className="w-5 h-5 mr-2 text-cyan-400" /> STAR Analyzer</h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {(['Situation', 'Task', 'Action', 'Result'] as const).map(label => {
                            const key = label.toLowerCase() as keyof typeof starAnalysis;
                            const present = !!starAnalysis[key];
                            return (
                                <div key={label} className={`p-3 rounded-xl border text-xs ${present ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
                                    {present ? 'Present' : 'Needs detail'}: {label}
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        {starAnalysis.missing.length ? `Add clearer ${starAnalysis.missing.join(', ')} details in behavioral answers.` : 'Your behavioral answers included all STAR ingredients.'}
                    </p>
                </div>

                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center"><BookOpen className="w-5 h-5 mr-2 text-emerald-400" /> Study Plan</h3>
                    {studyPlan.length ? (
                        <ul className="space-y-3">
                            {studyPlan.map((item, index) => (
                                <li key={index} className="text-sm text-slate-300 flex items-start">
                                    <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold mr-3 shrink-0">{index + 1}</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-slate-500">Complete a fuller session to generate a targeted study plan.</p>}
                </div>
            </div>

            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800 bg-slate-800/50">
                    <h3 className="font-bold text-white">Dimensional Deep Dive</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-800">
                    <DimensionCard title="Communication" data={dims.communication} icon={Activity} color="cyan" />
                    <DimensionCard title="Technical" data={dims.technical} icon={Cpu} color="purple" />
                    <DimensionCard title="Structure" data={dims.structure} icon={BarChart2} color="blue" />
                    <DimensionCard title="Behavioral" data={dims.behavioral} icon={Zap} color="orange" />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-bold text-white px-2">Question Analysis</h3>
                
                {(analysis.perQuestion && analysis.perQuestion.length > 0) ? (
                    analysis.perQuestion.map((q, i) => (
                    <div key={i} className="rounded-2xl border bg-slate-900 border-slate-800 p-6">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center space-x-3">
                                <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                    {i + 1}
                                </span>
                                <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                                    q.evaluation === 'Strong' ? 'bg-green-500/20 text-green-400' :
                                    q.evaluation === 'Good' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-red-500/20 text-red-400'
                                }`}>
                                    {q.evaluation}
                                </span>
                            </div>
                            <div className="text-2xl font-bold text-slate-700">{q.performanceScore}</div>
                        </div>
                        
                        <h4 className="text-lg font-medium text-white mb-3">{q.questionText}</h4>
                        <div className="bg-slate-950/50 rounded-xl p-4 mb-4 border border-slate-800/50">
                            <p className="text-sm text-slate-400 italic">"{(q.answerText || '').slice(0, 200)}..."</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Analysis</p>
                                <p className="text-sm text-slate-300">{q.feedback}</p>
                            </div>
                            {q.suggestedAction && (
                                <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-3">
                                    <p className="text-xs font-bold text-blue-400 uppercase mb-1 flex items-center">
                                        <Lightbulb className="w-3 h-3 mr-1" /> Tip
                                    </p>
                                    <p className="text-sm text-blue-200/80">{q.suggestedAction}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))
               ) : (
                   <div className="text-center py-10 bg-slate-900 rounded-3xl border border-slate-800">
                       <p className="text-slate-500">No questions analyzed in this session.</p>
                   </div>
               )}
            </div>
        </div>
      </div>
    </div>
  );
};

const DimensionCard: React.FC<any> = ({ title, data, icon: Icon, color }) => {
    if (!data) return null;
    return (
        <div className="bg-slate-900 p-6">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-400`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white">{title}</h4>
                        <p className="text-xs text-slate-500 font-mono">{Math.round((data.confidence || 0.1) * 100)}% Conf</p>
                    </div>
                </div>
                <div className={`text-2xl font-bold text-${color}-400`}>{data.score || 0}</div>
            </div>
            
            <div className="space-y-3">
                {Object.entries(data.breakdown || {}).map(([key, val]: [string, any]) => (
                    <div key={key}>
                        <div className="flex justify-between text-xs mb-1 text-slate-400 capitalize">
                            <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span>{val}</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className={`h-full rounded-full bg-${color}-500 transition-all duration-1000`} 
                                style={{ width: `${Math.min(100, Math.max(0, val || 0))}%` }} 
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Feedback;

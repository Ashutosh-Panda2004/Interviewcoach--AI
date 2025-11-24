
import React, { useEffect, useState, useMemo } from 'react';
import { HistoryItem, InterviewSettings } from '../types';
import { getInterviewHistory, addHistoryItems, removeMockItems } from '../utils/storage';
import { generateMockHistory } from '../utils/mockData';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    LineChart, Line, ScatterChart, Scatter, RadarChart, PolarGrid, 
    PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ComposedChart, Bar, ReferenceLine
} from 'recharts';
import { 
    Activity, TrendingUp, CheckCircle2, AlertTriangle, 
    Zap, FileText, PlayCircle, BookOpen, Info, Minus, TrendingDown, 
    Target, Database, Terminal, BarChart2, Trash2, Eye, Gauge, ArrowUpRight
} from 'lucide-react';

interface DashboardProps {
    onStartSession?: (settings: Partial<InterviewSettings>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onStartSession }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setHistory(getInterviewHistory());
  }, [refreshTrigger]);

  // --- HANDLERS ---
  
  const handleAddMockData = () => {
    const mockItems = generateMockHistory();
    addHistoryItems(mockItems);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRemoveMockData = () => {
    removeMockItems();
    setRefreshTrigger(prev => prev + 1);
  };

  const handleGenerateFocusedSession = (topic: string, reason: string) => {
      if(onStartSession) {
          onStartSession({
              focusArea: `Improve: ${topic}. Focus on: ${reason}`,
              difficulty: 'Medium',
              duration: 15
          });
      }
  };

  // --- ANALYTICS ENGINE ---
  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    
    // 1. Averages
    const avgScore = Math.round(sorted.reduce((acc, curr) => acc + curr.score, 0) / sorted.length);
    
    // 2. Improvement (Slope/Growth)
    const improvement = sorted.length > 1 ? latest.score - sorted[0].score : 0;
    
    // 3. Stability Index (1 - Standard Deviation / 100)
    const variance = sorted.reduce((acc, curr) => acc + Math.pow(curr.score - avgScore, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);
    const stabilityIndex = Math.max(0, Math.round((1 - (stdDev / 50)) * 100)); 

    // 4. DPI (Difficulty Performance Index)
    let dpi = 0;
    if (sorted.length > 2) {
        const n = sorted.length;
        const sumX = sorted.reduce((a, c) => a + c.feedback.meta.difficulty_final, 0);
        const sumY = sorted.reduce((a, c) => a + c.score, 0);
        const sumXY = sorted.reduce((a, c) => a + (c.feedback.meta.difficulty_final * c.score), 0);
        const sumX2 = sorted.reduce((a, c) => a + (c.feedback.meta.difficulty_final * c.feedback.meta.difficulty_final), 0);
        const sumY2 = sorted.reduce((a, c) => a + (c.score * c.score), 0);
        
        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
        dpi = denominator === 0 ? 0 : numerator / denominator;
    }

    // 5. Radar Data
    const latestDims = latest.feedback.dimensions;
    const radarData = [
        { subject: 'Comm', A: latestDims.communication?.score || 0, fullMark: 100, cohort: 75 },
        { subject: 'Tech', A: latestDims.technical?.score || 0, fullMark: 100, cohort: 70 },
        { subject: 'Struct', A: latestDims.structure?.score || 0, fullMark: 100, cohort: 65 },
        { subject: 'Prob', A: latestDims.problemSolving?.score || 0, fullMark: 100, cohort: 72 },
        { subject: 'Behav', A: latestDims.behavioral?.score || 0, fullMark: 100, cohort: 68 },
        { subject: 'Fit', A: latestDims.resumeFit?.score || 0, fullMark: 100, cohort: 60 },
    ];

    // 6. Heatmap Data
    const heatmapData = Array(90).fill(0);
    const today = new Date();
    sorted.forEach(session => {
        const date = new Date(session.date);
        const diffTime = Math.abs(today.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 90) {
            heatmapData[90 - diffDays] = (heatmapData[90 - diffDays] || 0) + 1;
        }
    });

    // 7. Pressure / Resilience Data (Enhanced)
    const pressureData = sorted.map(item => {
        const diff = item.feedback.meta.difficulty_final; // 1-5
        const score = item.score;
        
        // Calculate Resilience Rating
        let resilience = "Neutral";
        let resilienceColor = "text-slate-400";
        
        if (diff >= 4) {
            if (score >= 80) { resilience = "Ironclad"; resilienceColor = "text-green-400"; }
            else if (score >= 60) { resilience = "Resilient"; resilienceColor = "text-blue-400"; }
            else { resilience = "Struggled"; resilienceColor = "text-red-400"; }
        } else if (diff <= 2) {
             if (score >= 90) { resilience = "Cruising"; resilienceColor = "text-cyan-400"; }
        }

        return {
            dateRaw: item.date,
            date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            difficulty: diff,
            difficultyScaled: diff * 20, // Scale 1-5 to 0-100 for visual comparison
            score: score,
            resilience,
            resilienceColor,
            role: item.role
        };
    });

    return {
        total: sorted.length,
        latestScore: latest.score,
        avgScore,
        improvement,
        stabilityIndex,
        dpi,
        sortedData: sorted,
        latestReport: latest.feedback,
        resumeAnalysis: latest.feedback.resumeAnalysis,
        radarData,
        heatmapData,
        pressureData
    };
  }, [history]);

  const chartData = useMemo(() => stats?.sortedData.map((item, i) => ({
    date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: item.score,
    technical: item.feedback.dimensions.technical?.score || 0,
    communication: item.feedback.dimensions.communication?.score || 0,
    structure: item.feedback.dimensions.structure?.score || 0,
    difficulty: item.feedback.meta.difficulty_final,
    index: i
  })) || [], [stats]);

  // --- RENDER ---

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center">
                <Activity className="w-8 h-8 mr-3 text-cyan-400" />
                Performance Hub
            </h1>
            <p className="text-slate-400 text-sm mt-1">
                {stats ? `Analytics across ${stats.total} sessions` : 'No session data available'}
            </p>
        </div>
        
        <div className="flex space-x-3 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            <button onClick={handleAddMockData} className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-medium flex items-center transition-colors">
                <Database className="w-3 h-3 mr-2" /> Add Mock Data
            </button>
            <button onClick={handleRemoveMockData} className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded text-xs font-medium flex items-center transition-colors">
                <Trash2 className="w-3 h-3 mr-2" /> Remove Mock
            </button>
        </div>
      </div>

      {/* EMPTY STATE */}
      {!stats && (
          <div className="text-center py-24 bg-slate-900/50 rounded-3xl border border-slate-800 shadow-xl">
              <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BarChart2 className="w-10 h-10 text-slate-500" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">No Session Data Yet</h2>
              <p className="text-slate-400 max-w-md mx-auto mb-8">
                  Complete an interview session to visualize your performance trends, 
                  or use the buttons above to add mock data for testing.
              </p>
          </div>
      )}

      {/* MAIN DASHBOARD CONTENT */}
      {stats && (
          <>
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <MetricCard label="Current Score" value={stats.latestScore} icon={Target} color="cyan" />
                <MetricCard label="Growth" value={`+${Math.round(stats.improvement)} pts`} icon={TrendingUp} color="green" />
                <MetricCard label="Stability" value={`${stats.stabilityIndex}%`} icon={Activity} color="purple" />
                <MetricCard label="Avg Score" value={stats.avgScore} icon={BarChart2} color="blue" />
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden flex flex-col justify-center">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Pressure Index</p>
                    <div className="flex items-center">
                        <span className={`text-xl font-bold ${stats.dpi > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                            {stats.dpi > 0 ? 'Resilient' : 'Sensitive'}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">DPI: {stats.dpi.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Score Trend - 2/3 width */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="font-semibold text-white mb-4">Performance Trajectory</h3>
                    <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis domain={[0,100]} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2} fill="url(#colorScore)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Radar Skill - 1/3 width */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="font-semibold text-white mb-4 text-center">Skill Profile</h3>
                    <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats.radarData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar name="You" dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.5} />
                                <Radar name="Cohort" dataKey="cohort" stroke="#64748b" fill="#64748b" fillOpacity={0.1} />
                                <Legend />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* PERFORMANCE UNDER PRESSURE & SKILL EVOLUTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                
                {/* ENHANCED: Pressure Analysis */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-white flex items-center">
                            <Gauge className="w-5 h-5 mr-2 text-pink-400" /> 
                            Pressure & Resilience Analysis
                        </h3>
                        <div className="flex items-center text-xs space-x-3">
                            <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-cyan-400 mr-1"/> Score</div>
                            <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-purple-500 mr-1"/> Difficulty</div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-full">
                        {/* LEFT: Combined Chart */}
                        <div className="md:col-span-3 h-64 min-w-0">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <ComposedChart data={stats.pressureData}>
                                    <CartesianGrid stroke="#1e293b" vertical={false} strokeDasharray="3 3" />
                                    <XAxis dataKey="date" hide />
                                    <YAxis yAxisId="left" domain={[0, 100]} hide />
                                    <YAxis yAxisId="right" domain={[0, 5]} hide />
                                    <Tooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl">
                                                        <p className="text-slate-300 text-xs mb-1">{d.date}</p>
                                                        <div className="flex items-center justify-between gap-4 mb-1">
                                                            <span className="text-purple-400 text-xs font-bold">Difficulty: {d.difficulty}/5</span>
                                                            <span className="text-cyan-400 text-xs font-bold">Score: {d.score}</span>
                                                        </div>
                                                        <p className={`text-[10px] uppercase font-bold mt-1 ${d.resilienceColor}`}>{d.resilience}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar yAxisId="left" dataKey="difficultyScaled" barSize={8} fill="#a855f7" radius={[4, 4, 0, 0]} fillOpacity={0.4} />
                                    <Line yAxisId="left" type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} />
                                    <ReferenceLine yAxisId="left" y={60} stroke="#334155" strokeDasharray="3 3" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* RIGHT: Detailed Session List */}
                        <div className="md:col-span-2 bg-slate-950/50 rounded-xl border border-slate-800/50 p-3 overflow-y-auto max-h-64 custom-scrollbar">
                            <h4 className="text-[10px] uppercase text-slate-500 font-bold mb-3 sticky top-0 bg-slate-950/90 py-1">High Pressure Sessions</h4>
                            <div className="space-y-2">
                                {stats.pressureData
                                    .filter(d => d.difficulty >= 3) // Only show Medium+ difficulty
                                    .reverse() // Newest first
                                    .map((session, idx) => (
                                    <div key={idx} className="flex flex-col p-2 rounded hover:bg-slate-900 transition-colors border-b border-slate-800/50 last:border-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-slate-300 font-medium">{session.date}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${session.difficulty >= 4 ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                                Diff {session.difficulty}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{session.role}</span>
                                            <span className={`text-[10px] font-bold ${session.resilienceColor}`}>
                                                {session.resilience}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Skill Evolution */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="font-semibold text-white mb-4">Skill Evolution</h3>
                    <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="index" tick={false} axisLine={false} />
                                <YAxis domain={[0,100]} hide />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="technical" stroke="#a855f7" strokeWidth={2} dot={false} name="Technical" />
                                <Line type="monotone" dataKey="communication" stroke="#22d3ee" strokeWidth={2} dot={false} name="Communication" />
                                <Legend />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* RESUME INTELLIGENCE - PDF STYLE */}
            {stats.resumeAnalysis && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl mb-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
                    
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center">
                            <FileText className="w-6 h-6 text-purple-400 mr-3" />
                            <h3 className="text-xl font-bold text-white">Resume Intelligence</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                        
                        {/* PDF Viewer */}
                        <div className="xl:col-span-8">
                            <div className="bg-slate-200 text-slate-900 rounded-sm shadow-2xl p-8 font-serif min-h-[600px] relative">
                                {/* Paper Effect Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
                                
                                <div className="relative z-10">
                                    <ResumePDFHighlighter 
                                        text={stats.resumeAnalysis.text}
                                        highlights={stats.resumeAnalysis.highlights}
                                        onGeneratePractice={handleGenerateFocusedSession}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Analysis Sidebar */}
                        <div className="xl:col-span-4 space-y-6">
                            
                            {/* Summary Card */}
                            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5">
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide mb-3 flex items-center">
                                    <Eye className="w-4 h-4 mr-2 text-cyan-400" /> AI Summary
                                </h4>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    {stats.resumeAnalysis.overallSummary || "No summary available."}
                                </p>
                            </div>

                            {/* Confidence Bars */}
                            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5">
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Topic Confidence</h4>
                                <div className="space-y-4">
                                    {stats.resumeAnalysis.topicConfidence.map((tc, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-medium text-slate-300">{tc.topic}</span>
                                                <span className={tc.score < 50 ? 'text-red-400' : tc.score < 75 ? 'text-yellow-400' : 'text-green-400'}>{tc.score}%</span>
                                            </div>
                                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                                                <div 
                                                    className={`h-1.5 rounded-full transition-all duration-500 ${tc.score < 50 ? 'bg-red-500' : tc.score < 75 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                                    style={{ width: `${tc.score}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="bg-gradient-to-b from-purple-900/20 to-slate-900 border border-purple-500/20 rounded-xl p-5">
                                <h4 className="text-sm font-bold text-purple-200 mb-3 flex items-center">
                                    <BookOpen className="w-4 h-4 mr-2" /> Suggested Practice
                                </h4>
                                <div className="space-y-2">
                                    {stats.resumeAnalysis.topicConfidence.filter(t => t.score < 70).map((t, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => handleGenerateFocusedSession(t.topic, `Low confidence detected (${t.score}%)`)}
                                            className="w-full text-left px-3 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex justify-between items-center group transition-all"
                                        >
                                            <span>Explain {t.topic}</span>
                                            <PlayCircle className="w-4 h-4 text-purple-400 opacity-50 group-hover:opacity-100" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="font-semibold text-white mb-4 flex items-center">
                        <CheckCircle2 className="w-5 h-5 mr-2 text-blue-400" /> Top Strengths
                    </h3>
                    <div className="space-y-3">
                        {stats.latestReport.strengths?.map((str: any, i: number) => (
                            <div key={i} className="flex items-start group relative">
                                <div className="mr-3 mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <div>
                                    <p className="text-slate-200 font-medium text-sm">{str.point}</p>
                                    <p className="text-slate-500 text-xs">{str.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="font-semibold text-white mb-4 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-orange-400" /> Priority Improvements
                    </h3>
                    <div className="space-y-3 h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {stats.latestReport.improvements?.map((imp: any, i: number) => (
                            <div key={i} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 hover:border-orange-500/30 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange-900/30 text-orange-400">
                                        {imp.severity} Priority
                                    </span>
                                </div>
                                <h4 className="text-white font-medium text-sm mb-1">{imp.title}</h4>
                                <button 
                                    onClick={() => handleGenerateFocusedSession(imp.title, imp.description)}
                                    className="w-full py-2 mt-3 bg-orange-900/20 hover:bg-orange-900/40 border border-orange-700/30 rounded-lg text-xs text-orange-200 font-medium flex items-center justify-center transition-all"
                                >
                                    <Zap className="w-3 h-3 mr-2" /> Generate Focused Session
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Heatmap */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Interview Frequency</h3>
                <div className="flex gap-1 flex-wrap">
                    {stats.heatmapData.map((count, i) => (
                        <div key={i} className={`w-3 h-3 rounded-sm ${count === 0 ? 'bg-slate-800' : 'bg-cyan-400'}`} title={`${count} sessions`} />
                    ))}
                </div>
            </div>
          </>
      )}
    </div>
  );
};

// --- RESUME PDF VIEWER ---

const ResumePDFHighlighter: React.FC<{text: string, highlights: any[], onGeneratePractice: any}> = ({ text, highlights, onGeneratePractice }) => {
    // FIX: Add guard for null/undefined text
    if (!text) return <div className="text-slate-500 italic p-4 text-center">No resume text available for analysis.</div>;

    const sorted = [...(highlights || [])].sort((a, b) => a.start - b.start);
    const elements = [];
    let lastIndex = 0;

    sorted.forEach((h, i) => {
        // Bounds Checking: Ensure LLM indices are within the actual text
        const safeStart = Math.max(0, Math.min(h.start, text.length));
        const safeEnd = Math.max(safeStart, Math.min(h.end, text.length));

        if (safeStart > lastIndex) {
            elements.push(<span key={`text-${i}`}>{text.substring(lastIndex, safeStart)}</span>);
        }
        
        const colorClass = 
            h.type === 'strength' ? 'bg-green-200/50 border-b-2 border-green-600' : 
            h.type === 'weakness' ? 'bg-red-200/50 border-b-2 border-red-600' : 
            'bg-yellow-200/50 border-b-2 border-yellow-600';

        elements.push(
            <span key={`highlight-${i}`} className={`relative group cursor-help ${colorClass} rounded px-0.5`}>
                {text.substring(safeStart, safeEnd)}
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl z-50 hidden group-hover:block text-left font-sans">
                    <p className={`font-bold text-[10px] uppercase mb-1 ${h.type === 'strength' ? 'text-green-400' : h.type === 'weakness' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {h.type}
                    </p>
                    <p className="text-slate-300 text-xs mb-2 leading-tight">{h.reason}</p>
                    {h.suggestion && <p className="text-slate-500 text-[10px] italic border-t border-slate-800 pt-1">💡 {h.suggestion}</p>}
                    
                    {h.type === 'weakness' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onGeneratePractice("Resume Weakness", h.reason); }}
                            className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded flex items-center justify-center mt-2 text-xs font-bold"
                        >
                            <Zap className="w-3 h-3 mr-1" /> Practice This
                        </button>
                    )}
                </div>
            </span>
        );
        lastIndex = safeEnd;
    });
    
    if (lastIndex < text.length) {
        elements.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    }

    return <div className="whitespace-pre-wrap leading-relaxed text-sm text-slate-900">{elements}</div>;
};

const MetricCard: React.FC<any> = ({ label, value, icon: Icon, color }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-bold text-white">{value}</p>
            </div>
            <div className={`p-2.5 rounded-xl bg-${color}-500/10 text-${color}-400`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    </div>
);

export default Dashboard;
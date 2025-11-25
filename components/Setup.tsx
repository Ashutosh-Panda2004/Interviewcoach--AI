
import React, { useState, useRef, useEffect } from 'react';
import { InterviewSettings, InterviewType, InterviewerPersonality } from '../types';
import { PlayCircle, Briefcase, UploadCloud, FileText, CheckCircle2, Clock, Gauge, Sparkles, UserCog, Swords, Dna, Settings2, Loader2, Presentation, AlertCircle } from 'lucide-react';
// @ts-ignore
import * as pdfjsLibModule from 'pdfjs-dist';

// Handle ESM default export if necessary (fixes "Cannot set properties of undefined")
const pdfjsLib = (pdfjsLibModule as any).default || pdfjsLibModule;

// Set worker source for PDF.js - MUST match the version in index.html exactly
// We use unpkg here because it serves the raw worker script which works better with browser Worker() 
// than esm.sh's module-wrapped version in some contexts (prevents "Setting up fake worker failed" error).
if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

interface SetupProps {
  onStart: (settings: InterviewSettings) => void;
  initialSettings?: Partial<InterviewSettings> | null;
}

const Setup: React.FC<SetupProps> = ({ onStart, initialSettings }) => {
  // Required Fields (Always Visible)
  const [role, setRole] = useState('Software Engineer');
  const [experienceLevel, setExperienceLevel] = useState<InterviewSettings['experienceLevel']>('Mid-Level');
  const [focusArea, setFocusArea] = useState('System Design & React');
  const [resumeText, setResumeText] = useState('');
  
  // Configurable Fields (Hidden in Blind Mode)
  const [duration, setDuration] = useState<number>(15);
  const [difficulty, setDifficulty] = useState<InterviewSettings['difficulty']>('Medium');
  const [interviewType, setInterviewType] = useState<InterviewType>('Actual Interview');
  const [personality, setPersonality] = useState<InterviewerPersonality>('Neutral Professional');
  
  // UI State
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false); // NEW: Demo Mode State
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply initial settings if provided (e.g., from Dashboard)
  useEffect(() => {
    if (initialSettings) {
        if (initialSettings.role) setRole(initialSettings.role);
        if (initialSettings.focusArea) setFocusArea(initialSettings.focusArea);
        if (initialSettings.difficulty) setDifficulty(initialSettings.difficulty);
        if (initialSettings.duration) setDuration(initialSettings.duration);
        if (initialSettings.resumeText) {
            setResumeText(initialSettings.resumeText);
            setFileName("Previous Resume");
        }
        if (initialSettings.interviewType) setInterviewType(initialSettings.interviewType);
        if (initialSettings.personality) setPersonality(initialSettings.personality);
        
        // Disable blind mode if coming from a specific "Generate Session" action
        setIsBlindMode(false);
    }
  }, [initialSettings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalType = interviewType;
    let finalPersonality = personality;
    let finalDifficulty = difficulty;
    let finalDuration = duration;

    // BLIND MODE LOGIC: Randomize settings
    if (isBlindMode) {
        const types: InterviewType[] = ['Actual Interview', 'Practice Interview'];
        const personalities: InterviewerPersonality[] = ['Neutral Professional', 'Very Strict', 'Calm & Polite', 'Highly Helpful', 'Friendly Conversational'];
        const difficulties: InterviewSettings['difficulty'][] = ['Easy', 'Medium', 'Hard'];
        const durations = [15, 20, 30]; // Don't random select 5min for blind mode, too short

        finalType = types[Math.floor(Math.random() * types.length)];
        finalPersonality = personalities[Math.floor(Math.random() * personalities.length)];
        finalDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
        finalDuration = durations[Math.floor(Math.random() * durations.length)];
        
        console.log("Blind Mode Activated:", { finalType, finalPersonality, finalDifficulty, finalDuration });
    }

    onStart({ 
        role, 
        experienceLevel, 
        focusArea, 
        resumeText, 
        duration: finalDuration, 
        difficulty: finalDifficulty, 
        interviewType: finalType, 
        personality: finalPersonality,
        isBlindMode,
        isDemoMode // Pass to types/prompts
    });
  };

  const extractTextFromPdf = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Use standard font data and CMaps to avoid "empty text" errors
      // using UNPKG to avoid CORS/ESM issues that occur with esm.sh for static assets
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
      });

      const pdf = await loadingTask.promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Improve text layout: Join items with NEWLINES to preserve list structures
        // Resumes are often vertical lists; joining with space breaks the context for the AI.
        const pageItems = textContent.items
            .map((item: any) => item.str)
            .filter((str: string) => str.trim().length > 0);
            
        // Join with newline to preserve bullets/sections
        const pageText = pageItems.join('\n');

        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      
      return fullText;
    } catch (error) {
      console.error("PDF Extraction Failed:", error);
      throw new Error("Could not parse PDF. It might be an image scan, encrypted, or corrupted.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);

    if (file) {
      setFileName(file.name);
      setIsProcessingFile(true);
      
      try {
        if (file.type === 'application/pdf') {
            const text = await extractTextFromPdf(file);
            
            // Validation: If extraction yields very little text, it might be a scanned image
            if (text.replace(/[\s\n-]/g, '').length < 50) {
                 const warning = `[WARNING: PDF PARSE YIELDED LOW CONTENT. This file may be a scanned image.]`;
                 setResumeText(warning);
                 setUploadError("This PDF appears to be an image scan (no selectable text). Please use a standard text-based PDF.");
            } else {
                 setResumeText(text);
            }
        } else {
            // Text/MD/JSON
            const reader = new FileReader();
            reader.onload = (event) => {
              const text = event.target?.result as string;
              setResumeText(text);
            };
            reader.readAsText(file);
        }
      } catch (err: any) {
          console.error("File upload error", err);
          setResumeText('');
          setUploadError(err.message || "Failed to read file.");
          setFileName(null);
      } finally {
          setIsProcessingFile(false);
      }
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    setFileName(null);
    setResumeText('');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Interview<span className="text-cyan-400">Coach</span> Setup
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Configure your session parameters or try "Blind Mode" for an unpredictable challenge.
        </p>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 md:p-10 shadow-2xl">
        
        {/* MODE TOGGLE - TOP LEVEL */}
        <div className="flex flex-col items-center justify-center mb-12">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Select Configuration Mode</p>
            <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800 inline-flex shadow-inner relative">
                {/* Animated Background Pill */}
                <div 
                    className={`absolute top-2 bottom-2 rounded-xl transition-all duration-300 ease-out shadow-lg z-0 ${
                        !isBlindMode 
                        ? 'left-2 w-[180px] bg-gradient-to-r from-cyan-600/20 to-cyan-400/10 border border-cyan-500/50' 
                        : 'left-[190px] w-[180px] bg-gradient-to-r from-purple-600/20 to-purple-400/10 border border-purple-500/50'
                    }`}
                />
                
                <button
                    type="button"
                    onClick={() => setIsBlindMode(false)}
                    className={`relative z-10 px-8 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center w-[180px] ${
                        !isBlindMode ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Manual Setup
                </button>
                
                <button
                    type="button"
                    onClick={() => setIsBlindMode(true)}
                    className={`relative z-10 px-8 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center w-[180px] ${
                        isBlindMode ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <Dna className="w-4 h-4 mr-2" />
                    Blind Mode
                </button>
            </div>
        </div>

        {initialSettings && (
            <div className="mb-8 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 p-4 rounded-xl flex items-center animate-pulse">
                <Sparkles className="w-5 h-5 text-cyan-400 mr-3" />
                <div>
                    <p className="text-cyan-200 font-semibold text-sm">Focused Session Configured</p>
                    <p className="text-cyan-400/70 text-xs">Optimized to improve: {initialSettings.focusArea}</p>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Configuration */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* REQUIRED: Role & Experience (Always Visible) */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <Briefcase className="w-5 h-5 mr-3 text-cyan-400" />
                Role & Experience
              </h3>
              
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Target Position</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all placeholder-slate-600"
                    placeholder="e.g. Product Manager, Senior Developer..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Experience Level</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['Junior', 'Mid-Level', 'Senior', 'Executive'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setExperienceLevel(level as InterviewSettings['experienceLevel'])}
                        className={`px-2 py-3 rounded-xl text-sm font-medium transition-all border ${
                          experienceLevel === level
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CONDITIONAL SECTION */}
            {isBlindMode ? (
                // BLIND MODE: Mystery Card
                <div className="p-8 bg-gradient-to-br from-purple-900/20 to-slate-900 border border-purple-500/30 rounded-2xl relative overflow-hidden group animate-fade-in">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-50" />
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all" />
                    
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                        <Sparkles className="w-6 h-6 mr-3 text-purple-400 animate-pulse" /> 
                        Mystery Configuration
                    </h3>
                    
                    <div className="space-y-4 text-sm text-purple-200/80">
                        <p>The AI will randomly select hidden parameters to simulate an unpredictable interview environment:</p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <div className="bg-slate-950/50 p-3 rounded-lg border border-purple-500/20 flex items-center">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"/> Interview Type
                            </div>
                            <div className="bg-slate-950/50 p-3 rounded-lg border border-purple-500/20 flex items-center">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"/> Personality
                            </div>
                            <div className="bg-slate-950/50 p-3 rounded-lg border border-purple-500/20 flex items-center">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"/> Difficulty
                            </div>
                            <div className="bg-slate-950/50 p-3 rounded-lg border border-purple-500/20 flex items-center">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"/> Duration
                            </div>
                        </div>
                        <p className="mt-4 italic text-xs opacity-70 border-t border-purple-500/20 pt-3">
                            "You won't know if the interviewer is helpful or strict until they start speaking. Adapt on the fly!"
                        </p>
                    </div>
                </div>
            ) : (
                // MANUAL MODE: Full Configuration
                <div className="space-y-8 animate-fade-in">
                    
                    {/* Duration & Difficulty */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white flex items-center">
                                <Clock className="w-5 h-5 mr-3 text-cyan-400" />
                                Duration
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {[5, 10, 15, 20, 30].map((mins) => (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => setDuration(mins)}
                                        className={`px-2 py-3 rounded-xl text-sm font-medium transition-all border ${
                                        duration === mins
                                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        {mins} min
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white flex items-center">
                                <Gauge className="w-5 h-5 mr-3 text-cyan-400" />
                                Difficulty
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {['Easy', 'Medium', 'Hard'].map((diff) => (
                                    <button
                                        key={diff}
                                        type="button"
                                        onClick={() => setDifficulty(diff as any)}
                                        className={`px-2 py-3 rounded-xl text-sm font-medium transition-all border ${
                                        difficulty === diff
                                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        {diff}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Interview Type Selection */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <Swords className="w-5 h-5 mr-3 text-cyan-400" />
                            Interview Type
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {['Actual Interview', 'Practice Interview'].map((type) => (
                                <div 
                                    key={type}
                                    onClick={() => setInterviewType(type as InterviewType)}
                                    className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center space-x-3 ${
                                        interviewType === type 
                                        ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${interviewType === type ? 'border-cyan-400' : 'border-slate-600'}`}>
                                        {interviewType === type && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{type}</p>
                                        <p className="text-xs opacity-60 mt-0.5">
                                            {type === 'Actual Interview' ? 'Realistic, professional, no hints.' : 'Feedback after each question.'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Interviewer Personality */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <UserCog className="w-5 h-5 mr-3 text-cyan-400" />
                            Interviewer Personality
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {[
                                'Neutral Professional', 
                                'Very Strict', 
                                'Calm & Polite', 
                                'Highly Helpful', 
                                'Friendly Conversational'
                            ].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPersonality(p as InterviewerPersonality)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all border ${
                                        personality === p
                                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Focus Areas</label>
                <textarea
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all placeholder-slate-600 resize-none"
                placeholder="Specific skills? (e.g. System Design, Leadership, React)"
                />
            </div>
            
            {/* Demo Mode Toggle (Subtle) */}
            <div className="pt-2 flex items-center space-x-2">
                <input 
                    type="checkbox" 
                    id="demoMode" 
                    checked={isDemoMode} 
                    onChange={(e) => setIsDemoMode(e.target.checked)} 
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-offset-0 focus:ring-0"
                />
                <label htmlFor="demoMode" className="text-xs text-slate-600 flex items-center cursor-pointer select-none">
                    <Presentation className="w-3 h-3 mr-1" /> Enable Scripted Demo Mode
                </label>
            </div>

          </div>

          {/* Right Column: Resume & Launch */}
          <div className="lg:col-span-5 flex flex-col space-y-8">
            <div className="space-y-4 flex-1">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <FileText className="w-5 h-5 mr-3 text-cyan-400" />
                Resume Context
              </h3>
              
              <div 
                onClick={triggerFileUpload}
                className={`relative group cursor-pointer h-64 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 text-center ${
                  uploadError
                    ? 'border-red-500/50 bg-red-500/5'
                    : fileName 
                    ? 'border-green-500/50 bg-green-500/5' 
                    : 'border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50 bg-slate-950'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload} 
                  accept=".pdf,.txt,.md,.json"
                  className="hidden"
                />
                
                {isProcessingFile ? (
                    <div className="animate-fade-in flex flex-col items-center">
                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
                        <p className="text-cyan-200 text-sm">Parsing Resume...</p>
                    </div>
                ) : fileName ? (
                  <div className="animate-fade-in w-full">
                     {uploadError ? (
                        <div className="flex flex-col items-center">
                            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                            <p className="text-red-400 font-medium mb-1">Upload Error</p>
                            <p className="text-red-300/70 text-xs mb-3">{uploadError}</p>
                            <button 
                              onClick={(e) => { e.stopPropagation(); clearFile(); }}
                              className="px-3 py-1.5 bg-slate-900 rounded-lg text-xs text-slate-300 border border-slate-700"
                            >
                              Try Again
                            </button>
                        </div>
                     ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                            </div>
                            <p className="text-white font-medium mb-1 truncate max-w-[200px] mx-auto">{fileName}</p>
                            <p className="text-green-400 text-sm">Resume Ready</p>
                            <button 
                            onClick={(e) => { e.stopPropagation(); clearFile(); }}
                            className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs text-slate-400 transition-colors border border-slate-800"
                            >
                            Remove File
                            </button>
                        </>
                     )}
                  </div>
                ) : (
                  <div className="group-hover:scale-105 transition-transform duration-300">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 group-hover:bg-slate-700 transition-colors">
                      <UploadCloud className="w-8 h-8 text-cyan-400" />
                    </div>
                    <p className="text-slate-300 font-medium mb-2">Upload Resume</p>
                    <p className="text-slate-500 text-sm mb-4">Supported formats: .pdf, .txt, .md, .json</p>
                    <span className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-xs text-cyan-400 font-medium border border-slate-700 group-hover:border-cyan-500/30 transition-colors">
                      Browse Files
                    </span>
                  </div>
                )}
              </div>
              
              {/* Fallback Text Area */}
              {!fileName && (
                <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Or paste resume text here..."
                    className="w-full h-20 bg-transparent border-b border-slate-800 text-slate-400 text-xs focus:outline-none focus:border-cyan-500 transition-colors resize-none p-2"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={isProcessingFile || !!uploadError}
              className={`w-full font-bold py-5 rounded-2xl transition-all transform hover:scale-[1.02] shadow-xl flex items-center justify-center space-x-3 group ${
                  isBlindMode 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/20 text-white'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/20 text-white'
              } ${(isProcessingFile || !!uploadError) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-lg">{isBlindMode ? 'Start Mystery Session' : (isDemoMode ? 'Start Demo Session' : 'Start Session')}</span>
              <PlayCircle className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Setup;
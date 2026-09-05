
import React, { useState, useRef, useEffect } from 'react';
import { CompanyTrack, InterviewSettings, InterviewType, InterviewerPersonality, SessionMode, SystemDesignTemplate } from '../types';
import { PlayCircle, Briefcase, UploadCloud, FileText, CheckCircle2, Clock, Gauge, Sparkles, UserCog, Swords, Dna, Settings2, Loader2, Presentation, AlertCircle, Code2, AlertTriangle, Network, LayoutTemplate } from 'lucide-react';
import systemDesignTemplates from '../data/system-design-templates.json';
import companyTracksData from '../data/company-tracks.json';
import { formatResumeWithSections } from '../utils/resumeUtils';
import { randomizeBlindSettings } from '../utils/interviewSettings';

const SYSTEM_DESIGN_TEMPLATES = systemDesignTemplates as SystemDesignTemplate[];
const COMPANY_TRACKS = companyTracksData as CompanyTrack[];

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_PAGES = 20;
const MAX_RESUME_CHARACTERS = 100_000;

interface SetupProps {
  onStart: (settings: InterviewSettings) => void;
  initialSettings?: Partial<InterviewSettings> | null;
}

const TECHNICAL_KEYWORDS = [
    'software', 'developer', 'engineer', 'architect', 'programmer', 
    'coder', 'data', 'scientist', 'ai', 'ml', 'frontend', 'backend', 
    'full stack', 'web', 'ios', 'android', 'devops', 'sre', 'tech', 
    'quant', 'embedded', 'firmware', 'security', 'cyber', 'network'
];

const PERSONA_INFO: Record<string, { name: string; title: string; desc: string; badgeColor: string }> = {
  'Neutral Professional': { 
    name: 'Sarah', 
    title: 'Technical Recruiter', 
    desc: 'Structured, standard, objective, and professional. Conducts standard behavioral rubrics.', 
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
  },
  'Very Strict': { 
    name: 'Victor', 
    title: 'Principal Architect', 
    desc: 'Blunt, forensic, highly analytical. Will interrupt, push your logic to its limit, and test your speed under pressure.', 
    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20' 
  },
  'Calm & Polite': { 
    name: 'Clara', 
    title: 'Senior Engineering Manager', 
    desc: 'Patient, warm, highly supportive. Outstanding for reducing anxiety and practicing fluid communication.', 
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
  },
  'Highly Helpful': { 
    name: 'Marcus', 
    title: 'Lead Mentor', 
    desc: 'Collaborative, pedagogical. Offers subtle hints and helps you structure your technical explanations.', 
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
  },
  'Friendly Conversational': { 
    name: 'Penny', 
    title: 'Staff UI Engineer', 
    desc: 'Warm, energetic, peer-to-peer. Keeps the vibe casual, engaging, and collaborative.', 
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
  }
};

const Setup: React.FC<SetupProps> = ({ onStart, initialSettings }) => {
  // Required Fields (Always Visible)
  const [role, setRole] = useState('Software Engineer');
  const [experienceLevel, setExperienceLevel] = useState<InterviewSettings['experienceLevel']>('Mid-Level');
  const [focusArea, setFocusArea] = useState('Core role skills & communication');
  const [resumeText, setResumeText] = useState('');
  
  // Configurable Fields (Hidden in Blind Mode)
  const [duration, setDuration] = useState<number>(15);
  const [difficulty, setDifficulty] = useState<InterviewSettings['difficulty']>('Medium');
  const [interviewType, setInterviewType] = useState<InterviewType>('Actual Interview');
  const [personality, setPersonality] = useState<InterviewerPersonality>('Neutral Professional');
  
  // UI State
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false); // NEW: Demo Mode State
  const [isCodingIntensive, setIsCodingIntensive] = useState(false); // NEW: Coding Intensive Mode
  const [sessionMode, setSessionMode] = useState<SessionMode>('Standard'); // NEW: System Design Whiteboard mode
  const [systemDesignScenarioId, setSystemDesignScenarioId] = useState<string>('url_shortener');
  const [systemDesignCustomPrompt, setSystemDesignCustomPrompt] = useState<string>('');
    const [companyTrackId, setCompanyTrackId] = useState<string>('generic_student');
    const [jobDescription, setJobDescription] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived State for Role Compatibility
  const isLikelyTechnical = React.useMemo(() => {
      const lowerRole = role.toLowerCase();
      return TECHNICAL_KEYWORDS.some(kw => lowerRole.includes(kw));
  }, [role]);

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
        if (initialSettings.companyTrackId) setCompanyTrackId(initialSettings.companyTrackId);
        if (initialSettings.jobDescription) setJobDescription(initialSettings.jobDescription);
        
        // Disable blind mode if coming from a specific "Generate Session" action
        setIsBlindMode(false);
    }
  }, [initialSettings]);

  // Safety Check: If role changes to non-technical, warn user about Coding Mode
  useEffect(() => {
      if (!isLikelyTechnical && isCodingIntensive) {
          // Optional: Auto-disable or just let the warning UI handle it.
          // For better UX, we just let the UI show the warning rather than forcing a state change that might annoy the user.
      }
  }, [role, isLikelyTechnical, isCodingIntensive]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalType = interviewType;
    let finalPersonality = personality;
    let finalDifficulty = difficulty;
    let finalDuration = duration;
    
    // SAFETY OVERRIDE: If role is totally non-technical, force disable coding intensive
    // unless the user specifically wrote something confusing.
    let finalIsCodingIntensive = isCodingIntensive;
    if (!isLikelyTechnical && isCodingIntensive) {
         const confirm = window.confirm(
             `You have selected "Coding Intensive Mode" for the role of "${role}", which appears to be non-technical.\n\nDo you want to proceed with coding questions, or switch to standard verbal questions?`
         );
         if (!confirm) {
             finalIsCodingIntensive = false;
         }
    }

    // BLIND MODE LOGIC: Randomize settings
    if (isBlindMode) {
        const randomized = randomizeBlindSettings();
        finalType = randomized.interviewType;
        finalPersonality = randomized.personality;
        finalDifficulty = randomized.difficulty;
        finalDuration = randomized.duration;
        
    }

    const companyTrack = COMPANY_TRACKS.find(track => track.id === companyTrackId) || COMPANY_TRACKS[0];

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
        isDemoMode, // Pass to types/prompts
        isCodingIntensive: sessionMode === 'System Design' ? false : finalIsCodingIntensive, // Pass to types/prompts
        sessionMode,
        systemDesignScenarioId: sessionMode === 'System Design' ? systemDesignScenarioId : undefined,
        systemDesignPrompt: sessionMode === 'System Design'
            ? (systemDesignScenarioId === 'freeform'
                ? (systemDesignCustomPrompt.trim() || undefined)
                : SYSTEM_DESIGN_TEMPLATES.find(t => t.id === systemDesignScenarioId)?.promptText)
            : undefined,
        companyTrackId,
        companyTrackName: companyTrack?.name,
        jobDescription: jobDescription.trim() || undefined,
    });
  };

  const extractTextFromPdf = async (file: File) => {
    try {
            const [pdfjs, workerModule] = await Promise.all([
                import('pdfjs-dist'),
                import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
            ]);
            pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjs.getDocument({
        data: arrayBuffer,
      });

      const pdf = await loadingTask.promise;
            if (pdf.numPages > MAX_RESUME_PAGES) {
                throw new Error(`Resume PDFs are limited to ${MAX_RESUME_PAGES} pages.`);
            }
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract items with text string, x (transform[4]), and y (transform[5]) coordinates
        const pageItems = textContent.items
            .map((item: any) => {
                const str = item.str || '';
                const transform = item.transform || [0, 0, 0, 0, 0, 0];
                const x = transform[4] || 0;
                const y = transform[5] || 0;
                return { str, x, y };
            })
            .filter((item: any) => item.str.trim().length > 0);
            
        // Group items into lines by Y coordinate with a 4px threshold
        const lines: { y: number; items: typeof pageItems }[] = [];
        for (const item of pageItems) {
            let found = false;
            for (const line of lines) {
                if (Math.abs(line.y - item.y) <= 4) {
                    line.items.push(item);
                    found = true;
                    break;
                }
            }
            if (!found) {
                lines.push({ y: item.y, items: [item] });
            }
        }
        
        // Sort lines by Y coordinate descending (top to bottom)
        lines.sort((a, b) => b.y - a.y);
        
        // Sort items in each line by X coordinate ascending (left to right) and join
        const pageText = lines
            .map(line => {
                const sortedItems = [...line.items].sort((a, b) => a.x - b.x);
                return sortedItems.map(item => item.str).join(' ');
            })
            .join('\n');

                fullText += `--- Page ${i} ---\n${pageText}\n\n`;
                if (fullText.length > MAX_RESUME_CHARACTERS) {
                    throw new Error('The extracted resume text is too large. Please upload a shorter document.');
                }
      }
      
      return fullText;
    } catch (error) {
      console.error("PDF Extraction Failed:", error);
            if (error instanceof Error && (
                error.message.startsWith('Resume PDFs are limited') ||
                error.message.startsWith('The extracted resume text is too large')
            )) {
                throw error;
            }
      throw new Error("Could not parse PDF. It might be an image scan, encrypted, or corrupted.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);

    if (file) {
            const extension = file.name.split('.').pop()?.toLowerCase() || '';
            if (!['pdf', 'txt', 'md', 'json'].includes(extension)) {
                setUploadError('Use a PDF, TXT, Markdown, or JSON resume file.');
                setFileName(null);
                e.target.value = '';
                return;
            }
            if (file.size > MAX_RESUME_BYTES) {
                setUploadError('Resume files are limited to 5 MB.');
                setFileName(null);
                e.target.value = '';
                return;
            }
      setFileName(file.name);
      setIsProcessingFile(true);
      
      try {
                if (file.type === 'application/pdf' || extension === 'pdf') {
            const text = await extractTextFromPdf(file);
            
            // Validation: If extraction yields very little text, it might be a scanned image
            if (text.replace(/[\s\n-]/g, '').length < 50) {
                 const warning = `[WARNING: PDF PARSE YIELDED LOW CONTENT. This file may be a scanned image.]`;
                 setResumeText(warning);
                 setUploadError("This PDF appears to be an image scan (no selectable text). Please use a standard text-based PDF.");
            } else {
                 setResumeText(formatResumeWithSections(text));
            }
        } else {
                        const text = await file.text();
                        if (text.length > MAX_RESUME_CHARACTERS) {
                                throw new Error('Resume text is limited to 100,000 characters.');
                        }
                        setResumeText(formatResumeWithSections(text));
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
        <div className="session-composer legacy-container rise-in">
            <header className="composer-intro">
                <div>
                    <p className="section-kicker">Interview workspace</p>
                    <h1>Compose the room.</h1>
                    <p>
                        Set the role, pressure, context, and format. You will check audio and AI access
                        before the live session begins.
                    </p>
        </div>
                <dl className="composer-facts">
                    <div><dt>Record</dt><dd>Browser local</dd></div>
                    <div><dt>Audio</dt><dd>Preflight tested</dd></div>
                    <div><dt>AI access</dt><dd>Verified before live</dd></div>
                </dl>
            </header>

            <div className="setup-workspace">
        
        {/* MODE TOGGLE - TOP LEVEL */}
        <div className="setup-mode-row">
            <div>
              <p className="section-kicker">Session configuration</p>
              <p>Choose what you know now, or keep the conditions hidden.</p>
            </div>
            <div className="setup-mode-switch" role="group" aria-label="Configuration mode">
                <button
                    type="button"
                    onClick={() => setIsBlindMode(false)}
                    data-active={!isBlindMode}
                    aria-pressed={!isBlindMode}
                >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Compose
                </button>
                
                <button
                    type="button"
                    onClick={() => setIsBlindMode(true)}
                    data-active={isBlindMode}
                    aria-pressed={isBlindMode}
                >
                    <Dna className="w-4 h-4 mr-2" />
                    Blind
                </button>
            </div>
        </div>

        {initialSettings && (
            <div className="focused-session-note">
                <Sparkles className="w-5 h-5 text-cyan-400 mr-3" />
                <div>
                    <p className="text-cyan-200 font-semibold text-sm">Focused Session Configured</p>
                    <p className="text-cyan-400/70 text-xs">Optimized to improve: {initialSettings.focusArea}</p>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="setup-grid">
          
          {/* Left Column: Configuration */}
          <div className="setup-primary space-y-8">
            
            {/* REQUIRED: Role & Experience (Always Visible) */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <Briefcase className="w-5 h-5 mr-3 text-cyan-400" />
                Role & Experience
              </h3>
              
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                                    <label htmlFor="target-position" className="text-sm font-medium text-slate-300 ml-1">Target Position</label>
                  <input
                                        id="target-position"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    maxLength={120}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all placeholder-slate-600"
                    placeholder="e.g. Product Manager, Senior Developer..."
                    required
                  />
                  {!isLikelyTechnical && role.length > 3 && (
                      <p className="text-xs text-amber-500/80 flex items-center ml-1">
                          Note: "{role}" may be non-technical. Some coding features might be disabled.
                      </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p id="experience-level-label" className="text-sm font-medium text-slate-300 ml-1">Experience Level</p>
                  <div role="group" aria-labelledby="experience-level-label" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['Junior', 'Mid-Level', 'Senior', 'Executive'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setExperienceLevel(level as InterviewSettings['experienceLevel'])}
                        aria-pressed={experienceLevel === level}
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
                <div className="blind-configuration animate-fade-in">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                        <Sparkles className="w-6 h-6 mr-3 text-purple-400" /> 
                        Hidden conditions
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
                                        aria-pressed={duration === mins}
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
                                        aria-pressed={difficulty === diff}
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
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setInterviewType(type as InterviewType)}
                                    aria-pressed={interviewType === type}
                                    className={`w-full cursor-pointer p-4 rounded-xl border transition-all flex items-center space-x-3 text-left ${
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
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Interviewer Personality */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-white flex items-center">
                                <UserCog className="w-5 h-5 mr-3 text-cyan-400" />
                                Interviewer Persona Engine
                            </h3>
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">Adaptive</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[
                                'Neutral Professional', 
                                'Very Strict', 
                                'Calm & Polite', 
                                'Highly Helpful', 
                                'Friendly Conversational'
                            ].map((p) => {
                                const info = PERSONA_INFO[p];
                                const isSelected = personality === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPersonality(p as InterviewerPersonality)}
                                        aria-pressed={isSelected}
                                        className={`w-full cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between text-left hover:scale-[1.01] ${
                                            isSelected
                                            ? 'bg-slate-900 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20'
                                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900 hover:border-slate-700'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${info.badgeColor}`}>
                                                    {info.title}
                                                </span>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-cyan-400' : 'border-slate-700'}`}>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                                                </div>
                                            </div>
                                            <h4 className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                                {info.name} <span className="text-xs font-normal text-slate-500">({p})</span>
                                            </h4>
                                            <p className="text-xs text-slate-400 leading-relaxed mt-2 line-clamp-3">
                                                {info.desc}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="focus-areas" className="text-sm font-medium text-slate-300 ml-1">Focus Areas</label>
                <textarea
                id="focus-areas"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                maxLength={2_000}
                className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all placeholder-slate-600 resize-none"
                placeholder="Specific skills? (e.g. System Design, Leadership, React)"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label htmlFor="company-track" className="text-sm font-medium text-slate-300 ml-1">Company / Track</label>
                    <select
                        id="company-track"
                        value={companyTrackId}
                        onChange={(e) => setCompanyTrackId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    >
                        {COMPANY_TRACKS.map(track => (
                            <option key={track.id} value={track.id}>{track.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-500 ml-1">Community-editable interview tracks with realistic round structure.</p>
                </div>
                <div className="space-y-2">
                    <p id="session-format-label" className="text-sm font-medium text-slate-300 ml-1">Session Format</p>
                    <div role="group" aria-labelledby="session-format-label" className="grid grid-cols-1 gap-2">
                        {(['Standard', 'Campus Placement'] as SessionMode[]).map(mode => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setSessionMode(mode)}
                                aria-pressed={sessionMode === mode}
                                className={`px-3 py-3 rounded-xl text-sm font-medium transition-all border text-left ${
                                    sessionMode === mode
                                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300'
                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                                }`}
                            >
                                {mode === 'Campus Placement' ? 'Campus Placement (Aptitude + Technical + HR)' : 'Standard Interview'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="job-description" className="text-sm font-medium text-slate-300 ml-1">Job Description / Drive Notice (Optional)</label>
                <textarea
                    id="job-description"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    maxLength={20_000}
                    className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all placeholder-slate-600 resize-none"
                    placeholder="Paste a real JD, campus drive notice, or role requirements for targeted questions."
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
                    <Presentation className="w-3 h-3 mr-1" /> Enable dynamic demo mode
                </label>
            </div>

          </div>

          {/* Right Column: Resume & Launch */}
          <aside className="setup-secondary flex flex-col space-y-8">
            <div className="space-y-4 flex-1">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <FileText className="w-5 h-5 mr-3 text-cyan-400" />
                Resume Context
              </h3>
              
              <div
                className={`relative group cursor-pointer h-64 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 text-center ${
                  uploadError
                    ? 'border-red-500/50 bg-red-500/5'
                    : fileName 
                    ? 'border-green-500/50 bg-green-500/5' 
                    : 'border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50 bg-slate-950'
                }`}
              >
                <input 
                                    id="resume-file"
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload} 
                  accept=".pdf,.txt,.md,.json"
                  aria-label="Choose resume file"
                  className="hidden"
                />
                
                {isProcessingFile ? (
                    <div className="animate-fade-in flex flex-col items-center">
                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
                        <p className="text-cyan-200 text-sm">Parsing Resume...</p>
                    </div>
                                ) : uploadError ? (
                                        <div className="flex flex-col items-center" role="alert">
                                                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                                                <p className="text-red-400 font-medium mb-1">Upload Error</p>
                                                <p className="text-red-300/70 text-xs mb-3">{uploadError}</p>
                                                <button
                                                    type="button"
                                                    onClick={clearFile}
                                                    className="px-3 py-1.5 bg-slate-900 rounded-lg text-xs text-slate-300 border border-slate-700"
                                                >
                                                    Try Again
                                                </button>
                                        </div>
                                ) : fileName ? (
                  <div className="animate-fade-in w-full">
                                                <>
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                            </div>
                            <p className="text-white font-medium mb-1 truncate max-w-[200px] mx-auto">{fileName}</p>
                            <p className="text-green-400 text-sm">Resume Ready</p>
                            <button 
                            type="button"
                            onClick={clearFile}
                            className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs text-slate-400 transition-colors border border-slate-800"
                            >
                            Remove File
                            </button>
                                                </>
                  </div>
                ) : (
                                    <button type="button" onClick={triggerFileUpload} className="h-full w-full group-hover:scale-105 transition-transform duration-300">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 group-hover:bg-slate-700 transition-colors">
                      <UploadCloud className="w-8 h-8 text-cyan-400" />
                    </div>
                    <p className="text-slate-300 font-medium mb-2">Upload Resume</p>
                    <p className="text-slate-500 text-sm mb-4">Supported formats: .pdf, .txt, .md, .json</p>
                    <span className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-xs text-cyan-400 font-medium border border-slate-700 group-hover:border-cyan-500/30 transition-colors">
                      Browse Files
                    </span>
                                    </button>
                )}
              </div>
              
              {/* Fallback Text Area */}
              {!fileName && (
                                <div>
                                    <label htmlFor="resume-text" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Or paste resume text</label>
                                    <textarea
                                            id="resume-text"
                                            value={resumeText}
                                            onChange={(e) => setResumeText(e.target.value)}
                                            maxLength={MAX_RESUME_CHARACTERS}
                                            placeholder="Paste plain-text resume content here..."
                                            className="w-full h-20 bg-transparent border-b border-slate-800 text-slate-400 text-xs focus:outline-none focus:border-cyan-500 transition-colors resize-none p-2"
                                    />
                                </div>
              )}
            </div>

            {/* NEW: System Design Whiteboard Mode */}
            <div>
                <button
                    type="button"
                    className={`w-full p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                        sessionMode === 'System Design'
                        ? 'bg-cyan-900/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                        : 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                    }`}
                    onClick={() => setSessionMode(sessionMode === 'System Design' ? 'Standard' : 'System Design')}
                    aria-pressed={sessionMode === 'System Design'}
                >
                    <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 transition-colors ${sessionMode === 'System Design' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Network className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`font-bold text-sm ${sessionMode === 'System Design' ? 'text-cyan-400' : 'text-slate-300'}`}>System Design Whiteboard</p>
                            <p className="text-xs text-slate-500">Drag-and-drop architecture canvas, reviewed live by the AI.</p>
                        </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${sessionMode === 'System Design' ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-all duration-300 ${sessionMode === 'System Design' ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                </button>

                {sessionMode === 'System Design' && (
                    <div className="mt-3 space-y-3 animate-fade-in">
                        <div>
                            <label htmlFor="system-design-scenario" className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center mb-2">
                                <LayoutTemplate className="w-3.5 h-3.5 mr-1.5 text-cyan-400" /> Scenario
                            </label>
                            <select
                                id="system-design-scenario"
                                value={systemDesignScenarioId}
                                onChange={e => setSystemDesignScenarioId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-cyan-500 outline-none"
                            >
                                {SYSTEM_DESIGN_TEMPLATES.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.title} {t.id !== 'freeform' ? `(${t.difficulty})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {systemDesignScenarioId === 'freeform' && (
                            <textarea
                                aria-label="Custom system design scenario"
                                value={systemDesignCustomPrompt}
                                onChange={e => setSystemDesignCustomPrompt(e.target.value)}
                                maxLength={4_000}
                                placeholder="Optionally describe the system you want to design (leave blank to let the AI pick)..."
                                className="w-full h-20 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg focus:outline-none focus:border-cyan-500 transition-colors resize-none p-3"
                            />
                        )}
                        <div className="text-xs text-cyan-300/80 bg-cyan-900/10 p-2.5 rounded border border-cyan-500/20 flex items-start">
                            <Sparkles className="w-3 h-3 mr-1.5 mt-0.5 shrink-0" />
                            <span>Talk through your architecture out loud while you draw. The interviewer watches the diagram and probes gaps in real time.</span>
                        </div>
                    </div>
                )}
            </div>

            {/* NEW: Coding Intensive Toggle (Visible in Both Modes) */}
            <div className={sessionMode === 'System Design' ? 'opacity-40 pointer-events-none' : ''}>
                <button
                    type="button"
                    className={`w-full p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-left ${
                        isCodingIntensive 
                        ? (isLikelyTechnical ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-amber-900/20 border-amber-500/50')
                        : 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                    }`}
                    onClick={() => setIsCodingIntensive(!isCodingIntensive)}
                    aria-pressed={isCodingIntensive}
                >
                    <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 transition-colors ${isCodingIntensive ? (isLikelyTechnical ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400') : 'bg-slate-800 text-slate-500'}`}>
                            <Code2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`font-bold text-sm ${isCodingIntensive ? (isLikelyTechnical ? 'text-blue-400' : 'text-amber-400') : 'text-slate-300'}`}>Coding Intensive Mode</p>
                            <p className="text-xs text-slate-500">More frequent & complex coding problems.</p>
                        </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${isCodingIntensive ? (isLikelyTechnical ? 'bg-blue-500' : 'bg-amber-600') : 'bg-slate-700'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-all duration-300 ${isCodingIntensive ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                </button>
                {isCodingIntensive && !isLikelyTechnical && (
                    <div className="mt-2 text-xs text-amber-400 bg-amber-900/20 p-2 rounded border border-amber-500/20 flex items-start">
                        <AlertTriangle className="w-3 h-3 mr-1.5 mt-0.5 shrink-0" />
                        <span>Warning: Your role "{role}" doesn't seem technical. This mode might be inappropriate.</span>
                    </div>
                )}
            </div>

            <button
              type="submit"
              disabled={isProcessingFile || !!uploadError}
              className={`setup-launch-button group ${(isProcessingFile || !!uploadError) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-lg">{isBlindMode ? 'Start Mystery Session' : (isDemoMode ? 'Start Demo Session' : (sessionMode === 'System Design' ? 'Start Design Session' : 'Start Session'))}</span>
              <PlayCircle className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
};

export default Setup;

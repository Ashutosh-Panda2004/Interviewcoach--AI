
import React, { useState, useEffect, useRef } from 'react';
import { CodingProblem, TestResult, CodeSnapshot } from '../types';
import { Play, RotateCcw, CheckCircle, XCircle, Terminal, Clock, ShieldCheck, AlertCircle, CheckCheck, ArrowRight } from 'lucide-react';
import { runJavascriptTests } from '../utils/codeRunner';

interface CodeWorkspaceProps {
  problem: CodingProblem;
  isLastProblem: boolean;
  onCodeRun: (code: string, results: TestResult[]) => void;
  onComplete: () => void;
}

const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ problem, isLastProblem, onCodeRun, onComplete }) => {
  // CRASH FIX: Safe access to initialCode with fallback
  const getInitialCode = (prob: CodingProblem, lang: string) => {
      if (!prob || !prob.initialCode) return '// Write your solution here';
      return prob.initialCode[lang] || prob.initialCode['javascript'] || prob.initialCode['python'] || '// No starter code provided';
  };

    const language = 'javascript';
  const [code, setCode] = useState(getInitialCode(problem, 'javascript'));
  
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<'problem' | 'console'>('problem');
  
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Initialize or Reset when problem changes
  useEffect(() => {
      const newCode = getInitialCode(problem, language);
      setCode(newCode);
      setTestResults(null);
      setConsoleOutput([]);
      setActiveTab('problem'); 
  }, [problem, language]);

    const runTests = async () => {
    setIsRunning(true);
        setConsoleOutput(['> Preparing JavaScript...', '> Running in an isolated browser worker...']);
    setActiveTab('console');
        try {
            const newResults = await runJavascriptTests(code, problem.testCases || []);
            setTestResults(newResults);
            const allPassed = newResults.length > 0 && newResults.every(result => result.passed);
            setConsoleOutput(prev => [
                    ...prev,
                    '> Execution complete.',
                    `> ${newResults.filter(result => result.passed).length}/${newResults.length} tests passed.`,
                    allPassed ? '> SUCCESS: All tests passed.' : '> FAILURE: Some tests failed.',
            ]);
            setSnapshots(prev => [{
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    code,
                    language,
                    passed: allPassed,
            }, ...prev].slice(0, 20));
            onCodeRun(code, newResults);
        } catch (error) {
            setTestResults(null);
            setConsoleOutput(prev => [...prev, `> ERROR: ${error instanceof Error ? error.message : 'Execution failed.'}`]);
        } finally {
            setIsRunning(false);
        }
  };

  const handleSubmit = () => {
      const message = isLastProblem 
        ? "This is the last coding question. Are you sure you want to submit and return to the verbal interview?"
        : "Are you confident in this solution? Proceed to the next question?";
      
      if (window.confirm(message)) {
          onComplete();
      }
  };

  // Safe checks for rendering
  const safeTags = Array.isArray(problem.tags) ? problem.tags : [];
  const safeDifficulty = problem.difficulty || 'Medium';
  const safeTestCases = problem.testCases || [];

  return (
    <div className="code-workspace flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl animate-fade-in">
      
      {/* HEADER TOOLBAR */}
            <div className="min-h-14 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
                <div className="flex min-w-0 items-center space-x-3">
            <div className="flex items-center text-slate-200 font-bold">
                <Terminal className="w-4 h-4 mr-2 text-cyan-400" />
                {problem.title || "Untitled Challenge"}
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex space-x-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${safeDifficulty === 'Easy' ? 'bg-green-500/20 text-green-400' : safeDifficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                    {safeDifficulty}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> {problem.timeLimit || 15}m
                </span>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            <span className="bg-slate-800 text-xs text-slate-300 border border-slate-700 rounded px-2 py-1.5">
                JavaScript
            </span>
            
            <button 
                onClick={runTests}
                disabled={isRunning}
                className="flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded border border-slate-700 transition-colors disabled:opacity-50"
            >
                {isRunning ? <RotateCcw className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1 fill-current" />}
                Run Tests
            </button>

            <button 
                onClick={handleSubmit}
                className="flex items-center px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded shadow-lg shadow-green-900/20 transition-all transform hover:scale-105"
            >
                {isLastProblem ? (
                    <>Submit & Finish <CheckCheck className="w-3 h-3 ml-2" /></>
                ) : (
                    <>Next Problem <ArrowRight className="w-3 h-3 ml-2" /></>
                )}
            </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
    <div className="flex-1 flex flex-col overflow-hidden md:flex-row">
        
        {/* LEFT PANEL: PROBLEM / CONSOLE */}
        <div className="h-[42%] w-full border-b border-slate-800 flex flex-col bg-slate-900/50 md:h-auto md:w-1/3 md:border-b-0 md:border-r">
            <div className="flex border-b border-slate-800">
                <button 
                    onClick={() => setActiveTab('problem')}
                    className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'problem' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Description
                </button>
                <button 
                    onClick={() => setActiveTab('console')}
                    className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'console' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Output {testResults && `(${testResults.filter(t=>t.passed).length}/${testResults.length})`}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'problem' ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-slate-300 leading-relaxed">{problem.description}</p>
                        <div className="mt-4 space-y-2">
                            {safeTags.map(tag => (
                                <span key={tag} className="inline-block px-2 py-1 rounded-full bg-slate-800 text-xs text-slate-400 mr-2">#{tag}</span>
                            ))}
                        </div>
                        <div className="mt-6 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                            <p className="text-xs text-blue-300 flex items-center">
                                <AlertCircle className="w-3 h-3 mr-2" /> 
                                Please plan your approach in comments before coding.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Console Logs */}
                        <div className="font-mono text-xs space-y-1 mb-4">
                            {consoleOutput.map((line, i) => (
                                <div key={i} className={`${line.includes('FAILURE') ? 'text-red-400' : line.includes('SUCCESS') ? 'text-green-400' : 'text-slate-400'}`}>
                                    {line}
                                </div>
                            ))}
                        </div>

                        {/* Test Cases */}
                        {testResults && (
                            <div className="space-y-2">
                                {testResults.map((res, i) => {
                                    // Robust finding of test config
                                    const testConfig = safeTestCases.find(t => t.id === res.testId) || safeTestCases[i];
                                    return (
                                        <div key={res.testId || i} className={`p-3 rounded border ${res.passed ? 'bg-green-900/10 border-green-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center">
                                                    {res.passed ? <CheckCircle className="w-3 h-3 text-green-400 mr-2" /> : <XCircle className="w-3 h-3 text-red-400 mr-2" />}
                                                    <span className={`text-xs font-bold ${res.passed ? 'text-green-400' : 'text-red-400'}`}>
                                                        Test Case {i + 1} {testConfig?.visible ? '' : '(Hidden)'}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-mono">{res.runtimeMs}ms</span>
                                            </div>
                                            {!res.passed && testConfig?.visible && (
                                                <div className="mt-2 p-2 bg-black/30 rounded text-[10px] font-mono text-slate-300">
                                                    <div className="text-slate-500">Input:</div>
                                                    <div className="mb-1">{testConfig.input}</div>
                                                    <div className="text-slate-500">Expected:</div>
                                                    <div className="text-green-400/70 mb-1">{testConfig.expectedOutput}</div>
                                                    <div className="text-slate-500">Actual:</div>
                                                    <div className="text-red-400/70">{res.actualOutput}</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* RIGHT PANEL: EDITOR */}
        <div className="min-h-0 w-full flex-1 flex flex-col bg-slate-950 relative md:w-2/3">
            <div className="flex-1 relative">
                {/* Line numbers and source editor */}
                <div className="absolute inset-0 flex font-mono text-sm">
                    {/* Line Numbers */}
                    <div className="w-12 bg-slate-900 border-r border-slate-800 text-slate-600 text-right py-4 pr-3 select-none">
                        {code.split('\n').map((_, i) => (
                            <div key={i} className="leading-6">{i + 1}</div>
                        ))}
                    </div>
                    
                    {/* Editor Area */}
                    <textarea
                        ref={editorRef}
                        aria-label="JavaScript solution editor"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        spellCheck={false}
                        className="flex-1 bg-slate-950 text-slate-300 p-4 leading-6 outline-none resize-none custom-scrollbar"
                        style={{ fontFamily: '"Fira Code", "JetBrains Mono", monospace' }}
                    />
                </div>

                {/* Execution environment badge */}
                <div className="absolute bottom-4 right-4 flex items-center space-x-2 pointer-events-none opacity-50">
                    <div className="flex items-center px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Isolated browser worker
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default CodeWorkspace;

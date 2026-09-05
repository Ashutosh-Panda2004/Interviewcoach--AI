import { HistoryItem, ComprehensiveAnalysisReport, ImprovementPoint, StrengthPoint, ResumeAnalysis } from '../types';

// A structured text representation that mimics a PDF layout when rendered
const MOCK_RESUME_TEXT = `
JOHN DOE
Software Engineer
San Francisco, CA | john.doe@example.com | linkedin.com/in/johndoe

PROFESSIONAL SUMMARY
Results-oriented Software Engineer with 4 years of experience building scalable web applications. 
Specialized in React, Node.js, and Cloud Infrastructure. Proven track record of improving system performance and mentoring junior developers.

WORK EXPERIENCE

Senior Developer | TechCorp Inc. | 2020 - Present
• Led migration from legacy monolith to microservices architecture using Go and gRPC, resulting in 40% reduction in system latency.
• Designed and implemented a real-time analytics dashboard using React and WebSocket, serving 50k+ daily active users.
• Mentored 3 junior developers, conducting code reviews and weekly technical workshops.
• Optimized database queries in PostgreSQL, reducing average query time by 200ms.

Full Stack Developer | StartupInc | 2017 - 2020
• Built responsive frontend for e-commerce platform using React and Redux.
• Implemented CI/CD pipelines using Jenkins and Docker, reducing deployment time by 60%.
• Integrated Stripe API for payment processing and handled subscription billing logic.
• Collaborated with UX designers to implement pixel-perfect UI components.

SKILLS
• Languages: JavaScript, TypeScript, Go, Python, SQL
• Technologies: React, Node.js, Next.js, GraphQL, gRPC
• Infrastructure: AWS (EC2, S3, RDS), Docker, Kubernetes, Terraform
• Concepts: System Design, Agile/Scrum, TDD, Microservices

EDUCATION
B.S. Computer Science
University of Technology, 2013 - 2017
• Graduated with Honors (3.8 GPA)
• Capstone Project: Distributed File System implementation in C++
`.trim();

export const generateMockHistory = (): HistoryItem[] => {
    const mockHistory: HistoryItem[] = [];
    const now = Date.now();
    const dayMs = 86400000;
    const sessionsCount = 15;
    
    // Simulating a Software Engineer improving over 90 days
    for (let i = 0; i < sessionsCount; i++) {
        const progress = i / (sessionsCount - 1);
        const daysAgo = 90 - (progress * 90);
        const date = new Date(now - (daysAgo * dayMs) + (Math.random() * 10000000)).toISOString();

        let diff: 'Easy' | 'Medium' | 'Hard' = 'Easy';
        if (i > 4) diff = 'Medium';
        if (i > 10) diff = 'Hard';
        if (Math.random() > 0.7) diff = diff === 'Medium' ? 'Hard' : 'Medium';

        // Score Calculation
        const baseScore = 55 + (progress * 35) + (Math.random() * 10 - 5);
        const score = Math.min(98, Math.max(40, Math.round(baseScore)));

        // Dimensional Scores
        const techScore = Math.min(100, Math.max(30, score + (Math.random() * 10 - 5)));
        const commScore = Math.min(100, Math.max(40, 60 + (progress * 25) + (Math.random() * 5)));
        const structScore = Math.min(100, Math.max(40, score - 5 + (Math.random() * 10)));
        const problemScore = Math.min(100, Math.max(30, score - 10 + (progress * 15)));

        const improvements: ImprovementPoint[] = [
            {
                id: `imp-${i}-1`,
                title: "Weak System Design Trade-offs",
                description: "You listed technologies but didn't explain WHY you chose them over alternatives.",
                severity: "High",
                trend: "stagnant",
                dimension: "Technical Depth",
                evidence: "Transcript: 'I used Redis.' (No explanation of why vs Memcached)"
            },
            {
                id: `imp-${i}-2`,
                title: "Vague Action Verbs",
                description: "Answers lack strong ownership language.",
                severity: "Medium",
                trend: "improving",
                dimension: "Behavioral",
                evidence: "Transcript: 'We worked on the migration...'"
            }
        ];

        const strengths: StrengthPoint[] = [
            {
                id: `str-${i}-1`,
                point: "Clear Communication Pacing",
                detail: "Maintained 130 WPM consistently.",
                evidence: ["Detected in session Jan 12", "Detected in session Feb 02"],
                stability: 90
            },
            {
                id: `str-${i}-2`,
                point: "Strong React Knowledge",
                detail: "Explained reconciliation perfectly.",
                evidence: ["Transcript: 'Virtual DOM diffing...'"],
                stability: 85
            }
        ];

        // Indices calculated based on the MOCK_RESUME_TEXT structure
        const resumeAnalysis: ResumeAnalysis = {
            text: MOCK_RESUME_TEXT,
            overallSummary: "You show strong capability in Frontend development (React) and basic Backend tasks. However, your confidence drops significantly when discussing Infrastructure (Kubernetes/AWS) and complex System Design trade-offs. Your resume lists these skills, but your interview answers suggest you need more practice articulating them deeply.",
            highlights: [
                { 
                    id: 'rh-1', 
                    start: MOCK_RESUME_TEXT.indexOf("Led migration"), 
                    end: MOCK_RESUME_TEXT.indexOf("latency.") + 8, 
                    type: 'strength', 
                    reason: "Strong Impact: '40% reduction in latency' is a great quantifiable metric that you explained well.",
                },
                { 
                    id: 'rh-2', 
                    start: MOCK_RESUME_TEXT.indexOf("Optimized database queries"), 
                    end: MOCK_RESUME_TEXT.indexOf("200ms.") + 6, 
                    type: 'strength', 
                    reason: "Good specific technical achievement confirmed in interview.", 
                },
                { 
                    id: 'rh-3', 
                    start: MOCK_RESUME_TEXT.indexOf("Kubernetes"), 
                    end: MOCK_RESUME_TEXT.indexOf("Kubernetes") + 10, 
                    type: 'weakness', 
                    reason: "Low Confidence: You stumbled when asked to explain how you used Kubernetes in production.", 
                    suggestion: "Practice explaining Pods vs Services and your specific role in deployment."
                },
                {
                     id: 'rh-4',
                     start: MOCK_RESUME_TEXT.indexOf("CI/CD pipelines"),
                     end: MOCK_RESUME_TEXT.indexOf("60%.") + 4,
                     type: 'neutral',
                     reason: "Vague: You mentioned Jenkins but couldn't explain the pipeline stages clearly.",
                     suggestion: "Detail the specific build/test/deploy stages you set up."
                }
            ],
            topicConfidence: [
                { topic: "React / Frontend", score: 92, delivery: 95 },
                { topic: "Node.js / Go", score: 85, delivery: 88 },
                { topic: "System Design", score: 65, delivery: 70 },
                { topic: "Kubernetes / Infra", score: 40, delivery: 50 }
            ],
            missingKeywords: ["GraphQL Security", "Load Balancing strategies"]
        };

        const mockReport: ComprehensiveAnalysisReport = {
            meta: {
                candidateName: "Dev User",
                role: "Software Engineer",
                seniority: i < 8 ? "Junior" : "Mid-Level",
                duration_minutes: 15 + (Math.floor(Math.random() * 3) * 5),
                difficulty_initial: diff === 'Easy' ? 1 : diff === 'Medium' ? 3 : 5,
                difficulty_final: diff === 'Easy' ? 1 : diff === 'Medium' ? 3 : 5,
                resume_uploaded: true,
                timestamp: date
            },
            composite: {
                score: score,
                stars: score >= 80 ? 5 : score >= 60 ? 4 : 3,
                confidence: 0.85,
                explanation: "Mock generated score."
            },
            dimensions: {
                communication: { 
                    score: commScore, 
                    confidence: 0.9, 
                    breakdown: {
                        wpm: 130 + (Math.random() * 20 - 10),
                        clarity: commScore,
                        fillerFrequency: 80 + (progress * 10),
                        pacing: commScore - 5
                    } 
                },
                structure: { 
                    score: structScore, 
                    confidence: 0.8, 
                    breakdown: {
                        starMethod: structScore,
                        coherence: structScore + 5,
                        conciseness: structScore - 5
                    } 
                },
                technical: { 
                    score: techScore, 
                    confidence: 0.9, 
                    breakdown: {
                        depth: techScore,
                        accuracy: techScore + 5,
                        terminology: techScore - 5
                    } 
                },
                problemSolving: { 
                    score: problemScore, 
                    confidence: 0.8, 
                    breakdown: {
                        analytical: problemScore,
                        creativity: problemScore - 10
                    } 
                },
                behavioral: { 
                    score: commScore - 10, 
                    confidence: 0.8, 
                    breakdown: {
                        empathy: commScore - 5,
                        teamwork: commScore,
                        ownership: commScore - 15
                    } 
                },
                delivery: { 
                    score: commScore + 5, 
                    confidence: 0.8, 
                    breakdown: {
                        confidence: commScore + 5,
                        tone: commScore
                    } 
                },
                resumeFit: { 
                    score: 70 + (progress * 20), 
                    confidence: 0.8, 
                    breakdown: {
                        consistency: 70 + (progress * 20),
                        impact: 75 + (progress * 15)
                    } 
                }
            },
            strengths: strengths,
            improvements: improvements,
            resumeAnalysis: resumeAnalysis,
            perQuestion: [],
            actionPlan: [],
            summary: "Mock summary."
        };

        const item: HistoryItem = {
            id: crypto.randomUUID(),
            date: date,
            role: "Software Engineer",
            score: score,
            duration: mockReport.meta.duration_minutes,
            feedback: mockReport,
            isMock: true // Flag to identify this as mock data
        };

        mockHistory.push(item);
    }

    return mockHistory;
};
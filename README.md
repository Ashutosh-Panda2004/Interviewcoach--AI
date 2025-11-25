# InterviewCoach AI

A voice-first interview preparation platform powered by Google Gemini's Multimodal Live API. Practice realistic technical and behavioral interviews with an intelligent AI interviewer that adapts to your experience and provides actionable feedback.

## Overview

Stop practicing with generic interview questions. InterviewCoach AI creates realistic interview experiences by speaking naturally with you, understanding your background, and giving you detailed feedback on where you stand. It's like having a senior engineer mock interview you anytime you want.

Built with modern web technologies and powered by Google's latest AI models, this platform brings the real interview experience to your screen with low-latency voice streaming, intelligent conversations, and data-driven insights to track your progress.

## Key Features

**Real-Time Voice Interaction**
- Speak naturally instead of typing responses
- AI handles natural interruptions and turn-taking like a real interviewer
- Four interviewer personalities to choose from: Strict (challenging), Helpful (guiding), Neutral (balanced), or Friendly (casual)
- Real-time audio visualization shows your voice levels as waveforms
- Low-latency streaming via WebSocket ensures smooth conversation flow

**Resume-Based Question Generation**
- Upload your resume as PDF or text file
- AI extracts your actual projects, skills, and experience
- Gets specific questions about your real work experience
- Cross-checks your interview answers against resume claims for authenticity
- No more generic "tell me about yourself" questions

**Integrated Code Editor & Testing**
- Write code directly in the built-in editor (supports JavaScript, Python, and more)
- Run simulated test cases against your solution in real-time
- Get timing and complexity feedback on your code
- Switch seamlessly between voice conversation and coding mode
- Never leave the platform to solve technical problems

**Comprehensive Post-Interview Analytics**
- Composite score (0-100) across seven dimensions:
  - Communication Clarity
  - Technical Depth
  - Problem Structure
  - Time Management
  - Confidence Level
  - Stress Resilience
  - Follow-Through
- Visual radar charts showing your strength profile
- Question-by-question detailed feedback with suggested better answers
- Historical dashboard tracking improvement over multiple sessions
- Pressure resilience index to measure how you handle being put on the spot

**Special Practice Modes**
- Blind Mode: Randomizes difficulty, personality, and interview type for surprise challenges
- Demo Mode: Scripted flow for presentations and platform testing

## Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| Framework | React 19 + TypeScript | Core UI and state management |
| AI Model | Google Gemini 2.5 Flash | Intelligent conversational AI |
| Real-time API | Multimodal Live API | WebSocket-based low-latency audio |
| Audio Processing | Web Audio API + AudioWorklet | Browser-native audio handling |
| Styling | Tailwind CSS | Responsive, modern UI |
| Analytics | Recharts | Interactive data visualization |
| Icons | Lucide React | Clean SVG icons |
| PDF Processing | PDF.js | Client-side resume extraction |

## Getting Started

### Requirements
- Node.js v18 or higher
- Google Gemini API key with Multimodal Live API access

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/InterviewCoach--AI.git
cd InterviewCoach--AI

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the root directory:
```env
API_KEY=your_google_gemini_api_key_here
```

Note: If using Vite, you may need to prefix with `VITE_` and update code references accordingly.

### Run the Application

```bash
npm start
# or for development mode
npm run dev
```

Open your browser and navigate to `http://localhost:3000`

## How to Use

**Step 1: Setup Your Interview**
- Enter your target role (e.g., "Senior React Developer")
- Upload your resume (PDF or text)
- Choose difficulty level (Easy, Medium, Hard)
- Select interviewer personality
- Set interview duration (15, 30, or 45 minutes)
- Optionally enable Blind Mode for random parameters

**Step 2: Start the Interview**
- Allow microphone access when prompted
- Speak naturally—the AI will interrupt and ask follow-up questions
- Answer thoughtfully but don't worry about perfection
- If you get a technical question, click "Open Editor" to write code
- Pause or mute anytime if you need a break

**Step 3: Review Your Feedback**
- Wait for the AI to generate your detailed report
- Check your composite score and dimension breakdown
- Read question-by-question feedback
- Review suggested better answers for tough questions
- Compare against your previous interview sessions on the dashboard

## Project Structure

```
InterviewCoach--AI/
│
├── components/
│   ├── AudioVisualizer.tsx       # Canvas-based waveform visualization
│   ├── CodeWorkspace.tsx         # Code editor with mock test runner
│   ├── Dashboard.tsx             # Analytics and interview history view
│   ├── Feedback.tsx              # Post-interview report generation
│   ├── LiveInterview.tsx         # Core logic (WebSocket, audio, Gemini API)
│   ├── Navbar.tsx                # Navigation component
│   └── Setup.tsx                 # Configuration and role selection screen
│
├── utils/
│   ├── audioUtils.ts             # PCM encoding/decoding and downsampling
│   ├── codingProblems.ts         # Database of mock coding challenges
│   ├── mockData.ts               # Sample data for testing
│   ├── prompts.ts                # AI system instructions and personality prompts
│   └── storage.ts                # LocalStorage wrapper for interview history
│
├── App.tsx                       # Main router and global state manager
├── index.html                    # HTML entry point with Tailwind imports
├── index.tsx                     # React DOM root
├── types.ts                      # Shared TypeScript interfaces and types
└── .env                          # Environment variables (API key)
```

## Troubleshooting

**Disconnects or Network Errors**
- Check your internet connection stability
- App auto-retries up to 8 times before failing
- Restart the interview if connection persists
- Try disabling VPN if you're using one

**Permission Denied (403)**
- Verify your API key is valid in Google Cloud Console
- Ensure "Generative Language API" is enabled for your project
- Check that your API key has access to the Multimodal Live API
- Some API keys are restricted by API type

**Microphone Not Detected**
- Check browser microphone permissions (Settings > Privacy > Microphone)
- Make sure this domain is allowed microphone access
- Try in an incognito window to rule out extension conflicts
- Test microphone in another browser app first

**Slow Response from AI**
- Check your internet bandwidth usage
- You may be hitting API rate limits—wait a moment and retry
- Reduce browser tabs to free up resources
- Check Google Cloud Console for quota information

## License

MIT License - free and open-source. Use, modify, and share freely.

## Contributing

We welcome contributions! Feel free to fork this repository, make improvements, and submit pull requests. Whether it's bug fixes, new features, or documentation improvements, your help is appreciated.

## Support

Encountering issues? Check the troubleshooting section above or open an issue on GitHub. We're here to help!

---

**Start practicing smarter interviews today. Your next interview shouldn't be your first.**
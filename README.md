# InterviewCoach AI

A voice-first interview preparation platform powered by Google Gemini's Multimodal Live API. Practice technical and behavioral interviews with an intelligent AI interviewer that adapts to your experience and provides real-time feedback.

## Overview

InterviewCoach AI solves a real problem: most candidates practice interviews alone or with friends who can't replicate the pressure and dynamic nature of real interviews. This tool uses advanced AI to create a realistic interview experience with a conversational agent that interrupts naturally, adapts to your answers, and can switch between casual discussion and intense technical problem-solving.

The platform focuses on three core areas: voice-based natural conversation, context-aware questioning based on your actual experience, and comprehensive post-interview analytics so you know exactly where to improve.

## Core Features

### Real-Time Voice Interaction

The heart of this platform is a seamless voice conversation powered by Google's Gemini 2.5 Flash model. Instead of typing, you speak naturally to the AI interviewer. The system uses low-latency WebSocket connections and browser-native AudioWorklet processing to stream your audio at 16kHz PCM format.

What makes this different from other tools is the natural turn-taking. The AI doesn't just wait for you to finish speaking—it can interrupt, handle overlapping speech, and create the natural back-and-forth rhythm of a real interview. You can choose from four interviewer personas: Strict (challenging, technical), Helpful (encouraging, guiding), Neutral (professional, balanced), or Friendly (casual, collaborative).

There's also real-time audio visualization so you can see your voice levels and the AI's responses as waveforms and dynamic visual elements.

### Resume-Based Question Generation

Upload your resume as a PDF or text file, and the system analyzes it client-side to extract your experience, skills, and projects. Instead of generic questions, the AI asks about your actual work. If you mention building a microservices architecture in your resume, you'll get deep questions about that specific project.

The AI also cross-checks your interview answers against your resume claims, so there's accountability. If you exaggerate something in an interview, the AI will gently call it out.

### Integrated Code Editor and Technical Challenges

When the interview shifts to technical questions, you're not fumbling between tabs. There's a built-in code workspace supporting JavaScript, Python, and other languages. You write code directly in the editor, and the system runs simulated test cases against your solution with timing information.

This isn't a full sandbox—it's a simplified environment that lets you write and test algorithmic solutions quickly. The AI can review your code, suggest optimizations, and discuss your approach.

### Comprehensive Analytics Dashboard

After each interview, you get a detailed report with:

- A composite score (0-100) based on seven dimensions: Communication Clarity, Technical Depth, Problem Structure, Time Management, Confidence, Stress Resilience, and Follow-Through.
- Visual breakdown of your strengths and weaknesses using radar charts.
- Question-by-question feedback with suggested better answers.
- Historical tracking across multiple sessions so you can see your improvement over time.
- Pressure resilience index—how well you handle being put on the spot.

The dashboard shows trends. You can see if you're getting better at explaining concepts or if you still need work on thinking out loud while coding.

### Special Modes

**Blind Mode** randomizes the difficulty level, interviewer personality, and interview type (behavioral, technical, mixed) so you can test your adaptability and get surprised with different scenarios.

**Demo Mode** uses a scripted flow that's useful for presentations, team demos, or testing the platform without going through a full interview.

## Technical Stack

The platform is built with modern web technologies designed for reliability and performance:

**React 19 with TypeScript** provides a solid foundation for managing complex state and audio streams. **Google Gemini 2.5 Flash** handles the AI logic—it's fast enough for real-time conversation without noticeable lag.

The **Multimodal Live API** is a WebSocket-based connection that streams audio bidirectionally. The **Web Audio API** and **AudioWorklet** handle the heavy lifting on the client side—audio buffering, PCM encoding/decoding, and downsampling happen in your browser.

**Tailwind CSS** keeps the UI responsive and dark-mode-first. **Recharts** renders all the analytics visualizations. **Lucide React** provides clean, modern icons. **PDF.js** extracts text from resume PDFs in the browser, so your resume never leaves your machine.

## Getting Started

### Requirements

You'll need Node.js 18 or higher and a Google Gemini API key with access to the Multimodal Live API. If you're using the free tier, there may be rate limits—check Google's pricing page for details.

### Installation

**1. Clone and install**

```bash
git clone https://github.com/yourusername/interview-coach-ai.git
cd interview-coach-ai
npm install
```

**2. Set up your API key**

Create a `.env` file in the root directory:

```env
API_KEY=your_google_gemini_api_key_here
```

If you're using Vite, you might need to prefix this with `VITE_` and update the import references, or use a bundler replacement plugin.

**3. Start the development server**

```bash
npm start
# or for development mode
npm run dev
```

Open your browser to `http://localhost:3000`.

## How to Use

### Before You Start

Think about what role you're interviewing for. Are you targeting a Senior React Developer position? A Backend Engineer role? A Product Manager spot? The AI tailors the interview to your target role.

Upload your resume. The system reads it locally and uses it to generate relevant questions. You'll be asked about specific projects and technologies you've listed.

Choose your settings: how long do you want the interview to last (15, 30, or 45 minutes)? How challenging should it be (easy, medium, hard)? What personality would you prefer from the interviewer? Then hit start.

### During the Interview

Allow microphone access when prompted. Speak naturally. You don't need to be perfectly polished—the AI wants to hear how you think.

If you're asked a technical question and need to code, click the "Open Editor" button. Write your solution, run it against test cases, and explain your approach. When you're done, you can go back to voice conversation.

You can interrupt the interviewer if you want to clarify something or add more context. You can also pause or mute at any time if you need a break.

### After the Interview

When you're done, the system generates a report. This takes a moment as it analyzes everything you said. You'll see:

- Your overall score
- A breakdown of each dimension
- Specific feedback on each question you answered
- Better sample answers for the questions you struggled with
- Comparison to your previous interviews

All of this is saved to your local dashboard, so you can track improvement over weeks of practice.

## Project Structure

The codebase is organized by responsibility:

**Components** handle the UI—the audio visualizer shows your voice levels in real-time, the code workspace is a mini-IDE, the dashboard displays all your historical data, the setup screen collects your preferences, and the live interview component orchestrates everything.

**Utils** contains helper functions: audio utilities handle PCM encoding and downsampling, mock coding problems are a database of technical challenges, prompts define the AI's system instructions and personality, and storage handles persisting your interview history to local storage.

**Types** define all the TypeScript interfaces used throughout the app.

## Troubleshooting

**Disconnects or Network Errors**

The app uses advanced audio buffering to maintain a stable connection. If you're getting disconnected, check your internet stability. The app attempts to reconnect automatically up to 8 times before giving up.

**Permission Denied (403)**

Make sure your Google Cloud project has the "Generative Language API" enabled. Double-check that you're using an API key that has access to the Multimodal Live API. Some API keys are restricted to specific APIs.

**Microphone Not Working**

Check your browser permissions—the app needs access to `navigator.mediaDevices.getUserMedia`. In Chrome, this is usually in Settings > Privacy and Security > Site Settings > Microphone. Make sure this domain is allowed.

**Slow Response or Lag**

If the AI feels slow to respond, it could be a bandwidth issue or your API key's rate limit. Try closing other tabs that use internet and check your connection speed.

## Development & Contributing

The codebase is designed to be easy to extend. Want to add a new interviewer personality? Update the prompts file. Want to add more coding languages? Extend the code workspace component. Want to add new analytics? Build them in the feedback component.

If you're making changes, make sure to test with both voice and video. Audio streaming can behave differently than regular network requests, so always verify with your microphone connected.

## License

This project is open-source under the MIT License. Use it, modify it, share it.

## What's Next

Future versions are planned to include:

- Integration with actual coding platforms like LeetCode for real-time code validation
- Support for system design interviews with whiteboarding capability
- Group mock interviews where multiple candidates interview together
- AI-powered coaching hints during the interview itself
- Integration with popular video call platforms for seamless recording and sharing

---

**Built with care for candidates who want to interview better.**
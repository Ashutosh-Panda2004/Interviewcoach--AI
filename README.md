# 🎙️ InterviewCoach AI

**A Next-Generation Voice-First Interview Preparation Agent powered by Google Gemini Multimodal Live API.**

InterviewCoach AI transforms the way candidates prepare for technical and behavioral interviews. By leveraging the low-latency capabilities of the Gemini Multimodal Live API, it provides a seamless, real-time voice conversation experience that mimics a real human interviewer, complete with interruptions, turn-taking, and dynamic adaptation.

---

## 🌟 Key Features

### 🧠 Intelligent Voice Interaction
*   **Real-time Conversation:** Uses `AudioWorklet` for low-latency audio streaming (PCM 16kHz) to Google's Gemini 2.5 Flash model.
*   **Natural Turn-Taking:** Handles interruptions and silence naturally.
*   **Personalities:** Configure the interviewer to be "Strict", "Helpful", "Neutral", or "Friendly".
*   **Audio Visualization:** Real-time orb and waveform visualizations powered by the Web Audio API.

### 📄 Context-Aware Resume Parsing
*   **PDF Analysis:** Upload your resume (PDF/Text) directly. The AI parses the text client-side (via `pdfjs-dist`) and tailors questions specifically to your experience.
*   **Deep Dives:** The AI cross-references your answers with your resume claims to check for consistency.

### 💻 Integrated Coding Workspace
*   **Live Coding Challenges:** Seamlessly switches between conversational and technical modes.
*   **Simulated Sandbox:** A built-in code editor (supporting JS, Python, etc.) with a mock execution environment.
*   **Algorithmic Testing:** Runs simulated test cases against your code with time complexity constraints.

### 📊 Comprehensive Post-Interview Analytics
*   **Composite Scoring:** Receive a 0-100 score based on 7 dimensions (Communication, Technical, Structure, etc.).
*   **Radar Charts:** Visual breakdown of your skill profile using `Recharts`.
*   **Heatmaps & Trendlines:** Track your improvement over time via the Dashboard.
*   **Question-by-Question Breakdown:** Detailed feedback on every answer you gave, including "Better Sample Answers".

### 🎮 Gamified Modes
*   **Blind Mode:** Randomizes difficulty, personality, and interview type for a surprise challenge.
*   **Demo Mode:** A scripted flow for presentations and testing.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | React 19 + TypeScript | Core UI and component logic. |
| **AI Model** | Google Gemini 2.5 Flash | Powered by `@google/genai` SDK. |
| **Real-time API** | Multimodal Live API | WebSocket-based low-latency audio streaming. |
| **Audio** | Web Audio API + AudioWorklet | Browser-native audio processing and buffering. |
| **Styling** | Tailwind CSS | Responsive, dark-mode-first design. |
| **Charts** | Recharts | Analytics visualization. |
| **Icons** | Lucide React | Modern SVG iconography. |
| **PDF Processing** | PDF.js | Client-side resume text extraction. |

---

## 🚀 Getting Started

### Prerequisites
*   **Node.js** (v18 or higher)
*   **Google Gemini API Key** (Must have access to the Multimodal Live API)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/Interviewcoach--AI.git
    cd interview-coach-ai
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory and add your API key.
    *Note: The application expects the key to be available via `process.env.API_KEY`.*

    ```env
    API_KEY=your_google_gemini_api_key_here
    ```

    *(If using Vite, you may need to prefix with `VITE_` and update the code references, or use a bundler replacement plugin).*

4.  **Run the Application**
    ```bash
    npm start
    # or
    npm run dev
    ```

5.  **Open in Browser**
    Navigate to `http://localhost:3000` (or the port shown in your terminal).

---

## 📖 Usage Guide

### 1. Setup Phase
*   **Configure Role:** Enter your target role (e.g., "Senior React Developer").
*   **Upload Resume:** Drag and drop your PDF resume. The system will extract the text.
*   **Settings:** Choose difficulty, duration, and interviewer personality.
*   **Blind Mode:** Toggle this for a randomized challenge.

### 2. Live Interview
*   **Microphone Access:** Allow microphone permissions when prompted.
*   **Conversation:** Speak naturally. You can interrupt the AI if needed.
*   **Coding:** If asked a technical question, click "Open Editor" to write code.
*   **Controls:** You can mute the mic or pause the session at any time.

### 3. Feedback & Dashboard
*   **Immediate Report:** Upon ending the call, wait a moment for the AI to generate a detailed report.
*   **Dashboard:** Visit the dashboard to see your historical progress, pressure resilience index, and skill evolution graphs.

---

## 📂 Project Structure

```text
/
├── components/
│   ├── AudioVisualizer.tsx   # Canvas-based audio visualizations
│   ├── CodeWorkspace.tsx     # Mock code editor and test runner
│   ├── Dashboard.tsx         # Analytics and history view
│   ├── Feedback.tsx          # Post-interview report generation
│   ├── LiveInterview.tsx     # Core logic: WebSockets, AudioWorklet, Gemini connection
│   ├── Navbar.tsx            # Navigation
│   └── Setup.tsx             # Configuration screen
├── utils/
│   ├── audioUtils.ts         # PCM encoding/decoding, downsampling
│   ├── codingProblems.ts     # Database of mock coding questions
│   ├── mockData.ts           # Sample data for dashboard testing
│   ├── prompts.ts            # System instructions for the AI persona
│   └── storage.ts            # LocalStorage wrapper for interview history
├── App.tsx                   # Main router and state manager
├── index.html                # Entry point (Import maps & Tailwind)
├── index.tsx                 # React DOM root
└── types.ts                  # TypeScript interfaces
```

---

## ⚠️ Troubleshooting

*   **"Network Error" / Disconnects:**
    *   The app uses advanced audio buffering. If you experience disconnects, ensure your internet connection is stable. The app automatically attempts to reconnect 8 times before failing.
*   **"Permission Denied" (403):**
    *   Ensure your API Key has the "Generative Language API" enabled in Google Cloud Console.
    *   Verify you are using a model that supports the Live API (`gemini-2.5-flash-native-audio-preview`).
*   **Microphone Issues:**
    *   Check browser permissions. The app requires access to `navigator.mediaDevices.getUserMedia`.

---

## 🛡️ License

This project is open-source and available under the MIT License.

---


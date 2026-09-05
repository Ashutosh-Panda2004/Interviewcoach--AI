# InterviewCoach AI

InterviewCoach is a private, open-source interview rehearsal studio built with React, TypeScript, Express, and the Google Gemini Live API. It combines voice interviews, validated feedback, resume-aware sessions, JavaScript coding exercises, and a complete system-design practice arena.

## Features

- Real-time voice interviews with interruption, transcription, pause/resume, and reconnect handling
- Hardware preflight with microphone recording, playback, and signal verification
- Role, seniority, difficulty, duration, company-track, campus, blind, and demo modes
- Local PDF/text resume extraction with file, page, and text-size limits
- Evidence-validated feedback, STAR review, study plans, and personal progress history
- JavaScript challenge runner in a disposable, time-bounded browser Worker
- Advanced system-design canvas with anchored wheel/button zoom, panning, fit/reset view, minimap navigation, snap grid, auto-layout, starter architecture, duplicate, undo/redo, labels, notes, JSON/SVG import-export, persistence, coaching, and scoring
- Optional Practice Arena diagnostic, ranked learning resources, problem recommendations, and growth tracking
- Dedicated landing, Interview, Practice Arena, Progress, and Open Source routes
- Local-first customer data export and deletion

## Privacy And Security

- The deployment Gemini key stays on the Express server and is never embedded in the client bundle.
- Live voice sessions use one-use ephemeral tokens minted by the server.
- Optional bring-your-own-key credentials live in `sessionStorage` for the current browser tab only. They are never written to a database or `localStorage`.
- Interview history, reports, skill profiles, and in-progress sessions remain in the user's browser.
- The server applies CSP and security headers, bounded JSON bodies, request timeouts, and per-IP AI rate limits.
- AI reports are validated before display or persistence. Missing or malformed scores are not fabricated.
- Uploaded resumes are parsed locally and are sent to Gemini only as interview context.

This repository has no authentication or cloud-sync backend. Add authenticated, owner-scoped storage before enabling multi-device persistence.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A Google Gemini API key with Live API access for voice interviews
- A Chromium-based browser for the best audio experience
- HTTPS in production, because browsers require a secure context for microphone access

## Quick Start

```bash
npm ci
```

Copy `.env.example` to `.env`, then set `GEMINI_API_KEY`:

```env
GEMINI_API_KEY=your_google_gemini_api_key
```

Start development mode:

```bash
npm run dev
```

Open `http://localhost:1234`.

A server key is optional if each user supplies a key through AI settings. Without either key, the local Practice Arena remains usable, but live interviews and generated feedback are unavailable; practice coaching and design scoring use transparent local fallbacks.

### Create A Gemini API Key

No Google Cloud CLI is required:

1. Open [Google AI Studio API keys](https://aistudio.google.com/apikey) and sign in.
2. Choose **Create API key** and select a Google Cloud project if prompted.
3. Copy the generated key.
4. In InterviewCoach, choose **Connect AI**, paste the key, and select **Verify and use key**.

The interface makes a small provider request before accepting the key. A user-provided key remains in `sessionStorage` for the current tab and is never added to interview history, `localStorage`, or a database. For a shared deployment, prefer `GEMINI_API_KEY` in the server's secret manager so users do not need their own key.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | empty | Server-managed Google Gemini key |
| `GEMINI_TEXT_MODEL` | `gemini-3.8-flash` | Text generation, feedback, coaching, and problem generation |
| `GEMINI_LIVE_MODEL` | `gemini-3.1-flash-live-preview` | Real-time native-audio interview model |
| `PORT` | `1234` | Express listening port |
| `AI_RATE_LIMIT` | `40` | Text AI requests allowed per IP every 15 minutes |
| `LIVE_RATE_LIMIT` | `12` | Ephemeral live tokens allowed per IP every 15 minutes |
| `VITE_REPOSITORY_URL` | empty | Optional public repository link shown in the interface |

Gemini Live is a preview service. Pin a tested `GEMINI_LIVE_MODEL` in production and monitor Google's deprecation notices.

## Release Checks

Run the complete release gate:

```bash
npm run check
```

The gate performs:

1. TypeScript type checking
2. Core behavior tests
3. Production client/server build
4. Client-bundle credential scan
5. Production-server smoke tests

Individual commands:

```bash
npm run typecheck
npm test
npm run build
npm run check:bundle
npm run test:server
npm run test:ai
npm audit --omit=dev
```

`npm run test:ai` is an opt-in provider certification. With `GEMINI_API_KEY` in `.env`, it verifies the server-side key check, a real text response, and one-use Live-token issuance. It skips without a key and never prints the credential.

## Production

Build and start the Node server:

```bash
npm ci
npm run check
npm start
```

The server exposes:

- `GET /api/health`
- `GET /api/config`
- `POST /api/ai/generate`
- `POST /api/ai/validate`
- `POST /api/live/token`
- SPA deep-link fallback for `/interview`, `/practice`, `/dashboard`, and `/open-source`

Deploy to a Node-capable host with HTTPS. Do not deploy only the `dist` directory to static hosting: secure AI endpoints and ephemeral live tokens require the Express process.

## Docker

```bash
docker build -t interviewcoach-ai .
docker run --rm -p 8080:8080 --env-file .env interviewcoach-ai
```

Open `http://localhost:8080` for local container testing. Put TLS at the platform/load-balancer layer for production.

## Data Lifecycle

- Active interview state is retained for up to 12 hours to support safe reload recovery.
- Active-session recovery is compacted and checkpointed every five seconds instead of rewriting storage every second.
- If local browser quota is unavailable, active recovery falls back to tab-scoped session storage without stopping the interview.
- The microphone is rechecked before a restored interview reconnects.
- Completed interview reports and practice profiles remain in browser storage.
- API keys are tab-scoped and disappear when the browser tab closes.
- Dashboard users can export all interview reports as JSON or erase them.
- System-design canvases can be exported/imported independently as JSON.

## Coding Runner Scope

The built-in runner executes JavaScript functions against JSON-compatible tests in a disposable Worker with a 3-second timeout. It is intended for interview practice, not for running untrusted third-party programs or providing an operating-system sandbox. Python, Java, and C++ execution require an external isolated execution service and are intentionally not advertised.

## Architecture

```text
Browser
  React SPA
  Web Audio + Gemini Live connection (ephemeral token)
  Local resume parsing (PDF.js worker)
  Local interview/practice persistence
  JavaScript Worker runner
        |
        | same-origin HTTPS
        v
Express server
  Security headers and rate limits
  Text generation proxy
  One-use Live token minting
        |
        v
Google Gemini API
```

## Project Structure

```text
components/       React screens and reusable experience components
data/             Company tracks, diagnostics, resources, and design templates
utils/            AI client, validation, recovery, storage, scoring, audio, and canvas utilities
tests/            Core tests and production-server smoke tests
server.ts         Express API and production SPA server
App.tsx           Route and interview lifecycle state
index.css         Tailwind entry and design system
```

## Troubleshooting

**AI is not configured**

Set `GEMINI_API_KEY` on the server or add a session key from AI settings. Confirm `GET /api/config` reports `aiConfigured: true`.

**Live interview cannot connect**

Confirm the key has Live API access, `GEMINI_LIVE_MODEL` is currently available in your region, outbound HTTPS/WSS is allowed, and the page is served through HTTPS.

**Microphone check fails**

Allow microphone permission in site settings, select a working input device, speak during the two-second sample, and retry.

**PDF has no text**

Scanned image PDFs do not contain extractable text. Use a text-based PDF or paste resume text manually. Files are limited to 5 MB and 20 pages.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues should follow [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).

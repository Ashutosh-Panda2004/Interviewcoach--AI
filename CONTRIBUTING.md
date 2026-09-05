# Contributing

Thank you for improving InterviewCoach AI.

## Development

1. Use Node.js 20 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and add a development Gemini key when testing AI flows.
4. Run `npm run dev`.
5. Keep customer data and credentials out of commits, logs, screenshots, and fixtures.

## Before A Pull Request

Run:

```bash
npm run check
npm audit --omit=dev
```

When changing Gemini models, token issuance, or AI endpoints, also set a development key in `.env` and run `npm run test:ai`. The test uses the real provider without printing the key.

For UI changes, verify `/`, `/interview`, `/practice`, `/dashboard`, and `/open-source` at narrow and desktop widths. For voice changes, test permission denial, pause/resume, reconnect, thirty-minute recovery checkpoints, and clean session completion.

## Change Guidelines

- Keep AI keys server-side; browser live connections must use ephemeral tokens.
- Validate model output before displaying or storing it.
- Preserve local-first data behavior unless authenticated owner-scoped storage is introduced.
- Do not describe heuristic data as measured analytics.
- Do not add a language to the coding runner without real execution support.
- Add focused tests for scoring, persistence, routing, and API behavior changes.
- Keep preview model names configurable through environment variables.

## Pull Requests

Explain the user-visible behavior, risks, and validation performed. Keep unrelated refactors separate. Never commit `.env`, production data, resumes, transcripts, API keys, or generated build output.

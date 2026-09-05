# Security Policy

## Supported Version

Security updates target the latest release on the default branch.

## Reporting A Vulnerability

Do not open a public issue for suspected vulnerabilities. Use the repository's private GitHub Security Advisory reporting flow and include:

- Affected version and component
- Reproduction steps or proof of concept
- Expected impact
- Any suggested mitigation

Do not include real API keys, resumes, transcripts, or customer records. Maintainers should acknowledge a complete report within five business days and coordinate disclosure after a fix is available.

## Deployment Responsibilities

- Rotate any key that may have been committed or exposed in client bundles.
- Store `GEMINI_API_KEY` in the hosting platform's secret manager.
- Serve the application through HTTPS.
- Keep rate limits appropriate for the deployment and Gemini quota.
- Monitor Gemini preview-model deprecations and pin a tested live model.
- Do not enable cloud persistence without authentication and owner-scoped authorization rules.
- Review Google Gemini terms, privacy requirements, and regional availability before handling customer data.

## Security Boundaries

The JavaScript runner uses a disposable browser Worker and timeout. It is not an operating-system sandbox and must run only code entered by the current user. The application does not provide account isolation or multi-tenant cloud storage.

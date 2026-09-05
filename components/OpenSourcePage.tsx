import React from 'react';
import {
  ArrowRight,
  Braces,
  Check,
  ExternalLink,
  FileCode2,
  Github,
  HeartHandshake,
  Scale,
  Shield,
  TerminalSquare,
} from 'lucide-react';
import { AppView } from '../types';

interface OpenSourcePageProps {
  onNavigate: (view: AppView) => void;
}

const repositoryUrl = import.meta.env.VITE_REPOSITORY_URL as string | undefined;

const OpenSourcePage: React.FC<OpenSourcePageProps> = ({ onNavigate }) => (
  <div className="open-source-page">
    <header className="open-source-masthead legacy-container">
      <div>
        <p className="section-kicker">Open source, end to end</p>
        <h1>Built to be read.<br />Built to be changed.</h1>
      </div>
      <div className="open-source-intro">
        <p>
          InterviewCoach is an MIT-licensed reference application for private, voice-first
          interview practice. The product boundary is deliberately visible.
        </p>
        <div className="landing-actions">
          {repositoryUrl && (
            <a className="legacy-button legacy-button-primary" href={repositoryUrl} target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" /> View repository <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button className="legacy-button legacy-button-quiet" onClick={() => onNavigate(AppView.INTERVIEW)}>
            Run the product <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>

    <section className="principles-band">
      <div className="legacy-container principle-grid">
        <article>
          <Scale aria-hidden="true" />
          <h2>MIT licensed</h2>
          <p>Use it, study it, adapt it, and contribute improvements back.</p>
        </article>
        <article>
          <Shield aria-hidden="true" />
          <h2>Private by default</h2>
          <p>Browser-local records and ephemeral live credentials keep the boundary legible.</p>
        </article>
        <article>
          <HeartHandshake aria-hidden="true" />
          <h2>No hidden telemetry</h2>
          <p>No analytics SDK, account wall, or anonymous shared database ships with the project.</p>
        </article>
      </div>
    </section>

    <section className="legacy-section legacy-container architecture-section" aria-labelledby="architecture-heading">
      <div className="editorial-heading compact">
        <p className="section-kicker">Architecture</p>
        <h2 id="architecture-heading">A small, inspectable system.</h2>
      </div>
      <div className="architecture-ledger">
        <div>
          <span>Browser</span>
          <Braces aria-hidden="true" />
          <strong>React experience</strong>
          <p>Audio, resume parsing, JavaScript worker, canvas, and local persistence.</p>
        </div>
        <div>
          <span>Server</span>
          <TerminalSquare aria-hidden="true" />
          <strong>Express boundary</strong>
          <p>Security headers, rate limits, model proxy, and one-use Live tokens.</p>
        </div>
        <div>
          <span>Provider</span>
          <FileCode2 aria-hidden="true" />
          <strong>Gemini API</strong>
          <p>Voice conversation and validated structured output through configurable models.</p>
        </div>
      </div>
    </section>

    <section className="source-workflow">
      <div className="legacy-container source-workflow-layout">
        <div>
          <p className="section-kicker">Release discipline</p>
          <h2>One command before every contribution.</h2>
          <p>Type safety, core behavior, production build, bundle scanning, and server smoke tests.</p>
        </div>
        <pre aria-label="Release check command"><code>npm ci{`\n`}npm run check</code></pre>
      </div>
    </section>

    <section className="legacy-section legacy-container contribution-section">
      <div className="editorial-heading compact">
        <p className="section-kicker">Contribution standard</p>
        <h2>Useful changes leave the system more honest.</h2>
      </div>
      <ul className="contribution-list">
        <li><Check aria-hidden="true" /> Keep long-lived model keys on the server.</li>
        <li><Check aria-hidden="true" /> Validate model output before display or storage.</li>
        <li><Check aria-hidden="true" /> Add real execution support before advertising a language.</li>
        <li><Check aria-hidden="true" /> Test narrow and desktop layouts for every workflow.</li>
        <li><Check aria-hidden="true" /> Never commit resumes, transcripts, customer data, or secrets.</li>
      </ul>
    </section>
  </div>
);

export default OpenSourcePage;

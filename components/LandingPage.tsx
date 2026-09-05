import React from 'react';
import {
  ArrowRight,
  Code2,
  Github,
  Mic2,
  Network,
  ShieldCheck,
} from 'lucide-react';
import { AppView } from '../types';
import liveInterviewImage from '../assets/InterviewPage_1.png';
import workspaceImage from '../assets/selection_page_2.png';

interface LandingPageProps {
  onNavigate: (view: AppView) => void;
}

const disciplines = ['Engineering', 'Product', 'Design', 'Sales', 'Finance', 'Operations'];

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => (
  <div className="landing-page">
    <section className="landing-hero" aria-labelledby="landing-title">
      <img
        src={liveInterviewImage}
        alt="InterviewCoach live voice interview workspace"
        className="landing-hero-media"
      />
      <div className="landing-hero-veil" />
      <div className="landing-hero-grid" aria-hidden="true" />

      <div className="landing-hero-content">
        <p className="section-kicker">Open interview rehearsal studio</p>
        <h1 id="landing-title" className="landing-title">InterviewCoach</h1>
        <p className="landing-lede">
          Practise the conversation before it matters. A private, voice-led studio for sharper
          answers, clearer thinking, and evidence-backed review.
        </p>
        <div className="landing-actions">
          <button className="legacy-button legacy-button-primary" onClick={() => onNavigate(AppView.INTERVIEW)}>
            Begin a session <ArrowRight className="h-4 w-4" />
          </button>
          <button className="legacy-button legacy-button-quiet" onClick={() => onNavigate(AppView.PRACTICE_ARENA)}>
            Enter practice arena
          </button>
        </div>
        <div className="landing-trust" aria-label="Product principles">
          <span>Open source</span>
          <span>Local-first history</span>
          <span>Bring your own key</span>
        </div>
      </div>

      <div className="landing-hero-index" aria-hidden="true">
        <span>Est.</span>
        <strong>2026</strong>
      </div>
    </section>

    <section className="discipline-band" aria-label="Supported professions">
      <div className="legacy-container discipline-row">
        <p>Built for the work behind the title</p>
        <div>
          {disciplines.map(discipline => <span key={discipline}>{discipline}</span>)}
        </div>
      </div>
    </section>

    <section className="legacy-section legacy-container" aria-labelledby="studio-heading">
      <div className="editorial-heading">
        <p className="section-kicker">The rehearsal room</p>
        <h2 id="studio-heading">One focused place to speak, build, and review.</h2>
        <p>
          Voice interviews, a real JavaScript runner, and a system-design canvas live in one
          continuous session. Nothing is scored without evidence from your work.
        </p>
      </div>

      <div className="experience-ledger">
        <article>
          <span>01</span>
          <Mic2 aria-hidden="true" />
          <h3>Speak naturally</h3>
          <p>Low-latency voice, interruption support, live transcription, and measured pacing.</p>
        </article>
        <article>
          <span>02</span>
          <Code2 aria-hidden="true" />
          <h3>Work in context</h3>
          <p>Run JavaScript against real tests or reason through architecture on the whiteboard.</p>
        </article>
        <article>
          <span>03</span>
          <ShieldCheck aria-hidden="true" />
          <h3>Keep the record yours</h3>
          <p>Reports and progress stay in your browser, ready to export or erase at any time.</p>
        </article>
      </div>
    </section>

    <section className="product-proof" aria-labelledby="workspace-heading">
      <div className="legacy-container proof-layout">
        <div className="proof-copy">
          <p className="section-kicker">A working instrument</p>
          <h2 id="workspace-heading">Designed for repetition, not spectacle.</h2>
          <p>
            Configure the role, company track, format, difficulty, and interview temperament.
            Resume context is parsed locally; the live model sees only what the session needs.
          </p>
          <button className="text-link" onClick={() => onNavigate(AppView.INTERVIEW)}>
            Compose an interview <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <figure className="proof-figure">
          <img src={workspaceImage} alt="InterviewCoach session configuration workspace" />
          <figcaption>Session composition workspace</figcaption>
        </figure>
      </div>
    </section>

    <section className="open-manifesto" aria-labelledby="open-heading">
      <div className="legacy-container manifesto-layout">
        <Github className="manifesto-mark" aria-hidden="true" />
        <div>
          <p className="section-kicker">Built in public</p>
          <h2 id="open-heading">Inspectable by design.</h2>
          <p>
            The complete experience is MIT licensed: interface, prompts, validation, server
            boundary, practice data, and release checks.
          </p>
        </div>
        <button className="legacy-button legacy-button-quiet" onClick={() => onNavigate(AppView.OPEN_SOURCE)}>
          Explore the project <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>

    <section className="closing-invitation">
      <div className="legacy-container">
        <Network aria-hidden="true" />
        <p className="section-kicker">Your next conversation</p>
        <h2>Walk in having already done the hard part.</h2>
        <button className="legacy-button legacy-button-primary" onClick={() => onNavigate(AppView.INTERVIEW)}>
          Start rehearsing <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  </div>
);

export default LandingPage;

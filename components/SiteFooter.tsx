import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AppView } from '../types';

interface SiteFooterProps {
  onNavigate: (view: AppView) => void;
}

const repositoryUrl = import.meta.env.VITE_REPOSITORY_URL as string | undefined;

const SiteFooter: React.FC<SiteFooterProps> = ({ onNavigate }) => (
  <footer className="site-footer">
    <div className="legacy-container site-footer-grid">
      <div>
        <span className="brand-seal" aria-hidden="true">IC</span>
        <p>Open, private interview rehearsal for serious preparation.</p>
      </div>
      <nav aria-label="Footer navigation">
        <button onClick={() => onNavigate(AppView.INTERVIEW)}>Interview</button>
        <button onClick={() => onNavigate(AppView.PRACTICE_ARENA)}>Practice</button>
        <button onClick={() => onNavigate(AppView.DASHBOARD)}>Progress</button>
        <button onClick={() => onNavigate(AppView.OPEN_SOURCE)}>Open source</button>
        {repositoryUrl && (
          <a href={repositoryUrl} target="_blank" rel="noreferrer">Repository <ArrowUpRight /></a>
        )}
      </nav>
      <div className="site-footer-meta">
        <span>MIT licensed</span>
        <span>Local-first by default</span>
        <span>v1.0.0</span>
      </div>
    </div>
  </footer>
);

export default SiteFooter;

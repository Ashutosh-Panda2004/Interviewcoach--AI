import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/newsreader';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode is intentional, though it may cause double-connects in dev,
  // our LiveInterview component handles cleanup robustly.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
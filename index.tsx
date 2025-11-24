import React from 'react';
import ReactDOM from 'react-dom/client';
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
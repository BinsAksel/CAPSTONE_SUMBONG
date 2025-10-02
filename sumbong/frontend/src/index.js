import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register versioned service worker (build-aware) for controlled caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const buildId = process.env.REACT_APP_BUILD_ID || 'dev';
    const swUrl = `/sw.js?build=${encodeURIComponent(buildId)}`;
    navigator.serviceWorker.register(swUrl).then(reg => {
      // Force activate waiting SW (user gets fresh version immediately)
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version installed, activating...');
            nw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(err => console.warn('Service worker registration failed:', err));

    // Reload tab when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed -> reloading for fresh assets');
      window.location.reload();
    });

    // Optional: listen for activation message
    navigator.serviceWorker.addEventListener('message', (evt) => {
      if (evt.data && evt.data.type === 'SW_ACTIVATED') {
        console.log('[SW] Activated build', evt.data.buildId);
      }
    });
  });
}

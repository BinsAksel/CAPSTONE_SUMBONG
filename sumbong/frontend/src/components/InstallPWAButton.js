import React, { useEffect, useState, useRef } from 'react';
import './InstallPWAButton.css';

// Shows a small install bubble ONLY when the browser fires beforeinstallprompt.
// If the event never fires (unsupported or already installed), nothing is shown.
export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBubble, setShowBubble] = useState(false);
  const [installed, setInstalled] = useState(false);
  const dismissedRef = useRef(false);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }
    const handleBeforeInstallPrompt = (e) => {
      if (dismissedRef.current) return;
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBubble(true);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setShowBubble(false);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (installed || !showBubble || dismissedRef.current || !deferredPrompt) return null;

  const performInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBubble(false);
      }
    } catch (err) {
      // ignore
    }
    setDeferredPrompt(null);
  };

  const dismissCompletely = () => {
    dismissedRef.current = true;
    setShowBubble(false);
  };

  return (
    <div className="pwa-bubble-wrapper" aria-live="polite">
      <button
        className="pwa-bubble"
        onClick={performInstall}
        aria-label="Install Sumbong application"
        type="button"
      >
        <img
          src={process.env.PUBLIC_URL + '/assets/icons/sumbong192.png'}
          alt="Sumbong app icon"
          className="pwa-bubble-icon"
          width={28}
          height={28}
          loading="lazy"
          onError={(e) => {
            // Fallback: show initial if icon path ever fails
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.parentElement?.querySelector('.pwa-bubble-fallback');
            if (fallback) fallback.classList.add('show');
          }}
        />
        <span className="pwa-bubble-fallback" aria-hidden="true">S</span>
    <span className="pwa-bubble-label">Install SUMBONG</span>
        <span
          className="pwa-bubble-close top-right"
          role="button"
          tabIndex={0}
          onClick={(e)=>{ e.stopPropagation(); dismissCompletely(); }}
          onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); e.stopPropagation(); dismissCompletely(); } }}
          aria-label="Dismiss install prompt"
        >×</span>
      </button>
      {/* No fallback instructions: button only appears when real install prompt is available */}
    </div>
  );
}

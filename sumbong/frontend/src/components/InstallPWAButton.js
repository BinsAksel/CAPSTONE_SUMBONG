import React, { useEffect, useState, useRef } from 'react';
import './InstallPWAButton.css';

// Compact top-right bubble style installer
export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBubble, setShowBubble] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const helpTimerRef = useRef(null);

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBubble(true);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setShowBubble(false);
      setShowHelp(false);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If after 6s no event & iOS (no prompt), still show bubble so user sees manual option
    helpTimerRef.current = setTimeout(() => {
      if (!deferredPrompt && !installed) {
        setShowBubble(true);
      }
    }, 6000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (helpTimerRef.current) clearTimeout(helpTimerRef.current);
    };
  }, [deferredPrompt, installed]);

  if (installed || !showBubble) return null;

  const performInstall = async () => {
    if (!deferredPrompt) {
      // iOS / unsupported → toggle help popover
      setShowHelp(h => !h);
      return;
    }
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
    setShowBubble(false);
    setShowHelp(false);
  };

  return (
    <div className="pwa-bubble-wrapper" aria-live="polite">
      <button
        className={`pwa-bubble ${showHelp ? 'help-open' : ''}`}
        onClick={performInstall}
        aria-haspopup={!deferredPrompt ? 'dialog' : undefined}
        aria-expanded={showHelp}
        aria-label={deferredPrompt ? 'Install Sumbong application' : 'How to install Sumbong'}
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
      {showHelp && (
        <div className="pwa-bubble-popover" role="dialog" aria-label="Install instructions">
          {isIOS() ? (
            <ol>
              <li>Tap the <b>Share</b> icon</li>
              <li>Select <b>Add to Home Screen</b></li>
              <li>Tap <b>Add</b></li>
            </ol>
          ) : (
            <p>Open your browser menu and choose <b>Add to Home screen</b>.</p>
          )}
          <div className="pwa-bubble-tip" />
        </div>
      )}
    </div>
  );
}

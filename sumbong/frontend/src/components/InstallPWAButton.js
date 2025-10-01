import React, { useEffect, useState, useRef } from 'react';
import './InstallPWAButton.css';

// Enhanced floating installer with fallback instructions (iOS / unsupported browsers)
export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [platform, setPlatform] = useState('');
  const timeoutRef = useRef(null);

  const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isAndroid = () => /android/i.test(window.navigator.userAgent);

  useEffect(() => {
    setPlatform(isIOS() ? 'iOS' : isAndroid() ? 'Android' : 'Other');
    if (isStandalone()) {
      setAlreadyInstalled(true);
      return; // already installed, don't show anything
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevent the default mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
      setShowFallback(false);
      setShowCard(true);
      console.log('[PWA] beforeinstallprompt fired');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] appinstalled event');
      setShowCard(false);
      setDeferredPrompt(null);
      setAlreadyInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Fallback: if no event within 5s & on iOS or other unsupported, show manual instructions
    timeoutRef.current = setTimeout(() => {
      if (!deferredPrompt && !isStandalone()) {
        if (isIOS()) {
          setShowFallback(true);
          setShowCard(true);
        } else {
          // For Android if it didn't fire, do nothing (Chrome may show menu option)
          // Optionally we could still show fallback, but we keep it clean.
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [deferredPrompt]);

  if (alreadyInstalled) return null;
  if (!showCard) return null;

  const handleInstall = async () => {
    try {
      if (!deferredPrompt) {
        // If no prompt (iOS) just toggle fallback instructions
        setShowFallback(true);
        return;
      }
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log('[PWA] user choice', choice);
      if (choice.outcome === 'accepted') {
        setShowCard(false);
      } else {
        // Keep card so user can try again
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('PWA install failed', err);
    }
  };

  const handleDismiss = () => {
    setShowCard(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="pwa-install-card" role="dialog" aria-label="Install App Prompt">
      <button className="pwa-install-dismiss" onClick={handleDismiss} aria-label="Dismiss install prompt">×</button>
      <div className="pwa-install-header">
        <div className="pwa-install-icon" aria-hidden="true">📱</div>
        <div className="pwa-install-text-group">
          <div className="pwa-install-title">Install Sumbong</div>
          <div className="pwa-install-sub">Quick access on your home screen</div>
        </div>
      </div>
      {showFallback ? (
        <div className="pwa-install-fallback">
          {platform === 'iOS' ? (
            <ol>
              <li>Tap the Share icon (square with ↑)</li>
              <li>Select <b>Add to Home Screen</b></li>
              <li>Confirm by tapping <b>Add</b></li>
            </ol>
          ) : (
            <p>Open the browser menu and choose <b>Add to Home screen</b> to install.</p>
          )}
        </div>
      ) : null}
      <div className="pwa-install-actions">
        {!showFallback && (
          <button className="pwa-install-primary" onClick={handleInstall} aria-label="Install application">
            {deferredPrompt ? 'Install Now' : 'How to Install'}
          </button>
        )}
        {showFallback && (
          <button className="pwa-install-secondary" onClick={() => setShowCard(false)}>Got it</button>
        )}
      </div>
    </div>
  );
}

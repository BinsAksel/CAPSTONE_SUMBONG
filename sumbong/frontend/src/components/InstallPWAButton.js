import React, { useEffect, useState } from 'react';
import './InstallPWAButton.css';

// Captures beforeinstallprompt event and shows a button so user can install app
export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(e) {
      // Prevent automatic mini-infobar on mobile
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If already installed, hide
    window.addEventListener('appinstalled', () => {
      setVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!visible || !deferredPrompt) return null;

  const handleClick = async () => {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome !== 'accepted') {
        // Keep button visible so they can try again
        console.log('PWA install dismissed');
      } else {
        console.log('PWA installed');
        setVisible(false);
      }
      setDeferredPrompt(null);
    } catch (e) {
      console.warn('Install prompt failed', e);
    }
  };

  return (
    <button className="pwa-install-btn" onClick={handleClick} aria-label="Install Sumbong App">
      Install App
    </button>
  );
}

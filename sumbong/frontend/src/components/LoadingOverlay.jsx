import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import './LoadingOverlay.css';

export default function LoadingOverlay({ show, text = 'Loading...', fullscreen = true }) {
  if (!show) return null;
  return (
    <div className={`loading-overlay ${fullscreen ? 'fullscreen' : ''}`} role="status" aria-live="polite">
      <div className="loading-overlay-box">
        <LoadingSpinner size={40} inline={false} text={text} />
      </div>
    </div>
  );
}
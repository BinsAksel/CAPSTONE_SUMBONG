import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import './LoadingOverlay.css';

// Props:
// show: boolean to display
// text: label under spinner
// fullscreen: occupy viewport vs parent bounds
// dim: darker backdrop (for destructive or blocking ops)
// iconSize: override spinner diameter
export default function LoadingOverlay({ show, text = 'Loading...', fullscreen = true, dim = false, iconSize = 48, large = true, minimal = false }) {
  if (!show) return null;
  return (
    <div
      className={`loading-overlay ${fullscreen ? 'fullscreen' : ''} ${dim ? 'dim' : ''} ${minimal ? 'minimal' : ''}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className={`loading-overlay-box ${minimal ? 'minimal' : ''}`}>
        <LoadingSpinner
          size={iconSize}
          inline={false}
          text={minimal ? '' : text}
          showIcon
          className={`${large ? 'big' : ''} ${minimal ? 'minimal' : ''}`.trim()}
        />
      </div>
    </div>
  );
}
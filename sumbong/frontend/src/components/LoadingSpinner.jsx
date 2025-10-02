import React from 'react';
import './LoadingSpinner.css';

// Accessible loading spinner.
// Props:
// - size: diameter in px
// - inline: inline vs stacked layout
// - text: optional label
// - showIcon: allow hiding icon (defaults true so icon always renders unless explicitly disabled)
// - light: use light color scheme (for dark backgrounds)
export default function LoadingSpinner({ size = 32, inline = false, text = 'Loading...', showIcon = true, light = false, className = '' }) {
  const style = { width: size, height: size };
  return (
    <div
      className={`spinner-wrapper ${inline ? 'inline' : 'block'} ${light ? 'light' : ''} ${!showIcon ? 'text-only' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      {showIcon && <div className="spinner" style={style} aria-hidden="true" />}
      {text && (
        <span className="spinner-text" style={{ fontSize: Math.max(12, size * 0.35) }}>
          {text}
        </span>
      )}
    </div>
  );
}

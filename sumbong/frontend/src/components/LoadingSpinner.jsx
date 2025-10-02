import React from 'react';
import './LoadingSpinner.css';

// Accessible loading spinner. Props: size (px), inline (boolean), text (optional)
export default function LoadingSpinner({ size = 32, inline = false, text = 'Loading...', className = '' }) {
  const style = { width: size, height: size };
  return (
    <div className={`spinner-wrapper ${inline ? 'inline' : 'block'} ${className}`.trim()} role="status" aria-live="polite" aria-label={text}>
      <div className="spinner" style={style} />
      {text && <span className="spinner-text" style={{ fontSize: Math.max(12, size * 0.35) }}>{text}</span>}
    </div>
  );
}

import React from 'react';
import LoadingSpinner from './LoadingSpinner';

// Lightweight wrapper to render a small spinner inside a button while preserving layout.
// Props: show (boolean), children (button label)
export default function InlineButtonSpinner({ show, children }) {
  if (!show) return children;
  return (
    <span style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:90 }}>
      <LoadingSpinner size={18} inline showIcon text="" className="inline-btn-spinner" />
      <span style={{ visibility:'hidden' }}>{children}</span>
    </span>
  );
}
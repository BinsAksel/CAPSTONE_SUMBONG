import React from 'react';
import './GoogleButton.css';

/*
  Uses official multi-color Google "G" SVG per brand guidelines.
  Inline SVG prevents raster stretching/compression artifacts and keeps sharp edges on any DPI.
*/
const GoogleIcon = () => (
  <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 11.988v3.818h5.351c-.217 1.238-.964 2.284-2.058 2.982l3.322 2.577c1.94-1.789 3.06-4.423 3.06-7.577 0-.73-.065-1.433-.186-2.1H12z"/>
    <path fill="#34A853" d="M5.93 14.296l-.93.712-2.652 2.07C3.99 20.89 7.71 23.4 12 23.4c3.24 0 5.95-1.07 7.943-2.99l-3.322-2.577c-.89.58-2.03.94-3.621.94-2.79 0-5.156-1.88-6.005-4.414z"/>
    <path fill="#4285F4" d="M2.348 6.922A11.35 11.35 0 0 0 .6 12c0 1.98.48 3.85 1.318 5.488 0 .012 4.012-3.12 4.012-3.12a6.725 6.725 0 0 1-.36-2.13c0-.74.134-1.45.37-2.13z"/>
    <path fill="#FBBC05" d="M12 4.62c1.77 0 3.34.61 4.58 1.81l3.416-3.416C17.94 1.63 15.24.6 12 .6 7.71.6 3.99 3.11 2.348 6.922l4.61 3.188C6.844 7.49 9.21 4.62 12 4.62z"/>
  </svg>
);

const GoogleButton = ({ text = 'Continue with Google', onClick, variant='default' }) => (
  <button className={`google-btn ${variant}`} onClick={onClick} type="button">
    <span className="google-icon-wrapper"><GoogleIcon /></span>
    <span className="google-btn-text">{text}</span>
  </button>
);

export default GoogleButton;

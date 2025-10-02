import React from 'react';
import './GoogleButton.css';

/* Replaced inline SVG with provided raster Google icon (24x24) */
const GoogleIcon = () => (
  <img
    src={process.env.PUBLIC_URL + '/assets/icons/google.png'}
    alt="Google"
    className="google-icon"
    width={24}
    height={24}
    loading="lazy"
    decoding="async"
    draggable="false"
  />
);

const GoogleButton = ({ text = 'Continue with Google', onClick, variant='default' }) => (
  <button
    className={`google-btn ${variant}`}
    onClick={onClick}
    type="button"
    aria-label="Continue with Google – secure OAuth sign-in"
    data-trust="official-google-oauth"
  >
    <span className="google-icon-wrapper"><GoogleIcon /></span>
    <span className="google-btn-text">{text}</span>
  </button>
);

export default GoogleButton;

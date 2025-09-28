import React from 'react';
import './GoogleButton.css';

const GoogleButton = ({ text = 'Continue with Google', onClick }) => (
  <button className="google-btn" onClick={onClick}>
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png"
      alt="Google logo"
      className="google-logo"
    />
    {text}
  </button>
);

export default GoogleButton;

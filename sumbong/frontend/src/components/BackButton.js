import React from 'react';
import { useNavigate } from 'react-router-dom';
import './BackButton.css';

/* BackButton
 * Reusable top-left corner back navigation button.
 * Props:
 *  - to (string): optional path to navigate to (default '/')
 *  - label (string): accessible label text (default 'Back')
 */
const BackButton = ({ to = '/', label = 'Back' }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="back-btn"
      aria-label={label}
      onClick={() => navigate(to)}
    >
      <span className="back-btn-icon" aria-hidden="true">←</span>
      <span className="back-btn-text">{label}</span>
    </button>
  );
};

export default BackButton;

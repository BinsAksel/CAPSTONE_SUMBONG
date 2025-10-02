// Central place to derive the backend API base URL.
// Ensures accidental trailing spaces or slashes in env vars don't break fetch (e.g. producing %20 in URL).
// Usage: import { API_BASE } from '../config/apiBase';

const raw = (process.env.REACT_APP_API_BASE || 'https://capstone-sumbong.onrender.com');

// Sanitize: trim whitespace and strip only trailing slashes (keep protocol //)
export const API_BASE = raw.trim().replace(/\/?$/,'').replace(/\/+$/,'');

// Helper to build full endpoint paths safely without duplicating slashes
export const apiPath = (p = '') => {
  const path = String(p).trim();
  if (!path) return API_BASE;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default API_BASE;

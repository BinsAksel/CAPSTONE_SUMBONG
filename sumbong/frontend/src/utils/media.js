// Generic media utility helpers for images, video, documents
// Low-risk pure functions used by SmartImage component and evidence/credential rendering.

const IMAGE_EXTS = ['jpg','jpeg','png','gif','bmp','webp','jfif','avif'];
const VIDEO_EXTS = ['mp4','avi','mov','wmv','flv','webm','ogg','m4v'];
const DOC_EXTS = ['pdf'];

export function isImageExtension(ext = '') {
  return IMAGE_EXTS.includes(ext.toLowerCase());
}

export function isVideoExtension(ext = '') {
  return VIDEO_EXTS.includes(ext.toLowerCase());
}

export function isDocExtension(ext = '') {
  return DOC_EXTS.includes(ext.toLowerCase());
}

export function getExtensionFromUrl(url = '') {
  try {
    const clean = url.split('?')[0];
    const parts = clean.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  } catch { return ''; }
}

export function buildCacheBust(url) {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}

export function extractInitials(name = '', fallback = 'U') {
  try {
    if (!name) return fallback;
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return fallback;
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  } catch { return fallback; }
}

// Deterministic pastel-ish background color derived from a string
export function colorFromString(str = 'U') {
  try {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  } catch { return '#2563eb'; }
}

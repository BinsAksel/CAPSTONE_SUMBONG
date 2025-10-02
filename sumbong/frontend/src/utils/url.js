// Centralized URL utilities for building absolute media URLs
export const API_BASE = 'https://capstone-sumbong.onrender.com';

// Convert a possibly relative path (e.g. uploads/abc.jpg) into an absolute URL.
// If it's already an absolute http(s) URL (like a Cloudinary secure URL), return as-is.
export function toAbsolute(path) {
  if (!path) return '';
  // Leave local object/data URLs untouched (used for immediate client-side previews)
  if (/^(blob:|data:)/i.test(path)) return path;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return `${API_BASE}/${path.replace(/^\/+/, '')}`; // strip leading slashes then prefix
}

// Optional helper to cache-bust images (e.g., after profile update)
export function withCacheBust(url) {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}

import React, { useEffect, useState, useRef } from 'react';
import { buildCacheBust, getExtensionFromUrl, isImageExtension, isVideoExtension, isDocExtension, extractInitials, colorFromString } from '../utils/media';
import { toAbsolute } from '../utils/url';

// SmartImage: Unified resilient media loader with:
// - Prefetch via Image() for images
// - Single retry with cache-bust
// - Timeout fallback (default 6000ms)
// - Type-specific placeholders (profile/evidence/credential)
// - Supports images & will delegate video/pdf rendering to parent when needed
// Props:
//   src: original (possibly relative) URL
//   type: 'profile' | 'evidence' | 'credential'
//   alt, className, style, onClick
//   showRetryIndicator: bool to show small badge when retried
//   size: optional numeric size for avatar placeholder
export default function SmartImage({
  src,
  type = 'evidence',
  alt = '',
  className = '',
  style = {},
  onClick,
  timeoutMs = 6000,
  showRetryIndicator = true,
  size = 64,
  fallbackLabel,
  userNameForAvatar
}) {
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [loading, setLoading] = useState(!!src);
  const [error, setError] = useState(false);
  const [retried, setRetried] = useState(false);
  const timeoutRef = useRef(null);
  const didUnmount = useRef(false);

  // Normalize to absolute
    useEffect(() => {
      if (!src) { setResolvedSrc(''); return; }
      // Do NOT convert blob: or data: URLs
      if (/^(blob:|data:)/i.test(src)) {
        setResolvedSrc(src);
        return;
      }
      setResolvedSrc(toAbsolute(src));
    }, [src]);

  useEffect(() => {
    if (!resolvedSrc) { setLoading(false); return; }
  // Skip prefetch for blob/data URLs (they are already local)
  if (/^(blob:|data:)/i.test(resolvedSrc)) { setLoading(false); return; }
  const ext = getExtensionFromUrl(resolvedSrc);
  // Only prefetch images; let browser handle others (video/pdf)
  if (!isImageExtension(ext)) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    const img = new Image();
    let finished = false;
    const clear = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
    img.onload = () => {
      if (didUnmount.current) return;
      finished = true;
      clear();
      setLoading(false);
      setError(false);
    };
    img.onerror = () => {
      if (didUnmount.current) return;
      clear();
      if (!retried) {
        // attempt a single cache-busted retry
        setRetried(true);
        const busted = buildCacheBust(resolvedSrc);
        setResolvedSrc(busted);
      } else {
        setLoading(false);
        setError(true);
      }
    };
    timeoutRef.current = setTimeout(() => {
      if (finished || didUnmount.current) return;
      // Treat as error -> trigger retry or fallback
      img.src = ''; // abort
      if (!retried) {
        setRetried(true);
        setResolvedSrc(buildCacheBust(resolvedSrc));
      } else {
        setLoading(false);
        setError(true);
      }
    }, timeoutMs);
    img.src = resolvedSrc;
    return () => { didUnmount.current = true; clear(); };
  }, [resolvedSrc, retried, timeoutMs]);

  // Placeholder / fallback rendering
  const renderFallback = () => {
    if (type === 'profile') {
      const label = fallbackLabel || extractInitials(userNameForAvatar || 'User');
      const bg = colorFromString(userNameForAvatar || 'User');
  // Dynamically scale font size relative to avatar size (approx 50% of diameter)
  // Clamp between 24px and 120px for larger modals
  const dynamicFontSize = Math.round(Math.min(Math.max(size * 0.5, 24), 120));
      return (
        <div
          className={`smartimage-avatar-fallback ${className}`}
          style={{
            width: size,
            height: size,
            lineHeight: `${size}px`,
            fontSize: dynamicFontSize,
            background: bg,
            ...style
          }}
          onClick={onClick}
          aria-label={alt || 'Avatar'}
        >
          {label}
        </div>
      );
    }
    // evidence / credential generic file fallback
    return (
      <div className={`smartimage-file-fallback ${className}`} style={{ width: size, height: size, ...style }} onClick={onClick} aria-label={alt || 'File placeholder'}>
        <span className="smartimage-file-icon">📄</span>
      </div>
    );
  };

  const ext = getExtensionFromUrl(resolvedSrc);
  const isStandardImage = isImageExtension(ext);
  const isBlobImage = resolvedSrc.startsWith('blob:');
  const isImage = isStandardImage || isBlobImage;
  const showRetryBadge = retried && showRetryIndicator && !loading && !error;

  if (!resolvedSrc || error) return renderFallback();
  if (!isImage) {
    // Non-image (e.g., pdf/video) keep previous behavior
    return (
      <div className={`smartimage-wrapper ${className}`} style={style} onClick={onClick}>
        {showRetryBadge && <span className="smartimage-retry-badge" title="Retried">R</span>}
        <img
          src={resolvedSrc}
          alt={alt}
          className={className}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          onError={() => setError(true)}
        />
      </div>
    );
  }
  // Image (including blob preview)
  return (
    <div className={`smartimage-wrapper ${className}`} style={style} onClick={onClick}>
      {loading && isStandardImage && (
        <div className="smartimage-skeleton" aria-label="Loading image" />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        className={className}
        style={{ opacity: loading && isStandardImage ? 0 : 1, transition: isStandardImage ? 'opacity 0.35s ease' : 'none' }}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
        draggable={false}
      />
      {showRetryBadge && <span className="smartimage-retry-badge" title="Retried">R</span>}
    </div>
  );
}

// Basic styles (could alternatively live in a CSS file; inline here for quick integration)
// Recommend moving to a dedicated stylesheet later.
const styleTagId = 'smartimage-styles';
if (typeof document !== 'undefined' && !document.getElementById(styleTagId)) {
  const tag = document.createElement('style');
  tag.id = styleTagId;
  tag.textContent = `
  .smartimage-wrapper { position: relative; display: inline-block; overflow: hidden; background: #f1f5f9; }
  .smartimage-wrapper img { width: 100%; height: 100%; display: block; object-fit: cover; }
  .smartimage-skeleton { position:absolute; top:0; left:0; right:0; bottom:0; background: linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9); animation: smartimage-shimmer 1.2s linear infinite; }
  @keyframes smartimage-shimmer { 0%{background-position:-200px 0}100%{background-position:200px 0} }
  .smartimage-avatar-fallback { display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:clamp(14px,40%,28px); color:#fff; border-radius:50%; user-select:none; }
  .smartimage-file-fallback { display:flex; align-items:center; justify-content:center; background:#eef2f7; border:1px dashed #cbd5e1; color:#64748b; font-size:24px; border-radius:8px; }
  .smartimage-file-icon { filter: grayscale(0.2); }
  .smartimage-retry-badge { position:absolute; top:4px; right:4px; background:#f59e0b; color:#fff; font-size:10px; font-weight:600; padding:2px 4px; border-radius:4px; letter-spacing:.5px; }
  `;
  document.head.appendChild(tag);
}

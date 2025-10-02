# Media Loading & Reliability Strategy

This document explains how images, videos, and credential/evidence media are loaded reliably in the Sumbong application (frontend), including fallbacks, retry behavior, and performance considerations.

## Goals
- Eliminate blank or broken media placeholders on first visit.
- Avoid requiring hard refreshes after deployment or when a service worker update occurs.
- Provide graceful degradation (fallback avatars/placeholders) when a file is missing or slow.
- Support both locally uploaded /relative paths and absolute (Cloudinary) URLs.

## Components & Utilities

### 1. SmartImage Component
Located in `src/components/SmartImage.jsx` (implementation previously added).

Responsibilities:
- Prefetch the image with a timeout (default ~7s) to detect stalled connections.
- Single automatic retry with a cache‑busting query string (`?cb=TIMESTAMP`).
- Detects broken responses (error event or network failure).
- Emits loading skeleton until success or final failure.
- Falls back to:
  - User initials avatar (if `firstName`/`lastName` props provided)
  - Generic placeholder block otherwise.
- Supports `alt`, `className`, and container style passthrough.

### 2. Media Utility Helpers
Located in `src/utils/media.js` (or equivalent):
- `isImageExtension(name)` and `isVideoExtension(name)` for conditional rendering.
- `buildCacheBust(url)` to append a timestamp safely.
- `extractInitials(firstName, lastName)` for fallback avatars.
- `colorFromString(seed)` to derive deterministic background color for avatar circles.

### 3. URL Normalization
`toAbsolute(path)` ensures relative backend file paths become fully qualified using `API_BASE` (e.g. `/uploads/...` → `https://<backend>/uploads/...`). This is applied before attempting to load evidence or credential images.

### 4. Service Worker Strategy
Implemented network‑first for HTML/doc requests with versioned cache keys (e.g. `app-shell-v<N>`). On activation:
- `skipWaiting` + client claim triggers immediate update.
- A short post‑activation message prompts a soft reload (or automatic if coded) so the user doesn’t get a stale shell referencing moved assets.

This ensures new deployments expose latest CSP, media endpoint changes, and static asset revisions without manual hard refresh.

## Evidence & Credential Modals
- Fullscreen modals (`renderEvidenceModal`, credential modal) map over mixed representations (string or object with `url`).
- File type discrimination decides whether to render `<img>`, `<video>`, `<embed>` (PDF), or a generic extension badge.
- Carousel-style navigation (Prev/Next) wraps for multiple attachments.
- Arrows and close button are overlay-level to avoid layout shifts.

## Notifications & Real-Time Updates
Although not media-specific, SSE events may implicitly cause media to appear (e.g. new complaint evidence). The approach:
- SSE updates patch the existing complaint in state without a full refetch when safe.
- If a modal is open for that complaint, the in-memory copy is merged to reflect new feedback entries.
- Scroll preservation logic only autoscrolls when the user is near the bottom or the author is the admin (to reduce disruptive jumps).

## Fallback & Retry Flow (SmartImage)
1. Start prefetch via a new `Image()` instance.
2. If load event fires before timeout → display image.
3. If error or timeout fires:
   - If not yet retried → build cache‑busted URL and retry once.
   - Else → mark as failed and show fallback avatar/placeholder.

Timeout Rationale: Some mobile or poor networks neither error nor complete promptly. A timeout avoids indefinite skeletons.

## Cache Busting
`?cb=<Date.now()>` appended only on retry to avoid defeating CDN/browser caching on first attempt.

## Accessibility Notes
- Always pass meaningful `alt` when content conveys information (e.g. credential type). For decorative evidence, a generic label is acceptable but should be consistent.
- Fallback avatar includes user initials (text) which naturally aids accessibility; ensure contrast via generated background color.

## Performance Considerations
- Avoid multiple simultaneous large media loads inside modals; only the current index is mounted.
- Evidence / credential arrays are filtered & normalized once per modal open.
- No unnecessary refetch loops: SSE merges are surgical; periodic 10s refresh acts as a safety net.

## Error Handling Guidelines
- Silent retries for transient failures (network hiccups) in SmartImage.
- User-facing alerts (SweetAlert2) reserved for credential/evidence mutation failures (approve/reject actions) – not passive media loads.

## Adding New Media Surfaces
When adding another area that loads images:
1. Use `SmartImage` unless there’s a strong reason to stream differently (e.g. very large images requiring progressive loading).
2. Wrap relative paths with `toAbsolute`.
3. Provide `firstName`/`lastName` if a user identity context exists for better fallback.
4. Avoid introducing new direct `<img>` tags with raw URLs unless inside a controlled modal that already handles errors.

## Future Enhancements (Optional)
- LQIP / blurred tiny thumbnail before full image (progressive UX).
- IntersectionObserver to lazy load off-screen images in long lists.
- Add heuristic to backoff when many sequential failures occur (rate limiting network stress).
- Expose SmartImage events (onSuccess/onFail) for analytics of failure rates post-deployment.

---
Last updated: (auto-generated) – refine as architecture evolves.

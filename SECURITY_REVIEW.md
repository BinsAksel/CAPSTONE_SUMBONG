# Security Remediation & Review Preparation

This document summarizes the security hardening steps applied to the project so you can request removal of any browser "Deceptive" / "Dangerous" warnings (e.g. Google Safe Browsing, Microsoft SmartScreen) and demonstrate due diligence.

## 1. Summary of Changes Implemented
| Area | Action | Rationale |
|------|--------|-----------|
| HTTPS Enforcement | Added Strict-Transport-Security (HSTS) with `max-age=31536000; includeSubDomains; preload` | Forces HTTPS, mitigates downgrade / MITM risk |
| Content Security Policy | Strong CSP: `default-src 'self';` limited script, connect, image, media, frame sources; no `unsafe-inline` | Blocks injection, XSS, data exfiltration vectors |
| Frame Protections | `X-Frame-Options: DENY` | Prevent clickjacking |
| MIME Sniffing | `X-Content-Type-Options: nosniff` | Prevent MIME confusion attacks |
| Referrer Policy | `strict-origin-when-cross-origin` | Minimizes leakage of full URLs |
| Permissions Policy | Disabled geolocation, camera, microphone, payment | Reduces attack surface / implicit prompts |
| OAuth UI Hardening | Added accessible aria-label + trust data attribute to Google button | Reduces phishing suspicion, improves accessibility |
| Manifest / PWA | Corrected `start_url: /`, proper icons (192/512 PNG) | Removes irregular install/download behavior (earlier mhtml issue) |
| Inline Scripts | Avoided inline `<script>` and `eval` patterns | Aligns with strict CSP |
| Cloudinary Media | Whitelisted only required media domains | Limits external dependencies |

## 2. Current Header Set
```
/*
Content-Security-Policy: default-src 'self'; script-src 'self' https://accounts.google.com https://apis.google.com; connect-src 'self' https://capstone-sumbong.onrender.com https://accounts.google.com; img-src 'self' data: https: https://res.cloudinary.com; media-src 'self' https: https://res.cloudinary.com; style-src 'self'; font-src 'self' data:; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## 3. Verification Checklist Before Requesting Review
- [ ] Deployed site returns all headers (verify with `curl -I` or browser DevTools)
- [ ] No mixed content warnings in DevTools Console
- [ ] No unexpected external `<script>` domains (only `accounts.google.com`, `apis.google.com`)
- [ ] OAuth redirect flow works (login completes) under CSP without violations
- [ ] Service Worker registered cleanly (Application tab) and not serving outdated cached insecure payloads (perform a hard reload)
- [ ] No inline `style="..."` strings in server-rendered HTML that would require `unsafe-inline` (React style objects are fine)

## 4. Steps to Request Safe Browsing Review (Google)
1. Sign into Google Search Console and verify the domain (DNS TXT or HTML file).
2. Navigate: Security & Manual Actions → Security Issues.
3. If an issue is listed, click "Request Review".
4. Provide a concise explanation template:
   > We identified prior misconfiguration causing abnormal install/download behavior (PWA start_url). We implemented strict security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, nosniff) and removed any potentially unsafe patterns. OAuth uses official Google endpoints only. No malware or deceptive resources are present. Please re‑scan and remove the warning.
5. Submit and monitor (re-evaluation typically within several hours to 1–2 days).

## 5. Microsoft SmartScreen / Other Vendors
If Edge still shows a warning:
- Submit the URL at: https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site
- Provide same remediation summary.

## 6. Optional Further Hardening (Next Iteration)
- Add `frame-ancestors 'none'` to CSP (modern alternative to X-Frame-Options)
- Add `report-to` / `report-uri` endpoint for CSP violation monitoring
- Rotate and pin dependency versions with audit scanning (`npm audit` / `yarn audit`)
- Add Subresource Integrity (SRI) if any external scripts are ever introduced
- Remove remaining inline HTML style attributes by moving to CSS classes

## 7. Rollback / Compatibility Guidance
If after deploy a legitimate resource is blocked:
1. Open DevTools → Console → look for CSP violation messages.
2. Decide whether to whitelist the domain (add to appropriate directive) or serve the asset locally.
3. Redeploy and re-verify.

## 8. Contact / Ownership
Document the maintainer contact for faster review responses:
- Security Contact: <ADD_EMAIL_HERE>

---
Last updated: (update when changes occur)

# Post-Hardening Action Steps (Remove / Prevent Warnings)

Follow this sequence. Updated for Vercel deployment; legacy Netlify notes retained where useful.

## 1. Clean Build & Deploy (Vercel)
- [ ] Commit latest changes (security headers live in `vercel.json`).
- [ ] Push to `main` (Vercel auto deploys production).
- [ ] If a service worker or CSP header changed, optionally bump a trivial comment in `public/manifest.json` to force clients to re-fetch.

### (Legacy Netlify – only if still active)
- [ ] Trigger redeploy: Deploys → Trigger deploy → Clear cache and deploy site.

## 2. Verify Headers Live
PowerShell (replace YOUR_DOMAIN):
```
curl -I https://YOUR_DOMAIN/ | findstr /C:"Content-Security-Policy"
curl -I https://YOUR_DOMAIN/ | findstr /C:"Strict-Transport-Security"
curl -I https://YOUR_DOMAIN/ | findstr /C:"Permissions-Policy"
```
Confirm these exist:
1. Content-Security-Policy (with frame-ancestors 'none')
2. Strict-Transport-Security
3. X-Content-Type-Options: nosniff
4. Referrer-Policy
5. Permissions-Policy
6. (Optional) X-Frame-Options if you add it later (redundant with frame-ancestors)

## 3. Browser Console Audit
- [ ] Open site in Chrome incognito.
- [ ] DevTools → Console: Ensure no CSP violation messages or mixed content warnings.
- [ ] Application tab → Service Workers: Click "Update" then hard reload (Ctrl+Shift+R).

## 4. Safe Browsing Status Check
- [ ] Visit https://transparencyreport.google.com/safe-browsing/search and input the new production domain.
- If safe: still proceed to Search Console (Step 5) for monitoring.
- If flagged: continue through Step 6 review request.

## 5. Google Search Console – Add & Verify (New Deployment)
Choose ONE primary method:
* Domain Property (best, needs DNS for a custom domain)
* URL Prefix (fallback for Vercel default domain)

### 5.1 Domain Property (custom domain recommended)
- [ ] Add domain in Search Console → copy TXT record.
- [ ] Add DNS TXT at your domain registrar.
- [ ] Wait for DNS propagation (often < 5 min, can be longer) → Verify.

### 5.2 URL Prefix (Vercel default domain)
- [ ] Enter full URL (https://sumbong.vercel.app/).
- Pick ONE verification method:
  1. HTML file: download `googleXXXX.html`, place in `frontend/public/`, commit, deploy, visit the file URL, then Verify.
  2. Meta tag: add `<meta name="google-site-verification" content="TOKEN" />` inside `<head>` in `public/index.html` → deploy → Verify.
  3. (Optional) GA / GTM if already configured.

### 5.3 After Verification
- [ ] (Later) Add Domain Property when you attach a custom domain for broader coverage.
- [ ] Enable email notifications in Search Console settings.

## 6. If Flagged – Request Review
- [ ] Open Security & Manual Actions → Security Issues.
- [ ] Open each issue → Request Review with this template:
```
We resolved prior issues: implemented strict CSP (with frame-ancestors 'none'), HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, removed unsafe inline code, corrected manifest (start_url & icons). OAuth restricted to Google domains only. No deceptive or malicious content is hosted. Please re-scan and clear the warning.
```
- [ ] Submit and monitor status.

## 7. Microsoft / Other Engines (Only if still flagged)
- [ ] Submit URL: https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site
- [ ] Provide same remediation summary.

## 8. Monitoring
- [ ] Daily re-check (or calendar reminder) until any warning is gone.
- [ ] Optional: add header monitor (Better Stack, cron + curl) archiving CSP/HSTS.
- [ ] Enable Search Console email alerts.

## 9. After Clearance
- [ ] (Optional) Add CSP report endpoint (`report-to` / `report-uri`).
- [ ] Refactor remaining inline styles → CSS.
- [ ] Run dependency audit: `npm audit --production`.

## 10. Rollback Plan (If Something Breaks)
If users report blocked content:
1. DevTools Console → look for CSP violation lines.
2. Add minimal domain to the correct directive OR self-host the asset.
3. Redeploy (principle of least privilege maintained).


Keep this checklist versioned with each security iteration.

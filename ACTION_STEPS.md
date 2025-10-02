# Post-Hardening Action Steps (Remove "Dangerous" Warning)

Follow this exact sequence. Check each box as you go.

## 1. Clean Build & Deploy
- [ ] Commit latest changes (including `_headers`, accessibility updates, and docs).
- [ ] Trigger a fresh Netlify deploy (UI: Deploys → Trigger deploy → Clear cache and deploy site). Clearing cache ensures the new `_headers` file is respected.

## 2. Verify Headers Live
After deploy finishes, run (replace YOUR_DOMAIN):
PowerShell examples:
```
curl -I https://YOUR_DOMAIN/ | findstr /C:"Content-Security-Policy"
curl -I https://YOUR_DOMAIN/ | findstr /C:"Strict-Transport-Security"
```
Confirm all six headers appear (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).

## 3. Browser Console Audit
- [ ] Open site in Chrome incognito.
- [ ] DevTools → Console: Ensure no CSP violation messages or mixed content warnings.
- [ ] Application tab → Service Workers: Click "Update" then hard reload (Ctrl+Shift+R).

## 4. Safe Browsing Status Check
- [ ] Visit https://transparencyreport.google.com/safe-browsing/search and input your domain.
- If already marked safe, you are done. If flagged:
  - Proceed to step 5.

## 5. Google Search Console Review Request
- [ ] Add & verify property (Domain property preferred) if not present.
- [ ] Open Security & Manual Actions → Security Issues.
- [ ] Click the flagged issue → Request Review.
- [ ] Use this template:
```
We resolved prior configuration issues. Implemented strict security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, nosniff), corrected PWA manifest start_url, and removed any potentially unsafe inline scripts/assets. OAuth uses only official Google domains (accounts.google.com, apis.google.com). No deceptive or malicious content is hosted. Please re-scan and remove the warning.
```
- [ ] Submit.

## 6. Microsoft / Other Engines (Only if still flagged)
- [ ] Submit URL for review: https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site
- [ ] Provide same remediation summary.

## 7. Monitoring
- [ ] Re-test daily (or set a calendar reminder) until warning disappears.
- Optional: Add a lightweight uptime monitor that also stores headers (e.g. Better Stack or Cron job + curl) so you retain proof of continuous protection.

## 8. After Clearance
- [ ] Add `frame-ancestors 'none'` to CSP (optional modernization).
- [ ] Consider CSP reporting endpoint for early detection of future issues.
- [ ] Begin refactoring remaining inline HTML style attributes → CSS classes.

## 9. Rollback Plan (If Something Breaks)
If users report blocked content:
1. Check DevTools Console for CSP messages.
2. Temporarily add the needed domain to the correct directive OR host locally.
3. Redeploy and keep policy principle of least privilege.

---
Keep this checklist versioned with each security iteration.

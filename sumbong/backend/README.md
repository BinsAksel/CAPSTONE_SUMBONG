# Backend Service

## Email Notifications
The system now automatically emails users for these events:

1. Complaint status change (pending → in progress → solved)
2. Admin feedback added to a complaint thread
3. Admin adds feedback while changing status
4. Credential approval
5. Credential rejection (with issue details & required actions)
6. Credential resubmission request (with reason & deadline)
7. Manual user verify / disapprove endpoints (legacy) now use the same templates

All emails are sent using Brevo (Sendinblue) transactional API via `utils/sendEmail.js`.

### Environment Variables
Required:
- `BREVO_API_KEY` – API key for Brevo
- `JWT_SECRET` – JWT signing secret

Optional (legacy / no longer required for notifications):
- `ENABLE_EMAIL_THREAD` – Previously gated feedback/status emails. Emails now always send; this variable is ignored for new logic but harmless if present.

### Templates
Centralized in `utils/emailTemplates.js` for consistent styling and content. Modify there to adjust look & feel.

### Adding New Notifications
1. Create a new builder in `emailTemplates.js` returning `{ subject, html }`.
2. Import the builder in `server.js` (or a future modular route file).
3. Call `sendEmail({ to, subject, html })` after the triggering event.

### Failure Handling
Each email send is wrapped in a `try/catch` and will log a warning (not crash the request) if the transactional email API call fails.

### Security Note
Ensure the `BREVO_API_KEY` is only stored in environment configuration (.env not committed). The system uses a fixed sender identity `systemsumbong@gmail.com`.


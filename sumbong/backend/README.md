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

## Email & Account Lifecycle Additions
The authentication flow now enforces BOTH email verification and admin approval before a user can log in.

### New Environment Variable
- `EMAIL_VERIFY_TOKEN_EXP_MINUTES` (optional, default 30) – Expiration window (minutes) for verification links.

### New User Schema Fields
- `emailVerified` (Boolean)
- `emailVerificationToken` (hashed, transient)
- `emailVerificationExpires` (Date)

### New Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/verify-email` | Body: `{ token }` – Verifies the email using the raw token from the link |
| POST | `/api/auth/resend-verification` | Body: `{ email }` – Resends a verification link if the user exists and is still unverified |

### Flow Summary
1. User signs up (standard or Google complete-profile) → backend creates a verification token and emails link: `https://<frontend>/verify-email?token=RAW_TOKEN`.
2. User clicks link → frontend calls `POST /api/auth/verify-email`.
3. Backend marks `emailVerified = true` and sends a confirmation email.
4. Login is allowed only if BOTH `emailVerified === true` and `approved === true` (admin approval).
5. If email is unverified, login returns 403 with `code: "EMAIL_NOT_VERIFIED"`.
6. If email verified but not approved, login returns 403 with `code: "ACCOUNT_NOT_APPROVED"`.

### Frontend Pages/Changes
- `VerifyEmail.js` – Consumes token or lets user manually paste & resend link.
- `Login.js` – Detects `EMAIL_NOT_VERIFIED` and shows resend + link to `/verify-email`.

### Security Considerations
- Tokens are 32-byte random hex strings, SHA-256 hashed in DB.
- On success, token & expiry are cleared.
- Resend endpoint is indistinguishable (always generic response) to prevent email enumeration.
- Email verification enforced before admin approval check to avoid leaking approval status for unverified emails.

### Suggested Monitoring
Log counts of issued vs. verified tokens (future improvement) to detect deliverability issues.


## Admin Real-Time Notifications (Notification Bell)
Admins receive real-time (SSE) and persisted notifications for key events:

Events captured:
- `new_user` – A user successfully registers (standard or Google signup)
- `new_complaint` – A complaint is submitted
- `user_feedback` – A user (non-admin) adds a feedback thread entry to a complaint

Implementation overview:
1. Lightweight event bus at `events/bus.js` (Node `EventEmitter`).
2. Emissions occur in:
	 - `authController.js` after user creation
	 - Complaint POST route after complaint creation
	 - Feedback-entry route when the author is a normal user
3. Listeners in `server.js` create `Notification` documents for every admin and immediately push them to connected admin SSE streams (`/api/realtime/:userId`).

### Data Model
`models/Notification.js` fields:
```
recipient (ObjectId User)
type (string) e.g. new_user | new_complaint | user_feedback
entityType (string) user | complaint
entityId (ObjectId)
message (string)
meta (mixed) optional contextual data (preview, status, etc.)
read (boolean)
createdAt (Date)
```

### REST Endpoints (Admin Only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/notifications` | List recent notifications (query: `?unread=1` to filter, `?limit=100`) |
| PATCH | `/api/admin/notifications/:id/read` | Mark a single notification as read |
| PATCH | `/api/admin/notifications/read-all` | Mark all notifications for current admin as read |

### Real-Time Delivery
Notifications are also streamed via the existing SSE channel. Payload shape:
```
{ 
	type: 'admin_notification',
	notification: { _id, type, entityType, entityId, message, meta, read, createdAt }
}
```

### Frontend Integration Notes
1. Open SSE connection the same way as for user updates but with the admin's userId.
2. Maintain a local badge count of unread notifications.
3. When the admin opens the notification dropdown, optionally call `PATCH /api/admin/notifications/read-all` to reset badge.
4. Navigate using `entityType` + `entityId` (e.g., complaints detail page) when a notification is clicked.

### Extending
To add more events (e.g., complaint status changes) just:
1. Emit a new event via `bus.emit('event_name', payload)`.
2. Add a `bus.on('event_name', ...)` listener in `server.js` that calls `notifyAdmins` with message and meta.


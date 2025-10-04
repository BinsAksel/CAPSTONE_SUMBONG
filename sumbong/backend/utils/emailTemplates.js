// Centralized email templates for system notifications
// Each builder returns: { subject, html }

function baseWrapper(content) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; background:#f6f8fa; padding:24px; }
    .card { max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:24px; }
    h1,h2,h3 { font-weight:600; color:#1a202c; }
    p { line-height:1.5; font-size:15px; color:#2d3748; }
    .meta { font-size:12px; color:#718096; margin-top:32px; border-top:1px solid #edf2f7; padding-top:12px; }
    blockquote { margin:12px 0; padding:12px 16px; background:#f1f5f9; border-left:4px solid #2b6cb0; font-style:italic; white-space:pre-wrap; }
    .status { display:inline-block; padding:4px 10px; border-radius:16px; font-size:12px; background:#2b6cb0; color:#fff; text-transform:capitalize; }
    .btn { display:inline-block; margin-top:16px; background:#2b6cb0; color:#fff !important; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:600; }
  </style>
  </head><body><div class="card">${content}<div class="meta">This is an automated message from the Sumbong System. Do not reply directly to this email.</div></div></body></html>`;
}

function complaintStatusTemplate({ firstName = 'User', complaintId, oldStatus, newStatus }) {
  const subject = `Complaint Status Updated (${complaintId})`;
  const html = baseWrapper(`
    <h2>Complaint Status Update</h2>
    <p>Hi ${firstName},</p>
    <p>Your complaint <b>${complaintId}</b> status has changed:</p>
    <p><span class="status">${oldStatus}</span> ➜ <span class="status" style="background:#38a169">${newStatus}</span></p>
    <p>Log in to view full details or add further information.</p>
  `);
  return { subject, html };
}

function complaintFeedbackTemplate({ firstName = 'User', complaintId, message }) {
  const subject = `New Admin Feedback (${complaintId})`;
  const safeMsg = (message || '').replace(/</g, '&lt;');
  const html = baseWrapper(`
    <h2>New Feedback Added</h2>
    <p>Hi ${firstName},</p>
    <p>An administrator added a new message to your complaint:</p>
    <blockquote>${safeMsg}</blockquote>
    <p>Please log in to reply or view the full thread.</p>
  `);
  return { subject, html };
}

function credentialApprovedTemplate({ firstName = 'User' }) {
  const subject = 'Your Credentials Are Approved';
  const html = baseWrapper(`
    <h2>Credentials Approved</h2>
    <p>Hi ${firstName},</p>
    <p>Your submitted credentials have been reviewed and <b>approved</b>. You now have full access to the system.</p>
    <p>Thank you for completing the verification process.</p>
  `);
  return { subject, html };
}

function credentialRejectedTemplate({ firstName = 'User', issueDetails, adminNotes, requiredActions }) {
  const subject = 'Issues Found With Your Credentials';
  const html = baseWrapper(`
    <h2>Credential Review Result</h2>
    <p>Hi ${firstName},</p>
    <p>The submitted credentials did not pass verification. Your account will be deleted; you’ll need to register again with valid documents.</p>
    ${issueDetails ? `<p><b>Issue Details:</b><br/>${issueDetails}</p>` : ''}
    ${adminNotes ? `<p><b>Admin Notes:</b><br/>${adminNotes}</p>` : ''}
    ${requiredActions ? `<p><b>Required Actions:</b><br/>${requiredActions}</p>` : ''}
    <p>Please log in to your account to address these items.</p>
  `);
  return { subject, html };
}

function credentialResubmissionTemplate({ firstName = 'User', reason, deadline }) {
  const subject = 'Credential Resubmission Requested';
  const html = baseWrapper(`
    <h2>Resubmission Requested</h2>
    <p>Hi ${firstName},</p>
    <p>We need you to resubmit one or more of your credentials.</p>
    ${reason ? `<p><b>Reason:</b><br/>${reason}</p>` : ''}
    ${deadline ? `<p><b>Deadline:</b> ${new Date(deadline).toLocaleString()}</p>` : ''}
    <p>Please log in and upload the required documents before the deadline.</p>
  `);
  return { subject, html };
}

module.exports = {
  complaintStatusTemplate,
  complaintFeedbackTemplate,
  credentialApprovedTemplate,
  credentialRejectedTemplate,
  credentialResubmissionTemplate,
  // Password & security templates
  passwordResetTemplate: ({ firstName='User', resetUrl, minutes=15 }) => ({
    subject: 'Password Reset Instructions',
    html: baseWrapper(`
      <h2>Password Reset Requested</h2>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. This link is valid for <b>${minutes} minutes</b>.</p>
      <p><a class="btn" href="${resetUrl}" target="_blank" rel="noopener">Reset Password</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `)
  }),
  passwordChangeRequestTemplate: ({ firstName='User', changeUrl, minutes=20 }) => ({
    subject: 'Confirm Your Password Change',
    html: baseWrapper(`
      <h2>Confirm Password Change</h2>
      <p>Hi ${firstName},</p>
      <p>You initiated a password change from your dashboard. To continue, click the button below within <b>${minutes} minutes</b>.</p>
      <p><a class="btn" href="${changeUrl}" target="_blank" rel="noopener">Set New Password</a></p>
      <p>If you did not start this change, ignore this email and your password will remain unchanged.</p>
    `)
  }),
  passwordChangedTemplate: ({ firstName='User', when }) => ({
    subject: 'Your Password Was Changed',
    html: baseWrapper(`
      <h2>Password Changed</h2>
      <p>Hi ${firstName},</p>
      <p>Your password was successfully changed at <b>${when}</b>.</p>
      <p>If this wasn’t you, reset it immediately or contact support.</p>
    `)
  }),
  emailVerificationTemplate: ({ firstName='User', verifyUrl, minutes=30 }) => ({
    subject: 'Verify Your Email Address',
    html: baseWrapper(`
      <h2>Confirm Your Email</h2>
      <p>Hi ${firstName},</p>
      <p>Please verify your email address to activate your account. This link expires in ${minutes} minutes.</p>
      <p><a class="btn" href="${verifyUrl}" target="_blank" rel="noopener">Verify Email</a></p>
      <p>If you didn't create an account, you can ignore this email.</p>
    `)
  }),
  emailVerifiedConfirmationTemplate: ({ firstName='User' }) => ({
    subject: 'Email Verified Successfully',
    html: baseWrapper(`
      <h2>Email Verified</h2>
      <p>Hi ${firstName},</p>
      <p>Your email has been verified successfully. An administrator still needs to approve your credentials before you can log in. You'll receive another email once approval is complete.</p>
    `)
  })
};

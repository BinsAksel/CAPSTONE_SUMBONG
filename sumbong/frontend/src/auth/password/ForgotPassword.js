import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE } from '../../config/apiBase';
import '../Login.css'; // reuse styling
import BackButton from '../../components/BackButton';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      // Response always generic for security; treat any 200 as success
      if (!resp.ok) throw new Error('Request failed');
      setSent(true);
      Swal.fire({
        icon: 'success',
        title: 'Check Your Email',
        text: 'If that email exists, password reset instructions were sent.',
        confirmButtonColor: '#1a365d'
      });
    } catch (e) {
      // Still show generic success to avoid enumeration
      setSent(true);
      Swal.fire({
        icon: 'success',
        title: 'Check Your Email',
        text: 'If that email exists, password reset instructions were sent.',
        confirmButtonColor: '#1a365d'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <BackButton to="/login" />
      <div className="login-form-region" role="presentation">
        <div className="login-form-box" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
          <h2 id="forgot-title">Forgot Password</h2>
          <p style={{ marginTop: 4, fontSize: 14, lineHeight: '20px', color: '#2d3748' }}>
            Enter the email associated with your account and we'll send a link to reset your password.
          </p>
          <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
            <div className="form-group">
              <label htmlFor="fp-email">Email Address</label>
              <input
                type="email"
                id="fp-email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={sent}
              />
            </div>
            <button type="submit" className="signin-button" disabled={loading || sent} style={{ position:'relative', minHeight:48 }}>
              {loading ? 'Sending…' : (sent ? 'Sent' : 'Send Reset Link')}
            </button>
            <div className="signup-prompt" style={{ marginTop: 20 }}>
              Remembered it? <a href="/login">Back to login</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
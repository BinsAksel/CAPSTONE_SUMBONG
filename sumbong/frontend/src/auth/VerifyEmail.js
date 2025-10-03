import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { API_BASE } from '../config/apiBase';
import LoadingSpinner from '../components/LoadingSpinner';
import BackButton from '../components/BackButton';
import './Login.css';

// Simple utility to extract query param
const useQuery = () => {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
};

const VerifyEmail = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const initialToken = query.get('token') || '';
  const [status, setStatus] = useState(initialToken ? 'verifying' : 'idle'); // verifying | success | error | idle
  const [message, setMessage] = useState('');
  const [token, setToken] = useState(initialToken);
  const [resendLoading, setResendLoading] = useState(false);
  const [emailForResend, setEmailForResend] = useState('');
  const [resendSent, setResendSent] = useState(false);

  const performVerification = useCallback(async (rawToken) => {
    if (!rawToken) return;
    try {
      setStatus('verifying');
      const resp = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Verification failed');
      }
      setStatus('success');
      setMessage(data.message || 'Email verified successfully.');
      // Optionally clear stored token
      setTimeout(() => {
        Swal.fire({
          icon: 'success',
          title: 'Email Verified',
            text: 'You can now log in once an admin approves your account (if not already).',
          confirmButtonColor: '#1a365d'
        }).then(() => navigate('/login', { replace: true }));
      }, 600);
    } catch (e) {
      setStatus('error');
      setMessage(e.message || 'Verification failed.');
    }
  }, [navigate]);

  useEffect(() => {
    if (initialToken) {
      performVerification(initialToken);
    }
  }, [initialToken, performVerification]);

  const handleManualVerify = (e) => {
    e.preventDefault();
    if (!token) return;
    performVerification(token.trim());
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!emailForResend || resendLoading) return;
    setResendLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForResend.trim() })
      });
      // Always treat as success per backend design
      await resp.text();
      setResendSent(true);
      Swal.fire({
        icon: 'success',
        title: 'Check Your Email',
        text: 'If the email is unverified, a new verification link was sent.',
        confirmButtonColor: '#1a365d'
      });
    } catch {
      setResendSent(true);
      Swal.fire({
        icon: 'success',
        title: 'Check Your Email',
        text: 'If the email is unverified, a new verification link was sent.',
        confirmButtonColor: '#1a365d'
      });
    } finally {
      setResendLoading(false);
    }
  };

  const renderStatusBlock = () => {
    if (status === 'verifying') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <LoadingSpinner size={36} text="Verifying..." />
          <p style={{ fontSize: 14, color: '#2d3748', textAlign: 'center' }}>Please wait while we confirm your email.</p>
        </div>
      );
    }
    if (status === 'success') {
      return (
        <div className="success-box" style={{ marginTop: 12 }}>
          <p style={{ fontSize: 14, color: '#22543d', fontWeight: 600 }}>{message}</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>Redirecting you to login...</p>
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="error-box" style={{ marginTop: 12 }}>
          <p style={{ fontSize: 14, color: '#742a2a', fontWeight: 600 }}>{message}</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>You can paste the token again below or request a new one.</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="login-layout">
      <BackButton to="/login" />
      <div className="login-form-region">
        <div className="login-form-box" role="dialog" aria-modal="true" aria-labelledby="verify-title">
          <h2 id="verify-title">Verify Your Email</h2>
          <p style={{ marginTop: 4, fontSize: 14, lineHeight: '20px', color: '#2d3748' }}>
            {initialToken ? 'Processing your verification link...' : 'Enter your verification token or request a new link.'}
          </p>
          {renderStatusBlock()}
          {!initialToken && (
            <form onSubmit={handleManualVerify} className="login-form" style={{ marginTop: 12 }}>
              <div className="form-group">
                <label htmlFor="token">Verification Token</label>
                <input
                  id="token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token here"
                  required
                />
              </div>
              <button type="submit" className="signin-button" disabled={!token || status === 'verifying'}>
                Verify Email
              </button>
            </form>
          )}
          <div style={{ marginTop: 28, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>Need Another Link?</h3>
            <p style={{ marginTop: 6, fontSize: 13, color: '#4a5568' }}>Enter your account email and we'll resend a verification link.</p>
            <form onSubmit={handleResend} style={{ marginTop: 8 }}>
              <div className="form-group">
                <label htmlFor="resend-email">Email Address</label>
                <input
                  id="resend-email"
                  type="email"
                  value={emailForResend}
                  onChange={(e) => setEmailForResend(e.target.value)}
                  required
                  disabled={resendSent && !resendLoading}
                />
              </div>
              <button type="submit" className="signin-button" disabled={resendLoading || (resendSent && !resendLoading)} style={{ minHeight: 44 }}>
                {resendLoading ? 'Sending…' : (resendSent ? 'Link Sent' : 'Resend Verification Email')}
              </button>
            </form>
          </div>
          <div className="signup-prompt" style={{ marginTop: 20 }}>
            Back to <Link to="/login">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

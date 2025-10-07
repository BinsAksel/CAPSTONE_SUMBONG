
import React, { useState } from 'react';
import GoogleButton from '../components/GoogleButton';
import axios from 'axios';
import { Link } from 'react-router-dom';
import loginImage from '../assets/login.png';
import Swal from 'sweetalert2';
import './Login.css';
import BackButton from '../components/BackButton';
import { API_BASE } from '../config/apiBase';
import LoadingSpinner from '../components/LoadingSpinner';


const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Google login handler
  const handleGoogleLogin = () => {
  window.location.href = `${API_BASE}/api/auth/google`;
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
  const response = await axios.post(`${API_BASE}/api/auth/login`, formData);
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('justLoggedIn', 'true');
        window.location.href = '/dashboard';
      }
    } catch (error) {
      const code = error.response?.data?.code;
      const msg = error.response?.data?.message || '';
      if (code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(formData.email);
        Swal.fire({
          icon: 'warning',
          title: 'Email Not Verified',
          html: 'Please verify your email. You can request a new link below.',
          confirmButtonColor: '#1a365d'
        });
      } else if (code === 'ACCOUNT_NOT_APPROVED' || msg.toLowerCase().includes('not approved')) {
        Swal.fire({
          icon: 'info',
          title: 'Account Not Approved',
          text: 'Your email is verified, but your account awaits admin approval.',
          confirmButtonColor: '#1a365d'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Login Failed',
          text: msg || 'Incorrect email or password.',
          confirmButtonColor: '#1a365d'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail || resendBusy || resendSent) return;
    setResendBusy(true);
    try {
      await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail.trim() })
      });
      setResendSent(true);
      Swal.fire({
        icon: 'success',
        title: 'Link Sent',
        text: 'If the email is unverified, a new verification link was sent.',
        confirmButtonColor: '#1a365d'
      });
    } catch {
      setResendSent(true);
      Swal.fire({
        icon: 'success',
        title: 'Link Sent',
        text: 'If the email is unverified, a new verification link was sent.',
        confirmButtonColor: '#1a365d'
      });
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="login-layout">{/* Mirror SignIn outer layout */}
      <BackButton to="/" />
      <div className="login-illustration-panel" aria-hidden="true">
        <img src={loginImage} alt="Illustration" />
      </div>
      <div className="login-form-region" role="presentation">
        <div className="login-form-box" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
          <h2 id="login-modal-title">Sign in</h2>
          <GoogleButton text="Continue with Google" onClick={handleGoogleLogin} />
          <form onSubmit={handleSubmit} className="login-form" /* internal scroll on large screens */>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-container" style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  // reserve space for inline icons (badge + eye)
                  style={{ width: '100%', paddingRight: 110, boxSizing: 'border-box' }}
                />
                <div className="password-icons" style={{ position: 'absolute', top: 0, right: 8, height: '100%', display: 'flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
                  {/* badge area left of toggle (no badge rendered here by default) */}
                  <button
                    type="button"
                    className={`password-toggle ${showPassword ? 'show' : ''}`}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ flex: '0 0 auto', position: 'static' }}
                  />
                </div>
              </div>
            </div>
            <button type="submit" className="signin-button" disabled={loading} style={{ position:'relative', minHeight:48 }}>
              {loading ? (
                <>
                  <LoadingSpinner inline size={20} text="" />
                  <span style={{ fontSize:14, fontWeight:600 }}>Signing in…</span>
                </>
              ) : 'Sign in'}
            </button>
            <div className="login-options">
              <div className="remember-me">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="rememberMe">Remember me</label>
              </div>
              <Link to="/forgot-password" className="help-link">Forgot password?</Link>
            </div>
            <div className="signup-prompt">
              Don't have an account? <Link to="/signup">Sign up</Link>
            </div>
            <div className="learn-more">
              <Link to="/landing">Learn more.</Link>
            </div>
            {unverifiedEmail && (
              <div className="verification-hint" style={{ marginTop: 24, background:'#fffaf0', border:'1px solid #fbd38d', padding:12, borderRadius:6 }}>
                <p style={{ margin:0, fontSize:13, color:'#744210', fontWeight:600 }}>Email verification required</p>
                <p style={{ margin:'4px 0 8px', fontSize:12, color:'#975a16' }}>We sent a link to {unverifiedEmail}. Didn't get it?</p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button type="button" className="secondary-btn" disabled={resendBusy || resendSent} onClick={handleResend} style={{ padding:'6px 12px', fontSize:12 }}>
                    {resendBusy ? 'Sending…' : (resendSent ? 'Link Sent' : 'Resend Link')}
                  </button>
                  <Link to="/verify-email" style={{ fontSize:12, color:'#1a365d', fontWeight:600 }}>Enter Token Manually</Link>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login; 
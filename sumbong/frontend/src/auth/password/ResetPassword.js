import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API_BASE } from '../../config/apiBase';
import '../Login.css';
import BackButton from '../../components/BackButton';
import { useLocation, useNavigate } from 'react-router-dom';

// Unified strong password regex (matches SignIn & CompleteProfile patterns)
const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  useEffect(() => {
    // Always clear any existing session so old token can't remain active while resetting
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {/* ignore */}
    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Link',
        text: 'Missing or invalid reset token.',
        confirmButtonColor: '#1a365d'
      }).then(() => navigate('/forgot-password', { replace: true }));
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !token) return;
    if (password !== confirm) {
      return Swal.fire({ icon: 'error', title: 'Mismatch', text: 'Passwords do not match.', confirmButtonColor: '#1a365d' });
    }
    if (!strongPw.test(password)) {
      return Swal.fire({ icon: 'error', title: 'Weak Password', text: 'Need upper, lower, number, special, 8+ chars.', confirmButtonColor: '#1a365d' });
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok || !data.success) throw new Error(data.message || 'Reset failed');
      Swal.fire({
        icon: 'success',
        title: 'Password Updated',
        text: 'You can now log in with your new password.',
        confirmButtonColor: '#1a365d'
      }).then(() => navigate('/login', { replace: true }));
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Reset Failed', text: e.message || 'Invalid or expired token.', confirmButtonColor: '#1a365d' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <BackButton to="/login" />
      <div className="login-form-region" role="presentation">
        <div className="login-form-box" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <h2 id="reset-title">Reset Password</h2>
          <p style={{ marginTop:4, fontSize:14, lineHeight:'20px', color:'#2d3748' }}>
            Choose a new strong password. After resetting you'll be redirected to login.
          </p>
          <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <div className="password-input-container">
                <input
                  type={showPw ? 'text' : 'password'}
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className={`password-toggle ${showPw ? 'show' : ''}`} onClick={() => setShowPw(p=>!p)} aria-label={showPw ? 'Hide password' : 'Show password'} />
              </div>
              <small style={{ display:'block', marginTop:4, fontSize:12, color:'#4a5568' }}>Must include upper, lower, number, special, 8+ chars.</small>
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showPw2 ? 'text' : 'password'}
                  id="confirm-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className={`password-toggle ${showPw2 ? 'show' : ''}`} onClick={() => setShowPw2(p=>!p)} aria-label={showPw2 ? 'Hide password' : 'Show password'} />
              </div>
            </div>
            <button type="submit" className="signin-button" disabled={loading || !token} style={{ position:'relative', minHeight:48 }}>
              {loading ? 'Updating…' : 'Reset Password'}
            </button>
            <div className="signup-prompt" style={{ marginTop:20 }}>
              Back to <a href="/login">Login</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import loginImage from '../assets/login.png';
import '../auth/Login.css'; // reuse same styling as user login

const API_BASE = process.env.REACT_APP_API_BASE || 'https://capstone-sumbong.onrender.com';

const Admin = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const attemptLogin = async (url) => {
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password })
      });
    } catch (netErr) {
      throw new Error(`Network error: ${netErr.message}`);
    }
    const text = await resp.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch {/* ignore */} }
    if (!data) {
      if (!resp.ok) throw new Error(`Unexpected ${resp.status} from server.`);
      throw new Error('Invalid server response');
    }
    if (!resp.ok || !data.success) {
      throw new Error(data.message || 'Admin login failed');
    }
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const base = API_BASE.replace(/\/$/, '');
    const primary = `${base}/api/auth/admin/login`;
    try {
      let data;
      try {
        data = await attemptLogin(primary);
      } catch (err) {
        // Fallback path variant if API route differs
        if (/404/.test(err.message)) {
          const fallback = primary.replace('/api/auth/', '/auth/');
          if (fallback !== primary) data = await attemptLogin(fallback); else throw err;
        } else throw err;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('adminUser', JSON.stringify(data.user));
      Swal.fire({
        icon: 'success',
        title: 'Welcome Admin!',
        toast: true,
        position: 'top-end',
        timer: 1400,
        showConfirmButton: false,
        customClass: { popup: 'notif-toast' }
      });
      navigate('/admin-dashboard');
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: err.message || 'Unable to login as admin.',
        confirmButtonColor: '#1a365d'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout admin-login">
      <div className="login-illustration-panel" aria-hidden="true">
        <img src={loginImage} alt="Illustration" />
      </div>
      <div className="login-form-region" role="presentation">
        <div className="login-form-box" role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
          <h2 id="admin-login-title">Admin Sign in</h2>
          <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
            <div className="form-group">
              <label htmlFor="admin-email">Admin Email</label>
              <input
                type="email"
                id="admin-email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="admin-password">Password</label>
              <input
                type="password"
                id="admin-password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="signin-button" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 12, color: '#4b5563', marginTop: 12 }}>
              Authorized personnel only.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Admin;

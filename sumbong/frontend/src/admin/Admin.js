import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

// Adjust base URL if you have env var (e.g., process.env.REACT_APP_API_BASE)
const API_BASE = process.env.REACT_APP_API_BASE || 'https://capstone-sumbong.onrender.com';

const Admin = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // prevent duplicate rapid submits
    setError('');
    setLoading(true);

    // Single-read body helper
    const attemptLogin = async (url) => {
      let resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email.trim(), password: form.password })
        });
      } catch (netErr) {
        throw new Error(`Network error contacting server: ${netErr.message}`);
      }

      const raw = await resp.text(); // read once
      let dataParsed = null;
      if (raw) {
        try { dataParsed = JSON.parse(raw); } catch { /* non-JSON (likely HTML) */ }
      }

      // If non-JSON and not ok, craft message with snippet
      if (!dataParsed) {
        if (!resp.ok) {
          const snippet = raw ? raw.replace(/<[^>]*>/g, ' ').slice(0,120).trim() : '';
          throw new Error(`Unexpected ${resp.status} from server. ${snippet || 'Non-JSON response.'}`);
        }
        throw new Error('Unexpected non-JSON success response from server');
      }

      if (!resp.ok || !dataParsed.success) {
        throw new Error(dataParsed.message || `Login failed (status ${resp.status})`);
      }
      return dataParsed;
    };

    try {
      const primaryUrl = `${API_BASE.replace(/\/$/, '')}/api/auth/admin/login`;
      console.log('[AdminLogin] Attempting URL:', primaryUrl);
      let data;
      try {
        data = await attemptLogin(primaryUrl);
      } catch (firstErr) {
        if (/404/.test(firstErr.message) || /Unexpected 404/.test(firstErr.message)) {
          const fallbackUrl = primaryUrl.replace('/api/auth/', '/auth/');
            if (fallbackUrl !== primaryUrl) {
              console.warn('[AdminLogin] Retrying fallback URL:', fallbackUrl);
              data = await attemptLogin(fallbackUrl);
            } else {
              throw firstErr;
            }
        } else {
          throw firstErr;
        }
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('adminUser', JSON.stringify(data.user));
      navigate('/admin-dashboard');
    } catch (err) {
      console.error('[AdminLogin] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Admin Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Admin Email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login as Admin'}
          </button>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
            Use your provisioned admin account credentials.
          </div>
        </form>
      </div>
    </div>
  );
};

export default Admin;

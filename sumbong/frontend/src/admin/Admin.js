import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

// Adjust base URL if you have env var (e.g., process.env.REACT_APP_API_BASE)
const API_BASE = process.env.REACT_APP_API_BASE || 'https://capstone-sumbong.onrender.com';

const Admin = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }
      // Store token & admin flag
      localStorage.setItem('token', data.token);
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('adminUser', JSON.stringify(data.user));
      navigate('/admin-dashboard');
    } catch (err) {
      setError(err.message);
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
          <button type="submit" className="login-button">Login as Admin</button>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
            Use your provisioned admin account credentials.
          </div>
        </form>
      </div>
    </div>
  );
};

export default Admin;

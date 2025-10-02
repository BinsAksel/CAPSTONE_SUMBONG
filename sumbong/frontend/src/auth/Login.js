
import React, { useState } from 'react';
import GoogleButton from '../components/GoogleButton';
import axios from 'axios';
import { Link } from 'react-router-dom';
import loginImage from '../assets/login.png';
import Swal from 'sweetalert2';
import './Login.css';
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
      const msg = error.response?.data?.message || '';
      if (msg.toLowerCase().includes('not approved')) {
        Swal.fire({
          icon: 'info',
          title: 'Account Not Approved',
          text: 'Your account is not yet approved by the admin.',
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

  return (
    <div className="login-layout">{/* Mirror SignIn outer layout */}
      <div className="login-illustration-panel" aria-hidden="true">
        <img src={loginImage} alt="Illustration" />
      </div>
      <div className="login-form-region" role="presentation">
        <div className="login-form-box" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
          <h2 id="login-modal-title">Sign in</h2>
          <GoogleButton text="Continue with Google" onClick={handleGoogleLogin} />
          <form onSubmit={handleSubmit} className="login-form" /* internal scroll on large screens */>
            <div className="form-group">
              <label htmlFor="email">Email or phone number</label>
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
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className={`password-toggle ${showPassword ? 'show' : ''}`}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                />
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
              <Link to="/help" className="help-link">Need help?</Link>
            </div>
            <div className="signup-prompt">
              Don't have an account? <Link to="/signup">Sign up</Link>
            </div>
            <div className="learn-more">
              <Link to="/learn-more">Learn more.</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login; 
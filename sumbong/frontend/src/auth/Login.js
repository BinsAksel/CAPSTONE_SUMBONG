

import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import loginImage from '../assets/login.png';
import Swal from 'sweetalert2';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://capstone-sumbong.onrender.com/api/auth/login', formData);
  
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
  
        // Save a flag to indicate a fresh login
        localStorage.setItem('justLoggedIn', 'true');
  
        // Redirect
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error during login:', error);
  
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: error.response?.data?.message || 'Incorrect email or password.',
        confirmButtonColor: '#1a365d'
      });
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        {/* Left Section - Illustration */}
        <div className="login-illustration">
          <img src={loginImage} alt="Login Illustration" />
        </div>
        
        {/* Right Section - Sign In Form */}
        <div className="login-form-container">
          <div className="login-form-box">
            <h2>Sign in</h2>
            <form onSubmit={handleSubmit} className="login-form">
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
                    type={showPassword ? "text" : "password"}
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
                  >
                  </button>
                </div>
              </div>
              
              <button type="submit" className="signin-button">Sign in</button>
            </form>
            
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 
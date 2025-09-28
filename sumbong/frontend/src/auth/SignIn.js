import React, { useState } from 'react';
import GoogleButton from '../components/GoogleButton';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import loginImage from '../assets/login.png';
import './SignIn.css';

const SignIn = () => {
  const navigate = useNavigate();
  // Google sign up handler
  const handleGoogleSignUp = () => {
    window.location.href = 'https://capstone-sumbong.onrender.com/api/auth/google';
  };
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    password: '',
  });
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      
      // Append user data
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key]);
      });

      // Append credentials only if they exist
      if (images && images.length > 0) {
        images.forEach(image => {
          formDataToSend.append('credentials', image);
        });
      }
      
      const response = await axios.post('https://capstone-sumbong.onrender.com/api/auth/signup', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccess('You are now signed up! Please wait for the admin to verify your account before logging in.');
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phoneNumber: '',
          address: '',
          password: '',
        });
        setImages([]);
        // Do not store token or redirect
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data || err.message || 'Registration failed. Please try again.';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-content">
        <div className="signin-illustration">
          <img src={loginImage} alt="Sign Up Illustration" />
        </div>
        <div className="signin-form-container">
          <div className="signin-form-box">
            <h2>Create Account</h2>
            <GoogleButton text="Sign up with Google" onClick={handleGoogleSignUp} />
            {success && <div className="success-message">{typeof success === 'string' ? success : 'Success!'}</div>}
            {error && <div className="error-message">{typeof error === 'string' ? error : 'An error occurred'}</div>}
            <form onSubmit={handleSubmit} className="signin-form">
          <div className="form-group">
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First Name"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last Name"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="Phone Number"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Address"
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              required
            />
          </div>
          <div className="form-group">
            <label className="file-label">
              📋 Upload Credentials for Verification
            </label>
            <p className="file-description">
              Please upload your ID, barangay certificate, or other documents that prove you are a resident of Barangay East Tapinac.
            </p>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleImageChange}
              className="file-input"
              required
            />
            <small className="file-help">
              Accepted formats: Images (JPG, PNG, GIF), PDF, Word documents. You can add a profile picture later after logging in.
            </small>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
        <p className="login-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn; 
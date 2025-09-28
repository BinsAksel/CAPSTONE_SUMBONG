import React, { useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import './CompleteProfile.css';

const CompleteProfile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const userId = query.get('userId');
  // Get Google info from query params if present
  const initialFirstName = query.get('firstName') || '';
  const initialLastName = query.get('lastName') || '';
  const initialEmail = query.get('email') || '';
  const initialProfilePicture = query.get('profilePicture') || '';

  const [formData, setFormData] = useState({
    firstName: initialFirstName,
    lastName: initialLastName,
    phoneNumber: '',
    address: '',
    email: initialEmail,
    profilePicture: initialProfilePicture
  });
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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
      formDataToSend.append('firstName', formData.firstName);
      formDataToSend.append('lastName', formData.lastName);
      formDataToSend.append('phoneNumber', formData.phoneNumber);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('email', formData.email);
      if (formData.profilePicture) {
        formDataToSend.append('profilePicture', formData.profilePicture);
      }
      if (images && images.length > 0) {
        images.forEach(image => {
          formDataToSend.append('credentials', image);
        });
      }
      const response = await axios.post(
        'https://capstone-sumbong.onrender.com/api/auth/google-signup',
        formDataToSend,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (response.data.user) {
        Swal.fire({
          icon: 'success',
          title: 'Profile Completed!',
          text: 'Registration done. Please wait for the admin to verify your account before logging in.',
          confirmButtonColor: '#3b5998',
          customClass: { popup: 'swal2-rounded' }
        }).then(() => {
          navigate('/login');
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: 'Failed to complete profile. Please try again.',
        confirmButtonColor: '#c62828',
        customClass: { popup: 'swal2-rounded' }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="complete-profile-container">
      <h2>Complete Your Profile</h2>
      {formData.profilePicture && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img
            src={formData.profilePicture}
            alt="Profile Preview"
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b5998', background: '#fff' }}
          />
        </div>
      )}
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="complete-profile-form">
        <div className="form-group">
          <label htmlFor="firstName">First Name</label>
          <input
            type="text"
            name="firstName"
            id="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="First Name"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="lastName">Last Name</label>
          <input
            type="text"
            name="lastName"
            id="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Last Name"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="phoneNumber">Phone Number</label>
          <input
            type="tel"
            name="phoneNumber"
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="Phone Number"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="address">Address</label>
          <input
            type="text"
            name="address"
            id="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Address"
            required
          />
        </div>
        <div className="form-group">
          <label>Upload Credentials (ID, etc.)</label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleImageChange}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default CompleteProfile;

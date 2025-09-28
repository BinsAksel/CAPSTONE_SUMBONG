import React, { useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

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
      const response = await axios.patch(
        `https://capstone-sumbong.onrender.com/api/user/${userId}`,
        formDataToSend,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (response.data.user) {
        setSuccess('Profile completed! You may now use the app.');
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } catch (err) {
      setError('Failed to complete profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="complete-profile-container">
      <h2>Complete Your Profile</h2>
      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="complete-profile-form">
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

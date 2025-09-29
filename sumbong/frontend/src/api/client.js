import axios from 'axios';
import Swal from 'sweetalert2';

// Central Axios instance with base URL + auth & 401 handling
const api = axios.create({
  baseURL: 'https://capstone-sumbong.onrender.com'
});

// Attach Authorization header automatically if token exists
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// Global 401 handler with SweetAlert-based redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      try {
        // Prevent multiple stacked dialogs
        if (!window.__AUTH_REDIRECTING__) {
          window.__AUTH_REDIRECTING__ = true;
          localStorage.removeItem('token');
            localStorage.removeItem('user');
          if (typeof Swal !== 'undefined') {
            Swal.fire({
              icon: 'warning',
              title: 'Session expired',
              text: 'Please log in again to continue.',
              confirmButtonText: 'Go to Login'
            }).then(() => {
              window.location.href = '/login';
            });
          } else {
            window.location.href = '/login';
          }
        }
      } catch (e) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://capstone-sumbong.onrender.com';

// Axios instance for admin-authenticated calls
const adminApi = axios.create({
  baseURL: API_BASE,
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (token && isAdmin) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token invalid/expired -> force logout to admin login
      localStorage.removeItem('token');
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminUser');
      if (window.location.pathname.startsWith('/admin-dashboard')) {
        window.location.href = '/admin';
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;

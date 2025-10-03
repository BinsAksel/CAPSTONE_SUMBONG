import { useEffect } from 'react';
import { API_BASE } from '../config/apiBase';
import { useLocation, useNavigate } from 'react-router-dom';

import Swal from 'sweetalert2';

// This component should be rendered at the top of your app (e.g. in App.js)
export default function GoogleTokenHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const pending = params.get('pending');
    const path = location.pathname;
    // If we're on reset-password route, do NOT treat the token query param as a JWT
    if (path === '/reset-password') {
      return; // allow ResetPassword page to manage token itself
    }
    if (pending === '1') {
      Swal.fire({
        icon: 'info',
        title: 'Account Not Approved',
        text: 'Your account is not yet approved by the admin.',
        confirmButtonColor: '#1a365d'
      }).then(() => {
        navigate('/login', { replace: true });
      });
      return;
    }
    // Basic heuristic: JWTs usually have 2 dots. Reset tokens we generate do NOT.
    if (token && /\w+\.\w+\.\w+/.test(token)) {
      localStorage.setItem('token', token);
      // Fetch user info and store in localStorage
       fetch(`${API_BASE}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          navigate('/dashboard', { replace: true });
        })
        .catch(() => {
          navigate('/dashboard', { replace: true });
        });
    }
  }, [location, navigate]);

  return null;
}

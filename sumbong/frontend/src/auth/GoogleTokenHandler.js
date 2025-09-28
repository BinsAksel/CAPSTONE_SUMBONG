import { useEffect } from 'react';
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
    if (token) {
      localStorage.setItem('token', token);
      // Fetch user info and store in localStorage
      fetch('https://capstone-sumbong.onrender.com/api/user/me', {
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

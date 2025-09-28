import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// This component should be rendered at the top of your app (e.g. in App.js)
export default function GoogleTokenHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      // Optionally, fetch user info here and store in localStorage
      // Remove token from URL
      navigate('/dashboard', { replace: true });
    }
  }, [location, navigate]);

  return null;
}

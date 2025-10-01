import CompleteProfile from '../auth/CompleteProfile';
import React from 'react';
import { Navigate } from 'react-router-dom';
import SignIn from '../auth/SignIn';
import Login from '../auth/Login';
import Dashboard from '../pages/Dashboard';
import Admin from '../admin/Admin';
import AdminDashboard from '../admin/Admin-dashboard';

// Admin protected route
const AdminRoute = ({ children }) => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const token = localStorage.getItem('token');
  if (!isAdmin || !token) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Public Route component (for auth pages)
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const routes = [
  {
    path: '/complete-profile',
    element: <CompleteProfile />
  },
  {
    path: '/',
    element: <Navigate to="/login" replace />
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    )
  },
  {
    path: '/signup',
    element: (
      <PublicRoute>
        <SignIn />
      </PublicRoute>
    )
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    )
  },
  {
    path: '/admin/login',
    element: <Admin />
  },
  {
    path: '/admin',
    element: (() => {
      const isAdmin = localStorage.getItem('isAdmin') === 'true';
      const token = localStorage.getItem('token');
      if (isAdmin && token) return <Navigate to="/admin-dashboard" replace />;
      return <Navigate to="/admin/login" replace />;
    })()
  },
  {
    path: '/admin-dashboard',
    element: (
      <AdminRoute>
        <AdminDashboard />
      </AdminRoute>
    )
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />
  }
];

export default routes; 
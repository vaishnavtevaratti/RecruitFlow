/**
 * RecruitFlow — Protected Route Guard
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading message="Authenticating session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-warning shadow-sm p-4 rounded-3 d-inline-block">
          <i className="bi bi-shield-lock-fill fs-2 text-warning mb-2 d-block"></i>
          <h4>Access Restricted</h4>
          <p className="mb-0 text-muted">Your role ({user.role}) does not have permission to view this section.</p>
        </div>
      </div>
    );
  }

  return children;
}

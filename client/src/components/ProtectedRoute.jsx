/**
 * RecruitFlow — Protected Route Guard
 * UI-level guard only; every API endpoint enforces the same roles on the server.
 */

import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth, homePathForRole } from '../context/AuthContext';
import Loading from './Loading';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading message="Authenticating session..." />;
  }

  if (!isAuthenticated) {
    const loginPath = allowedRoles && allowedRoles.includes('CANDIDATE') ? '/candidate/login' : '/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="container py-5 text-center">
        <div className="card-rf p-5 d-inline-block" style={{ maxWidth: 480 }}>
          <div className="empty-state-icon bg-warning-subtle text-warning mx-auto mb-3">
            <i className="bi bi-shield-lock-fill"></i>
          </div>
          <h4 className="fw-bold">Access restricted</h4>
          <p className="text-muted mb-4">Your role ({user.role}) does not have permission to view this section.</p>
          <Link to={homePathForRole(user.role)} className="btn btn-primary">
            Go to my home page
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

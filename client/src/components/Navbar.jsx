/**
 * RecruitFlow — Top Navigation Bar Component
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onToggleSidebar }) {
  const { user, isCandidate, isHR } = useAuth();

  return (
    <header className="app-navbar">
      <div className="d-flex align-items-center gap-3">
        <button
          type="button"
          className="btn btn-light border btn-sm d-lg-none"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <i className="bi bi-list fs-5" aria-hidden="true"></i>
        </button>
        <span className="navbar-context d-none d-sm-inline">
          {isCandidate ? 'Candidate Portal' : 'Recruitment Management'}
        </span>
      </div>

      <div className="d-flex align-items-center gap-3">
        {isHR && (
          <Link to="/jobs/new" className="btn btn-sm btn-primary d-none d-md-inline-flex align-items-center gap-1">
            <i className="bi bi-plus-lg" aria-hidden="true"></i>
            <span>New Job</span>
          </Link>
        )}
        {isCandidate && (
          <Link to="/candidate/jobs" className="btn btn-sm btn-outline-primary d-none d-md-inline-flex align-items-center gap-1">
            <i className="bi bi-search" aria-hidden="true"></i>
            <span>Find Jobs</span>
          </Link>
        )}

        {user && (
          <div className="d-flex align-items-center gap-2 border-start ps-3">
            <div className="avatar-circle" aria-hidden="true">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="d-none d-sm-block text-start">
              <div className="fw-semibold small lh-sm text-dark">{user.name}</div>
              <small className="text-muted" style={{ fontSize: '0.75rem' }}>{user.email}</small>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

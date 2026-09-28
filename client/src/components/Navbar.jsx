/**
 * RecruitFlow — Top Navigation Bar Component
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onToggleSidebar }) {
  const { user } = useAuth();

  return (
    <header className="app-navbar">
      <div className="d-flex align-items-center gap-3">
        <button
          className="btn btn-outline-secondary btn-sm d-lg-none"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation"
        >
          <i className="bi bi-list fs-5"></i>
        </button>
        <span className="fw-semibold text-secondary d-none d-sm-inline" style={{ fontSize: '0.9rem' }}>
          Recruitment Management System
        </span>
      </div>

      <div className="d-flex align-items-center gap-3">
        <Link to="/jobs/public" className="btn btn-sm btn-outline-primary d-none d-md-flex align-items-center gap-1">
          <i className="bi bi-globe"></i>
          <span>View Public Careers</span>
        </Link>

        {user && (
          <div className="d-flex align-items-center gap-2 border-start ps-3">
            <div
              className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold"
              style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="d-none d-sm-block text-start">
              <div className="fw-bold small lh-1 text-dark">{user.name}</div>
              <small className="text-muted" style={{ fontSize: '0.75rem' }}>{user.email}</small>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

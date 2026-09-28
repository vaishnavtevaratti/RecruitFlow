/**
 * RecruitFlow — Sidebar Navigation Component
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isCandidate = user?.role === 'CANDIDATE';

  const handleLogout = () => {
    logout();
    navigate(isCandidate ? '/candidate/login' : '/login');
  };

  const hrNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'bi-grid-1x2-fill' },
    { to: '/jobs', label: 'Job Openings', icon: 'bi-briefcase-fill' },
    { to: '/candidates', label: 'Candidates', icon: 'bi-people-fill' },
    { to: '/applications', label: 'Applications', icon: 'bi-file-earmark-person-fill' },
    { to: '/interviews', label: 'Interviews', icon: 'bi-calendar-check-fill' },
    { to: '/offers', label: 'Offers & Hiring', icon: 'bi-award-fill' }
  ];

  const candidateNavItems = [
    { to: '/candidate/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    { to: '/candidate/jobs', label: 'Browse Jobs', icon: 'bi-briefcase-fill' },
    { to: '/candidate/applications', label: 'My Applications', icon: 'bi-file-earmark-check-fill' },
    { to: '/candidate/profile', label: 'My Profile', icon: 'bi-person-circle' }
  ];

  const navItems = isCandidate ? candidateNavItems : hrNavItems;
  const brandTo = isCandidate ? '/candidate/dashboard' : '/dashboard';

  return (
    <>
      <aside className={`app-sidebar ${isOpen ? 'show' : ''}`}>
        <NavLink to={brandTo} className="sidebar-brand" onClick={onClose}>
          <div className="brand-icon">
            <i className="bi bi-diagram-3-fill"></i>
          </div>
          <span>RecruitFlow</span>
        </NavLink>

        <ul className="sidebar-menu">
          <li className="px-3 py-2 text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}>
            {isCandidate ? 'Candidate Portal' : 'Recruitment'}
          </li>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <i className={`bi ${item.icon}`}></i>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}

          {!isCandidate && (
            <>
              <li className="px-3 py-2 mt-3 text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                External Portals
              </li>
              <li>
                <NavLink
                  to="/jobs/public"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sidebar-link"
                  onClick={onClose}
                >
                  <i className="bi bi-box-arrow-up-right"></i>
                  <span>Public Careers</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/application-status"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sidebar-link"
                  onClick={onClose}
                >
                  <i className="bi bi-search"></i>
                  <span>Applicant Lookup</span>
                </NavLink>
              </li>
            </>
          )}
        </ul>

        <div className="sidebar-footer">

          {user && (
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="text-truncate me-2">
                <div className="text-white fw-semibold small text-truncate">{user.name}</div>
                <div className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>{user.role}</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
          >
            <i className="bi bi-box-arrow-right"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="d-lg-none position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"
          style={{ zIndex: 999 }}
          onClick={onClose}
        ></div>
      )}
    </>
  );
}

/**
 * RecruitFlow — Sidebar Navigation Component
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, homePathForRole } from '../context/AuthContext';

const HR_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
  { to: '/jobs', label: 'Job Openings', icon: 'bi-briefcase' },
  { to: '/applications', label: 'Applications', icon: 'bi-kanban' },
  { to: '/candidates', label: 'Candidates', icon: 'bi-people' },
  { to: '/interviews', label: 'Interviews', icon: 'bi-calendar-check' },
  { to: '/offers', label: 'Offers & Hiring', icon: 'bi-award' }
];

const INTERVIEWER_NAV = [{ to: '/interviews', label: 'My Interviews', icon: 'bi-calendar-check' }];

const CANDIDATE_NAV = [
  { to: '/candidate/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
  { to: '/candidate/jobs', label: 'Browse Jobs', icon: 'bi-search' },
  { to: '/candidate/applications', label: 'My Applications', icon: 'bi-file-earmark-check' },
  { to: '/candidate/profile', label: 'My Profile', icon: 'bi-person-circle' }
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = user?.role;
  const isCandidate = role === 'CANDIDATE';
  const isHR = role === 'HR' || role === 'ADMIN';

  const handleLogout = () => {
    logout();
    navigate(isCandidate ? '/candidate/login' : '/login', { replace: true });
  };

  const navItems = isCandidate ? CANDIDATE_NAV : isHR ? HR_NAV : INTERVIEWER_NAV;
  const sectionLabel = isCandidate ? 'Candidate Portal' : isHR ? 'Recruitment' : 'Interviewing';

  return (
    <>
      <aside className={`app-sidebar ${isOpen ? 'show' : ''}`} aria-label="Main navigation">
        <NavLink to={homePathForRole(role)} className="sidebar-brand" onClick={onClose}>
          <div className="brand-icon">
            <i className="bi bi-diagram-3-fill"></i>
          </div>
          <span>RecruitFlow</span>
        </NavLink>

        <ul className="sidebar-menu">
          <li className="sidebar-section">{sectionLabel}</li>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}

          {isHR && (
            <>
              <li className="sidebar-section mt-3">External Portals</li>
              <li>
                <a href="/jobs/public" target="_blank" rel="noopener noreferrer" className="sidebar-link" onClick={onClose}>
                  <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                  <span>Public Careers</span>
                </a>
              </li>
              <li>
                <a href="/application-status" target="_blank" rel="noopener noreferrer" className="sidebar-link" onClick={onClose}>
                  <i className="bi bi-search" aria-hidden="true"></i>
                  <span>Applicant Lookup</span>
                </a>
              </li>
            </>
          )}
        </ul>

        <div className="sidebar-footer">
          {user && (
            <div className="d-flex align-items-center gap-2 mb-3">
              <div className="avatar-circle avatar-sm">{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
              <div className="text-truncate">
                <div className="text-white fw-semibold small text-truncate">{user.name}</div>
                <div className="sidebar-role">{role}</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-sidebar-logout btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isOpen && <div className="sidebar-backdrop d-lg-none" onClick={onClose} aria-hidden="true"></div>}
    </>
  );
}

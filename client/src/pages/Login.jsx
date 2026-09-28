/**
 * RecruitFlow — Login Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || (user?.role === 'CANDIDATE' ? '/candidate/dashboard' : '/dashboard');

  useEffect(() => {
    if (isAuthenticated && user) {
      const destination = user.role === 'CANDIDATE' ? '/candidate/dashboard' : '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      const loggedInUser = await login(email.trim(), password);
      const destination = loggedInUser?.role === 'CANDIDATE' ? '/candidate/dashboard' : from;
      navigate(destination, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Authentication failed. Please verify credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };


  const handleFillDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center bg-light py-5 px-3">
      <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5" style={{ maxWidth: '440px', width: '100%' }}>
        <div className="text-center mb-4">
          <div
            className="d-inline-flex align-items-center justify-content-center bg-primary text-white rounded-3 mb-3"
            style={{ width: '52px', height: '52px', fontSize: '1.6rem' }}
          >
            <i className="bi bi-diagram-3-fill"></i>
          </div>
          <h3 className="fw-bold text-dark mb-1">RecruitFlow</h3>
          <p className="text-muted small">Sign in to your recruitment management portal</p>
        </div>

        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold small text-secondary">Email Address</label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="email"
                className="form-control border-start-0 ps-0"
                placeholder="name@recruitflow.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold small text-secondary">Password</label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-lock"></i>
              </span>
              <input
                type="password"
                className="form-control border-start-0 ps-0"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2 fw-semibold rounded-3 shadow-sm mb-3"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Demo Credentials Quick-Select Helper for Technical Interview Demonstrations */}
        <div className="border-top pt-3 mt-2 text-center">
          <small className="text-muted d-block mb-2 fw-semibold">Quick Demo Login:</small>
          <div className="d-flex gap-2 justify-content-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handleFillDemo('hr@recruitflow.com', 'Admin@123')}
            >
              <i className="bi bi-person-badge me-1"></i> HR Manager
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handleFillDemo('interviewer@recruitflow.com', 'Admin@123')}
            >
              <i className="bi bi-person-video3 me-1"></i> Interviewer
            </button>
          </div>
        </div>

        <div className="text-center mt-3 pt-3 border-top">
          <p className="text-muted small mb-1">
            Job Applicant?{' '}
            <Link to="/candidate/login" className="text-decoration-none fw-bold text-primary">
              Candidate Portal Sign In
            </Link>
          </p>
          <p className="text-muted small mb-2">
            New Applicant?{' '}
            <Link to="/candidate/signup" className="text-decoration-none fw-semibold">
              Create Candidate Account
            </Link>
          </p>
          <Link to="/jobs/public" className="text-decoration-none small text-secondary">
            <i className="bi bi-arrow-left me-1"></i> Browse Public Career Openings
          </Link>
        </div>
      </div>
    </div>
  );
}


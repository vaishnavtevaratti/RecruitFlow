/**
 * RecruitFlow — Staff Login Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { useAuth, homePathForRole } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import Notice from '../components/Notice';
import { getErrorMessage } from '../utils/formatters';

const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(homePathForRole(user.role), { replace: true });
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
      const requested = location.state?.from?.pathname;
      const home = homePathForRole(loggedInUser?.role);
      const destination = requested && loggedInUser?.role !== 'CANDIDATE' && !requested.startsWith('/candidate') ? requested : home;
      navigate(destination, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Authentication failed. Please verify credentials.'));
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
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: '440px' }}>
        <div className="text-center mb-4">
          <div className="auth-logo mx-auto mb-3">
            <i className="bi bi-diagram-3-fill" aria-hidden="true"></i>
          </div>
          <h1 className="h3 fw-bold mb-1">Welcome back</h1>
          <p className="text-muted small mb-0">Sign in to the RecruitFlow staff portal</p>
        </div>

        {searchParams.get('expired') && !error && (
          <Notice type="warning" message="Your session has expired. Please sign in again." />
        )}
        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="login-email" className="form-label">Email address</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-envelope" aria-hidden="true"></i></span>
              <input
                id="login-email"
                type="email"
                className="form-control"
                placeholder="name@recruitflow.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="login-password" className="form-label">Password</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-lock" aria-hidden="true"></i></span>
              <input
                id="login-password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Demo credential helper for seed accounts: dev builds, or VITE_SHOW_DEMO_LOGIN=true for a demo deployment */}
        {SHOW_DEMO && <div className="border-top pt-3 mt-4 text-center">
          <small className="text-muted d-block mb-2 fw-semibold">Quick demo login</small>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <button type="button" className="btn btn-sm btn-light border" onClick={() => handleFillDemo('hr@recruitflow.com', 'Admin@123')}>
              <i className="bi bi-person-badge me-1" aria-hidden="true"></i> HR Manager
            </button>
            <button type="button" className="btn btn-sm btn-light border" onClick={() => handleFillDemo('interviewer@recruitflow.com', 'Admin@123')}>
              <i className="bi bi-person-video3 me-1" aria-hidden="true"></i> Interviewer
            </button>
          </div>
        </div>}

        <div className="text-center mt-3 pt-3 border-top small">
          <p className="text-muted mb-1">
            Job applicant?{' '}
            <Link to="/candidate/login" className="fw-semibold">Candidate sign in</Link>
            {' · '}
            <Link to="/candidate/signup" className="fw-semibold">Create account</Link>
          </p>
          <Link to="/jobs/public" className="text-secondary">
            <i className="bi bi-arrow-left me-1" aria-hidden="true"></i> Browse public career openings
          </Link>
        </div>
      </div>
    </div>
  );
}

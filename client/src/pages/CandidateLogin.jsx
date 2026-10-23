/**
 * RecruitFlow — Candidate Login Page
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth, homePathForRole } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import Notice from '../components/Notice';
import { getErrorMessage } from '../utils/formatters';

export default function CandidateLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const { candidateLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requested = location.state?.from?.pathname;
  const from = requested && requested.startsWith('/candidate') ? requested : '/candidate/dashboard';

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
      await candidateLogin(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed. Please verify credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: '440px' }}>
        <div className="text-center mb-4">
          <div className="auth-logo mx-auto mb-3">
            <i className="bi bi-person-badge-fill"></i>
          </div>
          <h1 className="h3 fw-bold mb-1">Candidate Portal</h1>
          <p className="text-muted small mb-0">Sign in to apply, track applications, and review offers</p>
        </div>

        {searchParams.get('expired') && !error && (
          <Notice type="warning" message="Your session has expired. Please sign in again." />
        )}
        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="cand-email" className="form-label">Email address</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-envelope"></i></span>
              <input
                id="cand-email"
                type="email"
                className="form-control"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="cand-password" className="form-label">Password</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-key"></i></span>
              <input
                id="cand-password"
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

        <div className="text-center mt-4 pt-3 border-top small">
          <p className="text-muted mb-2">
            New here?{' '}
            <Link to="/candidate/signup" className="fw-semibold">Create a candidate account</Link>
          </p>
          <p className="text-muted mb-0">
            <Link to="/jobs/public" className="text-secondary">Browse open jobs</Link>
            {' · '}
            <Link to="/login" className="text-secondary">Staff sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

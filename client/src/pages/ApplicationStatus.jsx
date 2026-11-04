/**
 * RecruitFlow — Candidate Application Status Tracker
 * Public lookup using Application ID + Candidate Email.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { candidatePortalService } from '../services/candidatePortalService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { formatDate, formatDateTime } from '../utils/formatters';

export default function ApplicationStatus() {
  const { isAuthenticated, isCandidate } = useAuth();
  const [appId, setAppId] = useState('');
  const [email, setEmail] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!appId.trim() || !email.trim()) {
      setError('Please provide both Application ID and your applicant email address.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setLookupResult(null);
      const res = await candidatePortalService.getPublicStatus(Number(appId.trim()), email.trim());
      if (res.success && res.data) {
        setLookupResult(res.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'No matching application found. Please verify the Application ID and email address.'
      );
    } finally {
      setLoading(false);
    }
  };

  const app = lookupResult?.application;

  return (
    <div className="bg-light min-vh-100 py-5">
      <div className="container" style={{ maxWidth: '680px' }}>
        <div className="text-center mb-4">
          <Link
            to="/jobs/public"
            className="d-inline-flex align-items-center gap-2 text-decoration-none text-primary fw-semibold mb-2"
          >
            <i className="bi bi-arrow-left" aria-hidden="true"></i> Back to Careers
          </Link>
          <h2 className="fw-bold text-dark mb-1">Application Status Lookup</h2>
          <p className="text-muted small">
            Enter your Application Reference ID and email address to check status
          </p>
        </div>

        <div className="card shadow-sm border-0 p-4 mb-4">
          <form onSubmit={handleLookup}>
            <div className="row g-3">
              <div className="col-12 col-md-5">
                <label className="form-label fw-semibold small">Application ID</label>
                <div className="input-group">
                  <span className="input-group-text bg-white text-muted">#</span>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 1"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="col-12 col-md-7">
                <label className="form-label fw-semibold small">Candidate Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="candidate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="col-12">
                <button
                  type="submit"
                  className="btn btn-primary w-100 fw-semibold shadow-sm"
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Lookup Application Status'}
                </button>
              </div>
            </div>
          </form>

          {error && <div className="mt-3"><ErrorMessage message={error} /></div>}

          <div className="alert alert-info small mt-4 mb-0 rounded-3">
            <i className="bi bi-person-badge me-2" aria-hidden="true"></i>
            Have a registered candidate account?{' '}
            <Link to="/candidate/login" className="alert-link fw-bold">
              Sign In to Candidate Portal
            </Link>{' '}
            for complete interview details, feedback, and one-click offer acceptance!
          </div>
        </div>

        {loading && <Loading message="Querying application status..." />}

        {app && (
          <div className="card shadow-sm border-0 p-4">
            <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-3">
              <div>
                <h5 className="fw-bold mb-1 text-dark">{app.candidate_name}</h5>
                <small className="text-muted">
                  {app.job_title} ({app.job_department})
                </small>
              </div>
              <StatusBadge status={app.status} />
            </div>

            <div className="row g-3">
              <div className="col-6">
                <small className="text-muted d-block">Application ID</small>
                <span className="fw-semibold">#{app.id}</span>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Submission Date</small>
                <span className="fw-semibold">{formatDate(app.applied_at)}</span>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Location</small>
                <span className="fw-semibold">{app.job_location}</span>
              </div>
              <div className="col-6">
                <small className="text-muted d-block">Current Pipeline Stage</small>
                <span className="fw-bold text-primary">{app.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {lookupResult.interviews?.length > 0 && (
              <div className="mt-3 p-3 bg-light rounded-3">
                <div className="fw-semibold small text-dark mb-1">
                  <i className="bi bi-calendar-event me-1 text-primary" aria-hidden="true"></i> Scheduled Interview:
                </div>
                <div className="small text-muted">
                  {formatDateTime(lookupResult.interviews[0].scheduled_at)} • {lookupResult.interviews[0].type}
                </div>
              </div>
            )}

            {lookupResult.offer && (
              <div className="mt-3 p-3 bg-success-subtle rounded-3 text-success">
                <div className="fw-bold small mb-1">
                  <i className="bi bi-award me-1" aria-hidden="true"></i> Job Offer Status: {lookupResult.offer.status}
                </div>
                <div className="small">
                  Sign in to your candidate account to review terms and accept or decline.
                </div>
              </div>
            )}

            <div className="border-top pt-3 mt-3 d-flex justify-content-between align-items-center">
              <Link to="/candidate/signup" className="btn btn-sm btn-outline-secondary">
                Create Candidate Account
              </Link>
              <Link to="/candidate/login" className="btn btn-sm btn-primary">
                Candidate Portal Sign In <i className="bi bi-arrow-right ms-1" aria-hidden="true"></i>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

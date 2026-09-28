/**
 * RecruitFlow — Candidate Dashboard
 * Displays real-time candidate statistics, application status summary, and recent activity.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { candidatePortalService } from '../services/candidatePortalService';
import Loading from '../components/Loading';

export default function CandidateDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await candidatePortalService.getDashboard();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      APPLIED: { bg: 'bg-secondary', label: 'Applied' },
      SCREENING: { bg: 'bg-info text-dark', label: 'Screening' },
      SHORTLISTED: { bg: 'bg-primary', label: 'Shortlisted' },
      INTERVIEW_SCHEDULED: { bg: 'bg-warning text-dark', label: 'Interview Scheduled' },
      INTERVIEWED: { bg: 'bg-info text-dark', label: 'Interviewed' },
      SELECTED: { bg: 'bg-success', label: 'Selected' },
      OFFER_SENT: { bg: 'bg-primary', label: 'Offer Received' },
      OFFER_ACCEPTED: { bg: 'bg-success', label: 'Offer Accepted' },
      HIRED: { bg: 'bg-success', label: 'Hired' },
      REJECTED: { bg: 'bg-danger', label: 'Rejected' }
    };
    const s = map[status] || { bg: 'bg-secondary', label: status };
    return <span className={`badge ${s.bg}`}>{s.label}</span>;
  };

  if (loading) {
    return <Loading message="Loading candidate overview..." />;
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">Candidate Dashboard</h2>
          <p className="text-muted small mb-0">Overview of your ongoing applications, interviews, and job offers</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/candidate/jobs" className="btn btn-primary d-flex align-items-center gap-2">
            <i className="bi bi-briefcase"></i>
            <span>Browse Job Openings</span>
          </Link>
          <Link to="/candidate/applications" className="btn btn-outline-secondary d-flex align-items-center gap-2">
            <i className="bi bi-list-check"></i>
            <span>My Applications</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
          <i className="bi bi-exclamation-octagon-fill me-2 fs-5"></i>
          <div>{error}</div>
        </div>
      )}

      {/* Real-time Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 h-100 p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Total Applied</span>
              <span className="badge bg-light text-primary p-2 rounded-circle">
                <i className="bi bi-file-earmark-text"></i>
              </span>
            </div>
            <h3 className="fw-bold mb-0 text-dark">{stats?.totalApplications || 0}</h3>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 h-100 p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Active</span>
              <span className="badge bg-light text-info p-2 rounded-circle">
                <i className="bi bi-arrow-repeat"></i>
              </span>
            </div>
            <h3 className="fw-bold mb-0 text-info">{stats?.activeApplications || 0}</h3>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 h-100 p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Interviews</span>
              <span className="badge bg-light text-warning p-2 rounded-circle">
                <i className="bi bi-calendar-event"></i>
              </span>
            </div>
            <h3 className="fw-bold mb-0 text-warning">{stats?.interviews || 0}</h3>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 h-100 p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Selected</span>
              <span className="badge bg-light text-success p-2 rounded-circle">
                <i className="bi bi-hand-thumbs-up"></i>
              </span>
            </div>
            <h3 className="fw-bold mb-0 text-success">{stats?.selected || 0}</h3>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 h-100 p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Offers</span>
              <span className="badge bg-light text-primary p-2 rounded-circle">
                <i className="bi bi-award"></i>
              </span>
            </div>
            <h3 className="fw-bold mb-0 text-primary">{stats?.offers || 0}</h3>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 h-100 p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Hired</span>
              <span className="badge bg-light text-success p-2 rounded-circle">
                <i className="bi bi-check-circle"></i>
              </span>
            </div>
            <h3 className="fw-bold mb-0 text-success">{stats?.hired || 0}</h3>
          </div>
        </div>
      </div>

      {/* Recent Applications Section */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold">Recent Applications</h5>
          <Link to="/candidate/applications" className="btn btn-sm btn-link text-decoration-none">
            View All Applications <i className="bi bi-arrow-right"></i>
          </Link>
        </div>

        <div className="card-body p-0">
          {!stats?.recentApplications || stats.recentApplications.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox text-muted fs-1 mb-3 d-block"></i>
              <h6 className="fw-bold text-dark">No applications yet</h6>
              <p className="text-muted small mb-3">Browse available jobs to submit your first application.</p>
              <Link to="/candidate/jobs" className="btn btn-primary btn-sm">
                Explore Available Jobs
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th>Job Title</th>
                    <th>Department</th>
                    <th>Location</th>
                    <th>Applied Date</th>
                    <th>Current Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentApplications.map((app) => (
                    <tr key={app.id}>
                      <td className="fw-semibold text-dark">{app.job_title}</td>
                      <td>
                        <span className="badge bg-light text-secondary">{app.job_department}</span>
                      </td>
                      <td className="text-muted small">
                        <i className="bi bi-geo-alt me-1"></i>
                        {app.job_location}
                      </td>
                      <td className="text-muted small">
                        {new Date(app.applied_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td>{getStatusBadge(app.status)}</td>
                      <td className="text-end">
                        <Link
                          to={`/candidate/applications/${app.id}`}
                          className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                        >
                          <span>Track</span>
                          <i className="bi bi-chevron-right"></i>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * RecruitFlow — Candidate Applications List Page
 * Displays only applications belonging to the logged-in candidate.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { candidatePortalService } from '../services/candidatePortalService';
import Loading from '../components/Loading';

export default function CandidateApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await candidatePortalService.getApplications();
      if (res.success && Array.isArray(res.data)) {
        setApplications(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load applications.');
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

  const filteredApplications = applications.filter((app) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return !['REJECTED', 'HIRED'].includes(app.status);
    if (statusFilter === 'INTERVIEWS') return ['INTERVIEW_SCHEDULED', 'INTERVIEWED'].includes(app.status);
    if (statusFilter === 'OFFERS') return ['OFFER_SENT', 'OFFER_ACCEPTED'].includes(app.status);
    return app.status === statusFilter;
  });

  if (loading) {
    return <Loading message="Loading your applications..." />;
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">My Applications</h2>
          <p className="text-muted small mb-0">Track all job applications submitted with your candidate profile</p>
        </div>
        <Link to="/candidate/jobs" className="btn btn-primary d-flex align-items-center gap-2">
          <i className="bi bi-search"></i>
          <span>Explore More Jobs</span>
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <div>{error}</div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-dark' : 'btn-outline-secondary'}`}
        >
          All ({applications.length})
        </button>
        <button
          onClick={() => setStatusFilter('ACTIVE')}
          className={`btn btn-sm ${statusFilter === 'ACTIVE' ? 'btn-dark' : 'btn-outline-secondary'}`}
        >
          Active Pipeline
        </button>
        <button
          onClick={() => setStatusFilter('INTERVIEWS')}
          className={`btn btn-sm ${statusFilter === 'INTERVIEWS' ? 'btn-dark' : 'btn-outline-secondary'}`}
        >
          Interviews
        </button>
        <button
          onClick={() => setStatusFilter('OFFERS')}
          className={`btn btn-sm ${statusFilter === 'OFFERS' ? 'btn-dark' : 'btn-outline-secondary'}`}
        >
          Offers
        </button>
      </div>

      {/* Applications Table / Cards */}
      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          {filteredApplications.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-folder2-open text-muted fs-1 mb-3 d-block"></i>
              <h5 className="fw-bold text-dark">No applications found</h5>
              <p className="text-muted small mb-3">
                {statusFilter === 'ALL'
                  ? 'No applications yet. Browse available jobs to apply.'
                  : `No applications match the '${statusFilter}' filter.`}
              </p>
              <Link to="/candidate/jobs" className="btn btn-primary btn-sm">
                Browse Open Positions
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
                    <th>Employment</th>
                    <th>Applied Date</th>
                    <th>Current Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div className="fw-bold text-dark">{app.job_title}</div>
                        {app.offer_status === 'SENT' && (
                          <span className="badge bg-primary text-white mt-1" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-star-fill me-1"></i> Offer Waiting Acceptance
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-light text-secondary">{app.job_department}</span>
                      </td>
                      <td className="text-muted small">
                        <i className="bi bi-geo-alt me-1"></i>
                        {app.job_location}
                      </td>
                      <td className="text-muted small">{app.job_employment_type}</td>
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
                          className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 shadow-sm"
                        >
                          <span>View Details</span>
                          <i className="bi bi-arrow-right"></i>
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

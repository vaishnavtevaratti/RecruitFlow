/**
 * RecruitFlow — Candidate Applications List
 * Only the signed-in candidate's applications (server derives identity from the session).
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { candidatePortalService } from '../services/candidatePortalService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { formatDate, getErrorMessage } from '../utils/formatters';

const FILTERS = [
  { key: 'ALL', label: 'All', test: () => true },
  { key: 'ACTIVE', label: 'In progress', test: (a) => !['REJECTED', 'HIRED'].includes(a.status) },
  { key: 'INTERVIEWS', label: 'Interviews', test: (a) => ['INTERVIEW_SCHEDULED', 'INTERVIEWED'].includes(a.status) },
  { key: 'OFFERS', label: 'Offers', test: (a) => ['OFFER_SENT', 'OFFER_ACCEPTED'].includes(a.status) },
  { key: 'CLOSED', label: 'Closed', test: (a) => ['REJECTED', 'HIRED'].includes(a.status) }
];

export default function CandidateApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await candidatePortalService.getApplications();
      setApplications(res.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load your applications.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const active = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const visible = applications.filter(active.test);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Applications</h1>
          <p className="page-subtitle">Every application you have submitted and its current stage</p>
        </div>
        <Link to="/candidate/jobs" className="btn btn-primary">
          <i className="bi bi-search me-1" aria-hidden="true"></i> Find more jobs
        </Link>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchApplications} />}

      <div className="stage-tabs mb-3" role="tablist" aria-label="Filter applications">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={`stage-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
            <span className="stage-tab-count">{applications.filter(f.test).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading message="Loading your applications..." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="bi-folder2-open"
          title={filter === 'ALL' ? 'No applications yet' : 'Nothing in this view'}
          message={filter === 'ALL' ? 'Browse open jobs to submit your first application.' : 'Try another filter.'}
          action={filter === 'ALL' ? <Link to="/candidate/jobs" className="btn btn-primary btn-sm">Browse jobs</Link> : null}
        />
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle mb-0">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Location</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="fw-semibold">{app.job_title}</div>
                      <div className="small text-muted">{app.job_department} · {app.job_employment_type}</div>
                      {app.offer_status === 'SENT' && app.status === 'OFFER_SENT' && (
                        <span className="chip chip-primary mt-1"><i className="bi bi-bell-fill me-1" aria-hidden="true"></i>Offer awaiting your response</span>
                      )}
                    </td>
                    <td className="small text-muted"><i className="bi bi-geo-alt me-1" aria-hidden="true"></i>{app.job_location}</td>
                    <td className="small text-muted">{formatDate(app.applied_at)}</td>
                    <td><StatusBadge status={app.status} audience="candidate" /></td>
                    <td className="text-end">
                      <Link to={`/candidate/applications/${app.id}`} className="btn btn-sm btn-primary">
                        Details <i className="bi bi-arrow-right" aria-hidden="true"></i>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

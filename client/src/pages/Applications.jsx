/**
 * RecruitFlow — Applications Pipeline Management Page
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applicationService } from '../services/applicationService';
import { jobService } from '../services/jobService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import Pagination, { paginate } from '../components/Pagination';
import Notice from '../components/Notice';
import { formatDate, getErrorMessage } from '../utils/formatters';

const STAGES = [
  'APPLIED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'SELECTED',
  'OFFER_SENT',
  'OFFER_ACCEPTED',
  'HIRED',
  'REJECTED'
];

export default function Applications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const statusFilter = searchParams.get('status') || '';
  const jobFilter = searchParams.get('job_id') || '';

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (jobFilter) params.job_id = jobFilter;
      const res = await applicationService.getApplications(params);
      setApplications(res.data || []);
      setPage(1);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch applications.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    jobService.getJobs().then((res) => setJobs(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, jobFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setFilter('search', search.trim());
    fetchApplications();
  };

  const quickAction = async (app, action) => {
    try {
      setBusyId(app.id);
      setError('');
      if (action === 'screen') {
        await applicationService.screenApplication(app.id);
        setFeedback(`${app.candidate_name} moved to screening.`);
      } else {
        await applicationService.shortlistApplication(app.id);
        setFeedback(`${app.candidate_name} shortlisted. Schedule an interview from the application page.`);
      }
      await fetchApplications();
    } catch (err) {
      setFeedback('');
      setError(getErrorMessage(err, 'Action failed.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Applications</h1>
          <p className="page-subtitle">Move candidates through screening, interviews, offers, and hiring</p>
        </div>
      </div>

      <Notice message={feedback} onClose={() => setFeedback('')} />
      {error && <ErrorMessage message={error} onRetry={fetchApplications} />}

      <div className="stage-tabs mb-3" role="tablist" aria-label="Filter by stage">
        <button type="button" role="tab" aria-selected={!statusFilter} className={`stage-tab ${!statusFilter ? 'active' : ''}`} onClick={() => setFilter('status', '')}>
          All
        </button>
        {STAGES.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={statusFilter === s} className={`stage-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setFilter('status', s)}>
            {s.replace(/_/g, ' ').toLowerCase()}
          </button>
        ))}
      </div>

      <div className="card-rf filter-bar mb-4">
        <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input
                type="search"
                className="form-control"
                placeholder="Search candidate name, email, or job title"
                aria-label="Search applications"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-8 col-md-4">
            <select className="form-select" aria-label="Filter by job" value={jobFilter} onChange={(e) => setFilter('job_id', e.target.value)}>
              <option value="">All jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>
          <div className="col-4 col-md-2">
            <button type="submit" className="btn btn-outline-primary w-100">Search</button>
          </div>
        </form>
      </div>

      {loading ? (
        <Loading message="Loading applications..." />
      ) : applications.length === 0 ? (
        <EmptyState icon="bi-inbox" title="No applications found" message="No applications match the selected filters." />
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job</th>
                  <th>Applied</th>
                  <th>Stage</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(applications, page).map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-circle avatar-sm" aria-hidden="true">{app.candidate_name?.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <Link to={`/applications/${app.id}`} className="fw-semibold text-dark text-decoration-none">
                            {app.candidate_name}
                          </Link>
                          <div className="small text-muted text-truncate">{app.candidate_email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link to={`/jobs/${app.job_id}`} className="text-secondary text-decoration-none">{app.job_title}</Link>
                      <div className="small text-muted">{app.job_department}</div>
                    </td>
                    <td className="small text-secondary">{formatDate(app.applied_at)}</td>
                    <td><StatusBadge status={app.status} /></td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        {app.status === 'APPLIED' && (
                          <button type="button" className="btn btn-sm btn-light border" disabled={busyId === app.id} onClick={() => quickAction(app, 'screen')}>
                            {busyId === app.id ? <span className="spinner-border spinner-border-sm" aria-hidden="true"></span> : 'Screen'}
                          </button>
                        )}
                        {app.status === 'SCREENING' && (
                          <button type="button" className="btn btn-sm btn-outline-success" disabled={busyId === app.id} onClick={() => quickAction(app, 'shortlist')}>
                            {busyId === app.id ? <span className="spinner-border spinner-border-sm" aria-hidden="true"></span> : 'Shortlist'}
                          </button>
                        )}
                        <Link to={`/applications/${app.id}`} className="btn btn-sm btn-primary">
                          Open <i className="bi bi-arrow-right"></i>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={applications.length} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

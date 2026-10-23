/**
 * RecruitFlow — Jobs Management Page
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { jobService } from '../services/jobService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import Notice from '../components/Notice';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate, getErrorMessage, dateInputValue } from '../utils/formatters';

export default function Jobs() {
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState(null); // { job, action }
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState([]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department = departmentFilter;

      const res = await jobService.getJobs(params);
      setJobs(res.data || []);
      if (!statusFilter && !departmentFilter && !search.trim()) {
        setDepartments(Array.from(new Set((res.data || []).map((j) => j.department))).filter(Boolean).sort());
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch job openings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, departmentFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  const runAction = async () => {
    if (!pending) return;
    const { job, action } = pending;
    try {
      setBusy(true);
      setError('');
      if (action === 'publish') {
        await jobService.publishJob(job.id);
        setFeedback(`"${job.title}" is now published and accepting applications.`);
      } else {
        await jobService.closeJob(job.id);
        setFeedback(`"${job.title}" has been closed. New applications are blocked.`);
      }
      setPending(null);
      await fetchJobs();
    } catch (err) {
      setPending(null);
      setFeedback('');
      setError(getErrorMessage(err, `Failed to ${action} job.`));
    } finally {
      setBusy(false);
    }
  };

  const today = dateInputValue(0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Openings</h1>
          <p className="page-subtitle">Create requisitions, publish them to candidates, and close them when filled</p>
        </div>
        <Link to="/jobs/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-1"></i> New Job Opening
        </Link>
      </div>

      <Notice message={feedback} onClose={() => setFeedback('')} />
      {error && <ErrorMessage message={error} onRetry={fetchJobs} />}

      <div className="card-rf filter-bar mb-4">
        <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input
                type="search"
                className="form-control"
                placeholder="Search title, skills, or description"
                aria-label="Search jobs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-6 col-md-3">
            <select className="form-select" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <select className="form-select" aria-label="Filter by department" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-1">
            <button type="submit" className="btn btn-outline-primary w-100">Search</button>
          </div>
        </form>
      </div>

      {loading ? (
        <Loading message="Loading job openings..." />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="bi-briefcase"
          title="No job openings found"
          message="Adjust your filters or create a new job opening."
          action={<Link to="/jobs/new" className="btn btn-sm btn-primary">Create job</Link>}
        />
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Deadline</th>
                  <th className="text-center">Applicants</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const deadlinePassed = job.deadline && job.deadline < today;
                  return (
                    <tr key={job.id}>
                      <td>
                        <Link to={`/jobs/${job.id}`} className="fw-semibold text-dark text-decoration-none">
                          {job.title}
                        </Link>
                        <div className="small text-muted text-truncate" style={{ maxWidth: '280px' }}>{job.employment_type}</div>
                      </td>
                      <td><span className="chip">{job.department}</span></td>
                      <td className="small text-secondary"><i className="bi bi-geo-alt me-1"></i>{job.location}</td>
                      <td className="small">
                        <span className={deadlinePassed && job.status === 'PUBLISHED' ? 'text-danger fw-semibold' : 'text-secondary'}>
                          {formatDate(job.deadline)}
                        </span>
                        {deadlinePassed && job.status === 'PUBLISHED' && <div className="small text-danger">Deadline passed</div>}
                      </td>
                      <td className="text-center">
                        <Link to={`/applications?job_id=${job.id}`} className="text-decoration-none fw-semibold">
                          {job.application_count ?? 0}
                        </Link>
                      </td>
                      <td><StatusBadge status={job.status} /></td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-1">
                          <Link to={`/jobs/${job.id}`} className="btn btn-sm btn-light border" title="View details" aria-label={`View ${job.title}`}>
                            <i className="bi bi-eye"></i>
                          </Link>
                          {job.status !== 'CLOSED' && (
                            <Link to={`/jobs/${job.id}/edit`} className="btn btn-sm btn-light border" title="Edit" aria-label={`Edit ${job.title}`}>
                              <i className="bi bi-pencil"></i>
                            </Link>
                          )}
                          {job.status === 'DRAFT' && (
                            <button type="button" className="btn btn-sm btn-success" onClick={() => setPending({ job, action: 'publish' })}>
                              Publish
                            </button>
                          )}
                          {job.status === 'PUBLISHED' && (
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setPending({ job, action: 'close' })}>
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pending)}
        title={pending?.action === 'publish' ? 'Publish job opening?' : 'Close job opening?'}
        message={
          pending?.action === 'publish'
            ? `"${pending?.job.title}" will be visible to candidates and open for applications until ${formatDate(pending?.job.deadline)}.`
            : `"${pending?.job.title}" will stop accepting applications. Closed jobs cannot be republished.`
        }
        confirmLabel={pending?.action === 'publish' ? 'Publish' : 'Close job'}
        variant={pending?.action === 'publish' ? 'success' : 'danger'}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

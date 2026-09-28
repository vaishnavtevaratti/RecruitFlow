/**
 * RecruitFlow — Jobs Management Page
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jobService } from '../services/jobService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { formatDate } from '../utils/formatters';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department = departmentFilter;

      const res = await jobService.getJobs(params);
      if (res.success && res.data) {
        setJobs(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch job requisitions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, departmentFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  const handlePublish = async (id, title) => {
    if (!window.confirm(`Are you sure you want to publish "${title}"? It will become open for public applications.`)) {
      return;
    }
    try {
      setError('');
      const res = await jobService.publishJob(id);
      if (res.success) {
        setFeedback(`Job "${title}" published successfully.`);
        fetchJobs();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish job.');
    }
  };

  const handleClose = async (id, title) => {
    if (!window.confirm(`Are you sure you want to close "${title}"? No further applications will be accepted.`)) {
      return;
    }
    try {
      setError('');
      const res = await jobService.closeJob(id);
      if (res.success) {
        setFeedback(`Job "${title}" closed successfully.`);
        fetchJobs();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close job.');
    }
  };

  // Get distinct departments from existing jobs for filter dropdown
  const departments = Array.from(new Set(jobs.map((j) => j.department))).filter(Boolean);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Openings</h1>
          <p className="page-subtitle">Manage open positions, draft requisitions, and recruitment lifecycle states</p>
        </div>
        <Link to="/jobs/new" className="btn btn-primary d-flex align-items-center gap-2">
          <i className="bi bi-plus-lg"></i>
          <span>Create New Requisition</span>
        </Link>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show rounded-3 shadow-sm" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button type="button" className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetchJobs} />}

      {/* Filter and Search Bar */}
      <div className="card-rf p-3 mb-4">
        <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by title or required skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="form-select"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-1">
            <button type="submit" className="btn btn-outline-primary w-100">
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Jobs Table */}
      {loading ? (
        <Loading message="Loading job requisitions..." />
      ) : jobs.length === 0 ? (
        <div className="card-rf p-5 text-center text-muted">
          <i className="bi bi-briefcase fs-1 text-secondary mb-2 d-block"></i>
          <h5>No job openings found</h5>
          <p className="small mb-3">Adjust your search criteria or create a new job opening.</p>
          <Link to="/jobs/new" className="btn btn-sm btn-primary">Create Job</Link>
        </div>
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Job Title & Requisition</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link to={`/jobs/${job.id}`} className="fw-bold text-dark text-decoration-none">
                        {job.title}
                      </Link>
                      <div className="small text-muted text-truncate" style={{ maxWidth: '280px' }}>
                        {job.skills}
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{job.department}</span>
                    </td>
                    <td>
                      <small className="text-secondary">
                        <i className="bi bi-geo-alt me-1"></i>{job.location}
                      </small>
                    </td>
                    <td>
                      <small className="text-secondary">{job.employment_type}</small>
                    </td>
                    <td>
                      <small className="text-secondary">{formatDate(job.deadline)}</small>
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link to={`/jobs/${job.id}`} className="btn btn-outline-secondary" title="View Details">
                          <i className="bi bi-eye"></i>
                        </Link>
                        {job.status !== 'CLOSED' && (
                          <Link to={`/jobs/${job.id}/edit`} className="btn btn-outline-secondary" title="Edit Job">
                            <i className="bi bi-pencil"></i>
                          </Link>
                        )}
                        {job.status === 'DRAFT' && (
                          <button
                            className="btn btn-outline-success"
                            onClick={() => handlePublish(job.id, job.title)}
                            title="Publish Job"
                          >
                            <i className="bi bi-cloud-upload"></i> Publish
                          </button>
                        )}
                        {job.status === 'PUBLISHED' && (
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => handleClose(job.id, job.title)}
                            title="Close Requisition"
                          >
                            <i className="bi bi-lock"></i> Close
                          </button>
                        )}
                      </div>
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

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
import { formatDate } from '../utils/formatters';

export default function Applications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const jobIdParam = searchParams.get('job_id') || '';
  const statusParam = searchParams.get('status') || '';
  const searchParam = searchParams.get('search') || '';

  const [search, setSearch] = useState(searchParam);
  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [jobFilter, setJobFilter] = useState(jobIdParam);

  const fetchJobs = async () => {
    try {
      const res = await jobService.getJobs();
      if (res.success && res.data) {
        setJobs(res.data);
      }
    } catch {
      // Non-critical if jobs list fails
    }
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
      if (res.success && res.data) {
        setApplications(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch candidate applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, jobFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchApplications();
  };

  const handleQuickScreen = async (id, name) => {
    try {
      setError('');
      await applicationService.screenApplication(id);
      setFeedback(`Application for ${name} moved to SCREENING.`);
      fetchApplications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to screen candidate.');
    }
  };

  const handleQuickShortlist = async (id, name) => {
    try {
      setError('');
      await applicationService.shortlistApplication(id);
      setFeedback(`Candidate ${name} SHORTLISTED successfully.`);
      fetchApplications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to shortlist candidate.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Application Pipeline</h1>
          <p className="page-subtitle">Track candidate progression from initial screening to final hire</p>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show rounded-3 shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button type="button" className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetchApplications} />}

      {/* Filter and Search Bar */}
      <div className="card-rf p-3 mb-4">
        <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
          <div className="col-12 col-md-4">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by candidate or job..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="form-select"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
            >
              <option value="">All Requisitions</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Pipeline Stages</option>
              <option value="APPLIED">APPLIED</option>
              <option value="SCREENING">SCREENING</option>
              <option value="SHORTLISTED">SHORTLISTED</option>
              <option value="INTERVIEW_SCHEDULED">INTERVIEW_SCHEDULED</option>
              <option value="INTERVIEWED">INTERVIEWED</option>
              <option value="SELECTED">SELECTED</option>
              <option value="OFFER_SENT">OFFER_SENT</option>
              <option value="OFFER_ACCEPTED">OFFER_ACCEPTED</option>
              <option value="HIRED">HIRED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div className="col-12 col-md-2">
            <button type="submit" className="btn btn-primary w-100">
              Filter Pipeline
            </button>
          </div>
        </form>
      </div>

      {/* Applications Table */}
      {loading ? (
        <Loading message="Loading applications..." />
      ) : applications.length === 0 ? (
        <div className="card-rf p-5 text-center text-muted">
          <i className="bi bi-inbox fs-1 text-secondary mb-2 d-block"></i>
          <h5>No applications found</h5>
          <p className="small">No candidate applications match the selected pipeline criteria.</p>
        </div>
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job Requisition</th>
                  <th>Applied On</th>
                  <th>Pipeline Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <Link to={`/applications/${app.id}`} className="fw-bold text-dark text-decoration-none">
                        {app.candidate_name}
                      </Link>
                      <div className="small text-muted">{app.candidate_email}</div>
                    </td>
                    <td>
                      <Link to={`/jobs/${app.job_id}`} className="text-secondary text-decoration-none">
                        {app.job_title}
                      </Link>
                      <div className="small text-muted">{app.job_department}</div>
                    </td>
                    <td>
                      <small className="text-secondary">{formatDate(app.applied_at)}</small>
                    </td>
                    <td>
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link to={`/applications/${app.id}`} className="btn btn-outline-primary" title="View Pipeline">
                          Manage Stage <i className="bi bi-arrow-right"></i>
                        </Link>
                        {app.status === 'APPLIED' && (
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => handleQuickScreen(app.id, app.candidate_name)}
                            title="Screen Candidate"
                          >
                            Screen
                          </button>
                        )}
                        {app.status === 'SCREENING' && (
                          <button
                            className="btn btn-outline-success"
                            onClick={() => handleQuickShortlist(app.id, app.candidate_name)}
                            title="Shortlist Candidate"
                          >
                            Shortlist
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

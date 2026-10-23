/**
 * RecruitFlow — Public Careers Portal
 * Publicly viewable job board displaying actively PUBLISHED requisitions.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jobService } from '../services/jobService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { formatDate, formatSalaryRange, getErrorMessage, splitSkills } from '../utils/formatters';

export default function PublicJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      // skipAuth: true so no Bearer token is attached
      const res = await jobService.getJobs(params, true);
      if (res.success && res.data) {
        setJobs(res.data);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch open positions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  return (
    <div className="public-shell">
      {/* Public Header */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark py-3 px-4 shadow-sm">
        <div className="container">
          <Link to="/jobs/public" className="navbar-brand fw-bold d-flex align-items-center gap-2">
            <span className="badge bg-primary p-2 rounded-3">
              <i className="bi bi-diagram-3-fill"></i>
            </span>
            <span>RecruitFlow Careers</span>
          </Link>
          <div className="d-flex align-items-center gap-2">
            <Link to="/application-status" className="btn btn-outline-light btn-sm">
              <i className="bi bi-search me-1"></i> Check Status
            </Link>
            <Link to="/candidate/login" className="btn btn-primary btn-sm">
              <i className="bi bi-person me-1"></i> Candidate Sign In
            </Link>
            <Link to="/login" className="btn btn-outline-light btn-sm d-none d-sm-inline-block">
              Staff
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Banner */}
      <section className="public-hero">
        <div className="container">
          <h1 className="display-5 fw-bold mb-3">Build Your Career With Us</h1>
          <p className="lead text-light opacity-75 mb-4" style={{ maxWidth: '650px', margin: '0 auto' }}>
            Explore current career opportunities. Join an innovative, high-impact team building modern enterprise software.
          </p>
          <div className="row justify-content-center">
            <div className="col-12 col-md-8 col-lg-6">
              <form onSubmit={handleSearch} className="input-group input-group-lg shadow">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by title or technical skills..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className="btn btn-primary px-4 fw-semibold" type="submit">
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Job Listings */}
      <div className="container py-5">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h4 className="fw-bold text-dark mb-0">Open Positions ({jobs.length})</h4>
          <span className="text-muted small">Updated in real-time</span>
        </div>

        {error && <ErrorMessage message={error} onRetry={fetchJobs} />}

        {loading ? (
          <Loading message="Loading current career openings..." />
        ) : jobs.length === 0 ? (
          <div className="card-rf p-5 text-center text-muted">
            <i className="bi bi-briefcase fs-1 text-secondary mb-2 d-block"></i>
            <h5>No open positions matching your search</h5>
            <p className="small mb-0">Please check back soon for new requisitions.</p>
          </div>
        ) : (
          <div className="row g-4">
            {jobs.map((job) => (
              <div key={job.id} className="col-12 col-md-6">
                <div className="card-rf p-4 h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="fw-bold text-dark mb-1">{job.title}</h5>
                      <span className="badge bg-light text-primary border">{job.department}</span>
                    </div>

                    <div className="d-flex flex-wrap gap-3 text-muted small mb-3">
                      <span><i className="bi bi-geo-alt me-1"></i>{job.location}</span>
                      <span><i className="bi bi-clock me-1"></i>{job.employment_type}</span>
                      <span><i className="bi bi-cash-stack me-1"></i>{formatSalaryRange(job.salary_min, job.salary_max)}</span>
                    </div>

                    <p className="text-secondary small mb-3" style={{ lineHeight: '1.6' }}>
                      {job.description.length > 200 ? `${job.description.slice(0, 200)}...` : job.description}
                    </p>

                    <div className="d-flex flex-wrap gap-1 mb-4">
                      {splitSkills(job.skills).map((s) => (
                        <span key={s} className="chip">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="border-top pt-3 d-flex justify-content-between align-items-center">
                    <small className="text-muted">
                      Deadline: <span className="fw-semibold text-danger">{formatDate(job.deadline)}</span>
                    </small>
                    <Link to={`/jobs/${job.id}/apply`} className="btn btn-primary btn-sm px-3 fw-semibold">
                      Apply Now <i className="bi bi-arrow-right ms-1"></i>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="text-center py-4 text-muted border-top bg-white mt-5 small">
        &copy; {new Date().getFullYear()} RecruitFlow — Recruitment Management System
      </footer>
    </div>
  );
}

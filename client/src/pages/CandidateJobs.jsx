/**
 * RecruitFlow — Candidate Job Board
 * Browse published jobs within the candidate portal and apply with one click.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jobService } from '../services/jobService';
import Loading from '../components/Loading';

export default function CandidateJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    fetchJobs();
  }, [department]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (department) params.department = department;

      const res = await jobService.getJobs(params, true);
      if (res.success && res.data) {
        setJobs(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch job openings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  if (loading) {
    return <Loading message="Loading available positions..." />;
  }

  const departments = Array.from(new Set(jobs.map((j) => j.department))).filter(Boolean);

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">Explore Open Positions</h2>
          <p className="text-muted small mb-0">Browse and apply to active career opportunities at RecruitFlow</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <div>{error}</div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card shadow-sm border-0 mb-4 p-3">
        <form onSubmit={handleSearch} className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-light text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search job title, skills, or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-8 col-md-4">
            <select
              className="form-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="col-4 col-md-2">
            <button type="submit" className="btn btn-primary w-100">
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Job Cards Grid */}
      {jobs.length === 0 ? (
        <div className="card shadow-sm border-0 text-center py-5">
          <i className="bi bi-briefcase text-muted fs-1 mb-3"></i>
          <h5 className="fw-bold">No Open Positions Matching Criteria</h5>
          <p className="text-muted small">Try adjusting your search filters or check back soon.</p>
        </div>
      ) : (
        <div className="row g-4">
          {jobs.map((job) => (
            <div key={job.id} className="col-12 col-lg-6">
              <div className="card shadow-sm border-0 h-100 p-4 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="fw-bold mb-0 text-dark">{job.title}</h5>
                    <span className="badge bg-primary-subtle text-primary fw-semibold">{job.department}</span>
                  </div>

                  <div className="d-flex flex-wrap gap-3 text-muted small mb-3">
                    <span>
                      <i className="bi bi-geo-alt me-1"></i> {job.location}
                    </span>
                    <span>
                      <i className="bi bi-clock me-1"></i> {job.employment_type}
                    </span>
                    {job.salary_min && job.salary_max && (
                      <span className="text-success fw-semibold">
                        <i className="bi bi-cash-stack me-1"></i>
                        ${Number(job.salary_min).toLocaleString()} - ${Number(job.salary_max).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <p className="text-secondary small mb-3 line-clamp-3" style={{ maxHeight: '4.5rem', overflow: 'hidden' }}>
                    {job.description}
                  </p>

                  <div className="d-flex flex-wrap gap-1 mb-3">
                    {job.skills?.split(',').map((skill, idx) => (
                      <span key={idx} className="badge bg-light text-secondary border">
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-auto">
                  <span className="text-muted small">
                    Deadline: {new Date(job.deadline).toLocaleDateString()}
                  </span>
                  <Link
                    to={`/jobs/${job.id}/apply`}
                    className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 shadow-sm px-3"
                  >
                    <span>Apply Now</span>
                    <i className="bi bi-arrow-right"></i>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

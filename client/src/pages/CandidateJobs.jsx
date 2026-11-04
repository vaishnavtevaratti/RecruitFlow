/**
 * RecruitFlow — Candidate Job Board
 * Lists published jobs that are still open, and marks jobs the candidate already applied to.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jobService } from '../services/jobService';
import { candidatePortalService } from '../services/candidatePortalService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import Pagination, { paginate } from '../components/Pagination';
import { formatDate, formatSalaryRange, getErrorMessage, splitSkills } from '../utils/formatters';

export default function CandidateJobs() {
  const [jobs, setJobs] = useState([]);
  const [appliedByJob, setAppliedByJob] = useState({});
  const [options, setOptions] = useState({ department: [], location: [], employment_type: [], skill: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ department: '', location: '', employment_type: '', skill: '' });
  const [page, setPage] = useState(1);
  const unique = (values) => Array.from(new Set(values)).filter(Boolean).sort();

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      for (const key of ['department', 'location', 'employment_type']) if (filters[key]) params[key] = filters[key];

      const [jobsRes, appsRes] = await Promise.all([
        jobService.getJobs(params, true),
        candidatePortalService.getApplications()
      ]);
      const list = jobsRes.data || [];
      setJobs(list);
      setPage(1);
      if (!search.trim() && !filters.department && !filters.location && !filters.employment_type) {
        setOptions({
          department: unique(list.map((j) => j.department)),
          location: unique(list.map((j) => j.location)),
          employment_type: unique(list.map((j) => j.employment_type)),
          skill: unique(list.flatMap((j) => splitSkills(j.skills)))
        });
      }
      const map = {};
      for (const a of appsRes.data || []) map[a.job_id] = a;
      setAppliedByJob(map);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch job openings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department, filters.location, filters.employment_type]);

  // Skill filter runs client-side on the already-fetched open jobs
  const matching = filters.skill
    ? jobs.filter((j) => splitSkills(j.skills).some((s) => s.toLowerCase() === filters.skill.toLowerCase()))
    : jobs;
  const setFilter = (key) => (e) => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Browse Jobs</h1>
          <p className="page-subtitle">Open positions currently accepting applications</p>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchJobs} />}

      <div className="card-rf filter-bar mb-4">
        <form onSubmit={handleSearch} className="row g-2 align-items-center">
          <div className="col-12 col-lg-4">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input type="search" className="form-control" placeholder="Search title, skills, or keywords" aria-label="Search jobs" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {[
            ['department', 'All departments'],
            ['location', 'All locations'],
            ['employment_type', 'All job types'],
            ['skill', 'Any skill']
          ].map(([key, label]) => (
            <div key={key} className="col-6 col-md-3 col-lg-2">
              <select className="form-select" aria-label={label} value={filters[key]} onChange={setFilter(key)}>
                <option value="">{label}</option>
                {options[key].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
          <div className="col-12 col-md-12 col-lg-auto flex-lg-grow-1">
            <button type="submit" className="btn btn-primary w-100">Search</button>
          </div>
        </form>
      </div>

      {loading ? (
        <Loading message="Loading open positions..." />
      ) : matching.length === 0 ? (
        <EmptyState icon="bi-briefcase" title="No open positions match" message="Try different keywords or check back soon." />
      ) : (
        <div className="row g-4">
          {paginate(matching, page).map((job) => {
            const applied = appliedByJob[job.id];
            return (
              <div key={job.id} className="col-12 col-xl-6">
                <article className="card-rf job-card h-100">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <h2 className="h5 fw-semibold mb-0">{job.title}</h2>
                    <span className="chip chip-primary">{job.department}</span>
                  </div>
                  <div className="d-flex flex-wrap gap-3 text-muted small mb-3">
                    <span><i className="bi bi-geo-alt me-1"></i>{job.location}</span>
                    <span><i className="bi bi-clock me-1"></i>{job.employment_type}</span>
                    <span><i className="bi bi-briefcase me-1"></i>{job.experience_required}</span>
                    <span className="text-success fw-medium"><i className="bi bi-cash-stack me-1"></i>{formatSalaryRange(job.salary_min, job.salary_max)}</span>
                  </div>
                  <p className="text-secondary small mb-3 line-clamp-3">{job.description}</p>
                  <div className="d-flex flex-wrap gap-1 mb-3">
                    {splitSkills(job.skills).map((s) => <span key={s} className="chip">{s}</span>)}
                  </div>
                  <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-auto">
                    <span className="text-muted small">Apply by {formatDate(job.deadline)}</span>
                    {applied ? (
                      <Link to={`/candidate/applications/${applied.id}`} className="btn btn-sm btn-light border">
                        <i className="bi bi-check2 me-1 text-success"></i> Applied · View
                      </Link>
                    ) : (
                      <Link to={`/candidate/jobs/${job.id}/apply`} className="btn btn-sm btn-primary">
                        View & apply <i className="bi bi-arrow-right"></i>
                      </Link>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
          <div className="col-12">
            <Pagination page={page} total={matching.length} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}

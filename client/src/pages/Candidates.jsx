/**
 * RecruitFlow — Candidates Directory Page
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { candidateService } from '../services/candidateService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import Pagination, { paginate } from '../components/Pagination';
import { formatDate, getErrorMessage } from '../utils/formatters';

export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await candidateService.getCandidates(params);
      if (res.success && res.data) {
        setCandidates(res.data);
      setPage(1);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch candidate profiles.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCandidates();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidate Talent Pool</h1>
          <p className="page-subtitle">Unified repository of candidate profiles and qualifications</p>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchCandidates} />}

      {/* Search Bar */}
      <div className="card-rf filter-bar mb-4">
        <form onSubmit={handleSearch} className="row g-2 align-items-center">
          <div className="col-12 col-md-10">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search candidates by name, email, or core skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-12 col-md-2">
            <button type="submit" className="btn btn-primary w-100">
              Search
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <Loading message="Loading candidate profiles..." />
      ) : candidates.length === 0 ? (
        <EmptyState icon="bi-people" title="No candidates found" message="Candidate profiles appear here when people apply or register." />
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Contact Info</th>
                  <th>Education</th>
                  <th>Experience</th>
                  <th>Skills</th>
                  <th className="text-center">Applications</th>
                  <th>Registered</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(candidates, page).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/candidates/${c.id}`} className="fw-bold text-dark text-decoration-none">
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <div><i className="bi bi-envelope me-1 text-muted"></i>{c.email}</div>
                      <small className="text-muted"><i className="bi bi-telephone me-1"></i>{c.phone}</small>
                    </td>
                    <td>
                      <small>{c.education}</small>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{c.experience}</span>
                    </td>
                    <td>
                      <div className="small text-muted text-truncate" style={{ maxWidth: '250px' }}>
                        {c.skills}
                      </div>
                    </td>
                    <td className="text-center fw-semibold">{c.application_count ?? 0}</td>
                    <td>
                      <small className="text-secondary">{formatDate(c.created_at)}</small>
                    </td>
                    <td className="text-end">
                      <Link to={`/candidates/${c.id}`} className="btn btn-sm btn-outline-secondary">
                        <i className="bi bi-eye me-1"></i> View Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={candidates.length} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

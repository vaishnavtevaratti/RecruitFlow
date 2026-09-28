/**
 * RecruitFlow — Candidate Profile Details Page
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { candidateService } from '../services/candidateService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { formatDate } from '../utils/formatters';

export default function CandidateDetails() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCandidate = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await candidateService.getCandidateById(id);
        if (res.success && res.data) {
          setCandidate(res.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch candidate details.');
      } finally {
        setLoading(false);
      }
    };
    fetchCandidate();
  }, [id]);

  if (loading) return <Loading message="Loading candidate profile..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!candidate) return null;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="page-title">{candidate.name}</h1>
          <p className="page-subtitle">Candidate Profile #{candidate.id} &bull; Registered on {formatDate(candidate.created_at)}</p>
        </div>
        <Link to="/candidates" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-1"></i> Back to Candidates
        </Link>
      </div>

      <div className="row g-4">
        <div className="col-12 col-md-4">
          <div className="card-rf p-4 text-center">
            <div
              className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 fw-bold fs-2"
              style={{ width: '80px', height: '80px' }}
            >
              {candidate.name.charAt(0).toUpperCase()}
            </div>
            <h4 className="fw-bold mb-1">{candidate.name}</h4>
            <p className="text-muted small mb-3">{candidate.email}</p>

            <div className="text-start border-top pt-3">
              <div className="mb-2">
                <small className="text-muted d-block">Phone Number</small>
                <span className="fw-medium">{candidate.phone}</span>
              </div>
              <div className="mb-2">
                <small className="text-muted d-block">Total Experience</small>
                <span className="fw-medium">{candidate.experience}</span>
              </div>
              <div className="mb-2">
                <small className="text-muted d-block">Highest Education</small>
                <span className="fw-medium">{candidate.education}</span>
              </div>
            </div>

            {candidate.resume_url && (
              <a
                href={candidate.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-primary btn-sm w-100 mt-3"
              >
                <i className="bi bi-file-earmark-pdf me-1"></i> View Resume
              </a>
            )}
          </div>
        </div>

        <div className="col-12 col-md-8">
          <div className="card-rf p-4 mb-4">
            <h5 className="fw-bold mb-3 border-bottom pb-2">Skills & Technical Proficiencies</h5>
            <div className="d-flex flex-wrap gap-2 mb-4">
              {candidate.skills.split(',').map((skill, idx) => (
                <span key={idx} className="badge bg-light text-primary border px-3 py-2 fs-6">
                  {skill.trim()}
                </span>
              ))}
            </div>

            <h5 className="fw-bold mb-3 border-bottom pb-2">Recruitment Pipeline Actions</h5>
            <p className="text-muted small">
              View this candidate's applications and progression across all job requisitions:
            </p>
            <Link to={`/applications?search=${encodeURIComponent(candidate.email)}`} className="btn btn-outline-primary">
              <i className="bi bi-folder2-open me-1"></i> View Candidate's Applications
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

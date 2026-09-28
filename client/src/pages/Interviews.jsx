/**
 * RecruitFlow — Interviews Management Page
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { interviewService } from '../services/interviewService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import { formatDateTime } from '../utils/formatters';

export default function Interviews() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Evaluation modal state
  const [isEvaluateOpen, setIsEvaluateOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [evaluateForm, setEvaluateForm] = useState({
    technical_rating: 8,
    communication_rating: 8,
    problem_solving_rating: 8,
    overall_rating: 8,
    feedback: '',
    result: 'PASS'
  });

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await interviewService.getInterviews();
      if (res.success && res.data) {
        setInterviews(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch interview rounds.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleOpenEvaluate = (interview) => {
    setSelectedInterview(interview);
    setEvaluateForm({
      technical_rating: interview.technical_rating || 8,
      communication_rating: interview.communication_rating || 8,
      problem_solving_rating: interview.problem_solving_rating || 8,
      overall_rating: interview.overall_rating || 8,
      feedback: interview.feedback || '',
      result: interview.result === 'PENDING' ? 'PASS' : interview.result
    });
    setIsEvaluateOpen(true);
  };

  const handleEvaluateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInterview) return;

    try {
      setSubmitting(true);
      setError('');
      const res = await interviewService.evaluateInterview(selectedInterview.id, evaluateForm);
      if (res.success) {
        setFeedback(`Evaluation for round "${selectedInterview.type}" recorded successfully.`);
        setIsEvaluateOpen(false);
        fetchInterviews();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit interview evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Interviews & Evaluations</h1>
          <p className="page-subtitle">Schedule rounds, record multi-criteria scores, and assess candidates</p>
        </div>
        <Link to="/applications?status=SHORTLISTED" className="btn btn-primary d-flex align-items-center gap-2">
          <i className="bi bi-calendar-plus"></i>
          <span>Schedule New Round</span>
        </Link>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show rounded-3 shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button type="button" className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetchInterviews} />}

      {loading ? (
        <Loading message="Loading interview rounds..." />
      ) : interviews.length === 0 ? (
        <div className="card-rf p-5 text-center text-muted">
          <i className="bi bi-calendar-event fs-1 text-secondary mb-2 d-block"></i>
          <h5>No interviews scheduled</h5>
          <p className="small">Shortlist candidates in the application pipeline to schedule evaluation rounds.</p>
          <Link to="/applications?status=SHORTLISTED" className="btn btn-sm btn-primary">
            View Shortlisted Candidates
          </Link>
        </div>
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Requisition & Round</th>
                  <th>Interviewer</th>
                  <th>Scheduled Time</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((iv) => (
                  <tr key={iv.id}>
                    <td>
                      <Link to={`/applications/${iv.application_id}`} className="fw-bold text-dark text-decoration-none">
                        {iv.candidate_name}
                      </Link>
                      <div className="small text-muted">{iv.candidate_email}</div>
                    </td>
                    <td>
                      <div className="fw-medium">{iv.type}</div>
                      <small className="text-secondary">{iv.job_title}</small>
                    </td>
                    <td>
                      <small className="text-secondary">
                        <i className="bi bi-person me-1"></i>{iv.interviewer_name}
                      </small>
                    </td>
                    <td>
                      <small className="text-secondary">{formatDateTime(iv.scheduled_at)}</small>
                    </td>
                    <td>
                      {iv.overall_rating ? (
                        <span className="badge bg-light text-primary border fw-bold fs-6">
                          {iv.overall_rating}/10
                        </span>
                      ) : (
                        <span className="text-muted small">Not rated</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={iv.result} />
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link to={`/applications/${iv.application_id}`} className="btn btn-outline-secondary" title="View Application">
                          <i className="bi bi-eye"></i>
                        </Link>
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => handleOpenEvaluate(iv)}
                          title="Evaluate Round"
                        >
                          <i className="bi bi-pencil-square me-1"></i>
                          {iv.result === 'PENDING' ? 'Evaluate' : 'Update'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evaluation Modal */}
      <Modal
        title={`Evaluate Interview — ${selectedInterview?.candidate_name || ''}`}
        isOpen={isEvaluateOpen}
        onClose={() => setIsEvaluateOpen(false)}
      >
        <form onSubmit={handleEvaluateSubmit}>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Technical Proficiency (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-control"
                value={evaluateForm.technical_rating}
                onChange={(e) => setEvaluateForm({ ...evaluateForm, technical_rating: Number(e.target.value) })}
                required
              />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Communication (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-control"
                value={evaluateForm.communication_rating}
                onChange={(e) => setEvaluateForm({ ...evaluateForm, communication_rating: Number(e.target.value) })}
                required
              />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Problem Solving (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-control"
                value={evaluateForm.problem_solving_rating}
                onChange={(e) => setEvaluateForm({ ...evaluateForm, problem_solving_rating: Number(e.target.value) })}
                required
              />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Overall Rating (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-control"
                value={evaluateForm.overall_rating}
                onChange={(e) => setEvaluateForm({ ...evaluateForm, overall_rating: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold">Feedback & Notes</label>
            <textarea
              className="form-control"
              rows="3"
              value={evaluateForm.feedback}
              onChange={(e) => setEvaluateForm({ ...evaluateForm, feedback: e.target.value })}
              placeholder="Candidate feedback and recommendations..."
              required
            ></textarea>
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold">Outcome Recommendation</label>
            <select
              className="form-select"
              value={evaluateForm.result}
              onChange={(e) => setEvaluateForm({ ...evaluateForm, result: e.target.value })}
            >
              <option value="PASS">PASS — Recommend for Selection</option>
              <option value="FAIL">FAIL — Do Not Recommend</option>
            </select>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsEvaluateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Save Evaluation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

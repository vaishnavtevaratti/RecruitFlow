/**
 * RecruitFlow — Interviews Page
 * HR/Admin see every round; interviewers see only rounds assigned to them (server-enforced).
 * Evaluations and rescheduling happen on the application page so they always act on
 * the latest persisted state.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { interviewService } from '../services/interviewService';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import { formatDateTime, getErrorMessage } from '../utils/formatters';

const TABS = [
  { key: 'pending', label: 'Awaiting evaluation' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' }
];

export default function Interviews() {
  const { isHR } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('pending');

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await interviewService.getInterviews();
      setInterviews(res.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch interviews.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'pending') return interviews.filter((iv) => iv.result === 'PENDING');
    if (tab === 'completed') return interviews.filter((iv) => iv.result !== 'PENDING');
    return interviews;
  }, [interviews, tab]);

  const now = new Date();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isHR ? 'Interviews' : 'My Interviews'}</h1>
          <p className="page-subtitle">
            {isHR ? 'Scheduled rounds, evaluations, and outcomes' : 'Interviews assigned to you. Open one to record your evaluation.'}
          </p>
        </div>
        {isHR && (
          <Link to="/applications?status=SHORTLISTED" className="btn btn-primary">
            <i className="bi bi-calendar-plus me-1" aria-hidden="true"></i> Schedule from shortlist
          </Link>
        )}
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchInterviews} />}

      <div className="stage-tabs mb-3" role="tablist" aria-label="Filter interviews">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`stage-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            <span className="stage-tab-count">
              {t.key === 'pending'
                ? interviews.filter((iv) => iv.result === 'PENDING').length
                : t.key === 'completed'
                ? interviews.filter((iv) => iv.result !== 'PENDING').length
                : interviews.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading message="Loading interviews..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="bi-calendar-event"
          title="No interviews here"
          message={isHR ? 'Shortlist candidates in the pipeline to schedule interviews.' : 'You have no interviews in this view.'}
        />
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Round</th>
                  <th>Interviewer</th>
                  <th>When</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((iv) => {
                  const overdue = iv.result === 'PENDING' && new Date(iv.scheduled_at) < now;
                  const canEvaluate = iv.result === 'PENDING' && iv.application_status === 'INTERVIEW_SCHEDULED';
                  return (
                    <tr key={iv.id}>
                      <td>
                        <div className="fw-semibold">{iv.candidate_name}</div>
                        <div className="small text-muted">{iv.job_title}</div>
                      </td>
                      <td>{iv.type}</td>
                      <td className="small text-secondary">{iv.interviewer_name}</td>
                      <td className="small">
                        {formatDateTime(iv.scheduled_at)}
                        {overdue && <div className="small text-warning fw-semibold">Evaluation due</div>}
                      </td>
                      <td>{iv.overall_rating ? <span className="fw-semibold">{iv.overall_rating}/10</span> : <span className="text-muted small">—</span>}</td>
                      <td><StatusBadge status={iv.result} /></td>
                      <td className="text-end">
                        <Link to={`/applications/${iv.application_id}`} className={`btn btn-sm ${canEvaluate ? 'btn-primary' : 'btn-light border'}`}>
                          {canEvaluate ? 'Evaluate' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

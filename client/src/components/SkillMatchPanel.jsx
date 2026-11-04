/**
 * RecruitFlow — Skill Match Panel (HR only)
 * Shows the rule-based job/candidate skill comparison from the server.
 * Advisory only: nothing here changes the application's status.
 */

import React, { useState } from 'react';
import api from '../services/api';
import { getErrorMessage } from '../utils/formatters';

export default function SkillMatchPanel({ applicationId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);

  const analyse = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/applications/${applicationId}/skill-match`);
      setResult(res.data.data);
      setHidden(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Skill match could not be computed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-rf p-4 mb-4">
      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-2">
        <div>
          <h2 className="section-title mb-1">Skill match <span className="chip ms-1">Rule-based · advisory</span></h2>
          <p className="text-muted small mb-0">Compares the job's required skills with the candidate's profile. HR makes every decision.</p>
        </div>
        {result && !hidden ? (
          <button type="button" className="btn btn-sm btn-light border" onClick={() => setHidden(true)}>Hide</button>
        ) : (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={analyse} disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> : <i className="bi bi-bar-chart me-1" aria-hidden="true"></i>}
            Analyse skills
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger small mb-0 mt-2">{error}</div>}

      {result && !hidden && (
        <div className="mt-3">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="match-score" aria-label={`Skill overlap ${result.score ?? 'not available'} percent`}>
              {result.score === null ? '—' : `${result.score}%`}
            </div>
            <div className="small">{result.summary}</div>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <div className="field-label mb-1">Found in profile ({result.matched.length})</div>
              {result.matched.length === 0 && <div className="small text-muted">None</div>}
              <ul className="list-unstyled small mb-0">
                {result.matched.map((m) => (
                  <li key={m.skill} className="mb-1">
                    <i className="bi bi-check-circle-fill text-success me-1" aria-hidden="true"></i>
                    <strong>{m.skill}</strong> <span className="text-muted">— {m.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-md-6">
              <div className="field-label mb-1">Not mentioned / unverified ({result.notMentioned.length})</div>
              {result.notMentioned.length === 0 && <div className="small text-muted">None</div>}
              <ul className="list-unstyled small mb-0">
                {result.notMentioned.map((m) => (
                  <li key={m.skill} className="mb-1">
                    <i className="bi bi-question-circle text-warning me-1" aria-hidden="true"></i>
                    <strong>{m.skill}</strong> <span className="text-muted">— not mentioned (may still have it)</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {result.additionalSkills.length > 0 && (
            <div className="mt-3">
              <div className="field-label mb-1">Other skills listed by candidate</div>
              <div className="d-flex flex-wrap gap-1">
                {result.additionalSkills.map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
            </div>
          )}

          {result.suggestedQuestions.length > 0 && (
            <div className="mt-3">
              <div className="field-label mb-1">Suggested interview questions</div>
              <ol className="small mb-0 ps-3">
                {result.suggestedQuestions.map((q) => <li key={q} className="mb-1">{q}</li>)}
              </ol>
            </div>
          )}

          <details className="mt-3 small text-muted">
            <summary>How this is calculated</summary>
            <p className="mt-2 mb-1">{result.scoring}</p>
            <ul className="mb-0">
              {result.limitations.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}

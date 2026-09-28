/**
 * RecruitFlow — Offers & Onboarding Page
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { offerService } from '../services/offerService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await offerService.getOffers();
      if (res.success && res.data) {
        setOffers(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch compensation offers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleAccept = async (id, candidateName) => {
    if (!window.confirm(`Confirm candidate ${candidateName} has accepted the offer? Status will update to HIRED.`)) {
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const res = await offerService.acceptOffer(id);
      if (res.success) {
        setFeedback(`Offer for ${candidateName} marked as ACCEPTED! Candidate is now HIRED.`);
        fetchOffers();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id, candidateName) => {
    if (!window.confirm(`Mark offer for ${candidateName} as declined? Candidate will transition to REJECTED.`)) {
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const res = await offerService.rejectOffer(id);
      if (res.success) {
        setFeedback(`Offer for ${candidateName} marked as DECLINED.`);
        fetchOffers();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to decline offer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Offers & Onboarding</h1>
          <p className="page-subtitle">Track extended compensation packages, candidate decisions, and hires</p>
        </div>
        <Link to="/applications?status=SELECTED" className="btn btn-primary d-flex align-items-center gap-2">
          <i className="bi bi-file-earmark-plus"></i>
          <span>Issue Offer to Selected Candidate</span>
        </Link>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show rounded-3 shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button type="button" className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetchOffers} />}

      {loading ? (
        <Loading message="Loading offer packages..." />
      ) : offers.length === 0 ? (
        <div className="card-rf p-5 text-center text-muted">
          <i className="bi bi-award fs-1 text-secondary mb-2 d-block"></i>
          <h5>No job offers issued yet</h5>
          <p className="small">Select candidates in the application pipeline to issue formal employment offers.</p>
          <Link to="/applications?status=SELECTED" className="btn btn-sm btn-primary">
            View Selected Candidates
          </Link>
        </div>
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job Requisition</th>
                  <th>Compensation</th>
                  <th>Offer Date</th>
                  <th>Joining Date</th>
                  <th>Expiration</th>
                  <th>Offer Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      <Link to={`/applications/${offer.application_id}`} className="fw-bold text-dark text-decoration-none">
                        {offer.candidate_name}
                      </Link>
                      <div className="small text-muted">{offer.candidate_email}</div>
                    </td>
                    <td>
                      <small className="text-secondary">{offer.job_title}</small>
                    </td>
                    <td>
                      <span className="fw-bold text-success fs-6">
                        {formatCurrency(offer.salary)}
                      </span>
                    </td>
                    <td>
                      <small className="text-secondary">{formatDate(offer.offer_date)}</small>
                    </td>
                    <td>
                      <small className="text-secondary">{formatDate(offer.joining_date)}</small>
                    </td>
                    <td>
                      <small className="text-danger fw-semibold">{formatDate(offer.expiry_date)}</small>
                    </td>
                    <td>
                      <StatusBadge status={offer.status} />
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link to={`/applications/${offer.application_id}`} className="btn btn-outline-secondary" title="View Application">
                          <i className="bi bi-eye"></i>
                        </Link>
                        {offer.status === 'SENT' && (
                          <>
                            <button
                              className="btn btn-success"
                              onClick={() => handleAccept(offer.id, offer.candidate_name)}
                              disabled={submitting}
                              title="Accept Offer (Hire)"
                            >
                              <i className="bi bi-check-lg"></i> Accept
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleReject(offer.id, offer.candidate_name)}
                              disabled={submitting}
                              title="Decline Offer"
                            >
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </>
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

/**
 * RecruitFlow — Offers & Hiring Page
 * Offer status is reported by the server; an unanswered offer past its expiry date shows as EXPIRED.
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { offerService } from '../services/offerService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import { formatDate, formatCurrency, getErrorMessage } from '../utils/formatters';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'SENT', label: 'Awaiting response' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'REJECTED', label: 'Declined' },
  { key: 'EXPIRED', label: 'Expired' }
];

export default function Offers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await offerService.getOffers(status ? { status } : {});
      setOffers(res.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch offers.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Offers & Hiring</h1>
          <p className="page-subtitle">Track offers, candidate responses, and hires awaiting confirmation</p>
        </div>
        <Link to="/applications?status=SELECTED" className="btn btn-primary">
          <i className="bi bi-envelope-paper me-1" aria-hidden="true"></i> Offer to selected candidate
        </Link>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchOffers} />}

      <div className="stage-tabs mb-3" role="tablist" aria-label="Filter offers">
        {FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            type="button"
            role="tab"
            aria-selected={status === f.key}
            className={`stage-tab ${status === f.key ? 'active' : ''}`}
            onClick={() => setSearchParams(f.key ? { status: f.key } : {}, { replace: true })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading message="Loading offers..." />
      ) : offers.length === 0 ? (
        <EmptyState
          icon="bi-award"
          title="No offers in this view"
          message="Offers are created from a selected candidate's application page."
          action={<Link to="/applications?status=SELECTED" className="btn btn-sm btn-primary">View selected candidates</Link>}
        />
      ) : (
        <div className="card-rf overflow-hidden">
          <div className="table-responsive">
            <table className="table table-rf align-middle">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job</th>
                  <th>Salary</th>
                  <th>Joining</th>
                  <th>Respond by</th>
                  <th>Offer</th>
                  <th>Application</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      <div className="fw-semibold">{offer.candidate_name}</div>
                      <div className="small text-muted">{offer.candidate_email}</div>
                    </td>
                    <td className="small text-secondary">{offer.job_title}{offer.designation && offer.designation !== offer.job_title && <div className="text-muted">{offer.designation}</div>}</td>
                    <td className="fw-semibold">{formatCurrency(offer.salary)}</td>
                    <td className="small">{formatDate(offer.joining_date)}</td>
                    <td className={`small ${offer.status === 'EXPIRED' ? 'text-danger' : ''}`}>{formatDate(offer.expiry_date)}</td>
                    <td><StatusBadge status={offer.status} audience="offer" /></td>
                    <td><StatusBadge status={offer.application_status} /></td>
                    <td className="text-end">
                      <Link
                        to={`/applications/${offer.application_id}`}
                        className={`btn btn-sm ${offer.application_status === 'OFFER_ACCEPTED' ? 'btn-success' : 'btn-light border'}`}
                      >
                        {offer.application_status === 'OFFER_ACCEPTED' ? 'Confirm hire' : 'Open'}
                      </Link>
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

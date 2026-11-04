/**
 * RecruitFlow — Candidate Application Details
 * Timeline, interview details, and offer response. Every action re-reads the application
 * from the server so the page reflects the persisted state.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { candidatePortalService } from '../services/candidatePortalService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Notice from '../components/Notice';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate, formatDateTime, formatCurrency, formatSalaryRange, getErrorMessage, splitSkills } from '../utils/formatters';

const STAGE_LABELS = {
  APPLIED: 'Applied',
  SCREENING: 'Under review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEWED: 'Interviewed',
  SELECTED: 'Selected',
  OFFER_SENT: 'Offer received',
  OFFER_ACCEPTED: 'Offer accepted',
  HIRED: 'Hired'
};

export default function CandidateApplicationDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirm, setConfirm] = useState(null); // 'accept' | 'decline'

  const fetchDetails = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const res = await candidatePortalService.getApplicationDetails(id);
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load application details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const respond = async () => {
    const accepting = confirm === 'accept';
    try {
      setActionLoading(true);
      setActionError('');
      setSuccessMessage('');
      const res = accepting ? await candidatePortalService.acceptOffer(id) : await candidatePortalService.rejectOffer(id);
      setSuccessMessage(res.message || (accepting ? 'Offer accepted.' : 'Offer declined.'));
    } catch (err) {
      setActionError(getErrorMessage(err, accepting ? 'Failed to accept offer.' : 'Failed to decline offer.'));
    } finally {
      setActionLoading(false);
      setConfirm(null);
      fetchDetails({ silent: true });
    }
  };

  if (loading) return <Loading message="Loading application..." />;

  if (error || !data) {
    return (
      <div className="py-4">
        <ErrorMessage message={error || 'Application not found.'} />
        <Link to="/candidate/applications" className="btn btn-light border">
          <i className="bi bi-arrow-left me-1" aria-hidden="true"></i> Back to my applications
        </Link>
      </div>
    );
  }

  const { application, job, interviews = [], offer, timeline = [] } = data;
  const status = application.status;
  const canRespond = offer && offer.status === 'SENT' && status === 'OFFER_SENT';

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/candidate/applications" className="small text-secondary d-inline-block mb-2">
            <i className="bi bi-arrow-left me-1" aria-hidden="true"></i> My applications
          </Link>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h1 className="page-title mb-0">{job.title}</h1>
            <StatusBadge status={status} audience="candidate" />
          </div>
          <p className="page-subtitle">
            {job.department} · {job.location} · Application #{application.id} · Applied {formatDate(application.applied_at)}
          </p>
        </div>
      </div>

      <Notice message={successMessage} onClose={() => setSuccessMessage('')} />
      {actionError && <ErrorMessage message={actionError} />}

      {status === 'HIRED' && (
        <div className="banner banner-success mb-4">
          <i className="bi bi-trophy-fill fs-3" aria-hidden="true"></i>
          <div>
            <div className="fw-semibold">Congratulations — you're hired!</div>
            <div className="small">The hiring team confirmed your onboarding for {job.title}.</div>
          </div>
        </div>
      )}
      {status === 'OFFER_ACCEPTED' && (
        <div className="banner banner-info mb-4">
          <i className="bi bi-check2-circle fs-3" aria-hidden="true"></i>
          <div>
            <div className="fw-semibold">You accepted the offer</div>
            <div className="small">The hiring team will confirm your onboarding. This page updates once they do.</div>
          </div>
        </div>
      )}
      {status === 'REJECTED' && (
        <div className="banner banner-muted mb-4">
          <i className="bi bi-info-circle fs-3" aria-hidden="true"></i>
          <div>
            <div className="fw-semibold">This application is closed</div>
            <div className="small">
              {offer?.status === 'REJECTED'
                ? 'You declined the offer for this role.'
                : `Thank you for your interest in ${job.title}. The team has decided not to move forward.`}
            </div>
          </div>
        </div>
      )}

      <div className="card-rf p-4 mb-4">
        <h2 className="section-title">Progress</h2>
        {status === 'REJECTED' ? (
          <p className="text-muted small mb-0">The application did not continue past its current stage.</p>
        ) : (
          <ol className="timeline-v">
            {timeline.map((item) => (
              <li key={item.stage} className={`timeline-v-item ${item.state}`} aria-current={item.state === 'current' ? 'step' : undefined}>
                <span className="timeline-v-dot">{item.state === 'completed' ? <i className="bi bi-check" aria-hidden="true"></i> : null}</span>
                <span className="timeline-v-label">{STAGE_LABELS[item.stage] || item.label}</span>
                {item.state === 'current' && <span className="chip chip-primary ms-2">Current</span>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="card-rf p-4 mb-4">
            <h2 className="section-title">Offer</h2>
            {!offer ? (
              <p className="text-muted small mb-0">No offer yet. Offers are issued after a successful interview and selection.</p>
            ) : (
              <>
                {canRespond && (
                  <div className="alert alert-primary small d-flex gap-2 align-items-start">
                    <i className="bi bi-bell-fill mt-1" aria-hidden="true"></i>
                    <div>You have an offer. Please respond by <strong>{formatDate(offer.expiry_date)}</strong>.</div>
                  </div>
                )}
                {offer.status === 'EXPIRED' && (
                  <div className="alert alert-warning small">This offer expired on {formatDate(offer.expiry_date)} and can no longer be accepted.</div>
                )}
                <div className="row g-3">
                  {offer.designation && (
                    <div className="col-12">
                      <div className="field-label">Designation</div>
                      <div className="fw-semibold">{offer.designation}</div>
                    </div>
                  )}
                  <div className="col-6">
                    <div className="field-label">Status</div>
                    <StatusBadge status={offer.status} audience="candidate" />
                  </div>
                  <div className="col-6">
                    <div className="field-label">Annual salary</div>
                    <div className="fs-5 fw-bold text-success">{formatCurrency(offer.salary)}</div>
                  </div>
                  <div className="col-6">
                    <div className="field-label">Offer date</div>
                    <div className="fw-medium">{formatDate(offer.offer_date)}</div>
                  </div>
                  <div className="col-6">
                    <div className="field-label">Joining date</div>
                    <div className="fw-medium">{formatDate(offer.joining_date)}</div>
                  </div>
                  <div className="col-6">
                    <div className="field-label">Respond by</div>
                    <div className="fw-medium">{formatDate(offer.expiry_date)}</div>
                  </div>
                  {offer.notes && (
                    <div className="col-12">
                      <div className="field-label">Offer details</div>
                      <div className="small prewrap">{offer.notes}</div>
                    </div>
                  )}
                </div>
                {canRespond && (
                  <div className="d-flex gap-2 mt-4 pt-3 border-top flex-wrap">
                    <button type="button" className="btn btn-success" disabled={actionLoading} onClick={() => setConfirm('accept')}>
                      <i className="bi bi-check2-circle me-1" aria-hidden="true"></i> Accept offer
                    </button>
                    <button type="button" className="btn btn-outline-danger" disabled={actionLoading} onClick={() => setConfirm('decline')}>
                      Decline
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card-rf p-4 mb-4">
            <h2 className="section-title">Job details</h2>
            <dl className="detail-list">
              <dt>Employment</dt>
              <dd>{job.employment_type}</dd>
              <dt>Experience</dt>
              <dd>{job.experience_required}</dd>
              <dt>Salary range</dt>
              <dd>{formatSalaryRange(job.salary_min, job.salary_max)}</dd>
            </dl>
            <div className="d-flex flex-wrap gap-1 mb-3">
              {splitSkills(job.skills).map((s) => <span key={s} className="chip">{s}</span>)}
            </div>
            <p className="text-secondary small prewrap mb-0">{job.description}</p>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="card-rf p-4">
            <h2 className="section-title">Interviews</h2>
            {interviews.length === 0 ? (
              <p className="text-muted small mb-0">No interview scheduled yet. Details appear here once the hiring team schedules one.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {interviews.map((iv) => (
                  <div key={iv.id} className="sub-card">
                    <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
                      <span className="fw-semibold">{iv.type}</span>
                      <StatusBadge status={iv.result} audience="candidate" />
                    </div>
                    <div className="small"><i className="bi bi-calendar3 me-1 text-primary" aria-hidden="true"></i>{formatDateTime(iv.scheduled_at)}</div>
                    {iv.interviewer_name && <div className="small text-muted"><i className="bi bi-person me-1" aria-hidden="true"></i>{iv.interviewer_name}</div>}
                    {iv.meeting_link && /^https?:\/\//i.test(iv.meeting_link) && iv.result === 'PENDING' && (
                      <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary mt-2">
                        <i className="bi bi-camera-video me-1" aria-hidden="true"></i> Join meeting
                      </a>
                    )}
                    {iv.result !== 'PENDING' && (
                      <div className="mt-2 small">
                        {iv.overall_rating && <div><span className="text-muted">Overall score:</span> <strong>{iv.overall_rating} / 10</strong></div>}
                        {iv.feedback && <div className="feedback-box mt-2">{iv.feedback}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={confirm === 'accept' ? 'Accept this offer?' : 'Decline this offer?'}
        message={
          confirm === 'accept'
            ? `You are accepting the offer for ${job.title} at ${formatCurrency(offer?.salary)} per year, joining ${formatDate(offer?.joining_date)}. The hiring team will then confirm your onboarding.`
            : 'Declining is final and closes this application.'
        }
        confirmLabel={confirm === 'accept' ? 'Accept offer' : 'Decline offer'}
        variant={confirm === 'accept' ? 'success' : 'danger'}
        busy={actionLoading}
        onConfirm={respond}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

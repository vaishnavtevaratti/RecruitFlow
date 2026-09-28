/**
 * RecruitFlow — Candidate Application Details Page
 * Includes visual recruitment lifecycle timeline, interview details, selection status,
 * and live offer acceptance/rejection flow.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { candidatePortalService } from '../services/candidatePortalService';
import Loading from '../components/Loading';

export default function CandidateApplicationDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchApplicationDetails();
  }, [id]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await candidatePortalService.getApplicationDetails(id);
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!window.confirm('Are you sure you want to accept this job offer? This will confirm your hiring status.')) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      setSuccessMessage('');
      const res = await candidatePortalService.acceptOffer(id);
      setSuccessMessage(res.message || 'Offer accepted successfully! Welcome to the team!');
      // Refresh state
      await fetchApplicationDetails();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to accept offer.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOffer = async () => {
    if (!window.confirm('Are you sure you want to decline this job offer?')) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      setSuccessMessage('');
      const res = await candidatePortalService.rejectOffer(id);
      setSuccessMessage(res.message || 'Offer declined.');
      await fetchApplicationDetails();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to decline offer.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      APPLIED: { bg: 'bg-secondary', label: 'Applied' },
      SCREENING: { bg: 'bg-info text-dark', label: 'Screening' },
      SHORTLISTED: { bg: 'bg-primary', label: 'Shortlisted' },
      INTERVIEW_SCHEDULED: { bg: 'bg-warning text-dark', label: 'Interview Scheduled' },
      INTERVIEWED: { bg: 'bg-info text-dark', label: 'Interviewed' },
      SELECTED: { bg: 'bg-success', label: 'Selected' },
      OFFER_SENT: { bg: 'bg-primary', label: 'Offer Received' },
      OFFER_ACCEPTED: { bg: 'bg-success', label: 'Offer Accepted' },
      HIRED: { bg: 'bg-success', label: 'Hired' },
      REJECTED: { bg: 'bg-danger', label: 'Rejected' }
    };
    const s = map[status] || { bg: 'bg-secondary', label: status };
    return <span className={`badge ${s.bg}`}>{s.label}</span>;
  };

  if (loading) {
    return <Loading message="Loading application tracking details..." />;
  }

  if (error || !data) {
    return (
      <div className="container-fluid py-5 text-center">
        <div className="alert alert-danger shadow-sm p-4 rounded-3 d-inline-block" style={{ maxWidth: '600px' }}>
          <i className="bi bi-shield-slash-fill fs-2 text-danger mb-2 d-block"></i>
          <h4>Unable to Load Application</h4>
          <p className="mb-3 text-muted">{error || 'Application not found or unauthorized.'}</p>
          <Link to="/candidate/applications" className="btn btn-primary btn-sm">
            <i className="bi bi-arrow-left me-1"></i> Back to My Applications
          </Link>
        </div>
      </div>
    );
  }

  const { application, job, candidate, interviews = [], offer, timeline = [] } = data;
  const isHired = application.status === 'HIRED';
  const isRejected = application.status === 'REJECTED';
  const isSelected = ['SELECTED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'HIRED'].includes(application.status);
  const isOfferExpired = offer?.expiry_date ? new Date(offer.expiry_date) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
  const canRespondToOffer = offer && offer.status === 'SENT' && !isRejected && !isOfferExpired;

  return (
    <div className="container-fluid py-4">
      {/* Top Bar */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <Link to="/candidate/applications" className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-arrow-left"></i>
            </Link>
            <h2 className="fw-bold mb-0">{job.title}</h2>
            {getStatusBadge(application.status)}
          </div>
          <p className="text-muted small mb-0">
            {job.department} • <i className="bi bi-geo-alt"></i> {job.location} • Application #{application.id} • Applied on{' '}
            {new Date(application.applied_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {canRespondToOffer && (
          <div className="d-flex align-items-center gap-2">
            <button
              onClick={handleRejectOffer}
              disabled={actionLoading}
              className="btn btn-outline-danger btn-sm px-3"
            >
              <i className="bi bi-x-circle me-1"></i>
              Decline Offer
            </button>
            <button
              onClick={handleAcceptOffer}
              disabled={actionLoading}
              className="btn btn-success btn-sm px-3 shadow-sm d-flex align-items-center gap-1"
            >
              <i className="bi bi-check-circle-fill"></i>
              <span>{actionLoading ? 'Processing...' : 'Accept Job Offer'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-center shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill fs-4 me-2"></i>
          <div>
            <strong>Great news!</strong> {successMessage}
          </div>
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
        </div>
      )}

      {/* Action Error Notification */}
      {actionError && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill fs-4 me-2"></i>
          <div>{actionError}</div>
          <button type="button" className="btn-close" onClick={() => setActionError('')}></button>
        </div>
      )}

      {/* Hired Banner */}
      {isHired && (
        <div className="card bg-success text-white shadow-sm border-0 mb-4 p-4 text-center">
          <div className="mb-2">
            <i className="bi bi-trophy-fill display-4"></i>
          </div>
          <h3 className="fw-bold mb-1">Congratulations! You Are Hired!</h3>
          <p className="mb-0 text-white-50">
            Your offer has been officially accepted. Welcome aboard to {job.department} at RecruitFlow!
          </p>
        </div>
      )}

      {/* Rejection Banner */}
      {isRejected && (
        <div className="card bg-danger text-white shadow-sm border-0 mb-4 p-3 d-flex flex-row align-items-center gap-3">
          <i className="bi bi-x-circle-fill fs-1"></i>
          <div>
            <h5 className="fw-bold mb-0">Application Not Selected</h5>
            <p className="mb-0 text-white-50 small">
              Thank you for your interest in the {job.title} role. We have decided to proceed with other candidates at this time.
            </p>
          </div>
        </div>
      )}

      {/* RECRUITMENT STATUS TIMELINE */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white py-3">
          <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-clock-history text-primary"></i>
            <span>Recruitment Lifecycle Timeline</span>
          </h5>
        </div>
        <div className="card-body p-4">
          <div className="timeline-horizontal d-flex flex-nowrap overflow-auto py-2 gap-2">
            {timeline.map((item, idx) => {
              const isCompleted = item.state === 'completed';
              const isCurrent = item.state === 'current';
              const isStopped = item.state === 'stopped';

              let badgeClass = 'bg-light text-muted border';
              let icon = <i className="bi bi-circle"></i>;

              if (isCompleted) {
                badgeClass = 'bg-success text-white border-success';
                icon = <i className="bi bi-check-lg fw-bold"></i>;
              } else if (isCurrent) {
                badgeClass = 'bg-primary text-white border-primary shadow-sm';
                icon = <i className="bi bi-record-circle-fill"></i>;
              } else if (isStopped) {
                badgeClass = 'bg-light text-muted opacity-50';
                icon = <i className="bi bi-dash"></i>;
              }

              return (
                <div
                  key={item.stage}
                  className="timeline-step flex-fill text-center px-2 py-2 rounded position-relative"
                  style={{ minWidth: '110px' }}
                >
                  <div
                    className={`d-inline-flex align-items-center justify-content-center rounded-circle mb-2 ${badgeClass}`}
                    style={{ width: '36px', height: '36px' }}
                  >
                    {icon}
                  </div>
                  <div className="small fw-semibold text-truncate" title={item.label}>
                    {item.label}
                  </div>
                  <div className="badge mt-1" style={{ fontSize: '0.65rem' }}>
                    {isCompleted && <span className="text-success">Completed</span>}
                    {isCurrent && <span className="text-primary fw-bold">Current Stage</span>}
                    {!isCompleted && !isCurrent && !isStopped && <span className="text-muted">Upcoming</span>}
                    {isStopped && <span className="text-secondary">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Job & Selection Info */}
        <div className="col-12 col-lg-7">
          {/* Job Details Card */}
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-briefcase-fill text-primary"></i>
                <span>Job Information</span>
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                <div className="col-6 col-md-4">
                  <div className="text-muted small">Department</div>
                  <div className="fw-semibold">{job.department}</div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="text-muted small">Location</div>
                  <div className="fw-semibold">{job.location}</div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="text-muted small">Employment Type</div>
                  <div className="fw-semibold">{job.employment_type}</div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="text-muted small">Experience Required</div>
                  <div className="fw-semibold">{job.experience_required}</div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="text-muted small">Salary Range</div>
                  <div className="fw-semibold text-success">
                    {job.salary_min && job.salary_max
                      ? `$${Number(job.salary_min).toLocaleString()} - $${Number(job.salary_max).toLocaleString()}`
                      : 'Competitive'}
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="text-muted small">Deadline</div>
                  <div className="fw-semibold">{new Date(job.deadline).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-muted small mb-1">Required Skills</div>
                <div className="d-flex flex-wrap gap-1">
                  {job.skills?.split(',').map((skill, idx) => (
                    <span key={idx} className="badge bg-light text-dark border">
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-muted small mb-1">Role Description</div>
                <p className="text-secondary small mb-0" style={{ whiteSpace: 'pre-line' }}>
                  {job.description}
                </p>
              </div>
            </div>
          </div>

          {/* Selection Status Card */}
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-star-fill text-warning"></i>
                <span>Selection Status</span>
              </h5>
            </div>
            <div className="card-body">
              {isRejected ? (
                <div className="d-flex align-items-center gap-3 text-danger">
                  <i className="bi bi-x-circle fs-3"></i>
                  <div>
                    <h6 className="fw-bold mb-0">Application Rejected</h6>
                    <small className="text-muted">This application has concluded.</small>
                  </div>
                </div>
              ) : isSelected ? (
                <div className="d-flex align-items-center gap-3 text-success">
                  <i className="bi bi-check-circle-fill fs-3"></i>
                  <div>
                    <h6 className="fw-bold mb-0">Selected for Position</h6>
                    <small className="text-muted">You have successfully cleared the interview evaluation.</small>
                  </div>
                </div>
              ) : (
                <div className="d-flex align-items-center gap-3 text-muted">
                  <i className="bi bi-hourglass-split fs-3"></i>
                  <div>
                    <h6 className="fw-bold mb-0">In Evaluation</h6>
                    <small className="text-muted">Application is progressing through screening and interview stages.</small>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interview Details & Offer Cards */}
        <div className="col-12 col-lg-5">
          {/* Interview Details Card */}
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-camera-video-fill text-primary"></i>
                <span>Interview Details</span>
              </h5>
            </div>
            <div className="card-body">
              {interviews.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-calendar-x fs-2 mb-2 d-block"></i>
                  <h6 className="fw-bold text-dark">Interview not scheduled yet</h6>
                  <p className="small mb-0">You will receive meeting instructions here once scheduled by the hiring team.</p>
                </div>
              ) : (
                interviews.map((iv, index) => {
                  const isEvaluated = iv.result && iv.result !== 'PENDING';
                  return (
                    <div key={iv.id} className={`${index > 0 ? 'mt-3 pt-3 border-top' : ''}`}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="badge bg-primary-subtle text-primary fw-semibold">{iv.type} Round</span>
                        {isEvaluated ? (
                          <span className={`badge ${iv.result === 'PASS' ? 'bg-success' : 'bg-danger'}`}>
                            {iv.result === 'PASS' ? 'Passed' : 'Failed'}
                          </span>
                        ) : (
                          <span className="badge bg-warning text-dark">Scheduled</span>
                        )}
                      </div>

                      <div className="mb-2">
                        <div className="text-muted small">Date & Time</div>
                        <div className="fw-semibold">
                          <i className="bi bi-calendar3 me-1 text-primary"></i>
                          {new Date(iv.scheduled_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </div>
                      </div>

                      {iv.meeting_link && (
                        <div className="mb-2">
                          <div className="text-muted small">Meeting Link</div>
                          <a
                            href={iv.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-primary btn-sm mt-1 d-inline-flex align-items-center gap-1"
                          >
                            <i className="bi bi-box-arrow-up-right"></i>
                            <span>Join Meeting</span>
                          </a>
                        </div>
                      )}

                      {isEvaluated && (
                        <div className="mt-2 p-2 bg-light rounded small">
                          <div className="d-flex justify-content-between">
                            <span className="text-muted">Overall Score:</span>
                            <span className="fw-bold text-dark">{iv.overall_rating} / 5</span>
                          </div>
                          {iv.feedback && (
                            <div className="mt-1 text-secondary">
                              <strong>Feedback:</strong> {iv.feedback}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Offer Details Card */}
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-award-fill text-success"></i>
                <span>Offer Details</span>
              </h5>
            </div>
            <div className="card-body">
              {!offer ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-file-earmark-lock fs-2 mb-2 d-block"></i>
                  <h6 className="fw-bold text-dark">No Offer Issued Yet</h6>
                  <p className="small mb-0">Offers are generated after successful interview completion and selection.</p>
                </div>
              ) : (
                <div>
                  {offer.status === 'SENT' && !isOfferExpired && (
                    <div className="alert alert-primary py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-bell-fill fs-5"></i>
                      <div>
                        <strong>Offer received!</strong> Review the terms below and choose to accept or decline.
                      </div>
                    </div>
                  )}

                  {offer.status === 'SENT' && isOfferExpired && (
                    <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                      <div>
                        <strong>Offer expired.</strong> The deadline for accepting this offer has passed ({new Date(offer.expiry_date).toLocaleDateString()}).
                      </div>
                    </div>
                  )}

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <div className="text-muted small">Offer Status</div>
                      <div>
                        <span
                          className={`badge ${
                            offer.status === 'ACCEPTED'
                              ? 'bg-success'
                              : offer.status === 'SENT'
                              ? (isOfferExpired ? 'bg-secondary' : 'bg-primary')
                              : offer.status === 'REJECTED'
                              ? 'bg-danger'
                              : 'bg-secondary'
                          }`}
                        >
                          {isOfferExpired && offer.status === 'SENT' ? 'EXPIRED' : (offer.status === 'REJECTED' ? 'DECLINED' : offer.status)}
                        </span>
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="text-muted small">Offered Salary</div>
                      <div className="fw-bold text-success fs-5">
                        ${Number(offer.salary).toLocaleString()}
                        <span className="small text-muted fw-normal"> / year</span>
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="text-muted small">Offer Date</div>
                      <div className="fw-semibold">
                        {new Date(offer.offer_date).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="text-muted small">Proposed Joining Date</div>
                      <div className="fw-semibold text-primary">
                        {new Date(offer.joining_date).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="text-muted small">Offer Expiry Date</div>
                      <div className={`fw-semibold ${isOfferExpired ? 'text-muted text-decoration-line-through' : 'text-danger'}`}>
                        {new Date(offer.expiry_date).toLocaleDateString()}
                        {isOfferExpired && <span className="badge bg-secondary ms-2">Expired</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions for SENT Offer */}
                  {canRespondToOffer && (
                    <div className="d-grid gap-2 pt-2 border-top">
                      <button
                        onClick={handleAcceptOffer}
                        disabled={actionLoading}
                        className="btn btn-success fw-bold py-2 shadow-sm"
                      >
                        <i className="bi bi-check2-circle me-1"></i>
                        {actionLoading ? 'Accepting Offer...' : 'Accept Job Offer'}
                      </button>

                      <button
                        onClick={handleRejectOffer}
                        disabled={actionLoading}
                        className="btn btn-outline-danger btn-sm"
                      >
                        <i className="bi bi-x-circle me-1"></i>
                        Decline Offer
                      </button>
                    </div>
                  )}

                  {offer.status === 'SENT' && isOfferExpired && (
                    <div className="alert alert-secondary py-2 px-3 small mt-2 mb-0 text-center">
                      <i className="bi bi-clock-history me-1"></i>
                      Offer Expired — Acceptance Deadline Passed
                    </div>
                  )}

                  {offer.status === 'ACCEPTED' && (
                    <div className="alert alert-success py-2 px-3 small mt-2 mb-0 text-center">
                      <i className="bi bi-check-circle-fill me-1"></i>
                      Offer Accepted on {new Date(offer.updated_at || Date.now()).toLocaleDateString()}
                    </div>
                  )}

                  {offer.status === 'REJECTED' && (
                    <div className="alert alert-danger py-2 px-3 small mt-2 mb-0 text-center">
                      <i className="bi bi-x-circle-fill me-1"></i>
                      Offer Declined — Application Concluded
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * RecruitFlow — Application Details & End-to-End Pipeline Action Center
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { applicationService } from '../services/applicationService';
import { interviewService } from '../services/interviewService';
import { offerService } from '../services/offerService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import { formatDate, formatDateTime, formatCurrency } from '../utils/formatters';

export default function ApplicationDetails() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Modals state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isEvaluateOpen, setIsEvaluateOpen] = useState(false);
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const [selectedInterviewId, setSelectedInterviewId] = useState(null);

  // Forms
  const [scheduleForm, setScheduleForm] = useState({
    interviewer_id: 2, // Default to demo Interviewer David Chen
    scheduled_at: '',
    type: 'Technical Interview',
    meeting_link: ''
  });

  const [evaluateForm, setEvaluateForm] = useState({
    technical_rating: 8,
    communication_rating: 8,
    problem_solving_rating: 8,
    overall_rating: 8,
    feedback: '',
    result: 'PASS'
  });

  const [offerForm, setOfferForm] = useState({
    salary: '',
    offer_date: new Date().toISOString().split('T')[0],
    joining_date: '',
    expiry_date: ''
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await applicationService.getApplicationById(id);
      if (res.success && res.data) {
        setApp(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch application details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [id]);

  // Actions
  const handleScreen = async () => {
    try {
      setSubmitting(true);
      setError('');
      const res = await applicationService.screenApplication(id);
      if (res.success) {
        setFeedback('Candidate advanced to SCREENING status.');
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to screen candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShortlist = async () => {
    try {
      setSubmitting(true);
      setError('');
      const res = await applicationService.shortlistApplication(id);
      if (res.success) {
        setFeedback('Candidate successfully SHORTLISTED. Eligible for interview scheduling.');
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to shortlist candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to mark this application as REJECTED? This terminal state stops pipeline progression.')) {
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const res = await applicationService.rejectApplication(id);
      if (res.success) {
        setFeedback('Application marked as REJECTED.');
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleForm.scheduled_at) {
      setError('Interview date and time are required.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const res = await interviewService.scheduleInterview({
        application_id: Number(id),
        ...scheduleForm
      });
      if (res.success) {
        setFeedback('Interview successfully scheduled.');
        setIsScheduleOpen(false);
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule interview.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEvaluate = (interviewId) => {
    setSelectedInterviewId(interviewId);
    setIsEvaluateOpen(true);
  };

  const handleEvaluateSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      const res = await interviewService.evaluateInterview(selectedInterviewId, evaluateForm);
      if (res.success) {
        setFeedback('Interview evaluation submitted. Application status updated to INTERVIEWED.');
        setIsEvaluateOpen(false);
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit interview evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelect = async () => {
    try {
      setSubmitting(true);
      setError('');
      const res = await applicationService.selectApplication(id);
      if (res.success) {
        setFeedback('Candidate officially SELECTED for hire! Ready for offer generation.');
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to select candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferSubmit = async (e) => {
    e.preventDefault();
    if (!offerForm.salary || !offerForm.joining_date || !offerForm.expiry_date) {
      setError('Please provide salary, joining date, and expiry date.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const res = await offerService.createOffer({
        application_id: Number(id),
        ...offerForm
      });
      if (res.success) {
        setFeedback('Offer letter created and dispatched! Application moved to OFFER_SENT.');
        setIsOfferOpen(false);
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptOffer = async (offerId) => {
    if (!window.confirm('Confirm candidate acceptance of this offer? This will complete the hiring workflow.')) {
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const res = await offerService.acceptOffer(offerId);
      if (res.success) {
        setFeedback('Offer officially ACCEPTED! Candidate status is now HIRED.');
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineOffer = async (offerId) => {
    if (!window.confirm('Mark this offer as declined / rejected?')) return;
    try {
      setSubmitting(true);
      setError('');
      const res = await offerService.rejectOffer(offerId);
      if (res.success) {
        setFeedback('Offer declined. Candidate marked as REJECTED.');
        fetchApplication();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject offer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading message="Loading application pipeline details..." />;
  if (error && !app) return <ErrorMessage message={error} onRetry={fetchApplication} />;
  if (!app) return null;

  // Pipeline stepper definition
  const pipelineStages = [
    { key: 'APPLIED', label: 'Applied' },
    { key: 'SCREENING', label: 'Screening' },
    { key: 'SHORTLISTED', label: 'Shortlisted' },
    { key: 'INTERVIEW', label: 'Interview' }, // Matches INTERVIEW_SCHEDULED or INTERVIEWED
    { key: 'SELECTED', label: 'Selected' },
    { key: 'OFFER', label: 'Offer Sent' }, // Matches OFFER_SENT or OFFER_ACCEPTED
    { key: 'HIRED', label: 'Hired' }
  ];

  const getStageStatus = (stageKey) => {
    if (app.status === 'REJECTED') return 'rejected';

    const stageOrder = [
      'APPLIED',
      'SCREENING',
      'SHORTLISTED',
      'INTERVIEW_SCHEDULED',
      'INTERVIEWED',
      'SELECTED',
      'OFFER_SENT',
      'OFFER_ACCEPTED',
      'HIRED'
    ];

    const currentIdx = stageOrder.indexOf(app.status);

    if (stageKey === 'APPLIED') return currentIdx >= 0 ? (currentIdx === 0 ? 'current' : 'completed') : 'upcoming';
    if (stageKey === 'SCREENING') return currentIdx >= 1 ? (currentIdx === 1 ? 'current' : 'completed') : 'upcoming';
    if (stageKey === 'SHORTLISTED') return currentIdx >= 2 ? (currentIdx === 2 ? 'current' : 'completed') : 'upcoming';
    if (stageKey === 'INTERVIEW') return currentIdx >= 3 ? (currentIdx === 3 || currentIdx === 4 ? 'current' : 'completed') : 'upcoming';
    if (stageKey === 'SELECTED') return currentIdx >= 5 ? (currentIdx === 5 ? 'current' : 'completed') : 'upcoming';
    if (stageKey === 'OFFER') return currentIdx >= 6 ? (currentIdx === 6 || currentIdx === 7 ? 'current' : 'completed') : 'upcoming';
    if (stageKey === 'HIRED') return currentIdx === 8 ? 'completed' : 'upcoming';

    return 'upcoming';
  };

  const latestInterview = app.interviews && app.interviews.length > 0
    ? app.interviews[app.interviews.length - 1]
    : null;

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-3">
            <h1 className="page-title mb-0">{app.candidate_name}</h1>
            <StatusBadge status={app.status} />
          </div>
          <p className="page-subtitle">
            Applying for <Link to={`/jobs/${app.job_id}`} className="fw-semibold text-primary">{app.job_title}</Link> ({app.job_department}) &bull; Applied on {formatDate(app.applied_at)}
          </p>
        </div>
        <Link to="/applications" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-1"></i> Back to Pipeline
        </Link>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show rounded-3 shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button type="button" className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {/* Visual Stepper Timeline */}
      <div className="card-rf p-4 mb-4">
        <h6 className="fw-bold text-muted text-uppercase mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.06em' }}>
          Recruitment Progression Pipeline
        </h6>

        {app.status === 'REJECTED' ? (
          <div className="alert alert-danger mb-0 d-flex align-items-center gap-2">
            <i className="bi bi-x-octagon-fill fs-4"></i>
            <div>
              <strong>Application Status: REJECTED.</strong>
              <div className="small">This application has reached a terminal state and cannot progress further through the pipeline.</div>
            </div>
          </div>
        ) : (
          <div className="pipeline-stepper">
            {pipelineStages.map((stage, idx) => {
              const statusClass = getStageStatus(stage.key);
              return (
                <div key={idx} className={`stepper-item ${statusClass}`}>
                  <div className="stepper-circle">
                    {statusClass === 'completed' ? (
                      <i className="bi bi-check-lg"></i>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div className="stepper-title">{stage.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="row g-4">
        {/* Left Column: Details & Interview Records */}
        <div className="col-12 col-lg-8">
          {/* Candidate Profile Summary */}
          <div className="card-rf p-4 mb-4">
            <h5 className="fw-bold mb-3 border-bottom pb-2">Candidate Qualifications</h5>
            <div className="row g-3">
              <div className="col-sm-6">
                <small className="text-muted d-block">Full Name</small>
                <div className="fw-semibold">{app.candidate_name}</div>
              </div>
              <div className="col-sm-6">
                <small className="text-muted d-block">Email Address</small>
                <div className="fw-semibold">{app.candidate_email}</div>
              </div>
              <div className="col-sm-6">
                <small className="text-muted d-block">Phone Number</small>
                <div className="fw-semibold">{app.candidate_phone}</div>
              </div>
              <div className="col-sm-6">
                <small className="text-muted d-block">Experience</small>
                <div className="fw-semibold">{app.candidate_experience}</div>
              </div>
              <div className="col-12">
                <small className="text-muted d-block">Education</small>
                <div className="fw-semibold">{app.candidate_education}</div>
              </div>
              <div className="col-12">
                <small className="text-muted d-block">Skills</small>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {app.candidate_skills.split(',').map((s, i) => (
                    <span key={i} className="badge bg-light text-dark border">
                      {s.trim()}
                    </span>
                  ))}
                </div>
              </div>
              {app.resume_url && (
                <div className="col-12 mt-2">
                  <a
                    href={app.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-primary"
                  >
                    <i className="bi bi-file-earmark-pdf me-1"></i> View Submitted Resume
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Interview Records Section */}
          <div className="card-rf p-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
              <h5 className="fw-bold mb-0">Interview History & Evaluations</h5>
              {app.status === 'SHORTLISTED' && (
                <button className="btn btn-sm btn-primary" onClick={() => setIsScheduleOpen(true)}>
                  <i className="bi bi-calendar-plus me-1"></i> Schedule Round
                </button>
              )}
            </div>

            {(!app.interviews || app.interviews.length === 0) ? (
              <p className="text-muted small mb-0">No interview rounds scheduled yet.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {app.interviews.map((iv) => (
                  <div key={iv.id} className="p-3 border rounded-3 bg-light">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="fw-bold mb-1 text-primary">{iv.type}</h6>
                        <small className="text-muted">
                          <i className="bi bi-clock me-1"></i> {formatDateTime(iv.scheduled_at)} &bull; Interviewer: {iv.interviewer_name}
                        </small>
                      </div>
                      <StatusBadge status={iv.result} />
                    </div>

                    {iv.meeting_link && (
                      <div className="small mb-2">
                        <span className="text-muted">Meeting URL: </span>
                        <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer">
                          {iv.meeting_link}
                        </a>
                      </div>
                    )}

                    {iv.result !== 'PENDING' ? (
                      <div className="border-top pt-2 mt-2">
                        <div className="row g-2 text-center my-2">
                          <div className="col-3">
                            <small className="text-muted d-block">Tech</small>
                            <span className="fw-bold">{iv.technical_rating}/10</span>
                          </div>
                          <div className="col-3">
                            <small className="text-muted d-block">Comms</small>
                            <span className="fw-bold">{iv.communication_rating}/10</span>
                          </div>
                          <div className="col-3">
                            <small className="text-muted d-block">Problem Solving</small>
                            <span className="fw-bold">{iv.problem_solving_rating}/10</span>
                          </div>
                          <div className="col-3">
                            <small className="text-muted d-block">Overall</small>
                            <span className="fw-bold text-primary">{iv.overall_rating}/10</span>
                          </div>
                        </div>
                        {iv.feedback && (
                          <div className="p-2 bg-white rounded border small mt-2">
                            <strong>Feedback:</strong> {iv.feedback}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-top pt-2 mt-2 text-end">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleOpenEvaluate(iv.id)}
                        >
                          <i className="bi bi-pencil-square me-1"></i> Submit Evaluation
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Offer Letter Details Section */}
          {app.offer && (
            <div className="card-rf p-4 mb-4 border-primary">
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h5 className="fw-bold mb-0 text-primary">
                  <i className="bi bi-award-fill me-2"></i>
                  Compensation Offer Package
                </h5>
                <StatusBadge status={app.offer.status} />
              </div>
              <div className="row g-3">
                <div className="col-sm-6">
                  <small className="text-muted d-block">Annual Salary</small>
                  <div className="fs-5 fw-bold text-success">{formatCurrency(app.offer.salary)}</div>
                </div>
                <div className="col-sm-6">
                  <small className="text-muted d-block">Offer Date</small>
                  <div className="fw-semibold">{formatDate(app.offer.offer_date)}</div>
                </div>
                <div className="col-sm-6">
                  <small className="text-muted d-block">Proposed Joining Date</small>
                  <div className="fw-semibold">{formatDate(app.offer.joining_date)}</div>
                </div>
                <div className="col-sm-6">
                  <small className="text-muted d-block">Offer Expiration Date</small>
                  <div className="fw-semibold text-danger">{formatDate(app.offer.expiry_date)}</div>
                </div>
              </div>

              {app.offer.status === 'SENT' && (
                <div className="border-top pt-3 mt-3 d-flex align-items-center justify-content-between text-muted small">
                  <span>
                    <i className="bi bi-hourglass-split me-1 text-primary"></i>
                    Awaiting candidate acceptance or decline
                  </span>
                  <span className="badge bg-primary-subtle text-primary">Pending Candidate Action</span>
                </div>
              )}
              {app.offer.status === 'ACCEPTED' && (
                <div className="border-top pt-3 mt-3 text-success small fw-semibold">
                  <i className="bi bi-check-circle-fill me-1"></i> Offer Accepted by Candidate — Candidate is HIRED
                </div>
              )}
              {app.offer.status === 'REJECTED' && (
                <div className="border-top pt-3 mt-3 text-danger small fw-semibold">
                  <i className="bi bi-x-circle-fill me-1"></i> Offer Declined by Candidate — Application REJECTED
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Workflow Action Panel */}
        <div className="col-12 col-lg-4">
          <div className="card-rf p-4 sticky-top" style={{ top: '90px' }}>
            <h5 className="fw-bold mb-3 border-bottom pb-2">Pipeline Decision Center</h5>
            <p className="text-muted small mb-3">
              Perform stage transitions adhering to RecruitFlow state machine business rules:
            </p>

            <div className="d-grid gap-2 mb-3">
              {/* State 1: APPLIED -> SCREENING */}
              {app.status === 'APPLIED' && (
                <button
                  className="btn btn-primary"
                  onClick={handleScreen}
                  disabled={submitting}
                >
                  <i className="bi bi-search me-1"></i> Begin Resume Screening
                </button>
              )}

              {/* State 2: SCREENING -> SHORTLISTED */}
              {app.status === 'SCREENING' && (
                <button
                  className="btn btn-success"
                  onClick={handleShortlist}
                  disabled={submitting}
                >
                  <i className="bi bi-star-fill me-1"></i> Shortlist Candidate
                </button>
              )}

              {/* State 3: SHORTLISTED -> INTERVIEW_SCHEDULED */}
              {app.status === 'SHORTLISTED' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsScheduleOpen(true)}
                  disabled={submitting}
                >
                  <i className="bi bi-calendar-plus me-1"></i> Schedule Interview
                </button>
              )}

              {/* State 4: INTERVIEW_SCHEDULED -> INTERVIEWED */}
              {app.status === 'INTERVIEW_SCHEDULED' && latestInterview && (
                <button
                  className="btn btn-warning text-dark fw-semibold"
                  onClick={() => handleOpenEvaluate(latestInterview.id)}
                  disabled={submitting}
                >
                  <i className="bi bi-pencil-square me-1"></i> Evaluate Interview
                </button>
              )}

              {/* State 5: INTERVIEWED -> SELECTED */}
              {app.status === 'INTERVIEWED' && latestInterview?.result === 'PASS' && (
                <button
                  className="btn btn-success"
                  onClick={handleSelect}
                  disabled={submitting}
                >
                  <i className="bi bi-award-fill me-1"></i> Select for Hire
                </button>
              )}

              {/* State 6: SELECTED -> OFFER_SENT */}
              {app.status === 'SELECTED' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsOfferOpen(true)}
                  disabled={submitting}
                >
                  <i className="bi bi-file-earmark-plus me-1"></i> Generate Offer Letter
                </button>
              )}

              {/* State 7: OFFER_SENT -> Awaiting Candidate Decision */}
              {app.status === 'OFFER_SENT' && (
                <div className="alert alert-info text-center mb-0">
                  <i className="bi bi-envelope-paper-fill fs-3 d-block mb-1 text-primary"></i>
                  <strong>Offer Dispatched</strong>
                  <div className="small mt-1">Awaiting candidate acceptance or decline.</div>
                </div>
              )}

              {/* Terminal: HIRED */}
              {app.status === 'HIRED' && (
                <div className="alert alert-success text-center mb-0">
                  <i className="bi bi-trophy-fill fs-3 d-block mb-1"></i>
                  <strong>Candidate Successfully Hired!</strong>
                </div>
              )}

              {/* General Rejection Action (Available for any active non-terminal state) */}
              {app.status !== 'HIRED' && app.status !== 'REJECTED' && (
                <button
                  className="btn btn-outline-danger mt-2"
                  onClick={handleReject}
                  disabled={submitting}
                >
                  <i className="bi bi-x-octagon me-1"></i> Reject Application
                </button>
              )}
            </div>

            <div className="bg-light p-3 rounded-3 border small text-muted">
              <strong>Workflow Invariants:</strong>
              <ul className="mb-0 ps-3 mt-1">
                <li>Candidates must be screened before shortlisting.</li>
                <li>Only shortlisted candidates can receive interviews.</li>
                <li>Passing score required before final selection.</li>
                <li>Only selected candidates can receive an offer.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Schedule Interview */}
      <Modal
        title="Schedule Interview Round"
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
      >
        <form onSubmit={handleScheduleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold">Round Type</label>
            <input
              type="text"
              className="form-control"
              value={scheduleForm.type}
              onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
              placeholder="e.g. Technical Round 1 / System Architecture"
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold">Date & Time</label>
            <input
              type="datetime-local"
              className="form-control"
              value={scheduleForm.scheduled_at}
              onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold">Meeting Link (Optional)</label>
            <input
              type="url"
              className="form-control"
              value={scheduleForm.meeting_link}
              onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_link: e.target.value })}
              placeholder="https://meet.google.com/xyz-abc"
            />
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsScheduleOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              Schedule Interview
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Evaluate Interview */}
      <Modal
        title="Submit Interview Evaluation"
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
            <label className="form-label fw-semibold">Interviewer Feedback & Notes</label>
            <textarea
              className="form-control"
              rows="3"
              value={evaluateForm.feedback}
              onChange={(e) => setEvaluateForm({ ...evaluateForm, feedback: e.target.value })}
              placeholder="Candidate strengths, areas for development, architectural depth..."
              required
            ></textarea>
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold">Evaluation Recommendation</label>
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
              Submit Evaluation
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Issue Offer */}
      <Modal
        title="Issue Compensation Offer"
        isOpen={isOfferOpen}
        onClose={() => setIsOfferOpen(false)}
      >
        <form onSubmit={handleOfferSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold">Annual Compensation ($)</label>
            <input
              type="number"
              className="form-control"
              placeholder="e.g. 115000"
              value={offerForm.salary}
              onChange={(e) => setOfferForm({ ...offerForm, salary: e.target.value })}
              required
            />
          </div>

          <div className="row g-3 mb-3">
            <div className="col-sm-6">
              <label className="form-label fw-semibold">Proposed Joining Date</label>
              <input
                type="date"
                className="form-control"
                value={offerForm.joining_date}
                onChange={(e) => setOfferForm({ ...offerForm, joining_date: e.target.value })}
                required
              />
            </div>
            <div className="col-sm-6">
              <label className="form-label fw-semibold">Offer Expiration Date</label>
              <input
                type="date"
                className="form-control"
                value={offerForm.expiry_date}
                onChange={(e) => setOfferForm({ ...offerForm, expiry_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsOfferOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              Dispatch Offer Letter
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

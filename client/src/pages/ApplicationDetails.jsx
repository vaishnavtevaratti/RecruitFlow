/**
 * RecruitFlow — Application Details & Pipeline Action Center
 * Every action calls the API and then reloads the application from the server, so the
 * page always shows the persisted state. Business rules are enforced server-side.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { applicationService } from '../services/applicationService';
import { interviewService } from '../services/interviewService';
import { offerService } from '../services/offerService';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Notice from '../components/Notice';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import SkillMatchPanel from '../components/SkillMatchPanel';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  getErrorMessage,
  splitSkills,
  dateInputValue,
  dateTimeInputValue
} from '../utils/formatters';

const STAGE_ORDER = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'SELECTED', 'OFFER_SENT', 'OFFER_ACCEPTED', 'HIRED'];

const PIPELINE_STAGES = [
  { label: 'Applied', from: 0, to: 0 },
  { label: 'Screening', from: 1, to: 1 },
  { label: 'Shortlisted', from: 2, to: 2 },
  { label: 'Interview', from: 3, to: 4 },
  { label: 'Selected', from: 5, to: 5 },
  { label: 'Offer', from: 6, to: 7 },
  { label: 'Hired', from: 8, to: 8 }
];

const EMPTY_EVALUATION = {
  technical_rating: '',
  communication_rating: '',
  problem_solving_rating: '',
  overall_rating: '',
  feedback: '',
  result: 'PASS'
};

const CONFIRM_COPY = {
  reject: {
    title: 'Reject this application?',
    message: 'Rejection is final. The candidate will see the application as not selected and it cannot progress further.',
    label: 'Reject application',
    variant: 'danger'
  },
  select: {
    title: 'Select candidate for hire?',
    message: 'The candidate passed the interview. Selecting them makes the application eligible for an offer.',
    label: 'Select candidate',
    variant: 'success'
  },
  cancelInterview: {
    title: 'Cancel this interview?',
    message: 'The interview is removed and the candidate returns to the shortlist, so you can schedule a new one.',
    label: 'Cancel interview',
    variant: 'danger'
  },
  hire: {
    title: 'Mark candidate as hired?',
    message: 'The candidate accepted the offer. This completes the recruitment workflow for this application.',
    label: 'Mark as hired',
    variant: 'success'
  }
};

function stageState(stage, status) {
  const idx = STAGE_ORDER.indexOf(status);
  if (status === 'HIRED') return 'completed';
  if (idx > stage.to) return 'completed';
  if (idx >= stage.from && idx <= stage.to) return 'current';
  return 'upcoming';
}

export default function ApplicationDetails() {
  const { id } = useParams();
  const { user, isHR } = useAuth();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [interviewers, setInterviewers] = useState([]);

  const [modal, setModal] = useState(null); // 'schedule' | 'reschedule' | 'evaluate' | 'offer'
  const [confirmAction, setConfirmAction] = useState(null); // 'reject' | 'select' | 'hire'
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [formError, setFormError] = useState('');

  const [scheduleForm, setScheduleForm] = useState({ interviewer_id: '', scheduled_at: '', type: 'Technical Interview', meeting_link: '' });
  const [evaluateForm, setEvaluateForm] = useState(EMPTY_EVALUATION);
  const [offerForm, setOfferForm] = useState({ designation: '', salary: '', offer_date: '', joining_date: '', expiry_date: '', notes: '' });

  const fetchApplication = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setLoadError('');
      const res = await applicationService.getApplicationById(id);
      setApp(res.data);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to fetch application details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  useEffect(() => {
    if (!isHR) return;
    interviewService
      .getInterviewers()
      .then((res) => setInterviewers(res.data || []))
      .catch(() => setInterviewers([]));
  }, [isHR]);

  /**
   * Runs an API action, shows the outcome, and reloads persisted state either way.
   */
  const runAction = async (fn, successMessage) => {
    try {
      setSubmitting(true);
      setActionError('');
      setFeedback('');
      await fn();
      setFeedback(successMessage);
      setModal(null);
      setConfirmAction(null);
      return true;
    } catch (err) {
      const message = getErrorMessage(err, 'Action failed.');
      if (modal) setFormError(message);
      else setActionError(message);
      setConfirmAction(null);
      return false;
    } finally {
      setSubmitting(false);
      fetchApplication({ silent: true });
    }
  };

  const openModal = (name, interview = null) => {
    setFormError('');
    setActionError('');
    setSelectedInterview(interview);
    if (name === 'schedule') {
      const defaultInterviewer = interviewers.find((u) => u.role === 'INTERVIEWER') || interviewers[0];
      setScheduleForm({
        interviewer_id: defaultInterviewer ? String(defaultInterviewer.id) : '',
        scheduled_at: '',
        type: 'Technical Interview',
        meeting_link: ''
      });
    } else if (name === 'reschedule' && interview) {
      setScheduleForm({
        interviewer_id: String(interview.interviewer_id),
        scheduled_at: dateTimeInputValue(interview.scheduled_at),
        type: interview.type,
        meeting_link: interview.meeting_link || ''
      });
    } else if (name === 'evaluate') {
      setEvaluateForm(EMPTY_EVALUATION);
    } else if (name === 'offer') {
      setOfferForm({ designation: app?.job_title || '', notes: '', salary: '', offer_date: dateInputValue(0), joining_date: dateInputValue(30), expiry_date: dateInputValue(14) });
    }
    setModal(name);
  };

  const closeModal = () => {
    if (!submitting) setModal(null);
  };

  const validateSchedule = () => {
    if (!scheduleForm.interviewer_id) return 'Select an interviewer.';
    if (!scheduleForm.type.trim()) return 'Interview type is required.';
    if (!scheduleForm.scheduled_at) return 'Interview date and time are required.';
    if (new Date(scheduleForm.scheduled_at) <= new Date()) return 'Interview must be scheduled in the future.';
    return '';
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    const problem = validateSchedule();
    if (problem) return setFormError(problem);
    setFormError('');
    if (modal === 'reschedule') {
      await runAction(
        () => interviewService.rescheduleInterview(selectedInterview.id, { ...scheduleForm, interviewer_id: Number(scheduleForm.interviewer_id) }),
        'Interview rescheduled.'
      );
    } else {
      await runAction(
        () => interviewService.scheduleInterview({ application_id: Number(id), ...scheduleForm, interviewer_id: Number(scheduleForm.interviewer_id) }),
        'Interview scheduled. The candidate can now see the interview details in their portal.'
      );
    }
  };

  const handleEvaluateSubmit = async (e) => {
    e.preventDefault();
    for (const field of ['technical_rating', 'communication_rating', 'problem_solving_rating', 'overall_rating']) {
      const v = evaluateForm[field];
      if (v === '' || !Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 10) {
        return setFormError('All ratings must be whole numbers from 1 to 10.');
      }
    }
    if (!evaluateForm.feedback.trim()) return setFormError('Please add written feedback.');
    setFormError('');
    const payload = {
      ...evaluateForm,
      technical_rating: Number(evaluateForm.technical_rating),
      communication_rating: Number(evaluateForm.communication_rating),
      problem_solving_rating: Number(evaluateForm.problem_solving_rating),
      overall_rating: Number(evaluateForm.overall_rating)
    };
    await runAction(
      () => interviewService.evaluateInterview(selectedInterview.id, payload),
      `Evaluation recorded (${payload.result}). Application moved to INTERVIEWED.`
    );
  };

  const handleOfferSubmit = async (e) => {
    e.preventDefault();
    const { salary, offer_date, joining_date, expiry_date } = offerForm;
    if (!salary || Number(salary) <= 0) return setFormError('Enter a positive annual salary.');
    if (!offer_date || !joining_date || !expiry_date) return setFormError('All offer dates are required.');
    if (expiry_date < dateInputValue(0)) return setFormError('Expiry date cannot be in the past.');
    if (expiry_date < offer_date) return setFormError('Expiry date cannot be before the offer date.');
    if (joining_date < offer_date) return setFormError('Joining date cannot be before the offer date.');
    setFormError('');
    await runAction(
      () => offerService.createOffer({ application_id: Number(id), ...offerForm, salary: Number(salary) }),
      'Offer sent. The candidate can accept or decline it from their portal.'
    );
  };

  const handleConfirm = async () => {
    if (confirmAction === 'reject') {
      await runAction(() => applicationService.rejectApplication(id), 'Application rejected.');
    } else if (confirmAction === 'select') {
      await runAction(() => applicationService.selectApplication(id), 'Candidate selected. You can now issue an offer.');
    } else if (confirmAction === 'cancelInterview') {
      await runAction(() => interviewService.cancelInterview(selectedInterview.id), 'Interview cancelled. The candidate is back on the shortlist.');
    } else if (confirmAction === 'hire') {
      await runAction(() => applicationService.hireApplication(id), 'Candidate marked as hired. Workflow complete.');
    }
  };

  if (loading) return <Loading message="Loading application..." />;
  if (loadError && !app) return <ErrorMessage message={loadError} onRetry={() => fetchApplication()} />;
  if (!app) return null;

  const interviews = app.interviews || [];
  const latestInterview = interviews.length > 0 ? interviews[interviews.length - 1] : null;
  const pendingInterview = interviews.find((iv) => iv.result === 'PENDING') || null;
  const canEvaluate =
    app.status === 'INTERVIEW_SCHEDULED' && pendingInterview && (isHR || pendingInterview.interviewer_id === user?.id);
  const offer = app.offer;
  const offerExpired = offer?.status === 'EXPIRED';
  const canReject =
    isHR &&
    !['HIRED', 'REJECTED', 'OFFER_ACCEPTED'].includes(app.status) &&
    !(app.status === 'OFFER_SENT' && offer && !offerExpired);

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-3">
          <div className="avatar-circle avatar-lg" aria-hidden="true">{app.candidate_name?.charAt(0).toUpperCase()}</div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h1 className="page-title mb-0">{app.candidate_name}</h1>
              <StatusBadge status={app.status} />
            </div>
            <p className="page-subtitle">
              Application #{app.id} for{' '}
              {isHR ? <Link to={`/jobs/${app.job_id}`} className="fw-semibold">{app.job_title}</Link> : <strong>{app.job_title}</strong>}
              {' '}· Applied {formatDate(app.applied_at)}
            </p>
          </div>
        </div>
        <Link to={isHR ? '/applications' : '/interviews'} className="btn btn-light border">
          <i className="bi bi-arrow-left me-1"></i> Back
        </Link>
      </div>

      <Notice message={feedback} onClose={() => setFeedback('')} />
      {actionError && <ErrorMessage message={actionError} />}

      <div className="card-rf p-4 mb-4">
        {app.status === 'REJECTED' ? (
          <div className="d-flex align-items-center gap-3 text-danger">
            <i className="bi bi-x-octagon-fill fs-3"></i>
            <div>
              <div className="fw-semibold">Application rejected</div>
              <div className="small text-muted">This is a terminal state; the application cannot progress further.</div>
            </div>
          </div>
        ) : (
          <ol className="pipeline-stepper" aria-label="Recruitment progress">
            {PIPELINE_STAGES.map((stage, idx) => {
              const state = stageState(stage, app.status);
              return (
                <li key={stage.label} className={`stepper-item ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                  <div className="stepper-circle">{state === 'completed' ? <i className="bi bi-check-lg"></i> : idx + 1}</div>
                  <div className="stepper-title">{stage.label}</div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <div className="card-rf p-4 mb-4">
            <h2 className="section-title">Candidate profile</h2>
            <div className="row g-3">
              <div className="col-sm-6">
                <div className="field-label">Email</div>
                <div className="fw-medium text-break">{app.candidate_email}</div>
              </div>
              <div className="col-sm-6">
                <div className="field-label">Phone</div>
                <div className="fw-medium">{app.candidate_phone || '—'}</div>
              </div>
              <div className="col-sm-6">
                <div className="field-label">Experience</div>
                <div className="fw-medium">{app.candidate_experience || '—'}</div>
              </div>
              <div className="col-sm-6">
                <div className="field-label">Education</div>
                <div className="fw-medium">{app.candidate_education || '—'}</div>
              </div>
              <div className="col-12">
                <div className="field-label">Skills</div>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {splitSkills(app.candidate_skills).length === 0 && <span className="text-muted small">Not provided</span>}
                  {splitSkills(app.candidate_skills).map((s) => (
                    <span key={s} className="chip">{s}</span>
                  ))}
                </div>
              </div>
              {app.resume_url && /^https?:\/\//i.test(app.resume_url) && (
                <div className="col-12">
                  <a href={app.resume_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary">
                    <i className="bi bi-file-earmark-text me-1"></i> View resume / portfolio
                  </a>
                </div>
              )}
            </div>
          </div>

          {isHR && <SkillMatchPanel applicationId={app.id} />}

          <div className="card-rf p-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="section-title mb-0">Interviews</h2>
              {isHR && app.status === 'SHORTLISTED' && (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => openModal('schedule')}>
                  <i className="bi bi-calendar-plus me-1"></i> Schedule
                </button>
              )}
            </div>

            {interviews.length === 0 ? (
              <p className="text-muted small mb-0">No interviews scheduled yet.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {interviews.map((iv) => (
                  <div key={iv.id} className="sub-card">
                    <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                      <div>
                        <div className="fw-semibold">{iv.type}</div>
                        <div className="small text-muted">
                          <i className="bi bi-clock me-1"></i>{formatDateTime(iv.scheduled_at)} · {iv.interviewer_name}
                        </div>
                        {iv.meeting_link && /^https?:\/\//i.test(iv.meeting_link) && (
                          <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="small">
                            <i className="bi bi-camera-video me-1"></i>Meeting link
                          </a>
                        )}
                      </div>
                      <StatusBadge status={iv.result} />
                    </div>

                    {iv.result !== 'PENDING' ? (
                      <div className="border-top pt-3 mt-3">
                        <div className="row g-2 text-center mb-2">
                          {[
                            ['Technical', iv.technical_rating],
                            ['Communication', iv.communication_rating],
                            ['Problem solving', iv.problem_solving_rating],
                            ['Overall', iv.overall_rating]
                          ].map(([label, value]) => (
                            <div key={label} className="col-6 col-md-3">
                              <div className="field-label">{label}</div>
                              <div className="fw-bold">{value ?? '—'}{value ? '/10' : ''}</div>
                            </div>
                          ))}
                        </div>
                        {iv.feedback && <div className="feedback-box small">{iv.feedback}</div>}
                      </div>
                    ) : (
                      app.status === 'INTERVIEW_SCHEDULED' && (
                        <div className="border-top pt-3 mt-3 d-flex justify-content-end gap-2">
                          {isHR && (
                            <button type="button" className="btn btn-sm btn-light border text-danger" onClick={() => { setSelectedInterview(iv); setConfirmAction('cancelInterview'); }}>
                              <i className="bi bi-x-circle me-1"></i> Cancel
                            </button>
                          )}
                          {isHR && (
                            <button type="button" className="btn btn-sm btn-light border" onClick={() => openModal('reschedule', iv)}>
                              <i className="bi bi-calendar2-week me-1"></i> Reschedule
                            </button>
                          )}
                          {(isHR || iv.interviewer_id === user?.id) && (
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => openModal('evaluate', iv)}>
                              <i className="bi bi-pencil-square me-1"></i> Record evaluation
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {offer && isHR && (
            <div className="card-rf p-4 mb-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="section-title mb-0">Offer</h2>
                <StatusBadge status={offer.status} audience="offer" />
              </div>
              <div className="row g-3">
                {offer.designation && (
                  <div className="col-12">
                    <div className="field-label">Designation</div>
                    <div className="fw-semibold">{offer.designation}</div>
                  </div>
                )}
                <div className="col-sm-6">
                  <div className="field-label">Annual salary</div>
                  <div className="fs-5 fw-bold text-success">{formatCurrency(offer.salary)}</div>
                </div>
                <div className="col-sm-6">
                  <div className="field-label">Offer date</div>
                  <div className="fw-medium">{formatDate(offer.offer_date)}</div>
                </div>
                <div className="col-sm-6">
                  <div className="field-label">Joining date</div>
                  <div className="fw-medium">{formatDate(offer.joining_date)}</div>
                </div>
                <div className="col-sm-6">
                  <div className="field-label">Respond by</div>
                  <div className={`fw-medium ${offerExpired ? 'text-danger' : ''}`}>{formatDate(offer.expiry_date)}</div>
                </div>
                {offer.notes && (
                  <div className="col-12">
                    <div className="field-label">Offer details</div>
                    <div className="small prewrap">{offer.notes}</div>
                  </div>
                )}
              </div>
              <div className="border-top pt-3 mt-3 small">
                {offer.status === 'SENT' && <span className="text-muted"><i className="bi bi-hourglass-split me-1"></i>Waiting for the candidate to accept or decline in their portal.</span>}
                {offer.status === 'EXPIRED' && <span className="text-danger"><i className="bi bi-hourglass-bottom me-1"></i>The candidate did not respond before the expiry date. You can reject the application to close it out.</span>}
                {offer.status === 'ACCEPTED' && app.status === 'OFFER_ACCEPTED' && <span className="text-success fw-semibold"><i className="bi bi-check-circle-fill me-1"></i>Accepted by the candidate. Confirm the hire to complete the workflow.</span>}
                {offer.status === 'ACCEPTED' && app.status === 'HIRED' && <span className="text-success fw-semibold"><i className="bi bi-trophy-fill me-1"></i>Accepted and hired.</span>}
                {offer.status === 'REJECTED' && <span className="text-danger"><i className="bi bi-x-circle-fill me-1"></i>Declined by the candidate. The application is closed.</span>}
              </div>
            </div>
          )}
        </div>

        <div className="col-12 col-lg-4">
          <div className="card-rf p-4 action-panel">
            <h2 className="section-title">Next step</h2>
            <div className="d-grid gap-2">
              {isHR && app.status === 'APPLIED' && (
                <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => runAction(() => applicationService.screenApplication(id), 'Moved to screening.')}>
                  <i className="bi bi-search me-1"></i> Start screening
                </button>
              )}
              {isHR && app.status === 'SCREENING' && (
                <button type="button" className="btn btn-success" disabled={submitting} onClick={() => runAction(() => applicationService.shortlistApplication(id), 'Candidate shortlisted. Schedule an interview next.')}>
                  <i className="bi bi-star me-1"></i> Shortlist candidate
                </button>
              )}
              {isHR && app.status === 'SHORTLISTED' && (
                <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => openModal('schedule')}>
                  <i className="bi bi-calendar-plus me-1"></i> Schedule interview
                </button>
              )}
              {canEvaluate && (
                <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => openModal('evaluate', pendingInterview)}>
                  <i className="bi bi-pencil-square me-1"></i> Record interview evaluation
                </button>
              )}
              {isHR && app.status === 'INTERVIEWED' && latestInterview?.result === 'PASS' && (
                <button type="button" className="btn btn-success" disabled={submitting} onClick={() => setConfirmAction('select')}>
                  <i className="bi bi-award me-1"></i> Select for hire
                </button>
              )}
              {isHR && app.status === 'INTERVIEWED' && latestInterview?.result === 'FAIL' && (
                <div className="state-callout state-callout-danger">The candidate did not pass the interview and cannot be selected.</div>
              )}
              {isHR && app.status === 'SELECTED' && (
                <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => openModal('offer')}>
                  <i className="bi bi-envelope-paper me-1"></i> Create & send offer
                </button>
              )}
              {app.status === 'OFFER_SENT' && !offerExpired && (
                <div className="state-callout">
                  <i className="bi bi-envelope-paper me-1"></i> Offer sent — awaiting the candidate's response.
                </div>
              )}
              {app.status === 'OFFER_SENT' && offerExpired && (
                <div className="state-callout state-callout-warning">
                  <i className="bi bi-hourglass-bottom me-1"></i> Offer expired without a response.
                </div>
              )}
              {isHR && app.status === 'OFFER_ACCEPTED' && (
                <button type="button" className="btn btn-success" disabled={submitting} onClick={() => setConfirmAction('hire')}>
                  <i className="bi bi-person-check me-1"></i> Mark as hired
                </button>
              )}
              {app.status === 'HIRED' && (
                <div className="state-callout state-callout-success">
                  <i className="bi bi-trophy-fill me-1"></i> Hired — recruitment complete.
                </div>
              )}
              {app.status === 'REJECTED' && <div className="state-callout state-callout-danger">No further actions available.</div>}
              {!isHR && !canEvaluate && app.status !== 'HIRED' && app.status !== 'REJECTED' && (
                <div className="state-callout">No action needed from you right now.</div>
              )}

              {canReject && (
                <button type="button" className="btn btn-outline-danger mt-2" disabled={submitting} onClick={() => setConfirmAction('reject')}>
                  <i className="bi bi-x-octagon me-1"></i> Reject application
                </button>
              )}
            </div>

            <div className="rules-box mt-4">
              <div className="fw-semibold mb-1">Workflow rules</div>
              <ul className="mb-0 ps-3">
                <li>Screen before shortlisting.</li>
                <li>Only shortlisted candidates can be interviewed.</li>
                <li>A passing interview is required for selection.</li>
                <li>Only selected candidates receive offers.</li>
                <li>Hiring requires the candidate's acceptance.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule / Reschedule Interview */}
      <Modal title={modal === 'reschedule' ? 'Reschedule interview' : 'Schedule interview'} isOpen={modal === 'schedule' || modal === 'reschedule'} onClose={closeModal}>
        <form onSubmit={handleScheduleSubmit} noValidate>
          {formError && <ErrorMessage message={formError} />}
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="iv-type" className="form-label">Round type</label>
              <input id="iv-type" type="text" maxLength={50} className="form-control" value={scheduleForm.type} onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })} placeholder="e.g. Technical Round 1" required />
            </div>
            <div className="col-md-6">
              <label htmlFor="iv-interviewer" className="form-label">Interviewer</label>
              <select id="iv-interviewer" className="form-select" value={scheduleForm.interviewer_id} onChange={(e) => setScheduleForm({ ...scheduleForm, interviewer_id: e.target.value })} required>
                <option value="">Select interviewer</option>
                {interviewers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.toLowerCase()})</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label htmlFor="iv-when" className="form-label">Date & time</label>
              <input id="iv-when" type="datetime-local" className="form-control" min={dateTimeInputValue(new Date())} value={scheduleForm.scheduled_at} onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })} required />
            </div>
            <div className="col-md-6">
              <label htmlFor="iv-link" className="form-label">Meeting link <span className="text-muted fw-normal">(optional)</span></label>
              <input id="iv-link" type="url" maxLength={500} className="form-control" value={scheduleForm.meeting_link} onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_link: e.target.value })} placeholder="https://meet.google.com/..." />
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 mt-4 border-top">
            <button type="button" className="btn btn-light border" onClick={closeModal} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>}
              {modal === 'reschedule' ? 'Save new time' : 'Schedule interview'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Evaluate Interview */}
      <Modal title="Record interview evaluation" isOpen={modal === 'evaluate'} onClose={closeModal}>
        <form onSubmit={handleEvaluateSubmit} noValidate>
          {formError && <ErrorMessage message={formError} />}
          <p className="text-muted small">Rate each area from 1 (poor) to 10 (excellent). The recommendation decides whether the candidate can be selected.</p>
          <div className="row g-3 mb-3">
            {[
              ['technical_rating', 'Technical skills'],
              ['communication_rating', 'Communication'],
              ['problem_solving_rating', 'Problem solving'],
              ['overall_rating', 'Overall']
            ].map(([field, label]) => (
              <div key={field} className="col-6 col-md-3">
                <label htmlFor={`ev-${field}`} className="form-label small">{label}</label>
                <input id={`ev-${field}`} type="number" min="1" max="10" step="1" className="form-control" value={evaluateForm[field]} onChange={(e) => setEvaluateForm({ ...evaluateForm, [field]: e.target.value })} required />
              </div>
            ))}
          </div>
          <div className="mb-3">
            <label htmlFor="ev-feedback" className="form-label">Feedback</label>
            <textarea id="ev-feedback" className="form-control" rows="4" maxLength={5000} value={evaluateForm.feedback} onChange={(e) => setEvaluateForm({ ...evaluateForm, feedback: e.target.value })} placeholder="Strengths, concerns, and evidence for the recommendation" required></textarea>
          </div>
          <fieldset className="mb-2">
            <legend className="form-label">Recommendation</legend>
            <div className="d-flex gap-2">
              <input type="radio" className="btn-check" name="ev-result" id="ev-pass" checked={evaluateForm.result === 'PASS'} onChange={() => setEvaluateForm({ ...evaluateForm, result: 'PASS' })} />
              <label className="btn btn-outline-success flex-fill" htmlFor="ev-pass"><i className="bi bi-check-lg me-1"></i>Pass</label>
              <input type="radio" className="btn-check" name="ev-result" id="ev-fail" checked={evaluateForm.result === 'FAIL'} onChange={() => setEvaluateForm({ ...evaluateForm, result: 'FAIL' })} />
              <label className="btn btn-outline-danger flex-fill" htmlFor="ev-fail"><i className="bi bi-x-lg me-1"></i>Fail</label>
            </div>
          </fieldset>
          <div className="d-flex justify-content-end gap-2 pt-3 mt-3 border-top">
            <button type="button" className="btn btn-light border" onClick={closeModal} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>}
              Submit evaluation
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Offer */}
      <Modal title="Create offer" isOpen={modal === 'offer'} onClose={closeModal}>
        <form onSubmit={handleOfferSubmit} noValidate>
          {formError && <ErrorMessage message={formError} />}
          <div className="row g-3">
            <div className="col-12">
              <label htmlFor="of-designation" className="form-label">Designation</label>
              <input id="of-designation" type="text" maxLength={150} className="form-control" placeholder="e.g. Senior Backend Engineer" value={offerForm.designation} onChange={(e) => setOfferForm({ ...offerForm, designation: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label htmlFor="of-salary" className="form-label">Annual salary ($)</label>
              <input id="of-salary" type="number" min="1" step="1000" className="form-control" placeholder="e.g. 115000" value={offerForm.salary} onChange={(e) => setOfferForm({ ...offerForm, salary: e.target.value })} required />
            </div>
            <div className="col-md-6">
              <label htmlFor="of-date" className="form-label">Offer date</label>
              <input id="of-date" type="date" className="form-control" value={offerForm.offer_date} onChange={(e) => setOfferForm({ ...offerForm, offer_date: e.target.value })} required />
            </div>
            <div className="col-md-6">
              <label htmlFor="of-join" className="form-label">Joining date</label>
              <input id="of-join" type="date" className="form-control" min={offerForm.offer_date} value={offerForm.joining_date} onChange={(e) => setOfferForm({ ...offerForm, joining_date: e.target.value })} required />
            </div>
            <div className="col-md-6">
              <label htmlFor="of-expiry" className="form-label">Candidate must respond by</label>
              <input id="of-expiry" type="date" className="form-control" min={dateInputValue(0)} value={offerForm.expiry_date} onChange={(e) => setOfferForm({ ...offerForm, expiry_date: e.target.value })} required />
            </div>
            <div className="col-12">
              <label htmlFor="of-notes" className="form-label">Offer details <span className="text-muted fw-normal">(optional)</span></label>
              <textarea id="of-notes" rows={3} maxLength={5000} className="form-control" placeholder="Benefits, bonus, reporting manager, conditions…" value={offerForm.notes} onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 pt-3 mt-4 border-top">
            <button type="button" className="btn btn-light border" onClick={closeModal} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>}
              Send offer
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={CONFIRM_COPY[confirmAction]?.title}
        message={CONFIRM_COPY[confirmAction]?.message}
        confirmLabel={CONFIRM_COPY[confirmAction]?.label}
        variant={CONFIRM_COPY[confirmAction]?.variant}
        busy={submitting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

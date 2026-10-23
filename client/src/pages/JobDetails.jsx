/**
 * RecruitFlow — Job Requisition Details Page
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { jobService } from '../services/jobService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Notice from '../components/Notice';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate, formatSalaryRange, getErrorMessage, splitSkills, dateInputValue } from '../utils/formatters';

export default function JobDetails() {
  const { id } = useParams();
  const location = useLocation();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState(location.state?.feedback || '');
  const [pendingAction, setPendingAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchJob = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await jobService.getJobById(id);
      setJob(res.data);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to fetch job details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runAction = async () => {
    try {
      setBusy(true);
      setActionError('');
      if (pendingAction === 'publish') {
        const res = await jobService.publishJob(id);
        setJob(res.data);
        setFeedback('Job published. Candidates can now apply.');
      } else {
        const res = await jobService.closeJob(id);
        setJob(res.data);
        setFeedback('Job closed. New applications are blocked.');
      }
    } catch (err) {
      setFeedback('');
      setActionError(getErrorMessage(err, 'Action failed.'));
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  };

  if (loading) return <Loading message="Loading job details..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={fetchJob} />;
  if (!job) return null;

  const deadlinePassed = job.deadline && job.deadline < dateInputValue(0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <h1 className="page-title mb-0">{job.title}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="page-subtitle">
            Job #{job.id} · {job.department} · Created by {job.creator_name || 'HR'}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/jobs" className="btn btn-light border">
            <i className="bi bi-arrow-left me-1"></i> Back
          </Link>
          {job.status !== 'CLOSED' && (
            <Link to={`/jobs/${job.id}/edit`} className="btn btn-outline-primary">
              <i className="bi bi-pencil me-1"></i> Edit
            </Link>
          )}
          {job.status === 'DRAFT' && (
            <button type="button" onClick={() => setPendingAction('publish')} className="btn btn-success">
              <i className="bi bi-megaphone me-1"></i> Publish
            </button>
          )}
          {job.status === 'PUBLISHED' && (
            <button type="button" onClick={() => setPendingAction('close')} className="btn btn-outline-danger">
              <i className="bi bi-lock me-1"></i> Close
            </button>
          )}
        </div>
      </div>

      <Notice message={feedback} onClose={() => setFeedback('')} />
      {actionError && <ErrorMessage message={actionError} />}
      {deadlinePassed && job.status !== 'CLOSED' && (
        <Notice
          type="warning"
          message={
            job.status === 'DRAFT'
              ? 'The application deadline has passed. Update the deadline before publishing.'
              : 'The application deadline has passed, so this job is hidden from candidates. Close it or extend the deadline.'
          }
        />
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <div className="card-rf p-4">
            <h2 className="section-title">Role overview</h2>
            <p className="text-secondary prewrap mb-4">{job.description}</p>

            <h2 className="section-title">Required skills</h2>
            <div className="d-flex flex-wrap gap-2">
              {splitSkills(job.skills).map((skill) => (
                <span key={skill} className="chip chip-primary">{skill}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card-rf p-4">
            <h2 className="section-title">Details</h2>
            <dl className="detail-list">
              <dt><i className="bi bi-geo-alt"></i> Location</dt>
              <dd>{job.location}</dd>
              <dt><i className="bi bi-clock"></i> Type</dt>
              <dd>{job.employment_type}</dd>
              <dt><i className="bi bi-briefcase"></i> Experience</dt>
              <dd>{job.experience_required}</dd>
              <dt><i className="bi bi-cash-stack"></i> Salary</dt>
              <dd>{formatSalaryRange(job.salary_min, job.salary_max)}</dd>
              <dt><i className="bi bi-calendar-x"></i> Deadline</dt>
              <dd className={deadlinePassed ? 'text-danger' : ''}>{formatDate(job.deadline)}</dd>
            </dl>
            <Link to={`/applications?job_id=${job.id}`} className="btn btn-primary w-100 mt-2">
              <i className="bi bi-people me-1"></i> View applicants
            </Link>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        title={pendingAction === 'publish' ? 'Publish job opening?' : 'Close job opening?'}
        message={
          pendingAction === 'publish'
            ? 'Candidates will be able to see and apply to this job until its deadline.'
            : 'The job will stop accepting applications. Closed jobs cannot be republished or edited.'
        }
        confirmLabel={pendingAction === 'publish' ? 'Publish' : 'Close job'}
        variant={pendingAction === 'publish' ? 'success' : 'danger'}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

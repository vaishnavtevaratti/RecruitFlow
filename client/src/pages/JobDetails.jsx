/**
 * RecruitFlow — Job Requisition Details Page
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobService } from '../services/jobService';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await jobService.getJobById(id);
      if (res.success && res.data) {
        setJob(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch job details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [id]);

  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to publish this job?')) return;
    try {
      const res = await jobService.publishJob(id);
      if (res.success) {
        setFeedback('Job published successfully! Public applicants can now apply.');
        fetchJob();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish job.');
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Are you sure you want to close this job?')) return;
    try {
      const res = await jobService.closeJob(id);
      if (res.success) {
        setFeedback('Job closed successfully. Application intake is now paused.');
        fetchJob();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close job.');
    }
  };

  if (loading) return <Loading message="Loading requisition details..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchJob} />;
  if (!job) return null;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-3">
            <h1 className="page-title mb-0">{job.title}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="page-subtitle">
            Requisition ID: #{job.id} &bull; Department: {job.department} &bull; Created by {job.creator_name || 'HR'}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/jobs" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-left me-1"></i> Back
          </Link>
          {job.status !== 'CLOSED' && (
            <Link to={`/jobs/${job.id}/edit`} className="btn btn-outline-primary">
              <i className="bi bi-pencil me-1"></i> Edit
            </Link>
          )}
          {job.status === 'DRAFT' && (
            <button onClick={handlePublish} className="btn btn-success">
              <i className="bi bi-cloud-upload me-1"></i> Publish Opening
            </button>
          )}
          {job.status === 'PUBLISHED' && (
            <button onClick={handleClose} className="btn btn-danger">
              <i className="bi bi-lock me-1"></i> Close Opening
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show rounded-3 shadow-sm mb-4">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button type="button" className="btn-close" onClick={() => setFeedback('')}></button>
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <div className="card-rf p-4 mb-4">
            <h5 className="fw-bold mb-3 border-bottom pb-2">Role Overview</h5>
            <p className="text-secondary" style={{ whiteSpace: 'pre-line', lineHeight: '1.7' }}>
              {job.description}
            </p>

            <h5 className="fw-bold mt-4 mb-3 border-bottom pb-2">Required Skills & Stack</h5>
            <div className="d-flex flex-wrap gap-2">
              {job.skills.split(',').map((skill, idx) => (
                <span key={idx} className="badge bg-light text-primary border px-3 py-2 fs-6">
                  {skill.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card-rf p-4 mb-4">
            <h5 className="fw-bold mb-3 border-bottom pb-2">Requisition Details</h5>
            <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="bi bi-building me-1"></i> Department:</span>
                <span className="fw-semibold">{job.department}</span>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="bi bi-geo-alt me-1"></i> Location:</span>
                <span className="fw-semibold">{job.location}</span>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="bi bi-clock me-1"></i> Type:</span>
                <span className="fw-semibold">{job.employment_type}</span>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="bi bi-briefcase me-1"></i> Experience:</span>
                <span className="fw-semibold">{job.experience_required}</span>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="bi bi-cash-stack me-1"></i> Salary Range:</span>
                <span className="fw-semibold">
                  {formatCurrency(job.salary_min)} - {formatCurrency(job.salary_max)}
                </span>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="bi bi-calendar-x me-1"></i> Deadline:</span>
                <span className="fw-semibold text-danger">{formatDate(job.deadline)}</span>
              </li>
            </ul>

            <div className="border-top pt-3 mt-3">
              <Link to={`/applications?job_id=${job.id}`} className="btn btn-primary w-100">
                <i className="bi bi-people me-1"></i> View Candidates for this Role
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * RecruitFlow — Job Application Page
 * Two modes:
 *  - Candidate portal (/candidate/jobs/:id/apply): signed-in candidates apply through the
 *    authenticated endpoint; identity comes from their session, not the form.
 *  - Public (/jobs/:id/apply): guests apply with their contact details.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, Navigate } from 'react-router-dom';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { candidatePortalService } from '../services/candidatePortalService';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { formatDate, formatSalaryRange, getErrorMessage, splitSkills, dateInputValue } from '../utils/formatters';

const PROFILE_FIELDS = ['phone', 'education', 'skills', 'experience', 'resume_url'];

function validate(form, { inPortal }) {
  const errors = {};
  if (!inPortal) {
    if (!form.name.trim()) errors.name = 'Full name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  }
  if (!form.phone.trim()) errors.phone = 'Phone number is required.';
  else if (!/^[0-9+()\-.\s]{5,50}$/.test(form.phone.trim())) errors.phone = 'Use digits, spaces, and + ( ) - . only.';
  if (!form.education.trim()) errors.education = 'Education is required.';
  if (!form.skills.trim()) errors.skills = 'List at least one skill.';
  if (!form.experience.trim()) errors.experience = 'Experience is required.';
  if (form.resume_url.trim() && !/^https?:\/\/\S+$/i.test(form.resume_url.trim())) errors.resume_url = 'Enter a full link starting with http:// or https://.';
  return errors;
}

function PageShell({ inPortal, children }) {
  if (inPortal) return <div style={{ maxWidth: 820 }}>{children}</div>;
  return (
    <div className="public-shell">
      <div className="container py-5" style={{ maxWidth: 820 }}>{children}</div>
    </div>
  );
}

export default function ApplyJob() {
  const { id } = useParams();
  const location = useLocation();
  const { isCandidate } = useAuth();
  const inPortal = location.pathname.startsWith('/candidate/');

  const [job, setJob] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [alreadyApplied, setAlreadyApplied] = useState(null);
  const [submittedApplication, setSubmittedApplication] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
    skills: '',
    experience: '',
    resume_url: ''
  });

  useEffect(() => {
    if (!inPortal && isCandidate) return;
    const load = async () => {
      try {
        setLoading(true);
        setLoadError('');
        const res = await jobService.getJobById(id, !inPortal);
        setJob(res.data);

        if (inPortal) {
          const [profileRes, appsRes] = await Promise.all([
            candidatePortalService.getProfile(),
            candidatePortalService.getApplications()
          ]);
          const c = profileRes.data?.candidate || {};
          const u = profileRes.data?.user || {};
          setProfile(profileRes.data);
          setFormData({
            name: c.name || u.name || '',
            email: u.email || '',
            phone: c.phone || '',
            education: c.education || '',
            skills: c.skills || '',
            experience: c.experience || '',
            resume_url: c.resume_url || ''
          });
          setAlreadyApplied((appsRes.data || []).find((a) => a.job_id === Number(id)) || null);
        }
      } catch (err) {
        setLoadError(getErrorMessage(err, 'This job opening was not found or is no longer available.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, inPortal, isCandidate]);

  // Signed-in candidates always use the portal flow
  if (!inPortal && isCandidate) {
    return <Navigate to={`/candidate/jobs/${id}/apply`} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validate(formData, { inPortal });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please correct the highlighted fields.');
      return;
    }

    try {
      setSubmitting(true);
      let res;
      if (inPortal) {
        // Save any profile edits first so HR reviews the same details the candidate submitted
        const current = profile?.candidate || {};
        const changes = {};
        for (const field of PROFILE_FIELDS) {
          if ((formData[field] || '').trim() !== (current[field] || '')) changes[field] = formData[field].trim();
        }
        if (Object.keys(changes).length > 0) {
          await candidatePortalService.updateProfile(changes);
        }
        res = await candidatePortalService.apply({ job_id: Number(id) });
      } else {
        res = await applicationService.apply({ job_id: Number(id), ...formData });
      }
      setSubmittedApplication(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit application.'));
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) return <Loading message="Loading job opening..." />;

  const backLink = inPortal ? '/candidate/jobs' : '/jobs/public';

  if (loadError || !job) {
    return (
      <PageShell inPortal={inPortal}>
        <ErrorMessage message={loadError || 'Job not found.'} />
        <Link to={backLink} className="btn btn-light border"><i className="bi bi-arrow-left me-1"></i> Back to jobs</Link>
      </PageShell>
    );
  }

  if (submittedApplication) {
    return (
      <PageShell inPortal={inPortal}>
        <div className="card-rf p-4 p-md-5 text-center">
          <div className="success-icon mx-auto mb-3"><i className="bi bi-check-lg"></i></div>
          <h1 className="h3 fw-bold mb-2">Application submitted</h1>
          <p className="text-muted mb-4">
            Your application for <strong>{job.title}</strong> was received and is now with the hiring team.
          </p>
          <dl className="detail-list text-start mx-auto" style={{ maxWidth: 380 }}>
            <dt>Application ID</dt>
            <dd>#{submittedApplication.id}</dd>
            <dt>Status</dt>
            <dd>Applied</dd>
          </dl>
          <div className="d-flex gap-2 justify-content-center flex-wrap mt-4">
            {inPortal ? (
              <>
                <Link to={`/candidate/applications/${submittedApplication.id}`} className="btn btn-primary">Track application</Link>
                <Link to="/candidate/jobs" className="btn btn-light border">Browse more jobs</Link>
              </>
            ) : (
              <>
                <Link to="/application-status" className="btn btn-primary">Check status</Link>
                <Link to="/candidate/signup" className="btn btn-outline-primary">Create an account to track</Link>
                <Link to="/jobs/public" className="btn btn-light border">Back to careers</Link>
              </>
            )}
          </div>
          {!inPortal && (
            <p className="small text-muted mt-3 mb-0">Keep your application ID and email; you need both to check your status.</p>
          )}
        </div>
      </PageShell>
    );
  }

  const deadlinePassed = job.deadline && job.deadline < dateInputValue(0);
  const closed = job.status !== 'PUBLISHED' || deadlinePassed;
  const fieldClass = (name) => `form-control ${fieldErrors[name] ? 'is-invalid' : ''}`;
  const fieldError = (name) => (fieldErrors[name] ? <div className="invalid-feedback d-block">{fieldErrors[name]}</div> : null);

  return (
    <PageShell inPortal={inPortal}>
      <Link to={backLink} className="small text-secondary d-inline-block mb-3">
        <i className="bi bi-arrow-left me-1"></i> Back to jobs
      </Link>

      <div className="card-rf p-4 mb-4">
        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <span className="chip chip-primary mb-2">{job.department}</span>
            <h1 className="h3 fw-bold mb-1">{job.title}</h1>
            <div className="text-muted small d-flex flex-wrap gap-3">
              <span><i className="bi bi-geo-alt me-1"></i>{job.location}</span>
              <span><i className="bi bi-clock me-1"></i>{job.employment_type}</span>
              <span><i className="bi bi-briefcase me-1"></i>{job.experience_required}</span>
              <span><i className="bi bi-cash-stack me-1"></i>{formatSalaryRange(job.salary_min, job.salary_max)}</span>
            </div>
          </div>
          <div className="small text-muted">Apply by <strong>{formatDate(job.deadline)}</strong></div>
        </div>
        <p className="text-secondary prewrap mt-3 mb-3">{job.description}</p>
        <div className="d-flex flex-wrap gap-1">
          {splitSkills(job.skills).map((s) => <span key={s} className="chip">{s}</span>)}
        </div>
      </div>

      {closed ? (
        <div className="card-rf p-5 text-center">
          <i className="bi bi-lock fs-1 text-secondary d-block mb-2"></i>
          <h2 className="h5 fw-semibold">This job is no longer accepting applications</h2>
          <Link to={backLink} className="btn btn-outline-primary btn-sm mt-2">Explore other roles</Link>
        </div>
      ) : alreadyApplied ? (
        <div className="card-rf p-5 text-center">
          <i className="bi bi-check2-circle fs-1 text-success d-block mb-2"></i>
          <h2 className="h5 fw-semibold">You have already applied to this job</h2>
          <Link to={`/candidate/applications/${alreadyApplied.id}`} className="btn btn-primary btn-sm mt-2">View application status</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="card-rf p-4">
          <h2 className="section-title">Your details</h2>
          {error && <ErrorMessage message={error} />}
          {!inPortal && error.toLowerCase().includes('sign in') && (
            <Link to="/candidate/login" state={{ from: { pathname: `/candidate/jobs/${id}/apply` } }} className="btn btn-sm btn-primary mb-3">
              Sign in to apply
            </Link>
          )}

          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="ap-name" className="form-label">Full name {!inPortal && <span className="text-danger">*</span>}</label>
              <input id="ap-name" name="name" className={fieldClass('name')} maxLength={100} value={formData.name} onChange={handleChange} disabled={inPortal} autoComplete="name" />
              {fieldError('name')}
            </div>
            <div className="col-md-6">
              <label htmlFor="ap-email" className="form-label">Email {!inPortal && <span className="text-danger">*</span>}</label>
              <input id="ap-email" type="email" name="email" className={fieldClass('email')} maxLength={255} value={formData.email} onChange={handleChange} disabled={inPortal} autoComplete="email" />
              {inPortal && <div className="form-text">Your account email is used for this application.</div>}
              {fieldError('email')}
            </div>
            <div className="col-md-6">
              <label htmlFor="ap-phone" className="form-label">Phone <span className="text-danger">*</span></label>
              <input id="ap-phone" type="tel" name="phone" className={fieldClass('phone')} maxLength={50} placeholder="+91 98765 43210" value={formData.phone} onChange={handleChange} autoComplete="tel" />
              {fieldError('phone')}
            </div>
            <div className="col-md-6">
              <label htmlFor="ap-exp" className="form-label">Total experience <span className="text-danger">*</span></label>
              <input id="ap-exp" name="experience" className={fieldClass('experience')} maxLength={50} placeholder="e.g. 4 years" value={formData.experience} onChange={handleChange} />
              {fieldError('experience')}
            </div>
            <div className="col-12">
              <label htmlFor="ap-edu" className="form-label">Education <span className="text-danger">*</span></label>
              <input id="ap-edu" name="education" className={fieldClass('education')} maxLength={255} placeholder="e.g. B.Tech in Computer Science" value={formData.education} onChange={handleChange} />
              {fieldError('education')}
            </div>
            <div className="col-12">
              <label htmlFor="ap-skills" className="form-label">Skills <span className="text-danger">*</span></label>
              <textarea id="ap-skills" name="skills" rows="2" className={fieldClass('skills')} maxLength={2000} placeholder="e.g. React, JavaScript, Node.js, MySQL" value={formData.skills} onChange={handleChange}></textarea>
              <div className="form-text">Comma-separated.</div>
              {fieldError('skills')}
            </div>
            <div className="col-12">
              <label htmlFor="ap-resume" className="form-label">Resume or portfolio link</label>
              <input id="ap-resume" type="url" name="resume_url" className={fieldClass('resume_url')} maxLength={500} placeholder="https://..." value={formData.resume_url} onChange={handleChange} />
              {fieldError('resume_url')}
            </div>
          </div>

          {inPortal && <p className="small text-muted mt-3 mb-0">Changes to these fields are saved to your profile.</p>}

          <button type="submit" className="btn btn-primary w-100 py-2 mt-4 fw-semibold" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Submitting...
              </>
            ) : (
              'Submit application'
            )}
          </button>
          {!inPortal && (
            <p className="small text-muted text-center mt-3 mb-0">
              Have an account? <Link to="/candidate/login" state={{ from: { pathname: `/candidate/jobs/${id}/apply` } }}>Sign in to apply</Link>
            </p>
          )}
        </form>
      )}
    </PageShell>
  );
}

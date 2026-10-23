/**
 * RecruitFlow — Candidate Registration Page
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import { getErrorMessage } from '../utils/formatters';

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Full name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (form.password.length < 6) errors.password = 'Use at least 6 characters.';
  else if (form.password.length > 72) errors.password = 'Use at most 72 characters.';
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
  if (form.phone.trim() && !/^[0-9+()\-.\s]{5,50}$/.test(form.phone.trim())) errors.phone = 'Use digits, spaces, and + ( ) - . only.';
  if (form.resume_url.trim() && !/^https?:\/\/\S+$/i.test(form.resume_url.trim())) errors.resume_url = 'Enter a full link starting with http:// or https://.';
  return errors;
}

export default function CandidateSignup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    education: '',
    skills: '',
    experience: '',
    resume_url: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { candidateSignup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validate(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setLoading(true);
      const { confirmPassword, ...payload } = formData;
      await candidateSignup({ ...payload, email: payload.email.trim(), name: payload.name.trim() });
      navigate('/candidate/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (name) => `form-control ${fieldErrors[name] ? 'is-invalid' : ''}`;
  const fieldError = (name) => (fieldErrors[name] ? <div className="invalid-feedback d-block">{fieldErrors[name]}</div> : null);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: '640px' }}>
        <div className="text-center mb-4">
          <div className="auth-logo mx-auto mb-3"><i className="bi bi-person-plus-fill"></i></div>
          <h1 className="h3 fw-bold mb-1">Create your candidate account</h1>
          <p className="text-muted small mb-0">Apply to jobs, follow your progress, and respond to offers in one place</p>
        </div>

        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="su-name" className="form-label">Full name <span className="text-danger">*</span></label>
              <input id="su-name" name="name" className={fieldClass('name')} maxLength={100} value={formData.name} onChange={handleChange} autoComplete="name" />
              {fieldError('name')}
            </div>
            <div className="col-md-6">
              <label htmlFor="su-email" className="form-label">Email <span className="text-danger">*</span></label>
              <input id="su-email" type="email" name="email" className={fieldClass('email')} maxLength={255} value={formData.email} onChange={handleChange} autoComplete="email" />
              {fieldError('email')}
            </div>
            <div className="col-md-6">
              <label htmlFor="su-password" className="form-label">Password <span className="text-danger">*</span></label>
              <input id="su-password" type="password" name="password" className={fieldClass('password')} value={formData.password} onChange={handleChange} autoComplete="new-password" />
              {fieldError('password') || <div className="form-text">At least 6 characters.</div>}
            </div>
            <div className="col-md-6">
              <label htmlFor="su-confirm" className="form-label">Confirm password <span className="text-danger">*</span></label>
              <input id="su-confirm" type="password" name="confirmPassword" className={fieldClass('confirmPassword')} value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" />
              {fieldError('confirmPassword')}
            </div>
          </div>

          <h2 className="section-title mt-4">Profile <span className="text-muted fw-normal small">(optional, you can add this later)</span></h2>
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="su-phone" className="form-label">Phone</label>
              <input id="su-phone" type="tel" name="phone" className={fieldClass('phone')} maxLength={50} value={formData.phone} onChange={handleChange} autoComplete="tel" />
              {fieldError('phone')}
            </div>
            <div className="col-md-6">
              <label htmlFor="su-exp" className="form-label">Total experience</label>
              <input id="su-exp" name="experience" className="form-control" maxLength={50} placeholder="e.g. 3 years" value={formData.experience} onChange={handleChange} />
            </div>
            <div className="col-12">
              <label htmlFor="su-edu" className="form-label">Education</label>
              <input id="su-edu" name="education" className="form-control" maxLength={255} placeholder="e.g. B.Tech in Computer Science" value={formData.education} onChange={handleChange} />
            </div>
            <div className="col-12">
              <label htmlFor="su-skills" className="form-label">Skills</label>
              <input id="su-skills" name="skills" className="form-control" maxLength={2000} placeholder="e.g. React, Node.js, SQL" value={formData.skills} onChange={handleChange} />
            </div>
            <div className="col-12">
              <label htmlFor="su-resume" className="form-label">Resume or portfolio link</label>
              <input id="su-resume" type="url" name="resume_url" className={fieldClass('resume_url')} maxLength={500} placeholder="https://..." value={formData.resume_url} onChange={handleChange} />
              {fieldError('resume_url')}
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-100 py-2 mt-4 fw-semibold" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Creating account...
              </>
            ) : 'Create account'}
          </button>
        </form>

        <div className="text-center mt-4 pt-3 border-top small">
          <p className="text-muted mb-1">
            Already registered? <Link to="/candidate/login" className="fw-semibold">Sign in</Link>
          </p>
          <Link to="/jobs/public" className="text-secondary">Browse open jobs</Link>
        </div>
      </div>
    </div>
  );
}

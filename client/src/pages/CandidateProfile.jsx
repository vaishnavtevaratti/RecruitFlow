/**
 * RecruitFlow — Candidate Profile Page
 * Reads and updates only the signed-in candidate's profile (identity comes from the session).
 */

import React, { useState, useEffect } from 'react';
import { candidatePortalService } from '../services/candidatePortalService';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Notice from '../components/Notice';
import { formatDate, getErrorMessage, splitSkills } from '../utils/formatters';

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  if (form.phone.trim() && !/^[0-9+()\-.\s]{5,50}$/.test(form.phone.trim())) errors.phone = 'Use digits, spaces, and + ( ) - . only.';
  if (form.resume_url.trim() && !/^https?:\/\/\S+$/i.test(form.resume_url.trim())) errors.resume_url = 'Enter a full link starting with http:// or https://.';
  if (form.experience.trim().length > 50) errors.experience = 'Keep this to 50 characters (e.g. "4 years").';
  return errors;
}

export default function CandidateProfile() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', education: '', skills: '', experience: '', resume_url: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const applyProfile = (data) => {
    setProfile(data);
    const cand = data.candidate || {};
    const usr = data.user || {};
    setFormData({
      name: cand.name || usr.name || '',
      phone: cand.phone || '',
      education: cand.education || '',
      skills: cand.skills || '',
      experience: cand.experience || '',
      resume_url: cand.resume_url || ''
    });
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await candidatePortalService.getProfile();
      applyProfile(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load profile.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const errors = validate(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSaving(true);
      const res = await candidatePortalService.updateProfile(formData);
      applyProfile(res.data);
      updateUser({ name: res.data.user?.name });
      setSuccess('Profile saved.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Loading your profile..." />;
  if (!profile) return <ErrorMessage message={error || 'Profile unavailable.'} onRetry={fetchProfile} />;

  const fieldClass = (name) => `form-control ${fieldErrors[name] ? 'is-invalid' : ''}`;
  const fieldError = (name) => (fieldErrors[name] ? <div className="invalid-feedback d-block">{fieldErrors[name]}</div> : null);
  const savedCandidate = profile.candidate || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Recruiters see these details when reviewing your applications</p>
        </div>
      </div>

      <Notice message={success} onClose={() => setSuccess('')} />
      {error && <ErrorMessage message={error} />}

      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <div className="card-rf p-4 text-center">
            <div className="avatar-circle avatar-xl mx-auto mb-3" aria-hidden="true">{(savedCandidate.name || profile.user?.name || 'U').charAt(0).toUpperCase()}</div>
            <h2 className="h5 fw-semibold mb-1">{savedCandidate.name || profile.user?.name}</h2>
            <p className="text-muted small mb-3 text-break">{profile.user?.email}</p>
            <dl className="detail-list text-start small mb-0">
              <dt>Member since</dt>
              <dd>{formatDate(profile.user?.created_at)}</dd>
              <dt>Phone</dt>
              <dd>{savedCandidate.phone || '—'}</dd>
              <dt>Experience</dt>
              <dd>{savedCandidate.experience || '—'}</dd>
            </dl>
            {splitSkills(savedCandidate.skills).length > 0 && (
              <div className="d-flex flex-wrap gap-1 justify-content-center mt-3">
                {splitSkills(savedCandidate.skills).map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <form onSubmit={handleSubmit} noValidate className="card-rf p-4">
            <h2 className="section-title">Edit details</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="pf-name" className="form-label">Full name</label>
                <input id="pf-name" name="name" className={fieldClass('name')} maxLength={100} value={formData.name} onChange={handleChange} autoComplete="name" />
                {fieldError('name')}
              </div>
              <div className="col-md-6">
                <label htmlFor="pf-email" className="form-label">Email</label>
                <input id="pf-email" type="email" className="form-control" value={profile.user?.email || ''} disabled />
                <div className="form-text">Email is your sign-in ID and cannot be changed.</div>
              </div>
              <div className="col-md-6">
                <label htmlFor="pf-phone" className="form-label">Phone</label>
                <input id="pf-phone" type="tel" name="phone" className={fieldClass('phone')} maxLength={50} value={formData.phone} onChange={handleChange} autoComplete="tel" />
                {fieldError('phone')}
              </div>
              <div className="col-md-6">
                <label htmlFor="pf-exp" className="form-label">Total experience</label>
                <input id="pf-exp" name="experience" className={fieldClass('experience')} maxLength={50} placeholder="e.g. 3 years" value={formData.experience} onChange={handleChange} />
                {fieldError('experience')}
              </div>
              <div className="col-12">
                <label htmlFor="pf-edu" className="form-label">Education</label>
                <input id="pf-edu" name="education" className="form-control" maxLength={255} value={formData.education} onChange={handleChange} />
              </div>
              <div className="col-12">
                <label htmlFor="pf-skills" className="form-label">Skills</label>
                <textarea id="pf-skills" name="skills" rows="2" className="form-control" maxLength={2000} placeholder="Comma-separated, e.g. React, Node.js, SQL" value={formData.skills} onChange={handleChange}></textarea>
              </div>
              <div className="col-12">
                <label htmlFor="pf-resume" className="form-label">Resume or portfolio link</label>
                <input id="pf-resume" type="url" name="resume_url" className={fieldClass('resume_url')} maxLength={500} placeholder="https://..." value={formData.resume_url} onChange={handleChange} />
                {fieldError('resume_url')}
              </div>
            </div>
            <div className="d-flex justify-content-end mt-4 pt-3 border-top">
              <button type="submit" disabled={saving} className="btn btn-primary px-4">
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

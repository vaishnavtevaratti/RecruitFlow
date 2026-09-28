/**
 * RecruitFlow — Candidate Profile Page
 * Displays candidate profile and allows in-place updates.
 */

import React, { useState, useEffect } from 'react';
import { candidatePortalService } from '../services/candidatePortalService';
import Loading from '../components/Loading';

export default function CandidateProfile() {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    education: '',
    skills: '',
    experience: '',
    resume_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await candidatePortalService.getProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        const cand = res.data.candidate || {};
        const usr = res.data.user || {};
        setFormData({
          name: cand.name || usr.name || '',
          phone: cand.phone || '',
          education: cand.education || '',
          skills: cand.skills || '',
          experience: cand.experience || '',
          resume_url: cand.resume_url || ''
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setSaving(true);
      const res = await candidatePortalService.updateProfile(formData);
      setSuccess(res.message || 'Profile updated successfully.');
      if (res.data) {
        setProfile(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Loading candidate profile..." />;
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">My Profile</h2>
          <p className="text-muted small mb-0">Manage your contact information, credentials, and resume</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="alert alert-success d-flex align-items-center mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2 fs-5"></i>
          <div>{success}</div>
        </div>
      )}

      <div className="row g-4">
        {/* Left: Summary Profile Card */}
        <div className="col-12 col-lg-4">
          <div className="card shadow-sm border-0 text-center p-4">
            <div
              className="rounded-circle bg-primary text-white mx-auto d-flex align-items-center justify-content-center mb-3"
              style={{ width: '72px', height: '72px', fontSize: '2rem' }}
            >
              <i className="bi bi-person-fill"></i>
            </div>
            <h5 className="fw-bold mb-1">{formData.name || profile?.user?.name}</h5>
            <p className="text-muted small mb-2">{profile?.user?.email}</p>
            <span className="badge bg-secondary mb-3 align-self-center">
              Role: {profile?.user?.role}
            </span>

            <hr className="my-3" />

            <div className="text-start small">
              <div className="mb-2">
                <span className="text-muted">Account Registered:</span>{' '}
                <span className="fw-semibold">
                  {profile?.user?.created_at
                    ? new Date(profile.user.created_at).toLocaleDateString()
                    : 'Active'}
                </span>
              </div>
              {formData.phone && (
                <div className="mb-2">
                  <span className="text-muted">Phone:</span>{' '}
                  <span className="fw-semibold">{formData.phone}</span>
                </div>
              )}
              {formData.resume_url && (
                <div>
                  <span className="text-muted">Resume:</span>{' '}
                  <a
                    href={formData.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-decoration-none"
                  >
                    View Link <i className="bi bi-box-arrow-up-right small"></i>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Editable Form */}
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0 fw-bold">Edit Profile Information</h5>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Email Address (Read-Only)</label>
                    <input
                      type="email"
                      className="form-control bg-light"
                      value={profile?.user?.email || ''}
                      disabled
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      className="form-control"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Resume / Portfolio URL</label>
                    <input
                      type="url"
                      name="resume_url"
                      className="form-control"
                      value={formData.resume_url}
                      onChange={handleChange}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold">Highest Education</label>
                    <input
                      type="text"
                      name="education"
                      className="form-control"
                      value={formData.education}
                      onChange={handleChange}
                      placeholder="e.g. B.S. in Computer Science"
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold">Skills (Comma-separated)</label>
                    <input
                      type="text"
                      name="skills"
                      className="form-control"
                      value={formData.skills}
                      onChange={handleChange}
                      placeholder="e.g. React, Node.js, Express, MySQL"
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold">Work Experience Summary</label>
                    <textarea
                      name="experience"
                      rows="3"
                      className="form-control"
                      value={formData.experience}
                      onChange={handleChange}
                      placeholder="Describe your relevant work experience..."
                    ></textarea>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-top text-end">
                  <button type="submit" disabled={saving} className="btn btn-primary px-4 shadow-sm">
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

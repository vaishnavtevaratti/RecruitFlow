/**
 * RecruitFlow — Candidate Registration Page
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CandidateSignup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    education: '',
    skills: '',
    experience: '',
    resume_url: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { candidateSignup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setError('Name, email, and password are required.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      await candidateSignup(formData);
      navigate('/candidate/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card shadow-lg p-4 p-md-5" style={{ maxWidth: '620px', width: '100%' }}>
        <div className="text-center mb-4">
          <div className="brand-icon mx-auto mb-2" style={{ width: '48px', height: '48px' }}>
            <i className="bi bi-person-plus-fill fs-4 text-white"></i>
          </div>
          <h2 className="fw-bold mb-1">Create Candidate Account</h2>
          <p className="text-muted small">Register to apply for jobs and track your applications end-to-end</p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center mb-4 py-2 px-3 small" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">Full Name *</label>
              <input
                type="text"
                name="name"
                className="form-control"
                placeholder="e.g. Jane Doe"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">Email Address *</label>
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="jane@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">Password *</label>
              <input
                type="password"
                name="password"
                className="form-control"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-semibold">Phone Number</label>
              <input
                type="tel"
                name="phone"
                className="form-control"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold">Highest Education</label>
              <input
                type="text"
                name="education"
                className="form-control"
                placeholder="e.g. B.S. in Computer Science, University of California"
                value={formData.education}
                onChange={handleChange}
              />
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold">Key Skills</label>
              <input
                type="text"
                name="skills"
                className="form-control"
                placeholder="e.g. React, Node.js, SQL, REST APIs, Git"
                value={formData.skills}
                onChange={handleChange}
              />
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold">Experience Summary</label>
              <textarea
                name="experience"
                rows="2"
                className="form-control"
                placeholder="e.g. 3 years full-stack web development specializing in Node & React"
                value={formData.experience}
                onChange={handleChange}
              ></textarea>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold">Resume / Portfolio Link (Optional)</label>
              <input
                type="url"
                name="resume_url"
                className="form-control"
                placeholder="https://drive.google.com/your-resume or portfolio URL"
                value={formData.resume_url}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2 mt-4 fw-semibold shadow-sm"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Creating Account...
              </>
            ) : (
              'Complete Registration'
            )}
          </button>
        </form>

        <div className="text-center mt-4 pt-3 border-top">
          <p className="text-muted small mb-1">
            Already have a candidate account?{' '}
            <Link to="/candidate/login" className="text-decoration-none fw-semibold">
              Candidate Sign In
            </Link>
          </p>
          <p className="text-muted small mb-0">
            Internal Staff / Recruiter?{' '}
            <Link to="/login" className="text-decoration-none text-secondary">
              Staff Portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

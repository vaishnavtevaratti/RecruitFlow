/**
 * RecruitFlow — Public Candidate Application Form
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { candidatePortalService } from '../services/candidatePortalService';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

export default function ApplyJob() {
  const { id } = useParams();
  const { user, isCandidate } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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
    const fetchJobAndProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await jobService.getJobById(id, true);
        if (res.success && res.data) {
          setJob(res.data);
        }

        // If candidate is logged in, prefill profile
        if (isCandidate) {
          try {
            const profileRes = await candidatePortalService.getProfile();
            if (profileRes.success && profileRes.data) {
              const c = profileRes.data.candidate || {};
              const u = profileRes.data.user || {};
              setFormData((prev) => ({
                ...prev,
                name: c.name || u.name || prev.name,
                email: c.email || u.email || prev.email,
                phone: c.phone || prev.phone,
                education: c.education || prev.education,
                skills: c.skills || prev.skills,
                experience: c.experience || prev.experience,
                resume_url: c.resume_url || prev.resume_url
              }));
            }
          } catch {
            // Non-blocking if profile fetch fails
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Job opening not found or no longer available.');
      } finally {
        setLoading(false);
      }
    };
    fetchJobAndProfile();
  }, [id, isCandidate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.education.trim() || !formData.skills.trim() || !formData.experience.trim()) {
      setError('Please fill in all required candidate fields.');
      return;
    }


    try {
      setSubmitting(true);
      const res = await applicationService.apply({
        job_id: Number(id),
        ...formData
      });

      if (res.success && res.data) {
        setSubmittedApplication(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit application. Please check your details.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading message="Loading job opening..." />;

  if (submittedApplication) {
    return (
      <div className="bg-light min-vh-100 py-5">
        <div className="container" style={{ maxWidth: '640px' }}>
          <div className="card-rf p-5 text-center shadow">
            <div
              className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: '64px', height: '64px', fontSize: '2rem' }}
            >
              <i className="bi bi-check-lg"></i>
            </div>
            <h3 className="fw-bold text-dark mb-2">Application Submitted!</h3>
            <p className="text-muted mb-4">
              Thank you for applying for <strong>{job?.title}</strong>. Your application has been logged into RecruitFlow.
            </p>

            <div className="p-3 bg-light rounded-3 border mb-4 text-start">
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Application ID:</span>
                <span className="fw-bold text-primary">#{submittedApplication.id}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Applicant Name:</span>
                <span className="fw-semibold">{formData.name}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Email:</span>
                <span className="fw-semibold">{formData.email}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Initial Status:</span>
                <span className="badge bg-success">APPLIED</span>
              </div>
            </div>

            <div className="d-flex gap-2 justify-content-center flex-wrap">
              {isCandidate ? (
                <>
                  <Link to={`/candidate/applications/${submittedApplication.id}`} className="btn btn-primary">
                    <i className="bi bi-clock-history me-1"></i> Track in Candidate Portal
                  </Link>
                  <Link to="/candidate/dashboard" className="btn btn-outline-secondary">
                    Candidate Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/jobs/public" className="btn btn-outline-secondary">
                    <i className="bi bi-arrow-left me-1"></i> Back to Careers
                  </Link>
                  <Link to="/application-status" className="btn btn-primary">
                    <i className="bi bi-search me-1"></i> Track Application
                  </Link>
                  <Link to="/candidate/signup" className="btn btn-outline-primary">
                    <i className="bi bi-person-plus me-1"></i> Create Account to Track
                  </Link>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-light min-vh-100 py-5">
      <div className="container" style={{ maxWidth: '760px' }}>
        <div className="mb-4">
          <Link to="/jobs/public" className="text-decoration-none text-secondary small">
            <i className="bi bi-arrow-left me-1"></i> Back to Career Opportunities
          </Link>
        </div>

        {error && <ErrorMessage message={error} />}

        {job && job.status !== 'PUBLISHED' ? (
          <div className="card-rf p-5 text-center text-muted">
            <i className="bi bi-exclamation-circle fs-1 text-warning mb-2 d-block"></i>
            <h4>Job Opening Closed</h4>
            <p className="small mb-3">This requisition is not currently accepting new candidate applications.</p>
            <Link to="/jobs/public" className="btn btn-outline-primary btn-sm">Explore Other Roles</Link>
          </div>
        ) : job ? (
          <div className="card-rf p-4 p-md-5 shadow-sm">
            <div className="border-bottom pb-3 mb-4">
              <span className="badge bg-light text-primary border mb-2">{job.department}</span>
              <h2 className="fw-bold text-dark mb-1">Apply for {job.title}</h2>
              <div className="text-muted small">
                <span><i className="bi bi-geo-alt me-1"></i>{job.location}</span> &bull; <span>{job.employment_type}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <h5 className="fw-bold mb-3 text-secondary" style={{ fontSize: '1rem' }}>Personal & Contact Information</h5>
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small">Full Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    placeholder="Jane Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small">Email Address <span className="text-danger">*</span></label>
                  <input
                    type="email"
                    name="email"
                    className="form-control"
                    placeholder="jane.doe@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small">Phone Number <span className="text-danger">*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-control"
                    placeholder="+1-555-0199"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold small">Total Experience <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="experience"
                    className="form-control"
                    placeholder="e.g. 4 years"
                    value={formData.experience}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <h5 className="fw-bold mb-3 text-secondary" style={{ fontSize: '1rem' }}>Qualifications & Profile</h5>
              <div className="row g-3 mb-4">
                <div className="col-12">
                  <label className="form-label fw-semibold small">Education Degree & Institution <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="education"
                    className="form-control"
                    placeholder="e.g. B.S. in Computer Science, University of Technology"
                    value={formData.education}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small">Technical Skills & Proficiencies <span className="text-danger">*</span></label>
                  <textarea
                    name="skills"
                    className="form-control"
                    rows="2"
                    placeholder="e.g. React, JavaScript, Node.js, Express, MySQL, REST APIs"
                    value={formData.skills}
                    onChange={handleChange}
                    required
                  ></textarea>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small">Online Resume / Portfolio Link</label>
                  <input
                    type="url"
                    name="resume_url"
                    className="form-control"
                    placeholder="https://example.com/resumes/my_resume.pdf"
                    value={formData.resume_url}
                    onChange={handleChange}
                  />
                  <div className="form-text">Provide an accessible link to your PDF resume or LinkedIn portfolio.</div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 py-2 fw-semibold fs-6 rounded-3 shadow-sm"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Submitting Application...
                  </>
                ) : (
                  'Submit Job Application'
                )}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

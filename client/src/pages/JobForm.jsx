/**
 * RecruitFlow — Create / Edit Job Requisition Form
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { jobService } from '../services/jobService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

export default function JobForm() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    department: '',
    description: '',
    skills: '',
    experience_required: '',
    location: '',
    employment_type: 'Full-time',
    salary_min: '',
    salary_max: '',
    deadline: ''
  });

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditMode) {
      const fetchJob = async () => {
        try {
          setLoading(true);
          const res = await jobService.getJobById(id);
          if (res.success && res.data) {
            const j = res.data;
            setFormData({
              title: j.title || '',
              department: j.department || '',
              description: j.description || '',
              skills: j.skills || '',
              experience_required: j.experience_required || '',
              location: j.location || '',
              employment_type: j.employment_type || 'Full-time',
              salary_min: j.salary_min !== null ? j.salary_min : '',
              salary_max: j.salary_max !== null ? j.salary_max : '',
              deadline: j.deadline ? j.deadline.split('T')[0] : ''
            });
          }
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to load job requisition details.');
        } finally {
          setLoading(false);
        }
      };
      fetchJob();
    }
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client validation
    if (!formData.title.trim() || !formData.department.trim() || !formData.description.trim() || !formData.skills.trim() || !formData.deadline) {
      setError('Please fill in all mandatory fields (Title, Department, Description, Skills, Deadline).');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        salary_min: formData.salary_min !== '' ? Number(formData.salary_min) : null,
        salary_max: formData.salary_max !== '' ? Number(formData.salary_max) : null
      };

      if (isEditMode) {
        await jobService.updateJob(id, payload);
      } else {
        await jobService.createJob(payload);
      }

      navigate('/jobs');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save job opening.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Loading requisition details..." />;

  return (
    <div className="container-fluid px-0" style={{ maxWidth: '900px' }}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="page-title">{isEditMode ? 'Edit Job Requisition' : 'Create Job Opening'}</h1>
          <p className="page-subtitle">{isEditMode ? 'Update opening parameters' : 'Define role requirements and posting specifications'}</p>
        </div>
        <Link to="/jobs" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-1"></i> Back to Jobs
        </Link>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="card-rf p-4">
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-12 col-md-8">
              <label className="form-label fw-semibold">Job Title <span className="text-danger">*</span></label>
              <input
                type="text"
                name="title"
                className="form-control"
                placeholder="e.g. Senior Full Stack Engineer"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Department <span className="text-danger">*</span></label>
              <input
                type="text"
                name="department"
                className="form-control"
                placeholder="e.g. Engineering"
                value={formData.department}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12">
              <label className="form-label fw-semibold">Description <span className="text-danger">*</span></label>
              <textarea
                name="description"
                className="form-control"
                rows="4"
                placeholder="Detailed summary of job responsibilities and impact..."
                value={formData.description}
                onChange={handleChange}
                required
              ></textarea>
            </div>

            <div className="col-12">
              <label className="form-label fw-semibold">Required Skills <span className="text-danger">*</span></label>
              <input
                type="text"
                name="skills"
                className="form-control"
                placeholder="e.g. React, Node.js, MySQL, REST APIs"
                value={formData.skills}
                onChange={handleChange}
                required
              />
              <div className="form-text">Comma-separated list of required proficiencies.</div>
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Experience Required <span className="text-danger">*</span></label>
              <input
                type="text"
                name="experience_required"
                className="form-control"
                placeholder="e.g. 3-5 years"
                value={formData.experience_required}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Location <span className="text-danger">*</span></label>
              <input
                type="text"
                name="location"
                className="form-control"
                placeholder="e.g. Remote / Hybrid / New York, NY"
                value={formData.location}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Employment Type</label>
              <select
                name="employment_type"
                className="form-select"
                value={formData.employment_type}
                onChange={handleChange}
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Salary Minimum ($)</label>
              <input
                type="number"
                name="salary_min"
                className="form-control"
                placeholder="e.g. 80000"
                value={formData.salary_min}
                onChange={handleChange}
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Salary Maximum ($)</label>
              <input
                type="number"
                name="salary_max"
                className="form-control"
                placeholder="e.g. 120000"
                value={formData.salary_max}
                onChange={handleChange}
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold">Application Deadline <span className="text-danger">*</span></label>
              <input
                type="date"
                name="deadline"
                className="form-control"
                value={formData.deadline}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
            <Link to="/jobs" className="btn btn-outline-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Saving...
                </>
              ) : isEditMode ? (
                'Save Changes'
              ) : (
                'Create Requisition (Draft)'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

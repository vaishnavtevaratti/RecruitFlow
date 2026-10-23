/**
 * RecruitFlow — Create / Edit Job Requisition Form
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { jobService } from '../services/jobService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { getErrorMessage, dateInputValue } from '../utils/formatters';

const EMPTY_FORM = {
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
};

function validate(form, { isEditMode, originalDeadline }) {
  const errors = {};
  const required = {
    title: 'Job title',
    department: 'Department',
    description: 'Description',
    skills: 'Required skills',
    experience_required: 'Experience required',
    location: 'Location',
    deadline: 'Application deadline'
  };
  for (const [field, label] of Object.entries(required)) {
    if (!String(form[field] || '').trim()) errors[field] = `${label} is required.`;
  }
  const min = form.salary_min === '' ? null : Number(form.salary_min);
  const max = form.salary_max === '' ? null : Number(form.salary_max);
  if (min !== null && (isNaN(min) || min < 0)) errors.salary_min = 'Enter a non-negative amount.';
  if (max !== null && (isNaN(max) || max < 0)) errors.salary_max = 'Enter a non-negative amount.';
  if (min !== null && max !== null && !errors.salary_min && !errors.salary_max && min > max) {
    errors.salary_max = 'Maximum must be greater than or equal to minimum.';
  }
  const deadlineChanged = !isEditMode || form.deadline !== originalDeadline;
  if (form.deadline && deadlineChanged && form.deadline < dateInputValue(0)) {
    errors.deadline = 'Deadline cannot be in the past.';
  }
  return errors;
}

export default function JobForm() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [originalDeadline, setOriginalDeadline] = useState('');
  const [jobStatus, setJobStatus] = useState('DRAFT');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditMode) return;
    const fetchJob = async () => {
      try {
        setLoading(true);
        const res = await jobService.getJobById(id);
        const j = res.data;
        const deadline = j.deadline ? String(j.deadline).slice(0, 10) : '';
        setOriginalDeadline(deadline);
        setJobStatus(j.status);
        setFormData({
          title: j.title || '',
          department: j.department || '',
          description: j.description || '',
          skills: j.skills || '',
          experience_required: j.experience_required || '',
          location: j.location || '',
          employment_type: j.employment_type || 'Full-time',
          salary_min: j.salary_min !== null ? String(Number(j.salary_min)) : '',
          salary_max: j.salary_max !== null ? String(Number(j.salary_max)) : '',
          deadline
        });
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load job details.'));
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validate(formData, { isEditMode, originalDeadline });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please correct the highlighted fields.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        salary_min: formData.salary_min !== '' ? Number(formData.salary_min) : null,
        salary_max: formData.salary_max !== '' ? Number(formData.salary_max) : null
      };

      const res = isEditMode ? await jobService.updateJob(id, payload) : await jobService.createJob(payload);
      navigate(`/jobs/${res.data.id}`, {
        state: { feedback: isEditMode ? 'Job opening updated.' : 'Job opening created as a draft. Publish it when ready.' }
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save job opening.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Loading job details..." />;

  if (isEditMode && jobStatus === 'CLOSED') {
    return <ErrorMessage message="Closed jobs cannot be edited." />;
  }

  const fieldClass = (name) => `form-control ${fieldErrors[name] ? 'is-invalid' : ''}`;
  const FieldError = ({ name }) => (fieldErrors[name] ? <div className="invalid-feedback d-block">{fieldErrors[name]}</div> : null);

  return (
    <div style={{ maxWidth: '920px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEditMode ? 'Edit Job Opening' : 'Create Job Opening'}</h1>
          <p className="page-subtitle">
            {isEditMode ? 'Update the requisition details' : 'New jobs are saved as drafts and are not visible to candidates until published'}
          </p>
        </div>
        <Link to={isEditMode ? `/jobs/${id}` : '/jobs'} className="btn btn-light border">
          <i className="bi bi-arrow-left me-1"></i> Back
        </Link>
      </div>

      {error && <ErrorMessage message={error} />}

      <form onSubmit={handleSubmit} noValidate className="card-rf p-4">
        <h2 className="section-title">Role details</h2>
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-8">
            <label htmlFor="title" className="form-label">Job title <span className="text-danger">*</span></label>
            <input id="title" name="title" className={fieldClass('title')} maxLength={150} placeholder="e.g. Senior Full Stack Engineer" value={formData.title} onChange={handleChange} />
            <FieldError name="title" />
          </div>
          <div className="col-12 col-md-4">
            <label htmlFor="department" className="form-label">Department <span className="text-danger">*</span></label>
            <input id="department" name="department" className={fieldClass('department')} maxLength={100} placeholder="e.g. Engineering" value={formData.department} onChange={handleChange} />
            <FieldError name="department" />
          </div>
          <div className="col-12">
            <label htmlFor="description" className="form-label">Description <span className="text-danger">*</span></label>
            <textarea id="description" name="description" className={fieldClass('description')} rows="5" maxLength={10000} placeholder="Responsibilities, team, and impact of the role" value={formData.description} onChange={handleChange}></textarea>
            <FieldError name="description" />
          </div>
          <div className="col-12">
            <label htmlFor="skills" className="form-label">Required skills <span className="text-danger">*</span></label>
            <input id="skills" name="skills" className={fieldClass('skills')} maxLength={2000} placeholder="e.g. React, Node.js, MySQL, REST APIs" value={formData.skills} onChange={handleChange} aria-describedby="skills-help" />
            <div id="skills-help" className="form-text">Comma-separated. Also used for skill matching on applications.</div>
            <FieldError name="skills" />
          </div>
        </div>

        <h2 className="section-title">Logistics</h2>
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-4">
            <label htmlFor="experience_required" className="form-label">Experience required <span className="text-danger">*</span></label>
            <input id="experience_required" name="experience_required" className={fieldClass('experience_required')} maxLength={50} placeholder="e.g. 3-5 years" value={formData.experience_required} onChange={handleChange} />
            <FieldError name="experience_required" />
          </div>
          <div className="col-12 col-md-4">
            <label htmlFor="location" className="form-label">Location <span className="text-danger">*</span></label>
            <input id="location" name="location" className={fieldClass('location')} maxLength={100} placeholder="e.g. Remote / Hybrid / Pune" value={formData.location} onChange={handleChange} />
            <FieldError name="location" />
          </div>
          <div className="col-12 col-md-4">
            <label htmlFor="employment_type" className="form-label">Employment type</label>
            <select id="employment_type" name="employment_type" className="form-select" value={formData.employment_type} onChange={handleChange}>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </div>
        </div>

        <h2 className="section-title">Compensation & deadline</h2>
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label htmlFor="salary_min" className="form-label">Minimum salary ($)</label>
            <input id="salary_min" type="number" min="0" step="1000" name="salary_min" className={fieldClass('salary_min')} placeholder="e.g. 80000" value={formData.salary_min} onChange={handleChange} />
            <FieldError name="salary_min" />
          </div>
          <div className="col-12 col-md-4">
            <label htmlFor="salary_max" className="form-label">Maximum salary ($)</label>
            <input id="salary_max" type="number" min="0" step="1000" name="salary_max" className={fieldClass('salary_max')} placeholder="e.g. 120000" value={formData.salary_max} onChange={handleChange} />
            <FieldError name="salary_max" />
          </div>
          <div className="col-12 col-md-4">
            <label htmlFor="deadline" className="form-label">Application deadline <span className="text-danger">*</span></label>
            <input id="deadline" type="date" name="deadline" className={fieldClass('deadline')} min={dateInputValue(0)} value={formData.deadline} onChange={handleChange} />
            <FieldError name="deadline" />
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
          <Link to={isEditMode ? `/jobs/${id}` : '/jobs'} className="btn btn-light border">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : isEditMode ? 'Save changes' : 'Create draft'}
          </button>
        </div>
      </form>
    </div>
  );
}

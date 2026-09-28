/**
 * RecruitFlow — Executive Dashboard
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await dashboardService.getStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load recruitment dashboard analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) return <Loading message="Loading recruitment metrics..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchStats} />;
  if (!stats) return null;

  const statCards = [
    { label: 'Total Jobs', val: stats.totalJobs, icon: 'bi-briefcase-fill', bg: '#eff6ff', color: '#2563eb' },
    { label: 'Active Jobs', val: stats.activeJobs, icon: 'bi-check2-circle', bg: '#ecfdf5', color: '#059669' },
    { label: 'Candidates', val: stats.totalCandidates, icon: 'bi-people-fill', bg: '#f5f3ff', color: '#7c3aed' },
    { label: 'Applications', val: stats.totalApplications, icon: 'bi-file-earmark-person-fill', bg: '#fffbeb', color: '#d97706' },
    { label: 'Shortlisted', val: stats.shortlisted, icon: 'bi-star-fill', bg: '#fdf4ff', color: '#c026d3' },
    { label: 'Interviews', val: stats.interviews, icon: 'bi-calendar-check-fill', bg: '#e0f2fe', color: '#0284c7' },
    { label: 'Selected', val: stats.selected, icon: 'bi-award-fill', bg: '#ecfeff', color: '#0d9488' },
    { label: 'Hired', val: stats.hired, icon: 'bi-trophy-fill', bg: '#f0fdf4', color: '#16a34a' }
  ];

  const funnelSteps = [
    { stage: 'Applied', count: stats.funnel?.applied || 0, icon: 'bi-inbox' },
    { stage: 'Screening', count: stats.funnel?.screening || 0, icon: 'bi-search' },
    { stage: 'Shortlisted', count: stats.funnel?.shortlisted || 0, icon: 'bi-star' },
    { stage: 'Interviewed', count: stats.funnel?.interviewed || 0, icon: 'bi-chat-dots' },
    { stage: 'Selected', count: stats.funnel?.selected || 0, icon: 'bi-award' },
    { stage: 'Hired', count: stats.funnel?.hired || 0, icon: 'bi-trophy' }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruitment Dashboard</h1>
          <p className="page-subtitle">Real-time overview of candidate pipelines and hiring funnel metrics</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/jobs/new" className="btn btn-primary d-flex align-items-center gap-2">
            <i className="bi bi-plus-lg"></i>
            <span>Create Job</span>
          </Link>
          <Link to="/applications" className="btn btn-outline-secondary d-flex align-items-center gap-2">
            <i className="bi bi-list-task"></i>
            <span>View Pipeline</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="row g-3 mb-4">
        {statCards.map((sc, i) => (
          <div key={i} className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card shadow-sm h-100">
              <div className="stat-icon-wrapper" style={{ backgroundColor: sc.bg, color: sc.color }}>
                <i className={`bi ${sc.icon}`}></i>
              </div>
              <div>
                <div className="stat-value">{sc.val}</div>
                <div className="stat-label">{sc.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recruitment Funnel Section */}
      <div className="card-rf p-4 mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
          <h5 className="fw-bold mb-0 text-dark">
            <i className="bi bi-filter-circle-fill text-primary me-2"></i>
            Recruitment Conversion Funnel
          </h5>
          <span className="badge bg-light text-muted border">Live Database Metrics</span>
        </div>
        <p className="text-muted small mb-3">
          Pipeline stage transitions from initial applicant ingestion to final corporate onboarding:
        </p>

        <div className="funnel-container">
          {funnelSteps.map((fs, idx) => (
            <React.Fragment key={idx}>
              <div className="funnel-step shadow-sm">
                <div className="mb-1 text-primary">
                  <i className={`bi ${fs.icon} fs-5`}></i>
                </div>
                <div className="count">{fs.count}</div>
                <div className="label">{fs.stage}</div>
              </div>
              {idx < funnelSteps.length - 1 && (
                <div className="text-muted px-1 d-none d-md-block">
                  <i className="bi bi-arrow-right fs-4 text-secondary"></i>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Breakdown Panels */}
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card-rf p-4 h-100">
            <h5 className="fw-bold mb-3 border-bottom pb-2 text-dark">
              <i className="bi bi-mic-fill text-primary me-2"></i>
              Interview Rounds Breakdown
            </h5>
            <div className="row g-3">
              <div className="col-4 text-center p-3 rounded-3 bg-light border">
                <div className="fs-3 fw-bold text-warning">{stats.interviewsBreakdown?.pending || 0}</div>
                <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Pending</small>
              </div>
              <div className="col-4 text-center p-3 rounded-3 bg-light border">
                <div className="fs-3 fw-bold text-success">{stats.interviewsBreakdown?.passed || 0}</div>
                <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Passed</small>
              </div>
              <div className="col-4 text-center p-3 rounded-3 bg-light border">
                <div className="fs-3 fw-bold text-danger">{stats.interviewsBreakdown?.failed || 0}</div>
                <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Failed</small>
              </div>
            </div>
            <div className="mt-4 text-end">
              <Link to="/interviews" className="btn btn-sm btn-outline-primary">
                Manage All Interviews <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card-rf p-4 h-100">
            <h5 className="fw-bold mb-3 border-bottom pb-2 text-dark">
              <i className="bi bi-file-earmark-check-fill text-primary me-2"></i>
              Offers & Acceptances
            </h5>
            <div className="row g-3">
              <div className="col-4 text-center p-3 rounded-3 bg-light border">
                <div className="fs-3 fw-bold text-primary">{stats.offersBreakdown?.sent || 0}</div>
                <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Sent / Active</small>
              </div>
              <div className="col-4 text-center p-3 rounded-3 bg-light border">
                <div className="fs-3 fw-bold text-success">{stats.offersBreakdown?.accepted || 0}</div>
                <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Accepted (Hired)</small>
              </div>
              <div className="col-4 text-center p-3 rounded-3 bg-light border">
                <div className="fs-3 fw-bold text-secondary">{stats.offersBreakdown?.rejected || 0}</div>
                <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Declined</small>
              </div>
            </div>
            <div className="mt-4 text-end">
              <Link to="/offers" className="btn btn-sm btn-outline-primary">
                Manage Offers <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

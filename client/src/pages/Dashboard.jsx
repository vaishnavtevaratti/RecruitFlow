/**
 * RecruitFlow — HR Dashboard
 * Every number on this page comes from GET /api/dashboard/stats (live MySQL counts).
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import { getErrorMessage, formatDateTime } from '../utils/formatters';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await dashboardService.getStats();
      setStats(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load recruitment dashboard metrics.'));
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
    { label: 'Open Jobs', val: stats.activeJobs, sub: `${stats.draftJobs} draft · ${stats.closedJobs} closed`, icon: 'bi-briefcase', tone: 'blue', to: '/jobs?status=PUBLISHED' },
    { label: 'Applications', val: stats.totalApplications, sub: `${stats.totalCandidates} candidates`, icon: 'bi-file-earmark-person', tone: 'violet', to: '/applications' },
    { label: 'Awaiting Screening', val: stats.pendingScreening, sub: 'Applied or in screening', icon: 'bi-funnel', tone: 'amber', to: '/applications?status=APPLIED' },
    { label: 'Interviews Pending', val: stats.pendingInterviews, sub: `${stats.interviews} total rounds`, icon: 'bi-calendar-event', tone: 'cyan', to: '/interviews' },
    { label: 'Active Offers', val: stats.offersBreakdown?.sent || 0, sub: `${stats.offersBreakdown?.expired || 0} expired`, icon: 'bi-envelope-paper', tone: 'pink', to: '/offers?status=SENT' },
    { label: 'Ready to Hire', val: stats.awaitingHire, sub: 'Offer accepted', icon: 'bi-person-check', tone: 'teal', to: '/applications?status=OFFER_ACCEPTED' },
    { label: 'Hired', val: stats.hired, sub: 'Completed hires', icon: 'bi-trophy', tone: 'green', to: '/applications?status=HIRED' },
    { label: 'Rejected', val: stats.funnel?.rejected || 0, sub: 'Closed applications', icon: 'bi-x-octagon', tone: 'red', to: '/applications?status=REJECTED' }
  ];

  const funnel = stats.funnel || {};
  const funnelSteps = [
    { stage: 'Applied', count: funnel.applied },
    { stage: 'Screening', count: funnel.screening },
    { stage: 'Shortlisted', count: funnel.shortlisted },
    { stage: 'Interview', count: (funnel.interviewScheduled || 0) + (funnel.interviewed || 0) },
    { stage: 'Selected', count: funnel.selected },
    { stage: 'Offer', count: (funnel.offerSent || 0) + (funnel.offerAccepted || 0) },
    { stage: 'Hired', count: funnel.hired }
  ];
  const maxFunnel = Math.max(1, ...funnelSteps.map((s) => s.count || 0));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruitment Dashboard</h1>
          <p className="page-subtitle">Live overview of openings, pipeline stages, and hiring outcomes</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-light border" onClick={fetchStats} aria-label="Refresh metrics">
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
          </button>
          <Link to="/applications" className="btn btn-outline-primary">
            <i className="bi bi-kanban me-1" aria-hidden="true"></i> View Pipeline
          </Link>
          <Link to="/jobs/new" className="btn btn-primary">
            <i className="bi bi-plus-lg me-1" aria-hidden="true"></i> Create Job
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {statCards.map((sc) => (
          <div key={sc.label} className="col-12 col-sm-6 col-xl-3">
            <Link to={sc.to} className="stat-card h-100 text-decoration-none">
              <div className={`stat-icon-wrapper tone-${sc.tone}`}>
                <i className={`bi ${sc.icon}`} aria-hidden="true"></i>
              </div>
              <div className="min-w-0">
                <div className="stat-label">{sc.label}</div>
                <div className="stat-value">{sc.val}</div>
                <div className="stat-sub">{sc.sub}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div className="card-rf p-4 mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h2 className="section-title mb-0">Pipeline by stage</h2>
            <p className="text-muted small mb-0">Applications currently at each stage of the workflow</p>
          </div>
        </div>
        <div className="funnel-bars">
          {funnelSteps.map((fs) => (
            <div key={fs.stage} className="funnel-bar-row">
              <div className="funnel-bar-label">{fs.stage}</div>
              <div className="funnel-bar-track">
                <div className="funnel-bar-fill" style={{ width: `${((fs.count || 0) / maxFunnel) * 100}%` }}></div>
              </div>
              <div className="funnel-bar-count">{fs.count || 0}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card-rf p-4 h-100">
            <h2 className="section-title">Interview outcomes</h2>
            <div className="row g-3 text-center">
              <div className="col-4">
                <div className="mini-metric">
                  <div className="mini-metric-value text-warning">{stats.interviewsBreakdown?.pending || 0}</div>
                  <div className="mini-metric-label">Pending</div>
                </div>
              </div>
              <div className="col-4">
                <div className="mini-metric">
                  <div className="mini-metric-value text-success">{stats.interviewsBreakdown?.passed || 0}</div>
                  <div className="mini-metric-label">Passed</div>
                </div>
              </div>
              <div className="col-4">
                <div className="mini-metric">
                  <div className="mini-metric-value text-danger">{stats.interviewsBreakdown?.failed || 0}</div>
                  <div className="mini-metric-label">Failed</div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-end">
              <Link to="/interviews" className="btn btn-sm btn-outline-primary">
                Manage interviews <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </Link>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card-rf p-4 h-100">
            <h2 className="section-title">Offer outcomes</h2>
            <div className="row g-3 text-center">
              <div className="col-3">
                <div className="mini-metric">
                  <div className="mini-metric-value text-primary">{stats.offersBreakdown?.sent || 0}</div>
                  <div className="mini-metric-label">Awaiting</div>
                </div>
              </div>
              <div className="col-3">
                <div className="mini-metric">
                  <div className="mini-metric-value text-success">{stats.offersBreakdown?.accepted || 0}</div>
                  <div className="mini-metric-label">Accepted</div>
                </div>
              </div>
              <div className="col-3">
                <div className="mini-metric">
                  <div className="mini-metric-value text-danger">{stats.offersBreakdown?.rejected || 0}</div>
                  <div className="mini-metric-label">Declined</div>
                </div>
              </div>
              <div className="col-3">
                <div className="mini-metric">
                  <div className="mini-metric-value text-secondary">{stats.offersBreakdown?.expired || 0}</div>
                  <div className="mini-metric-label">Expired</div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-end">
              <Link to="/offers" className="btn btn-sm btn-outline-primary">
                Manage offers <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card-rf mt-4 overflow-hidden">
        <div className="p-4 pb-2">
          <h2 className="section-title mb-0">Recent activity</h2>
          <p className="small text-muted mb-0">Latest application updates across all jobs</p>
        </div>
        {(stats.recentActivity || []).length === 0 ? (
          <p className="text-muted small px-4 pb-4 mb-0">No applications yet.</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {stats.recentActivity.map((a) => (
              <li key={a.id} className="activity-row">
                <Link to={`/applications/${a.id}`} className="d-flex align-items-center gap-3 text-decoration-none text-reset px-4 py-3">
                  <span className="avatar-circle avatar-sm">{a.candidate_name?.charAt(0)}</span>
                  <span className="flex-grow-1 min-w-0">
                    <span className="d-block fw-semibold text-truncate">{a.candidate_name}</span>
                    <span className="d-block small text-muted text-truncate">{a.job_title}</span>
                  </span>
                  <span className="text-end">
                    <StatusBadge status={a.status} />
                    <span className="d-block small text-muted mt-1">{formatDateTime(a.updated_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

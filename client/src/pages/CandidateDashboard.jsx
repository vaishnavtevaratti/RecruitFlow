/**
 * RecruitFlow — Candidate Dashboard
 * Personal application statistics and recent activity from GET /api/candidate/dashboard.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { candidatePortalService } from '../services/candidatePortalService';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { formatDate, getErrorMessage } from '../utils/formatters';

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await candidatePortalService.getDashboard();
      setStats(res.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load your dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) return <Loading message="Loading your dashboard..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchStats} />;

  const cards = [
    { label: 'Applications', val: stats?.totalApplications || 0, icon: 'bi-file-earmark-text', tone: 'blue' },
    { label: 'In progress', val: stats?.activeApplications || 0, icon: 'bi-arrow-repeat', tone: 'violet' },
    { label: 'Interviews', val: stats?.interviews || 0, icon: 'bi-calendar-event', tone: 'amber' },
    { label: 'Offers', val: stats?.offers || 0, icon: 'bi-envelope-paper', tone: 'pink' },
    { label: 'Hired', val: stats?.hired || 0, icon: 'bi-trophy', tone: 'green' }
  ];

  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome{firstName ? `, ${firstName}` : ''}</h1>
          <p className="page-subtitle">Here is where your applications stand</p>
        </div>
        <Link to="/candidate/jobs" className="btn btn-primary">
          <i className="bi bi-search me-1"></i> Find jobs
        </Link>
      </div>

      <div className="row g-3 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="col-6 col-md-4 col-xl">
            <div className="stat-card h-100">
              <div className={`stat-icon-wrapper tone-${c.tone}`}><i className={`bi ${c.icon}`}></i></div>
              <div>
                <div className="stat-label">{c.label}</div>
                <div className="stat-value">{c.val}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card-rf overflow-hidden">
        <div className="d-flex justify-content-between align-items-center px-4 py-3 border-bottom">
          <h2 className="section-title mb-0">Recent applications</h2>
          <Link to="/candidate/applications" className="small">View all <i className="bi bi-arrow-right"></i></Link>
        </div>
        {!stats?.recentApplications || stats.recentApplications.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon="bi-inbox"
              title="No applications yet"
              message="Browse open positions to submit your first application."
              action={<Link to="/candidate/jobs" className="btn btn-primary btn-sm">Explore jobs</Link>}
            />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-rf align-middle mb-0">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Location</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentApplications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="fw-semibold">{app.job_title}</div>
                      <div className="small text-muted">{app.job_department}</div>
                    </td>
                    <td className="small text-muted"><i className="bi bi-geo-alt me-1"></i>{app.job_location}</td>
                    <td className="small text-muted">{formatDate(app.applied_at)}</td>
                    <td><StatusBadge status={app.status} audience="candidate" /></td>
                    <td className="text-end">
                      <Link to={`/candidate/applications/${app.id}`} className="btn btn-sm btn-light border">Track</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * RecruitFlow — Main React Application Router & Layout Component
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// HR & Common Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobForm from './pages/JobForm';
import JobDetails from './pages/JobDetails';
import Candidates from './pages/Candidates';
import CandidateDetails from './pages/CandidateDetails';
import Applications from './pages/Applications';
import ApplicationDetails from './pages/ApplicationDetails';
import Interviews from './pages/Interviews';
import Offers from './pages/Offers';
import PublicJobs from './pages/PublicJobs';
import ApplyJob from './pages/ApplyJob';
import ApplicationStatus from './pages/ApplicationStatus';

// Phase 4 Candidate Portal Pages
import CandidateLogin from './pages/CandidateLogin';
import CandidateSignup from './pages/CandidateSignup';
import CandidateDashboard from './pages/CandidateDashboard';
import CandidateApplications from './pages/CandidateApplications';
import CandidateApplicationDetails from './pages/CandidateApplicationDetails';
import CandidateProfile from './pages/CandidateProfile';
import CandidateJobs from './pages/CandidateJobs';

/**
 * Authenticated Layout Wrapper
 * Renders fixed sidebar, top navigation, and responsive content canvas.
 */
function AuthenticatedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * Role-aware root/fallback redirection
 */
function RoleRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'CANDIDATE') return <Navigate to="/candidate/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Endpoints */}
          <Route path="/login" element={<Login />} />
          <Route path="/candidate/login" element={<CandidateLogin />} />
          <Route path="/candidate/signup" element={<CandidateSignup />} />
          <Route path="/jobs/public" element={<PublicJobs />} />
          <Route path="/jobs/:id/apply" element={<ApplyJob />} />
          <Route path="/application-status" element={<ApplicationStatus />} />

          {/* Candidate Portal Authenticated Routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['CANDIDATE']}>
                <AuthenticatedLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/candidate" element={<Navigate to="/candidate/dashboard" replace />} />
            <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
            <Route path="/candidate/jobs" element={<CandidateJobs />} />
            <Route path="/candidate/applications" element={<CandidateApplications />} />
            <Route path="/candidate/applications/:id" element={<CandidateApplicationDetails />} />
            <Route path="/candidate/profile" element={<CandidateProfile />} />
          </Route>

          {/* HR & Recruiter Authenticated Routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['HR', 'ADMIN', 'INTERVIEWER']}>
                <AuthenticatedLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/new" element={<JobForm />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
            <Route path="/jobs/:id/edit" element={<JobForm />} />

            <Route path="/candidates" element={<Candidates />} />
            <Route path="/candidates/:id" element={<CandidateDetails />} />

            <Route path="/applications" element={<Applications />} />
            <Route path="/applications/:id" element={<ApplicationDetails />} />

            <Route path="/interviews" element={<Interviews />} />
            <Route path="/offers" element={<Offers />} />
          </Route>

          {/* Root & Catch-all Fallbacks */}
          <Route path="/" element={<RoleRedirect />} />
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}


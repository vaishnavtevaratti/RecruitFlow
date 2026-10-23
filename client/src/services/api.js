/**
 * RecruitFlow — Centralized Axios Client & Request/Response Interceptors
 */

import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Request interceptor: attach token from localStorage if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('recruitflow_token');
    if (token && !config.skipAuth) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const PUBLIC_PATHS = ['/login', '/candidate/login', '/candidate/signup', '/jobs/public', '/application-status'];

// Response interceptor: an expired/invalid session sends the user to the right login page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);
    if (error.response && error.response.status === 401 && sentToken) {
      const currentPath = window.location.pathname;
      const onPublicPage = PUBLIC_PATHS.some((p) => currentPath.startsWith(p)) || /^\/jobs\/\d+\/apply/.test(currentPath);
      if (!onPublicPage) {
        let role = null;
        try {
          role = JSON.parse(localStorage.getItem('recruitflow_user') || 'null')?.role;
        } catch {
          role = null;
        }
        localStorage.removeItem('recruitflow_token');
        localStorage.removeItem('recruitflow_user');
        window.location.href = role === 'CANDIDATE' ? '/candidate/login?expired=1' : '/login?expired=1';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

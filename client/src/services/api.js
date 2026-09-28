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
  timeout: 10000
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

// Response interceptor: handle 401 unauthenticated
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If token is invalid or expired, clear local storage and redirect to login
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.startsWith('/jobs/public')) {
        localStorage.removeItem('recruitflow_token');
        localStorage.removeItem('recruitflow_user');
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

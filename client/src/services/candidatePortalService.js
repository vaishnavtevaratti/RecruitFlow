/**
 * RecruitFlow — Candidate Portal API Service
 * Handles candidate auth, application tracking, profile management, and offer actions.
 */

import api from './api';

export const candidatePortalService = {
  /**
   * Candidate Registration
   */
  async signup(data) {
    const response = await api.post('/auth/candidate/signup', data);
    return response.data;
  },

  /**
   * Candidate Login
   */
  async login(email, password) {
    const response = await api.post('/auth/candidate/login', { email, password });
    return response.data;
  },

  /**
   * Candidate Profile
   */
  async getProfile() {
    const response = await api.get('/candidate/me');
    return response.data;
  },

  /**
   * Update Candidate Profile
   */
  async updateProfile(data) {
    const response = await api.put('/candidate/profile', data);
    return response.data;
  },

  /**
   * Candidate Dashboard Summary Stats
   */
  async getDashboard() {
    const response = await api.get('/candidate/dashboard');
    return response.data;
  },

  /**
   * Get Candidate's Own Applications
   */
  async getApplications() {
    const response = await api.get('/candidate/applications');
    return response.data;
  },

  /**
   * Get Detailed Application with Timeline, Interview, and Offer
   */
  async getApplicationDetails(id) {
    const response = await api.get(`/candidate/applications/${id}`);
    return response.data;
  },

  /**
   * Submit Job Application as Logged-In Candidate
   */
  async apply(data) {
    const response = await api.post('/candidate/apply', data);
    return response.data;
  },

  /**
   * Candidate Accepts Job Offer
   */
  async acceptOffer(applicationId) {
    const response = await api.post(`/candidate/applications/${applicationId}/accept-offer`);
    return response.data;
  },

  /**
   * Candidate Declines Job Offer
   */
  async rejectOffer(applicationId) {
    const response = await api.post(`/candidate/applications/${applicationId}/reject-offer`);
    return response.data;
  },

  /**
   * Public Status Lookup by Application ID and Email
   */
  async getPublicStatus(applicationId, email) {
    const response = await api.post('/applications/public/status', {
      application_id: applicationId,
      email
    });
    return response.data;
  }
};

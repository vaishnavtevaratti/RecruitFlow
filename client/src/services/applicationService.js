/**
 * RecruitFlow — Applications API Service
 */

import api from './api';

export const applicationService = {
  async apply(applicationData) {
    const response = await api.post('/applications', applicationData, { skipAuth: true });
    return response.data;
  },

  async getApplications(params = {}) {
    const response = await api.get('/applications', { params });
    return response.data;
  },

  async getApplicationById(id) {
    const response = await api.get(`/applications/${id}`);
    return response.data;
  },

  async screenApplication(id) {
    const response = await api.patch(`/applications/${id}/screen`);
    return response.data;
  },

  async shortlistApplication(id) {
    const response = await api.patch(`/applications/${id}/shortlist`);
    return response.data;
  },

  async rejectApplication(id) {
    const response = await api.patch(`/applications/${id}/reject`);
    return response.data;
  },

  async selectApplication(id) {
    const response = await api.patch(`/applications/${id}/select`);
    return response.data;
  },

  async hireApplication(id) {
    const response = await api.patch(`/applications/${id}/hire`);
    return response.data;
  }
};

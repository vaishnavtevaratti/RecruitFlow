/**
 * RecruitFlow — Job Openings API Service
 */

import api from './api';

export const jobService = {
  async getJobs(params = {}, skipAuth = false) {
    const response = await api.get('/jobs', { params, skipAuth });
    return response.data;
  },

  async getJobById(id, skipAuth = false) {
    const response = await api.get(`/jobs/${id}`, { skipAuth });
    return response.data;
  },

  async createJob(jobData) {
    const response = await api.post('/jobs', jobData);
    return response.data;
  },

  async updateJob(id, jobData) {
    const response = await api.put(`/jobs/${id}`, jobData);
    return response.data;
  },

  async publishJob(id) {
    const response = await api.patch(`/jobs/${id}/publish`);
    return response.data;
  },

  async closeJob(id) {
    const response = await api.patch(`/jobs/${id}/close`);
    return response.data;
  }
};

/**
 * RecruitFlow — Interviews API Service
 */

import api from './api';

export const interviewService = {
  async getInterviews(params = {}) {
    const response = await api.get('/interviews', { params });
    return response.data;
  },

  async getInterviewById(id) {
    const response = await api.get(`/interviews/${id}`);
    return response.data;
  },

  async scheduleInterview(interviewData) {
    const response = await api.post('/interviews', interviewData);
    return response.data;
  },

  async evaluateInterview(id, evaluationData) {
    const response = await api.put(`/interviews/${id}/evaluate`, evaluationData);
    return response.data;
  },

  async rescheduleInterview(id, data) {
    const response = await api.patch(`/interviews/${id}/reschedule`, data);
    return response.data;
  },

  async getInterviewers() {
    const response = await api.get('/interviews/interviewers');
    return response.data;
  }
};

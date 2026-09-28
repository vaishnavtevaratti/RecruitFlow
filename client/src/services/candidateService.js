/**
 * RecruitFlow — Candidates API Service
 */

import api from './api';

export const candidateService = {
  async getCandidates(params = {}) {
    const response = await api.get('/candidates', { params });
    return response.data;
  },

  async getCandidateById(id) {
    const response = await api.get(`/candidates/${id}`);
    return response.data;
  },

  async createCandidate(candidateData) {
    const response = await api.post('/candidates', candidateData);
    return response.data;
  },

  async updateCandidate(id, candidateData) {
    const response = await api.put(`/candidates/${id}`, candidateData);
    return response.data;
  }
};

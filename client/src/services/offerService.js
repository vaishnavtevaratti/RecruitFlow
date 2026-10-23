/**
 * RecruitFlow — Offers API Service
 * Candidates respond to offers through candidatePortalService; HR completes hiring
 * through applicationService.hireApplication.
 */

import api from './api';

export const offerService = {
  async getOffers(params = {}) {
    const response = await api.get('/offers', { params });
    return response.data;
  },

  async getOfferById(id) {
    const response = await api.get(`/offers/${id}`);
    return response.data;
  },

  async createOffer(offerData) {
    const response = await api.post('/offers', offerData);
    return response.data;
  }
};

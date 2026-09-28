/**
 * RecruitFlow — Offers API Service
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
  },

  async acceptOffer(id) {
    const response = await api.patch(`/offers/${id}/accept`);
    return response.data;
  },

  async rejectOffer(id) {
    const response = await api.patch(`/offers/${id}/reject`);
    return response.data;
  }
};

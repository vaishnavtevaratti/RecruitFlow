/**
 * RecruitFlow — Dashboard Analytics API Service
 */

import api from './api';

export const dashboardService = {
  async getStats() {
    const response = await api.get('/dashboard/stats');
    return response.data;
  }
};

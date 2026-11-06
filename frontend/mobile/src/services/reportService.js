import { apiRequest } from './apiClient';

export const reportService = {
  summary: ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const suffix = params.toString();
    return apiRequest(`reports/summary${suffix ? `?${suffix}` : ''}`);
  },
};

import { apiRequest } from './apiClient';

function queryString(values = {}) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}` : '';
}

export const auditService = {
  list: (filters = {}) => apiRequest(`organisations/audit-events${queryString(filters)}`),
};

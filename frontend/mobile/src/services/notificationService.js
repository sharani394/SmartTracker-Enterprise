import { apiRequest } from './apiClient';

function queryString(values = {}) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}` : '';
}

export const notificationService = {
  list: (filters = {}) => apiRequest(`notifications${queryString(filters)}`),
  markAllRead: () => apiRequest('notifications/read', { method: 'PATCH' }),
  setRead: (notificationId, read) => apiRequest(`notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH', body: { read } }),
};

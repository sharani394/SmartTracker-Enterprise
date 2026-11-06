import { apiRequest } from './apiClient';

function queryString(values = {}) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}` : '';
}

export const ticketService = {
  list: (filters = {}) => apiRequest(`tickets${queryString(filters)}`),
  get: (ticketId) => apiRequest(`tickets/${encodeURIComponent(ticketId)}`),
  create: (payload) => apiRequest('tickets', { method: 'POST', body: payload }),
  assign: (ticketId, agentId) => apiRequest(`tickets/${encodeURIComponent(ticketId)}/assignment`, { method: 'PUT', body: { agentId } }),
  unassign: (ticketId) => apiRequest(`tickets/${encodeURIComponent(ticketId)}/assignment`, { method: 'DELETE' }),
  respondToAssignment: (ticketId, decision, reason) => apiRequest(`tickets/${encodeURIComponent(ticketId)}/assignment-response`, { method: 'PUT', body: { decision, ...(reason ? { reason } : {}) } }),
  updateStatus: (ticketId, status) => apiRequest(`tickets/${encodeURIComponent(ticketId)}/status`, { method: 'PATCH', body: { status } }),
  updatePriority: (ticketId, priority) => apiRequest(`tickets/${encodeURIComponent(ticketId)}/priority`, { method: 'PATCH', body: { priority } }),
  listComments: (ticketId, filters = {}) => apiRequest(`tickets/${encodeURIComponent(ticketId)}/comments${queryString(filters)}`),
  addComment: (ticketId, message, isInternal = false) => apiRequest(`tickets/${encodeURIComponent(ticketId)}/comments`, { method: 'POST', body: { message, isInternal } }),
  listActivity: (ticketId, filters = {}) => apiRequest(`tickets/${encodeURIComponent(ticketId)}/activity${queryString(filters)}`),
};

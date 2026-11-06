import { apiRequest } from './apiClient';

function queryString(values = {}) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}` : '';
}

export const knowledgeBaseService = {
  list: (filters = {}) => apiRequest(`knowledge-base/articles${queryString(filters)}`),
  get: (articleId) => apiRequest(`knowledge-base/articles/${encodeURIComponent(articleId)}`),
  create: (payload) => apiRequest('knowledge-base/articles', { method: 'POST', body: payload }),
  update: (articleId, changes) => apiRequest(`knowledge-base/articles/${encodeURIComponent(articleId)}`, { method: 'PATCH', body: changes }),
  remove: (articleId) => apiRequest(`knowledge-base/articles/${encodeURIComponent(articleId)}`, { method: 'DELETE' }),
};

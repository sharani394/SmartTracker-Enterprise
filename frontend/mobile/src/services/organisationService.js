import { apiRequest } from './apiClient';

function queryString(values = {}) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}` : '';
}

export const organisationService = {
  getSettings: () => apiRequest('organisations/settings'),
  updateSettings: (changes) => apiRequest('organisations/settings', { method: 'PATCH', body: changes }),
  listPendingMembers: () => apiRequest('organisations/members'),
  reviewMember: (memberId, decision, approvedRole, reason) => apiRequest(`organisations/members/${encodeURIComponent(memberId)}/approval`, {
    method: 'PATCH', body: { decision, ...(approvedRole ? { approvedRole } : {}), ...(reason ? { reason } : {}) },
  }),
  listInternalAdmins: () => apiRequest('organisations/internal-admins'),
  getPrimaryAdmin: () => apiRequest('organisations/primary-admin'),
  inviteInternalAdmin: (payload) => apiRequest('organisations/internal-admins', { method: 'POST', body: payload }),
  updateInternalAdminPermissions: (adminId, permissions) => apiRequest(`organisations/internal-admins/${encodeURIComponent(adminId)}/permissions`, { method: 'PATCH', body: { permissions } }),
  updateInternalAdminStatus: (adminId, status) => apiRequest(`organisations/internal-admins/${encodeURIComponent(adminId)}/status`, { method: 'PATCH', body: { status } }),
  listUsers: (filters) => apiRequest(`organisations/users${queryString(filters)}`),
  updateUserStatus: (userId, status) => apiRequest(`organisations/users/${encodeURIComponent(userId)}/status`, { method: 'PATCH', body: { status } }),
  listDepartments: (status) => apiRequest(`organisations/departments${queryString({ status })}`),
  createDepartment: (name, description = '') => apiRequest('organisations/departments', { method: 'POST', body: { name, description } }),
  updateDepartment: (departmentId, changes) => apiRequest(`organisations/departments/${encodeURIComponent(departmentId)}`, { method: 'PATCH', body: changes }),
};

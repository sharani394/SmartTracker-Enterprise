import { apiRequest } from './apiClient';

export const authService = {
  registerOrganisation: (payload) => apiRequest('organisations', { method: 'POST', auth: false, body: payload }),
  registerPrimaryAdmin: (payload) => apiRequest('auth/primary-admin/register', { method: 'POST', auth: false, body: payload }),
  registerMember: (payload) => apiRequest('auth/members/register', { method: 'POST', auth: false, body: payload }),
  confirmEmail: (email, code) => apiRequest('auth/email-verification/confirm', { method: 'POST', auth: false, body: { email, code } }),
  resendVerification: (email) => apiRequest('auth/email-verification/resend', { method: 'POST', auth: false, body: { email } }),
  requestPasswordReset: (email) => apiRequest('auth/password-reset/request', { method: 'POST', auth: false, body: { email } }),
  confirmPasswordReset: (email, code, password) => apiRequest('auth/password-reset/confirm', {
    method: 'POST', auth: false, body: { email, code, password },
  }),
  acceptInternalAdminInvitation: (payload) => apiRequest('auth/internal-admin-invitations/accept', { method: 'POST', auth: false, body: payload }),
  login: (email, password) => apiRequest('auth/login', { method: 'POST', auth: false, body: { email, password } }),
  refresh: (refreshToken) => apiRequest('auth/refresh', { method: 'POST', auth: false, retryAuth: false, body: { refreshToken } }),
  logout: () => apiRequest('auth/logout', { method: 'POST' }),
  me: () => apiRequest('auth/me'),
  updateMe: (fullName, phone) => apiRequest('auth/me', { method: 'PATCH', body: { fullName, phone } }),
  changePassword: (currentPassword, newPassword) => apiRequest('auth/password', { method: 'PUT', body: { currentPassword, newPassword } }),
  sessions: () => apiRequest('auth/sessions'),
  revokeSession: (sessionId) => apiRequest(`auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  issuePrimaryAdminCode: (payload = {}) => apiRequest('auth/primary-admin-codes', { method: 'POST', body: payload }),
};

jest.mock('../apiClient', () => ({ apiRequest: jest.fn() }));

import { apiRequest } from '../apiClient';
import { authService } from '../authService';
import { organisationService } from '../organisationService';

describe('authentication and approval API contract', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends owner, primary admin and member registration to their documented routes', async () => {
    const ownerPayload = { organisationName: 'Acme', domain: 'acme.example', ownerName: 'Owner', email: 'owner@acme.example', phone: '+15550102000', industry: 'Technology', country: 'US', password: 'owner-password' };
    const adminPayload = { organisationName: 'Acme', fullName: 'Admin', email: 'admin@acme.example', phone: '+15550102001', registrationCode: '123456', password: 'admin-password' };
    const memberPayload = { organisationName: 'Acme', email: 'member@acme.example', fullName: 'Member', phone: '+15550102002', accountType: 'Employee', department: 'IT', jobTitle: 'Engineer', experience: '1 year', skills: '', password: 'member-password' };
    apiRequest.mockResolvedValue({ message: 'Accepted' });

    await authService.registerOrganisation(ownerPayload);
    expect(apiRequest).toHaveBeenLastCalledWith('organisations', { method: 'POST', auth: false, body: ownerPayload });
    await authService.registerPrimaryAdmin(adminPayload);
    expect(apiRequest).toHaveBeenLastCalledWith('auth/primary-admin/register', { method: 'POST', auth: false, body: adminPayload });
    await authService.registerMember(memberPayload);
    expect(apiRequest).toHaveBeenLastCalledWith('auth/members/register', { method: 'POST', auth: false, body: memberPayload });
    await authService.confirmEmail(memberPayload.email, '987654');
    expect(apiRequest).toHaveBeenLastCalledWith('auth/email-verification/confirm', { method: 'POST', auth: false, body: { email: memberPayload.email, code: '987654' } });
  });

  test('requests and confirms password resets through unauthenticated routes', async () => {
    apiRequest.mockResolvedValue({ message: 'If an active account uses that email, a password reset code will be sent.' });
    await authService.requestPasswordReset('owner@example.org');
    expect(apiRequest).toHaveBeenLastCalledWith('auth/password-reset/request', {
      method: 'POST', auth: false, body: { email: 'owner@example.org' },
    });
    await authService.confirmPasswordReset('owner@example.org', '123456', 'NewPassword!2026');
    expect(apiRequest).toHaveBeenLastCalledWith('auth/password-reset/confirm', {
      method: 'POST', auth: false, body: { email: 'owner@example.org', code: '123456', password: 'NewPassword!2026' },
    });
  });

  test('submits the approved role and decision to the tenant member review endpoint', async () => {
    apiRequest.mockResolvedValue({ member: { id: 'member-1', role: 'SUPPORT_AGENT' } });
    await organisationService.reviewMember('member-1', 'APPROVE', 'SUPPORT_AGENT');
    expect(apiRequest).toHaveBeenCalledWith('organisations/members/member-1/approval', {
      method: 'PATCH', body: { decision: 'APPROVE', approvedRole: 'SUPPORT_AGENT' },
    });
  });

  test('requests Primary Admin details from the organisation leadership endpoint', async () => {
    apiRequest.mockResolvedValue({ primaryAdmin: null });
    await organisationService.getPrimaryAdmin();
    expect(apiRequest).toHaveBeenCalledWith('organisations/primary-admin');
  });
});

import { apiMessage, messageTone, navigateByRole, routeForRole } from '../feedback';

describe('feedback and role routing', () => {
  test.each([
    ['OWNER', 'OwnerDashboard'],
    ['PRIMARY_ADMIN', 'AdminDashboard'],
    ['INTERNAL_ADMIN', 'AdminDashboard'],
    ['EMPLOYEE', 'MemberPortal'],
    ['SUPPORT_AGENT', 'MemberPortal'],
  ])('routes %s to %s', (role, route) => {
    expect(routeForRole(role)).toBe(route);
  });

  test('does not silently route an unsupported account role', () => {
    const navigation = { replace: jest.fn() };
    expect(routeForRole('UNKNOWN')).toBeNull();
    expect(() => navigateByRole(navigation, 'UNKNOWN')).toThrow('not supported');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  test('uses actionable validation details and distinguishes error messages', () => {
    expect(apiMessage({
      message: 'Request data failed validation.',
      details: [{ msg: 'Email is invalid.' }, { msg: 'Password is required.' }],
    })).toBe('Email is invalid.\nPassword is required.');
    expect(messageTone('Wrong sign-in option')).toBe('error');
    expect(messageTone('Welcome back')).toBe('success');
  });
});

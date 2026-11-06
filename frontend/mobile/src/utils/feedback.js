import { Alert, Platform } from 'react-native';

export function messageTone(title = '') {
  return /failed|could not|invalid|error|unavailable|mismatch|incorrect|wrong|missing|denied|expired|not available|need attention/i.test(title)
    ? 'error'
    : 'success';
}

export function showMessage(title, message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.CustomEvent !== 'undefined') {
    window.dispatchEvent(new window.CustomEvent('smarttracker:message', {
      detail: { title, message, tone: messageTone(title) },
    }));
    return;
  }
  Alert.alert(title, message);
}

export function apiMessage(error, fallback = 'Please try again.') {
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details.map((detail) => detail.msg || detail.message).filter(Boolean).join('\n') || fallback;
  }
  return error?.message || fallback;
}

export function routeForRole(role) {
  if (role === 'OWNER') return 'OwnerDashboard';
  if (role === 'PRIMARY_ADMIN' || role === 'INTERNAL_ADMIN') return 'AdminDashboard';
  if (role === 'EMPLOYEE' || role === 'SUPPORT_AGENT') return 'MemberPortal';
  return null;
}

export function navigateByRole(navigation, role) {
  const route = routeForRole(role);
  if (!route) throw new Error('This account role is not supported by the mobile app.');
  return navigation.replace(route);
}

export function showSignInMessage(user) {
  if (user.profileLoadError) {
    showMessage(
      'Profile details need attention',
      `You are signed in, but some profile details could not be loaded. ${apiMessage(user.profileLoadError)}`
    );
    return;
  }
  const displayRole = user.role.replaceAll('_', ' ').toLowerCase();
  showMessage('Welcome back', `Signed in as ${displayRole}. Opening your workspace.`);
}

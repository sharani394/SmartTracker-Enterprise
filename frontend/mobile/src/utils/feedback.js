import { Alert, Platform } from 'react-native';

export function showMessage(title, message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export function apiMessage(error, fallback = 'Please try again.') {
  return error?.message || fallback;
}

export function navigateByRole(navigation, role) {
  if (role === 'OWNER') return navigation.replace('OwnerDashboard');
  if (role === 'PRIMARY_ADMIN' || role === 'INTERNAL_ADMIN') return navigation.replace('AdminDashboard');
  if (role === 'EMPLOYEE' || role === 'SUPPORT_AGENT') return navigation.replace('MemberPortal');
  throw new Error('This account role is not supported by the mobile app.');
}

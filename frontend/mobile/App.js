
import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { TicketProvider } from './src/context/TicketContext';
import { AuthProvider } from './src/context/AuthContext';
import { useAuth } from './src/context/AuthContext';

const navigationRef = createNavigationContainerRef();

function AuthAwareNavigation() {
  const { user, isLoading } = useAuth();
  const syncAuthenticatedRoute = () => {
    if (isLoading || !navigationRef.isReady()) return;
    const currentRoute = navigationRef.getCurrentRoute()?.name;
    if (user) {
      const target = user.role === 'OWNER' ? 'OwnerDashboard'
        : ['PRIMARY_ADMIN', 'INTERNAL_ADMIN'].includes(user.role) ? 'AdminDashboard'
          : ['EMPLOYEE', 'SUPPORT_AGENT'].includes(user.role) ? 'MemberPortal' : 'Welcome';
      if (target !== currentRoute) navigationRef.reset({ index: 0, routes: [{ name: target }] });
    } else if (currentRoute && !['Welcome', 'OrganisationRegister', 'AdminRegister', 'MemberRegister', 'EmailVerification', 'InternalAdminInvitation', 'OwnerLogin', 'AdminLogin', 'MemberLogin'].includes(currentRoute)) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  };
  useEffect(() => { syncAuthenticatedRoute(); }, [user?.id, user?.role, isLoading]);
  return <NavigationContainer ref={navigationRef} onReady={syncAuthenticatedRoute}><RootNavigator /></NavigationContainer>;
}

export default function App() {
  return (
    <AuthProvider>
      <TicketProvider>
        <AuthAwareNavigation />
      </TicketProvider>
    </AuthProvider>
  );
}

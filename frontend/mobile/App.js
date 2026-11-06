
import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { TicketProvider } from './src/context/TicketContext';
import { AuthProvider } from './src/context/AuthContext';
import { useAuth } from './src/context/AuthContext';
import MessageHost from './src/components/common/MessageHost';
import { routeForRole } from './src/utils/feedback';

const navigationRef = createNavigationContainerRef();

function AuthAwareNavigation() {
  const { user, isLoading } = useAuth();
  const syncAuthenticatedRoute = () => {
    if (isLoading || !navigationRef.isReady()) return;
    const currentRoute = navigationRef.getCurrentRoute()?.name;
    if (user) {
      const target = routeForRole(user.role) || 'Welcome';
      if (target !== currentRoute) navigationRef.reset({ index: 0, routes: [{ name: target }] });
    } else if (currentRoute && !['Welcome', 'OrganisationRegister', 'AdminRegister', 'MemberRegister', 'EmailVerification', 'InternalAdminInvitation', 'PasswordReset', 'OwnerLogin', 'AdminLogin', 'MemberLogin'].includes(currentRoute)) {
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
        <MessageHost />
      </TicketProvider>
    </AuthProvider>
  );
}

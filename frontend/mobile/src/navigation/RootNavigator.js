
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Onboarding
import WelcomeScreen from '../features/onboarding/WelcomeScreen';
import OrganisationRegisterScreen from '../features/onboarding/OrganisationRegisterScreen';

// Registration screens
import AdminRegisterScreen from '../features/authentication/AdminRegisterScreen';
import MemberRegisterScreen from '../features/authentication/MemberRegisterScreen';
import EmailVerificationScreen from '../features/authentication/EmailVerificationScreen';
import InternalAdminInvitationScreen from '../features/authentication/InternalAdminInvitationScreen';
import PasswordResetScreen from '../features/authentication/PasswordResetScreen';

// Login screens
import OwnerLoginScreen from '../features/authentication/OwnerLoginScreen';
import AdminLoginScreen from '../features/authentication/AdminLoginScreen';
import MemberLoginScreen from '../features/authentication/MemberLoginScreen';

// Member portal (Employee and Support Agent)
import MemberPortalScreen from '../features/people/MemberPortalScreen';

// Admin dashboard
import AdminDashboardScreen from '../features/admin/AdminDashboardScreen';

// Owner dashboard
import OwnerDashboardScreen from '../features/owner/OwnerDashboardScreen';

// Owner settings
import OwnerProfileScreen from '../features/owner/OwnerProfileScreen';
import OwnerSecurityScreen from '../features/owner/OwnerSecurityScreen';
import OwnerNotificationsScreen from '../features/owner/OwnerNotificationsScreen';
import OwnerHelpScreen from '../features/owner/OwnerHelpScreen';

// Owner additional screens
import OwnerReportsScreen from '../features/owner/OwnerReportsScreen';
import OwnerAccessScreen from '../features/owner/OwnerAccessScreen';
import OwnerActivityScreen from '../features/owner/OwnerActivityScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {/* Welcome */}
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
      />

      {/* Registration */}
      <Stack.Screen
        name="OrganisationRegister"
        component={OrganisationRegisterScreen}
      />

      <Stack.Screen
        name="AdminRegister"
        component={AdminRegisterScreen}
      />

      <Stack.Screen
        name="MemberRegister"
        component={MemberRegisterScreen}
      />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="InternalAdminInvitation" component={InternalAdminInvitationScreen} />
      <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />

      {/* Login */}
      <Stack.Screen
        name="OwnerLogin"
        component={OwnerLoginScreen}
      />

      <Stack.Screen
        name="AdminLogin"
        component={AdminLoginScreen}
      />

      <Stack.Screen
        name="MemberLogin"
        component={MemberLoginScreen}
      />

      {/* Employee and Support Agent Portal */}
      <Stack.Screen
        name="MemberPortal"
        component={MemberPortalScreen}
      />

      {/* Admin Dashboard */}
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
      />

      {/* Owner Dashboard */}
      <Stack.Screen
        name="OwnerDashboard"
        component={OwnerDashboardScreen}
      />

      {/* Owner Reports */}
      <Stack.Screen
        name="OwnerReports"
        component={OwnerReportsScreen}
      />

      {/* Owner Security & Access */}
      <Stack.Screen
        name="OwnerAccess"
        component={OwnerAccessScreen}
      />

      {/* Owner Activity Logs */}
      <Stack.Screen
        name="OwnerActivity"
        component={OwnerActivityScreen}
      />

      {/* Owner Settings */}
      <Stack.Screen
        name="OwnerProfile"
        component={OwnerProfileScreen}
      />

      <Stack.Screen
        name="OwnerSecurity"
        component={OwnerSecurityScreen}
      />

      <Stack.Screen
        name="OwnerNotifications"
        component={OwnerNotificationsScreen}
      />

      <Stack.Screen
        name="OwnerHelp"
        component={OwnerHelpScreen}
      />
    </Stack.Navigator>
  );
}

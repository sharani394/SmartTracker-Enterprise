import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { organisationService } from '../services/organisationService';
import { setSessionCallbacks } from '../services/apiClient';
import * as tokenStore from '../services/tokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organisation, setOrganisation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setOrganisation(null);
  }, []);

  const loadProfile = useCallback(async () => {
    const profile = await authService.me();
    setUser(profile.user);
    setOrganisation(profile.organisation || null);
    return profile;
  }, []);

  useEffect(() => {
    setSessionCallbacks({
      expired: clearAuthState,
      refreshedUser: (refreshedUser) => setUser(refreshedUser),
    });
    let active = true;
    const restoreSession = async () => {
      try {
        const refreshToken = await tokenStore.getRefreshToken();
        if (!refreshToken) return;
        const refreshed = await authService.refresh(refreshToken);
        await tokenStore.saveSession(refreshed.session);
        if (!active) return;
        setUser(refreshed.user);
        try {
          const profile = await authService.me();
          if (active) {
            setUser(profile.user);
            setOrganisation(profile.organisation || null);
          }
        } catch (error) {
          if (error.status === 401 || error.status === 403) await tokenStore.clearSession();
          if (active && error.status !== 0) clearAuthState();
        }
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          await tokenStore.clearSession();
          if (active) clearAuthState();
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    restoreSession();
    return () => {
      active = false;
      setSessionCallbacks({});
    };
  }, [clearAuthState]);

  const login = useCallback(async (email, password, allowedRoles) => {
    const result = await authService.login(email.trim().toLowerCase(), password);
    await tokenStore.saveSession(result.session);

    if (allowedRoles && !allowedRoles.includes(result.user.role)) {
      let revokeError;
      try {
        await authService.logout();
      } catch (error) {
        if (error?.status !== 401) revokeError = error;
      } finally {
        try {
          await tokenStore.clearSession();
        } finally {
          clearAuthState();
        }
      }

      const roleName = result.user.role.replaceAll('_', ' ').toLowerCase();
      const error = new Error(
        `This account is registered as ${roleName}. Select the matching sign-in option and try again.${revokeError ? ' Server sign-out could not be confirmed, so reconnect and sign out before continuing.' : ''}`
      );
      error.code = 'LOGIN_PORTAL_MISMATCH';
      throw error;
    }

    setUser(result.user);
    setOrganisation(null);
    try {
      const profile = await loadProfile();
      return profile.user;
    } catch (profileError) {
      if (profileError?.status === 401 || profileError?.status === 403) {
        try {
          await tokenStore.clearSession();
        } finally {
          clearAuthState();
        }
        throw profileError;
      }
      return { ...result.user, profileLoadError: profileError };
    }
  }, [clearAuthState, loadProfile]);

  const logout = useCallback(async () => {
    try {
      if (user) await authService.logout();
    } catch (error) {
      if (error?.status !== 401) throw error;
    } finally {
      try {
        await tokenStore.clearSession();
      } finally {
        clearAuthState();
      }
    }
  }, [clearAuthState, user]);

  const updateProfile = useCallback(async ({ fullName, phone }) => {
    const result = await authService.updateMe(fullName, phone);
    setUser(result.user);
    return result.user;
  }, []);

  const updateOrganisationSettings = useCallback(async (changes) => {
    const result = await organisationService.updateSettings(changes);
    setOrganisation(result.organisation);
    return result.organisation;
  }, []);

  const value = useMemo(() => ({
    user,
    organisation,
    isAuthenticated: Boolean(user && tokenStore.getAccessToken()),
    isLoading,
    login,
    logout,
    loadProfile,
    updateProfile,
    updateOrganisationSettings,
    registerOrganisation: authService.registerOrganisation,
    registerPrimaryAdmin: authService.registerPrimaryAdmin,
    registerMember: authService.registerMember,
    confirmEmail: authService.confirmEmail,
    resendVerification: authService.resendVerification,
    requestPasswordReset: authService.requestPasswordReset,
    confirmPasswordReset: authService.confirmPasswordReset,
    acceptInternalAdminInvitation: authService.acceptInternalAdminInvitation,
    issuePrimaryAdminCode: authService.issuePrimaryAdminCode,
    changePassword: authService.changePassword,
  }), [user, organisation, isLoading, login, logout, loadProfile, updateProfile, updateOrganisationSettings]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

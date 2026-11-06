jest.mock('../../services/tokenStore', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

jest.mock('../../services/authService', () => ({
  authService: {
    refresh: jest.fn(), login: jest.fn(), me: jest.fn(), logout: jest.fn(),
  },
}));

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import * as tokenStore from '../../services/tokenStore';
import { authService } from '../../services/authService';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext session lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenStore.getAccessToken.mockReturnValue(null);
    tokenStore.getRefreshToken.mockResolvedValue(null);
    tokenStore.saveSession.mockResolvedValue(undefined);
    tokenStore.clearSession.mockResolvedValue(undefined);
    authService.logout.mockResolvedValue({ message: 'Logged out.' });
  });

  test('restores and verifies user state using the refresh and profile APIs', async () => {
    const refreshedUser = { id: 'user-1', role: 'OWNER' };
    const profile = { user: { ...refreshedUser, fullName: 'Owner' }, organisation: { id: 'org-1' } };
    tokenStore.getRefreshToken.mockResolvedValue('stored-refresh');
    authService.refresh.mockResolvedValue({ user: refreshedUser, session: { accessToken: 'access-2', refreshToken: 'refresh-2' } });
    authService.me.mockResolvedValue(profile);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authService.refresh).toHaveBeenCalledWith('stored-refresh');
    expect(tokenStore.saveSession).toHaveBeenCalledWith({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(result.current.user).toEqual(profile.user);
    expect(result.current.organisation).toEqual(profile.organisation);
  });

  test('clears invalid restored sessions', async () => {
    tokenStore.getRefreshToken.mockResolvedValue('expired-refresh');
    authService.refresh.mockRejectedValue({ status: 401, message: 'Expired' });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(tokenStore.clearSession).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('login installs the session and logout revokes it and clears local identity', async () => {
    let accessToken = null;
    tokenStore.getAccessToken.mockImplementation(() => accessToken);
    tokenStore.saveSession.mockImplementation(async (session) => { accessToken = session.accessToken; });
    tokenStore.clearSession.mockImplementation(async () => { accessToken = null; });
    const loginUser = { id: 'employee-1', role: 'EMPLOYEE' };
    authService.login.mockResolvedValue({ user: loginUser, session: { accessToken: 'access-1', refreshToken: 'refresh-1' } });
    authService.me.mockResolvedValue({ user: { ...loginUser, fullName: 'Member' }, organisation: { id: 'org-1' } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.login('person@example.org', 'password', ['EMPLOYEE']); });
    expect(result.current.user.fullName).toBe('Member');
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => { await result.current.logout(); });
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(tokenStore.clearSession).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('rejects a login from the wrong portal and clears the issued session', async () => {
    authService.login.mockResolvedValue({
      user: { id: 'owner-1', role: 'OWNER' },
      session: { accessToken: 'access-1', refreshToken: 'refresh-1' },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let loginError;
    await act(async () => {
      try {
        await result.current.login('person@example.org', 'password', ['EMPLOYEE']);
      } catch (error) {
        loginError = error;
      }
    });

    expect(loginError).toMatchObject({ code: 'LOGIN_PORTAL_MISMATCH' });
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(tokenStore.clearSession).toHaveBeenCalledTimes(1);
    expect(authService.me).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('logout clears local credentials when the server session has already expired', async () => {
    let accessToken = null;
    tokenStore.getAccessToken.mockImplementation(() => accessToken);
    tokenStore.saveSession.mockImplementation(async (session) => { accessToken = session.accessToken; });
    tokenStore.clearSession.mockImplementation(async () => { accessToken = null; });
    authService.login.mockResolvedValue({
      user: { id: 'employee-1', role: 'EMPLOYEE' },
      session: { accessToken: 'access-1', refreshToken: 'refresh-1' },
    });
    authService.me.mockResolvedValue({ user: { id: 'employee-1', role: 'EMPLOYEE' } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.login('person@example.org', 'password'); });

    authService.logout.mockRejectedValueOnce({ status: 401, message: 'Session already expired.' });
    await act(async () => { await result.current.logout(); });

    expect(tokenStore.clearSession).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

jest.mock('../tokenStore', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
}));

import * as tokenStore from '../tokenStore';
import { apiRequest, setSessionCallbacks } from '../apiClient';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

describe('API client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSessionCallbacks({});
    tokenStore.getAccessToken.mockReturnValue(null);
    tokenStore.getRefreshToken.mockResolvedValue(null);
    tokenStore.saveSession.mockResolvedValue(undefined);
    tokenStore.clearSession.mockResolvedValue(undefined);
    global.fetch = jest.fn();
  });

  test('sends JSON and the current bearer token', async () => {
    tokenStore.getAccessToken.mockReturnValue('access-current');
    global.fetch.mockResolvedValue(jsonResponse({ ok: true }));

    await expect(apiRequest('tickets', { method: 'POST', body: { title: 'Printer issue' } }))
      .resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/tickets$/), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer access-current', 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title: 'Printer issue' }),
    }));
  });

  test('returns structured API error messages and handles network failures', async () => {
    tokenStore.getAccessToken.mockReturnValue('access-current');
    global.fetch.mockResolvedValueOnce(jsonResponse({ error: { code: 'FORBIDDEN', message: 'Not allowed.' } }, 403));
    await expect(apiRequest('tickets')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Not allowed.' });

    global.fetch.mockRejectedValueOnce(new TypeError('offline'));
    await expect(apiRequest('tickets')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  test('refreshes a rejected access token once and stores the rotated session', async () => {
    const onRefreshedUser = jest.fn();
    tokenStore.getAccessToken.mockReturnValue('access-old');
    tokenStore.getRefreshToken.mockResolvedValue('refresh-old');
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'TOKEN_EXPIRED', message: 'Expired' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: { id: 'u1' }, session: { accessToken: 'access-new', refreshToken: 'refresh-new' } }))
      .mockResolvedValueOnce(jsonResponse({ tickets: [] }));
    setSessionCallbacks({ refreshedUser: onRefreshedUser });

    await expect(apiRequest('tickets')).resolves.toEqual({ tickets: [] });
    expect(tokenStore.saveSession).toHaveBeenCalledWith({ accessToken: 'access-new', refreshToken: 'refresh-new' });
    expect(onRefreshedUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer access-new');
  });

  test('clears credentials and signals session expiry when refresh is rejected', async () => {
    const expired = jest.fn();
    tokenStore.getAccessToken.mockReturnValue('access-old');
    tokenStore.getRefreshToken.mockResolvedValue('refresh-expired');
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'TOKEN_EXPIRED', message: 'Expired' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'SESSION_EXPIRED', message: 'Please sign in.' } }, 401));
    setSessionCallbacks({ expired });

    await expect(apiRequest('tickets')).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(tokenStore.clearSession).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  test('signals expiry when no refresh credential remains', async () => {
    const expired = jest.fn();
    setSessionCallbacks({ expired });

    await expect(apiRequest('tickets')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(tokenStore.clearSession).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

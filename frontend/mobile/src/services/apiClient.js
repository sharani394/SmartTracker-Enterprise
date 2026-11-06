import { API_BASE_URL } from '../config/apiConfig';
import * as tokenStore from './tokenStore';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshInFlight = null;
let onSessionExpired = null;
let onRefreshedUser = null;

export function setSessionCallbacks({ expired, refreshedUser } = {}) {
  onSessionExpired = expired || null;
  onRefreshedUser = refreshedUser || null;
}

function parseBody(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function send(path, { method = 'GET', body, accessToken = null } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/${path.replace(/^\/+/, '')}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(`Unable to reach SmartTracker at ${API_BASE_URL}. Check the API URL and network connection.`, { code: 'NETWORK_ERROR' });
  }

  const payload = parseBody(await response.text());
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(error?.message || payload?.message || `Request failed with HTTP ${response.status}.`, {
      status: response.status,
      code: error?.code || 'HTTP_ERROR',
      details: error?.details || null,
    });
  }
  return payload;
}

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        await tokenStore.clearSession();
        onSessionExpired?.();
        throw new ApiError('Your session has expired. Please sign in again.', { status: 401, code: 'SESSION_EXPIRED' });
      }
      try {
        const result = await send('auth/refresh', { method: 'POST', body: { refreshToken } });
        await tokenStore.saveSession(result.session);
        onRefreshedUser?.(result.user);
        return result.session.accessToken;
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          await tokenStore.clearSession();
          onSessionExpired?.();
        }
        throw error;
      }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiRequest(path, options = {}) {
  const { auth = true, retryAuth = true, ...requestOptions } = options;
  let accessToken = auth ? tokenStore.getAccessToken() : null;
  if (auth && !accessToken) {
    try {
      accessToken = await refreshSession();
    } catch (error) {
      throw error;
    }
  }

  try {
    return await send(path, { ...requestOptions, accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !auth || !retryAuth || path === 'auth/refresh') throw error;
    const refreshedAccessToken = await refreshSession();
    try {
      return await send(path, { ...requestOptions, accessToken: refreshedAccessToken });
    } catch (retryError) {
      if (retryError.status === 401) {
        await tokenStore.clearSession();
        onSessionExpired?.();
      }
      throw retryError;
    }
  }
}

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'smarttracker.refreshToken';
let accessToken = null;
let memoryRefreshToken = null;

function webStorage() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  accessToken = session?.accessToken || null;
  const refreshToken = session?.refreshToken || null;
  memoryRefreshToken = refreshToken;
  if (!refreshToken) return;

  const storage = webStorage();
  if (storage) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export function getAccessToken() {
  return accessToken;
}

export async function getRefreshToken() {
  const storage = webStorage();
  if (Platform.OS === 'web') return storage?.getItem(REFRESH_TOKEN_KEY) || memoryRefreshToken;
  return (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) || memoryRefreshToken;
}

export async function clearSession() {
  accessToken = null;
  memoryRefreshToken = null;
  const storage = webStorage();
  if (storage) {
    storage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

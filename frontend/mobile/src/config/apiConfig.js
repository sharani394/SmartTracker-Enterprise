import { Platform } from 'react-native';

const DEFAULT_URLS = {
  web: 'http://localhost:5000/api/v1',
  android: 'http://10.0.2.2:5000/api/v1',
  ios: 'http://localhost:5000/api/v1',
};

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname === '0.0.0.0'
    || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export function resolveApiBaseUrl({ platform, commonUrl, webUrl, androidUrl }) {
  const configuredUrl = platform === 'web'
    ? webUrl || commonUrl
    : platform === 'android'
      ? androidUrl || commonUrl
      : commonUrl;
  const selectedUrl = configuredUrl || DEFAULT_URLS[platform] || DEFAULT_URLS.ios;

  if (platform === 'android' && configuredUrl) {
    let hostname;
    try { hostname = new URL(selectedUrl).hostname; }
    catch { throw new Error('The Android API URL must be a valid absolute HTTP URL.'); }
    if (isLoopback(hostname)) {
      throw new Error('Android cannot reach a backend at localhost. Use 10.0.2.2 for the emulator or your computer LAN IP for a physical device.');
    }
  }

  return selectedUrl.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl({
  platform: Platform.OS,
  commonUrl: process.env.EXPO_PUBLIC_API_URL,
  webUrl: process.env.EXPO_PUBLIC_API_URL_WEB,
  androidUrl: process.env.EXPO_PUBLIC_API_URL_ANDROID,
});

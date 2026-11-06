import { resolveApiBaseUrl } from '../apiConfig';

describe('platform API base URL configuration', () => {
  test('uses the Expo web URL before the common override', () => {
    expect(resolveApiBaseUrl({ platform: 'web', commonUrl: 'https://api.example.test/v1', webUrl: 'http://localhost:5000/api/v1' }))
      .toBe('http://localhost:5000/api/v1');
  });

  test('uses the Android emulator host mapping by default', () => {
    expect(resolveApiBaseUrl({ platform: 'android' })).toBe('http://10.0.2.2:5000/api/v1');
  });

  test('accepts a physical Android device LAN URL and rejects loopback URLs', () => {
    expect(resolveApiBaseUrl({ platform: 'android', androidUrl: 'http://192.168.1.25:5000/api/v1' }))
      .toBe('http://192.168.1.25:5000/api/v1');
    expect(() => resolveApiBaseUrl({ platform: 'android', androidUrl: 'http://localhost:5000/api/v1' }))
      .toThrow(/Android cannot reach a backend at localhost/);
  });
});

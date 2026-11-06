# SmartTracker mobile frontend

JavaScript Expo app using React Navigation.

## Configure the API URL

Copy the environment example, then set the platform-specific API URL in `frontend/mobile/.env`:

```sh
cd frontend/mobile
cp .env.example .env
```

The API base must include `/api/v1`.

| Target | `EXPO_PUBLIC_API_URL_*` value |
| --- | --- |
| Web in the local Expo dev server | `EXPO_PUBLIC_API_URL_WEB=http://localhost:5000/api/v1` |
| Android emulator | `EXPO_PUBLIC_API_URL_ANDROID=http://10.0.2.2:5000/api/v1` |
| Physical Android device | `EXPO_PUBLIC_API_URL_ANDROID=http://<computer-LAN-IP>:5000/api/v1` |

`EXPO_PUBLIC_API_URL_WEB` and `EXPO_PUBLIC_API_URL_ANDROID` take precedence over the optional common `EXPO_PUBLIC_API_URL`. Expo web's default origin is allowed by backend CORS as `http://localhost:8081` and `http://127.0.0.1:8081`; if Expo selects another origin or port, add that exact origin to `CORS_ORIGINS` in `backend/.env`, then restart the backend.

`10.0.2.2` is the Android emulator's host-machine alias. A physical Android device must use the computer's reachable LAN IPv4 address; `localhost`, `127.0.0.1`, and `10.0.2.2` do not address the development computer from a physical device. Keep the device and computer on a reachable network and allow inbound traffic to port 5000 in the computer firewall. Restart Expo after editing `.env` so the public variables are reloaded.

## Run the app

```sh
npx expo start
npx expo start --web
npx expo start --android
```

## Run frontend tests and platform bundle checks

```sh
npm test
npx expo export --platform web
npx expo export --platform android
```

The automated Jest tests mock API responses only within test files. The app itself does not substitute mock records when requests fail.

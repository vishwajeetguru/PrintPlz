# Mobile integration (Expo app)

Backend base URL: `http://<LAN-IP>:4000`. In Expo, set in `.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000
```

Install in mobile app:

```bash
npx expo install socket.io-client
```

## 1. API client (`services/api.client.ts`, new file)

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function api(path: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem('printplz.accessToken');
  // Maintenance gate: check once per launch
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body.error === 'SHOP_DEACTIVATED') throw new Error('SHOP_DEACTIVATED:' + body.message);
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Request failed');
  return res.json();
}
```

## 2. Replace service internals (keep exported names!)

- `auth.service.ts`: `sendOtp → POST /api/auth/send-otp`, `verifyOtp → POST /api/auth/verify-otp` (store `accessToken`/`refreshToken`), add `loginPassword → POST /api/auth/login-password`, `setPassword → POST /api/auth/set-password`.
- `requests.service.ts`: `list → GET /api/requests`, `updateStatus → PATCH /api/requests/:id/status`. Keep local `filter()`.
- `printer.service.ts`: `GET/POST/PATCH /api/printers`; `printDocument()` stays local (real print SDK) but call `PATCH status PRINTING/COMPLETED` around it.
- `notification.service.ts`: `GET /api/notifications`, `POST /api/notifications/read-all`.
- `analytics.service.ts`: `GET /api/analytics/summary?days=30`.

## 3. Realtime (`store/RealtimeProvider.tsx`, new)

```tsx
import { io } from 'socket.io-client';
// connect with accessToken, on 'request:created' | 'request:updated' | 'notification:new' | 'shop:status' | 'system:maintenance' → refresh contexts / show banner
```

Subscribe in `RequestProvider.refresh()`, `NotificationProvider.refresh()`. Maintenance event → full-screen "under maintenance" notice. `SHOP_DEACTIVATED` → lock vendor screens to "contact support".

## 4. File upload (customer flow is public; vendor walk-in uses authed `/api/uploads` then `/api/requests`)

Response `toMobile()` in `requests.routes.ts` already returns exactly `PrintRequest` fields the app renders (`uploadedAtLabel`, `fileSize`, etc.).

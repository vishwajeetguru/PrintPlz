# PrintPlz Backend

Node.js + Express + Prisma + PostgreSQL + Socket.io. Replaces the mobile app's mock services with real data + realtime.

## Quick start (no Docker needed — SQLite)

```bash
cp .env.example .env        # already points to file:./dev.db
npm install
npm run db:setup:sqlite     # generate client + create dev.db + seed
npm run dev                 # http://localhost:4000
```

## Production (PostgreSQL via Docker)

```bash
docker compose up -d
# set DATABASE_URL=postgresql://printplz:printplz@localhost:5432/printplz?schema=public
npx prisma migrate dev --name init   # uses prisma/schema.prisma
npm run seed
```

Switching providers regenerates the Prisma client: `npm run prisma:generate` (SQLite) vs `npm run prisma:generate:pg` (Postgres).

Seeded:
- Super admin `+919000000000` / `Super@123`
- Vendor `+919876543210` / `Shop@123` (OTP `123456` in dev), shop `PF-RJC-1024`

## Auth model (matches mobile flow)

1. Vendor enters phone → `POST /api/auth/send-otp` (dev returns `devCode`)
2. Vendor enters OTP → `POST /api/auth/verify-otp` → tokens + `mustSetPassword`
3. First time: `POST /api/auth/set-password` (Bearer) → next logins use `POST /api/auth/login-password`
4. Superadmin uses password login directly. Admin panel enforces `role === SUPER_ADMIN`.

Deactivated shop → `403 SHOP_DEACTIVATED` on every shop-scoped API + `shop:status` socket event. Mobile must show "contact support".

Maintenance → public `GET /api/system/status`. Superadmin `PUT /api/system/maintenance`. All sockets get `system:maintenance`.

## Realtime (Socket.io)

Connect with `auth: { token }`. Vendor joins `shop:{shopId}`, superadmin joins `superadmin`.

Events: `request:created`, `request:updated`, `notification:new`, `shop:updated`, `shop:status`, `printer:updated`, `system:maintenance`.

## Customer QR flow (no auth)

- `GET /api/public/shops/:code` → shop card
- `POST /api/public/shops/:code/requests` (multipart `file` + copies/color/paper/sides) → creates NEW request, emits to shop
- `GET /api/public/requests/:id` → tracking status

## Mobile wiring

Set `EXPO_PUBLIC_API_URL=http://<pc-lan-ip>:4000` in the Expo app, then replace each `services/*.service.ts` internals with `fetch(`${API}/api/...`, { Authorization: Bearer })` + `socket.io-client` listener that calls the existing Context `refresh()`. Response shapes in `requests.routes.ts → toMobile()` already match `types/request.ts`. See `MOBILE_INTEGRATION.md`.

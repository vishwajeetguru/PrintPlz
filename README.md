# PrintPlz — Backend + Superadmin

Real data + realtime replacement for the Expo vendor app's mock services.

```
PrintPlz-backend/
  backend/  Node.js + Express + Prisma + PostgreSQL + Socket.io
  admin/    Vite + React superadmin panel (SUPER_ADMIN only)
```

## Start everything

```bash
# 1. Database
cd backend
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev --name init
npm run seed        # superadmin + Rajesh shop + printers + requests
npm run dev         # :4000

# 2. Admin panel
cd ../admin
cp .env.example .env
npm install
npm run dev         # :5173 → login +919000000000 / Super@123
```

## Roles

- `VENDOR` — shop owner. Self-signup via mobile OTP, then sets password (`verify-otp → mustSetPassword → set-password`), next logins via password. Scoped to own shop; deactivated shop → `403 SHOP_DEACTIVATED` everywhere + locked mobile UI.
- `SUPER_ADMIN` — full access. Admin panel refuses non-superadmin tokens.

## Superadmin capabilities (as requested)

- View/search all shops, edit (name/owner/address/pricing), deactivate/activate (owner locked out + `SHOP_DEACTIVATED` notice + `shop:status` socket).
- Global + per-shop analytics (revenue, requests, pages, avg order, 7-day series, B&W vs color).
- Notices to one shop or broadcast-all → realtime `notification:new` + persisted notifications in mobile.
- Maintenance mode toggle + message → public `GET /api/system/status` + `system:maintenance` broadcast; mobile shows maintenance notice.
- Add shop (auto-generates readable password shown once) + reset/generate password per shop.

## Realtime

Socket.io, token in `auth`. Vendors join `shop:{shopId}`, superadmins join `superadmin`. Events: `request:created`, `request:updated`, `notification:new`, `shop:updated`, `shop:status`, `printer:updated`, `system:maintenance`.

## Mobile wiring

See `backend/MOBILE_INTEGRATION.md` — response shapes already match `types/request.ts` (`toMobile()`), so the Expo app only swaps service internals to `fetch` + `socket.io-client`, no UI changes.

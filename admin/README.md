# PrintPlz Admin (superadmin only)

Vite + React panel for `SUPER_ADMIN` role. Vendors are blocked at login even with a valid token.

## Run

```bash
cp .env.example .env   # VITE_API_URL=http://localhost:4000
npm install
npm run dev            # http://localhost:5173
```

Login with seeded superadmin: `+919000000000` / `Super@123`.

## What SA can do

- **Dashboard** — global revenue/requests/pages + realtime refresh on `request:created/updated`.
- **Shops** — search + active filter, create shop (auto-generates readable password shown once), deactivate (owner locked out, `shop:status` emitted) / activate.
- **Shop detail** — edit name/owner/address/pricing, reset/generate password, recent requests.
- **Requests** — all shops, filter status/search, change status (emits `request:updated` to the shop app).
- **Notices** — send to one shop (`notification:new` to `shop:{id}`) or broadcast to all.
- **Maintenance** — toggle + message; mobile polls `GET /api/system/status` and listens `system:maintenance`.

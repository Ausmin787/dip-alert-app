# External Integrations

**Verified:** 2026-07-15 from live source and deployment assets.

## Market Data

- **Yahoo Finance via yfinance 1.4.1** supplies current prices, previous closes, and historical closes.
- No API credential is used. Availability and throttling are external constraints.
- Frontend history requests are served by the backend; the browser does not call Yahoo directly.

## Messaging

- **CallMeBot WhatsApp API** sends alert and test messages through `httpx`.
- The owner configures phone/API key through Manage; values live in SQLite and are redacted on API reads.
- Optional deployment-failure CallMeBot credentials are separate in `/etc/dip-alert/deploy-alert.env` and are loaded only by the deploy service.

## Broker Links

- Per-asset outbound broker URLs can point to Groww or another configured target.
- The app provides reminders/links only; it never places orders.

## Persistence

- **SQLite + SQLModel** is configured through `DATABASE_URL`.
- Local development defaults to a backend-local database.
- Oracle production should use `sqlite:////var/lib/dip-alert/dip_alert.db` outside the checkout.
- Startup migrations are hand-written, additive, and idempotent.

## Hosting and Delivery

- **Oracle Cloud Always Free VM** is the backend target. systemd runs uvicorn on `127.0.0.1:8000`; Caddy/nginx must terminate public HTTPS.
- **Vercel** is the frontend target. `VITE_API_URL` points the static build at the HTTPS backend origin.
- **GitHub master** is polled by the VM deployment timer after one-time installation.
- `deploy/deploy.sh` performs backup, fast-forward update, conditional dependency install, verification, restart, health check, rollback, and quarantine.

These are configured targets and repository capabilities. Do not claim they are live without external verification.

## Environment Contract

Backend:

- `DATABASE_URL`
- `DISABLE_SCHEDULER=1` for development/tests
- `FRONTEND_ORIGIN` for CORS
- optional `APP_TOKEN` for write protection

Frontend:

- `VITE_API_URL` in production
- relative `/api` in development, proxied by Vite to `localhost:8000`

---
*Railway and persistent `/data` volume instructions are obsolete.*

# External Integrations

**Analysis Date:** 2026-06-14

## APIs & External Services

**Alerting / Messaging:**
- CallMeBot WhatsApp API - Sends automated alerts to the user's phone number.
  - Integration method: HTTP GET request via `httpx` (asynchronous client).
  - Auth: Credentials (phone number and API key) are saved in the `Settings` DB table and redacted on retrieval.
  - Configuration: Configured dynamically via the frontend's Settings page, never committed in code.

**Market Ingestion:**
- Yahoo Finance API - Used to fetch current market price and historical maximum (ATH).
  - SDK/Client: `yfinance` Python library.
  - Auth: No authentication required.
  - Rate limits: Rate-limited by Yahoo. Solved by polling only every N minutes (default 5 min) and caching.

## Data Storage

**Databases:**
- SQLite - Single-user relational DB stored locally (e.g. `dip_alert.db`).
  - Connection: Configured via `DATABASE_URL` (defaults to local SQLite file).
  - Client: `SQLModel` ORM.
  - Migrations: Hand-crafted additive SQLite migrations in `backend/app/main.py` using `PRAGMA table_info` before server start.

## UI Linkages / Broker Integration

**Outbound Links:**
- Groww.in Broker Integration - Outbound links to purchase the Nifty 50 ETF.
  - Slug: Configured per-asset in the `Watchlist` table. Default: `https://groww.in/etfs/sbietf-nifty` (verified internal Groww slug).
  - Purpose: Embeds a direct link in both WhatsApp messages and the dashboard UI to allow the user to easily buy ETF units.

## Hosting & CI/CD

**Hosting Platforms:**
- Railway (Backend) - Fast deployment from GitHub.
  - Environment: Requires env vars (`DATABASE_URL`, `FRONTEND_ORIGIN`, and optionally `APP_TOKEN`).
  - Storage: Requires a persistent volume mounted at `/data` to prevent database reset on redeployments.
- Vercel (Frontend) - Static React hosting.
  - Config: Requires env var `VITE_API_URL`.

## Environment Configuration

**Development:**
- Backend: Uses local sqlite file `dip_alert.db`. Scheduler can be disabled via `DISABLE_SCHEDULER=1`.
- Frontend: Vite dev server proxies `/api` to `localhost:8000`.

**Production:**
- Secrets (phone number/API key) are not stored in `.env` files; they are configured directly in the SQLite DB row via Settings.
- `APP_TOKEN` provides basic write protection on the API endpoints.

---

*Integration audit: 2026-06-14*
*Update when adding/removing external services*

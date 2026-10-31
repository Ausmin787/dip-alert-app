# Architecture

**Verified:** 2026-07-21 from live source.

## System Pattern

Dip Alert is a React single-page client backed by a FastAPI application that owns persistence, market polling, alert decisions, and WhatsApp delivery.

## Backend

- `main.py`: FastAPI construction, startup database creation/additive migrations, scheduler lifecycle, security headers, and optional docs exposure.
- `routes.py`: status/history reads, watchlist CRUD, alert history, settings, and test-alert endpoints.
- `ath_logic.py`: dip and momentum decision logic, reset/de-duplication rules, and alert-log updates.
- `scheduler.py`: weekday/NSE-hours scheduling behavior.
- `price_service.py`: yfinance current, previous-close, and history access.
- `whatsapp.py`: CallMeBot delivery.
- `db.py` and `models.py`: SQLModel engine/session and SQLite models.

### Alert Flow

```text
APScheduler -> active Watchlist rows -> yfinance price data
  -> dip mode: ATH/drop/level/reset rules
  -> momentum mode: previous-close move + UTC-day/direction de-duplication
  -> CallMeBot delivery
  -> only on success: AlertLog + tracker state commit
```

Indian dip assets use the NSE weekday/time gate. Momentum assets run on every scheduler tick without the IST-hours gate.

## Frontend

- `App.jsx` owns the shell, local tab state, and size class. There is no router.
- `tabs/WatchlistTab.jsx`, `AlertsTab.jsx`, and `SettingsTab.jsx` remain mounted and expose the product workflows.
- `AssetContext.jsx` polls status every 60 seconds, fetches 30-day history only for the selected ticker every five minutes, persists that selection, and exposes refresh after mutations.
- `api.js` owns Axios calls, the production `VITE_API_URL`, the dev-relative `/api` path, and the optional `X-App-Token` interceptor.
- `TabBar.jsx` owns the floating tab bar and its wide-screen `Sidebar`. `Sheet.jsx` owns the draggable sheet. `PriceChart.jsx` owns the scrubbable chart.
- `spring.js` provides the shared spring physics and the reduced-motion helper.
- `index.css` owns the design tokens from Apple's published values, plus all component styles.

### Motion Invariant

Everything that moves is one spring per value, started from the live on-screen value, so any animation can be grabbed and reversed. Scrubbing and dragging write to the DOM directly and stay 1:1 with the finger. Glass stays on the floating layer; the content layer never blurs.

## Persistence and Security

- SQLite is the durable store; production should use `/var/lib/dip-alert/dip_alert.db`, outside the checkout.
- CallMeBot credentials live in the settings row and are redacted by the API.
- When `APP_TOKEN` is set, write requests require `X-App-Token`; API docs are disabled.
- Frontend tokens are stored only in that browser's `localStorage`.

## Deployment Target

- Backend: Oracle Cloud Always Free VM, systemd, localhost-only uvicorn, HTTPS reverse proxy.
- Frontend: Vercel static deployment with `VITE_API_URL`.
- `deploy/` provides pull-based update, consistent backup, test gate, health check, rollback, quarantine, and optional deploy-only failure alerts.

Deployment assets exist, but live infrastructure status must be verified separately.

---
*Replaces the superseded Railway/split-pane architecture map dated 2026-06-14.*

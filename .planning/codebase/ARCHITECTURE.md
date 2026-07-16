# Architecture

**Verified:** 2026-07-15 from live source.

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

Indian dip assets use the NSE weekday/time gate. Momentum assets run on weekdays without the IST-hours gate.

## Frontend

- `App.jsx` owns the phone shell and local four-tab state. There is no router.
- `tabs/WatchTab.jsx`, `AlertsTab.jsx`, `HistoryTab.jsx`, and `ManageTab.jsx` remain mounted and expose the product workflows.
- `AssetContext.jsx` polls status every 60 seconds, fetches 30-day histories, persists the selected ticker, and exposes refresh after mutations.
- `api.js` owns Axios calls, the production `VITE_API_URL`, the dev-relative `/api` path, and the optional `X-App-Token` interceptor.
- `GlassNav.jsx` owns semantic bottom-nav buttons, measured equal-column geometry, SVG filter definitions, and GSAP selector movement.
- `gsap.js` registers shared GSAP integration/easing and provides the reduced-motion helper.
- `index.css` owns the wallpaper, phone shell, glass recipes, tab states, and nav presentation.
- `Wallpaper.jsx` owns the decorative wallpaper layers; `wallpaperImage.js` snapshots them (plus their CSS rules) into a shared pre-blurred bitmap; `liquidGlass.js` + `useLiquidGlass.jsx` + `GlassSurface.jsx` bend that bitmap under every `.g` card and the Manage sheet via per-surface `filter: url()` chains (Chromium-gated, plain-CSS fallback elsewhere).

### Glass Nav Invariant

One GSAP proxy is the position source for the rim and filter/map coordinates. The stationary highlighted icon/label is always crisp. A filtered duplicate is shown only while the selector physically travels; velocity and tween progress drive displacement/specular/chromatic strength. Completion, resize, cleanup, same-tab selection, and reduced motion restore zero refraction.

### Surface Refraction Invariant

Card/sheet refraction filters a static pre-baked wallpaper bitmap (`filter: url()` on an empty window layer), never the live backdrop — `backdrop-filter: url()` collapsed the app to ~25fps. The bitmap is a PNG (vector feImage sources re-rasterize per filter run), the host's scrim repaints above the bent layer via `background: inherit`, and the nav container is deliberately excluded (its indicator's backdrop-filter double-processes anything painted beneath it). Kill switches: `REFRACTION_ENABLED`, `data-refract="off"`, `?refract=off`.

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

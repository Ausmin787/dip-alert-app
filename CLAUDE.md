# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

A single-user web app (built for a friend — no auth) that watches assets during market hours and fires WhatsApp alerts (via CallMeBot). Shows a **mobile-first phone-shell dashboard** with four bottom-nav tabs (Watch · Alerts · History · Manage).

**Two alert modes on the watchlist:**
- **Dip Alert** (`alert_mode="dip"`, default): watches Indian indices/ETFs, fires when price crosses a new −X% level below its all-time high. Strategy: "buy ₹1L of Nifty 50 ETF for every −1% fall from ATH." Runs only during NSE market hours (9:15–15:30 IST, Mon–Fri).
- **Momentum Alert** (`alert_mode="momentum"`): watches global assets (Gold, Silver, S&P 500, Nasdaq 100, etc.), fires once per day per direction when `|daily change from prev close| > threshold%`. Runs any weekday (no IST hours gate — global markets are active at different times).

**Default seeded assets (5 total):**
- `^NSEI` Nifty 50 Index — dip 1%, ₹1L deploy, Groww broker URL
- `GC=F` Gold (COMEX) — momentum ±2%
- `SI=F` Silver (COMEX) — momentum ±2%
- `^GSPC` S&P 500 — momentum ±2%
- `^NDX` Nasdaq 100 — momentum ±2%

GitHub: https://github.com/Ausmin787/dip-alert-app (branch: `master`)

> **Parallel tooling:** `.planning/` (a GSD phase/roadmap system) and `GEMINI.md` are artifacts from an Antigravity/Gemini session — leave them be. This `CLAUDE.md` is the source of truth for Claude; some `.planning/` docs have minor drift (e.g. they say "Python 3.14" / "Jest" — neither is accurate).

## Commands

**Backend** (Python 3.11+, FastAPI; venv lives at `backend/.venv`):

```powershell
cd backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000   # run API
.venv\Scripts\python test_logic.py                          # run core-logic tests
.venv\Scripts\pip install -r requirements.txt               # (re)install deps
```

There is no pytest — `test_logic.py` is a plain script that monkeypatches the price functions and exits non-zero on failure. It writes/deletes `test_dip_alert.db` in `backend/`.

Set `DISABLE_SCHEDULER=1` to run the API without APScheduler (useful in dev/tests).

**Frontend** (React + Vite + Tailwind v4, in `frontend/`):

```powershell
cd frontend
npm run dev      # dev server on :5173, proxies /api -> localhost:8000
npm test         # tiny Node regression tests for shared frontend helpers
npm run build    # production build (run this to typecheck/verify changes)
npm run lint
```

Full-stack dev = run both servers; the Vite proxy handles API calls, no CORS config needed locally.

## Architecture

### Alert flow (the core of the app)

**Dip mode** (existing logic, IST-gated):
```
APScheduler (every N min) → market_hours_check() [skips non-weekdays]
  → check_all_assets(market_open=True/False)
    → for each active dip-mode Watchlist row (only when market_open=True):
       check_asset(session, item)
         - fetches current price (price_service.py / yfinance)
         - compares to AthTracker.ath_price
         - level = floor(drop_pct / item.threshold_pct)
         - fires only if level > tracker.last_alerted_level
         - sends WhatsApp, writes AlertLog row (alert_direction=None),
           advances last_alerted_level
```

**Momentum mode** (new, weekday-only, no IST hours gate):
```
APScheduler (every N min) → market_hours_check() [skips weekends]
  → check_all_assets(market_open=...)
    → for each active momentum-mode Watchlist row (always runs on weekdays):
       check_momentum_asset(session, item)
         - fetches current price + prev_close (price_service.py / yfinance)
         - daily_change_pct = (price - prev_close) / prev_close * 100
         - skips if |change| < item.threshold_pct
         - determines direction ("up" / "down")
         - de-duplicates: queries AlertLog for today+ticker+direction, skips if found
         - sends WhatsApp (format_momentum_message), writes AlertLog row
           with alert_direction="up"/"down"
```

State rules for **dip mode** (all in `ath_logic.py`, verified by `test_logic.py`):
- **No re-alert** at the same level within a dip cycle (`last_alerted_level` gate)
- **Recovery reset**: price within 0.5% of ATH (`RECOVERY_RESET_PCT`) resets `last_alerted_level = 0`
- **New ATH** updates the tracker and resets the level to 0
- Levels are in units of `threshold_pct`; `level_pct = level × threshold_pct` stored on `AlertLog`
- **Failed WhatsApp delivery does not consume the level**: no `AlertLog` row, level unchanged, next tick retries
- **Scheduler loops must `session.rollback()`** in per-asset exception handlers — without it one DB error poisons the shared session (`PendingRollbackError`). Regression-tested.

State rules for **momentum mode**:
- At most **one alert per UTC day per direction** (de-duplicated via AlertLog query on `alert_direction` + `ticker` + `alerted_at >= today_start`)
- Failed WhatsApp delivery: same retry pattern as dip mode (no AlertLog row written if `send=False`)
- `AlertLog.ath_price` stores `prev_close` (reference price) for momentum rows; `drop_pct` stores the signed daily change (positive = up, negative = down)

### Backend layout (`backend/app/`)

- `models.py` — SQLModel tables: `watchlist` (now has `alert_mode`), `ath_tracker`, `alert_log` (now has `alert_direction`), `settings` (single row)
- `price_service.py` — `get_current_price`, `get_historical_max`, **`get_prev_close`** (uses `fast_info.previous_close`, fallback to 5d history[-2])
- `ath_logic.py` — `check_asset` (dip), **`check_momentum_asset`** (momentum), `check_all_assets(market_open)`, `refresh_ath`, `refresh_all_aths`
- `whatsapp.py` — `format_alert_message` (dip), **`format_momentum_message`** (momentum: "📈 Gold UP +2.5%"), `send_whatsapp`
- `scheduler.py` — `market_hours_check()` skips weekends; on weekdays passes `market_open=is_market_open()` to `check_all_assets()`. Dip assets skip when `market_open=False`; momentum assets always run.
- `routes.py` — all endpoints under `/api` (status, history, watchlist CRUD, alerts, settings, test-alert)
  - `WatchlistIn` Pydantic model includes `alert_mode: str = "dip"`
  - `/api/status` returns `alert_mode` and `daily_change_pct` for each asset; momentum items have `ath_price/drop_pct/next_alert_level = None`, dip items have `daily_change_pct = None`
  - `next_alert_level` in dip status is `(max(last_alerted_level, current_crossed_level) + 1) × threshold_pct`
- `main.py` — lifespan: create tables → migrate → seed defaults → refresh ATHs in background thread → start scheduler
  - `seed_defaults()` now adds missing assets by ticker (safe to re-run on existing installs — won't duplicate)
  - Default seed: 5 assets (^NSEI dip + 4 global momentum)
  - `migrate_db()` adds `watchlist.alert_mode` (VARCHAR DEFAULT 'dip') and `alert_log.alert_direction` (VARCHAR, nullable)
- WhatsApp credentials live in the `settings` DB row (entered via the UI), **never** in env vars or code
- **Settings API is redacted**: GET/PUT `/api/settings` return only `whatsapp_phone_masked` + `apikey_set` + `check_interval_min` + `write_protected`
- **Optional write protection**: `APP_TOKEN` env var gates all write endpoints; frontend stores token in localStorage
- Input validation: `threshold_pct` >0 and ≤50, `check_interval_min` 1–60, ticker changes via PUT rejected
- Tickers are Yahoo Finance format: `^NSEI`, `SETFNIF50.NS` (NSE), `.BO` (BSE), `GC=F` / `SI=F` (COMEX), `^GSPC` / `^NDX` (US indices)
- `migrate_db()` in `main.py` holds all additive SQLite migrations — `create_all` only creates missing tables, never alters columns, so every new column needs a guard here.

### Frontend layout (`frontend/src/`)

The frontend is a **mobile-first single-page app** built on an "Open Design" phone-shell mockup. **No router** — tab switching is React `useState` in `App.jsx`. **No three.js / GSAP / motion / recharts** — deps are just `axios` + `react` + `react-dom`.

- `api.js` — all backend calls; baseURL is `VITE_API_URL` in production, relative (proxied) in dev. Axios `X-App-Token` interceptor.
- `App.jsx` — phone shell + 4-tab bottom nav. `StatusBar`, `AppHeader` (live/closed chip), `AppShell` (tab useState). Shell `.wrap` carries `id="phone-shell"`. Default export wraps in `<AssetProvider>`.
- `AssetContext.jsx` — `AssetProvider`: data loading from `/api/status`, 30-day history pre-fetching, active selection memory (localStorage), `refresh()`. `useAssets` hook lives in `useAssets.js` (fast-refresh rule). 60s poll.
- `tabs/WatchTab.jsx` — hero price card, **mode-aware display**:
  - **Dip mode**: `Tracker` (5 dip-level pills, windowed) + `NextAlert` (next trigger price + distance)
  - **Momentum mode**: `MomentumCard` (daily change % in green/rose, threshold reminder) — replaces Tracker+NextAlert
  - `Hero` shows `daily_change_pct` (signed, colored) for momentum assets; ATH drop for dip assets. Currency prefix is `$` for futures, blank for index points, `₹` for Indian.
  - `TodaysAlerts` shows directional badge (`.badge-up` green / `.badge-dn` rose) for momentum alerts vs `.badge` cyan for dip alerts
  - `WatchlistMini` shows signed daily % for momentum assets, drop % for dip assets
- `tabs/AlertsTab.jsx` — read-only config summary rows → jump to Manage; recent alerts; market-hours card.
- `tabs/HistoryTab.jsx` — deployment history by IST month (primarily useful for dip-mode assets that have invest_amount).
- `tabs/ManageTab.jsx` — `WatchlistManager` (CRUD); `AssetSheet` now has **Alert type selector** (Dip Alert / Momentum), threshold label adapts to mode, hint text shows global ticker examples; `WhatsAppCard`; `SetupCard`.
- `lib.js` — `tickerMeta(ticker)` now returns `{ exchange, type, currency }`:
  - `=F` suffix → `{ exchange: 'COMEX', type: 'Futures', currency: '$' }`
  - `^GSPC` → `{ exchange: 'NYSE', type: 'Index', currency: 'pts' }`
  - `^NDX` → `{ exchange: 'NASDAQ', type: 'Index', currency: 'pts' }`
  - Default Indian → `{ ..., currency: '₹' }`
  - `severity()` kept — `lib.test.js` depends on it. **Do not use severity colors in the UI.**
  - **Backend timestamps are naive UTC** (`datetime.utcnow`) — `asUTC` helper appends `Z`, don't strip it.

### Design system: Open Design phone shell (don't regress these)

Dark, glassmorphic **mobile** aesthetic, all in `frontend/src/index.css` (plain CSS variables under `:root`, no Tailwind `@theme` block). Phone-shell layout: `.wrap` is 375px centered on desktop, fullscreen under `@media (max-width:430px)`.
- Tokens: `--bg #040916`, `--accent #00e4ff` (mono-cyan), `--green #22c55e`, `--rose #ff5e6c`, `--r 20px`, `--rs 14px`. System/SF font, tabular-nums.
- **Directional colors**: `.chg-up { color: var(--green) }` / `.chg-dn { color: var(--rose) }` — used for momentum daily change display. These are financial up/down colors, not the old severity coloring.
- `.badge-up` / `.badge-dn` — momentum alert badge variants (green/rose), distinct from cyan `.badge` for dip alerts.
- `.momentum-row` / `.momentum-val` / `.momentum-sub` — the `MomentumCard` layout inside `.tracker` glass card.
- `.atmo` — fixed atmospheric background (radial gradients + SVG noise overlay).
- Recipes: `.g` (glass card), `.panel`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.field`, `.sheet-overlay`/`.sheet` (portaled to `#phone-shell`), `.bnav`/`.bni`.

### Bottom nav (`.nav`) — design rules locked in

The nav is **floating**: `position:absolute; bottom: calc(10px + env(safe-area-inset-bottom)); left/right: 15px; border-radius: 31px`. Must not span full width.

**Single-layer glass only**: `backdrop-filter` on `.nav` itself — NOT a child. Chrome seam bug on child inside `overflow:hidden`.

**Sliding indicator** (`.nav-indicator`): `transform: translateX(...)` + `width`. Use `cubic-bezier(0.16, 1, 0.3, 1)` — y > 1.0 causes overshoot.

**Tab switch flash fix**: inactive panels use `opacity: 0; pointer-events: none` (NOT `display: none`). Active tab uses `animation: enter 200ms 80ms ease-out both`.

**Liquid Glass refraction**: use `feImage` with pre-computed cubic gradient displacement map (red=X, green=Y, 128=neutral). `feTurbulence` = WRONG (shaky noise). SVG filter needs `y="-28%" height="156%"`.

## Gotchas

- Market-hours check uses `Asia/Kolkata` via `zoneinfo` — never compare against UTC or server-local time
- **Momentum assets run on weekdays, no IST hours gate** — checked every N minutes all day. This is safe because when a global market is closed, the price barely moves, so `|daily_change| < threshold` and no alert fires.
- **Known limitation**: NSE holidays not modeled (dip mode). Harmless — prices don't move on holidays.
- yfinance is unauthenticated and rate-limited; don't poll faster than every few minutes. Momentum mode adds `get_prev_close()` per asset per tick — the `fast_info` call is cached by yfinance so it's fast.
- SQLite on Railway needs a volume: `DATABASE_URL=sqlite:////data/dip_alert.db`, else data resets every deploy
- `git add -A` traps: `.playwright-mcp/`, `*.db` are gitignored. Playwright screenshots (`nav-*.png`, `dashboard-screenshot.png`, etc.) accumulate in repo root — untracked, safe to delete, never commit.
- Groww ETF URLs use their internal slug — verify at groww.in before hardcoding
- `alert_direction` in AlertLog is `None` for all legacy dip alerts; only set for momentum rows. Frontend checks `a.alert_direction != null` to detect momentum vs dip in the alerts list.

## Ownership Model

The friend deploys on **their own** Railway (backend, root dir `backend`) + Vercel (frontend, root dir `frontend`, `VITE_API_URL` env var) accounts and enters their own CallMeBot phone/key via the Manage tab. No developer credentials, phone numbers, or data anywhere in the repo — keep it that way. Full deploy steps are in README.md.

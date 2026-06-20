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
.venv\Scripts\python test_security.py                       # run security regression tests
.venv\Scripts\pip install -r requirements.txt               # (re)install deps
```

There is no pytest — `test_logic.py` is a plain script that monkeypatches the price functions and exits non-zero on failure. It writes/deletes `test_dip_alert.db` in `backend/`. `test_security.py` spins up a `TestClient` against a temp SQLite DB to check token enforcement, input validation, and response headers.

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
  - `WatchlistIn` Pydantic model includes `alert_mode: Literal["dip", "momentum"] = "dip"`
  - `/api/status` returns `alert_mode` and `daily_change_pct` for each asset; momentum items have `ath_price/drop_pct/next_alert_level = None`, dip items have `daily_change_pct = None`
  - `next_alert_level` in dip status is `(max(last_alerted_level, current_crossed_level) + 1) × threshold_pct`
- `main.py` — lifespan: create tables → migrate → seed defaults → refresh ATHs in background thread → start scheduler
  - `seed_defaults()` now adds missing assets by ticker (safe to re-run on existing installs — won't duplicate)
  - Default seed: 5 assets (^NSEI dip + 4 global momentum)
  - `migrate_db()` adds `watchlist.alert_mode` (VARCHAR DEFAULT 'dip') and `alert_log.alert_direction` (VARCHAR, nullable)
- WhatsApp credentials live in the `settings` DB row (entered via the UI), **never** in env vars or code
- **Settings API is redacted**: GET/PUT `/api/settings` return only `whatsapp_phone_masked` + `apikey_set` + `check_interval_min` + `write_protected`
- **Optional write protection**: `APP_TOKEN` env var gates all write endpoints; frontend stores token in localStorage. If unset, `warn_if_unprotected()` (`main.py`, called from `lifespan`) logs a loud startup warning since writes are then fully open to anyone with the URL.
- `/api/test-alert` enforces a 60s in-memory cooldown (`TEST_ALERT_COOLDOWN_SECONDS` in `routes.py`) to stop CallMeBot quota burn/spam from repeated calls.
- **Strict input validation** (`WatchlistIn`/`SettingsIn` in `routes.py`): `ticker` capped at 24 chars and regex-restricted to Yahoo-style symbols (`TICKER_RE`); `display_name` capped at 80 chars; `alert_mode` is a `Literal["dip", "momentum"]`; `broker_url` must be blank or `https://`; WhatsApp phone/apikey are length-capped to prevent oversized settings payloads.
- **HTTP security headers**: backend sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` via middleware in `main.py`; frontend sets the equivalent (plus CSP) via `frontend/vercel.json` `headers` block.
- Input validation: `threshold_pct` >0 and ≤50, `check_interval_min` 1–60, ticker changes via PUT rejected
- Tickers are Yahoo Finance format: `^NSEI`, `SETFNIF50.NS` (NSE), `.BO` (BSE), `GC=F` / `SI=F` (COMEX), `^GSPC` / `^NDX` (US indices)
- `migrate_db()` in `main.py` holds all additive SQLite migrations — `create_all` only creates missing tables, never alters columns, so every new column needs a guard here.

### Frontend layout (`frontend/src/`)

The frontend is a **mobile-first single-page app** on the **Liquid Glass** design (replaced the earlier dark "Open Design" mono-cyan pass — see Design system below). **No router** — tab switching is React `useState` in `App.jsx`. Deps: `axios` + `react` + `react-dom` + **`gsap` + `@gsap/react`** (added for entrance/feedback animations — see GSAP usage below). No three.js / motion / recharts.

- `api.js` — all backend calls; baseURL is `VITE_API_URL` in production, relative (proxied) in dev. Axios `X-App-Token` interceptor.
- `gsap.js` — tiny shared module: registers the `useGSAP` plugin once, exports `gsap`/`useGSAP`/`prefersReducedMotion()`. Every component doing GSAP work imports from here instead of `gsap` directly.
- `App.jsx` — phone shell + 4-tab bottom nav. `Wallpaper` (sky/ribbon/grain/glow decorative layers), `StatusBar`, `AppHeader` (live/closed chip), `BottomNav` (floating pill nav with a measured sliding indicator), `NavLensFilter` (dormant lens-displacement SVG filter, see Bottom nav below), `AppShell` (tab useState). Shell `.wrap` carries `id="phone-shell"`. Default export wraps in `<AssetProvider>`.
- `AssetContext.jsx` — `AssetProvider`: data loading from `/api/status`, 30-day history pre-fetching, active selection memory (localStorage), `refresh()`. `useAssets` hook lives in `useAssets.js` (fast-refresh rule). 60s poll.
- `tabs/WatchTab.jsx` — hero price card, **mode-aware display**:
  - **Dip mode**: `Tracker` (5 dip-level pills, windowed) + `NextAlert` (next trigger price + distance)
  - **Momentum mode**: `MomentumCard` (daily change % in green/rose, threshold reminder) — replaces Tracker+NextAlert
  - `Hero` shows `daily_change_pct` (signed, colored) for momentum assets; ATH drop for dip assets. Currency prefix is `$` for futures, blank for index points, `₹` for Indian.
  - `TodaysAlerts` shows directional badge (`.badge-up` green / `.badge-dn` rose) for momentum alerts vs `.badge` gold for dip alerts
  - `WatchlistMini` shows signed daily % for momentum assets, drop % for dip assets
  - **GSAP**: the four cards share a `.dash-card` class; on mount/asset-switch a `useGSAP` timeline staggers them in (`autoAlpha` + `y`). `Tracker` pulses the pill that just flipped to "done". `TodaysAlerts` slides a new alert in when the top alert id changes (not on initial load).
- `tabs/AlertsTab.jsx` — read-only config summary rows → jump to Manage; recent alerts (same new-alert slide-in as Watch); market-hours card.
- `tabs/HistoryTab.jsx` — deployment history by IST month (primarily useful for dip-mode assets that have invest_amount).
- `tabs/ManageTab.jsx` — `WatchlistManager` (CRUD); `AssetSheet` now has **Alert type selector** (Dip Alert / Momentum), threshold label adapts to mode, hint text shows global ticker examples; `WhatsAppCard`; `SetupCard`.
- `lib.js` — `tickerMeta(ticker)` now returns `{ exchange, type, currency }`:
  - `=F` suffix → `{ exchange: 'COMEX', type: 'Futures', currency: '$' }`
  - `^GSPC` → `{ exchange: 'NYSE', type: 'Index', currency: 'pts' }`
  - `^NDX` → `{ exchange: 'NASDAQ', type: 'Index', currency: 'pts' }`
  - Default Indian → `{ ..., currency: '₹' }`
  - `severity()` kept — `lib.test.js` depends on it. **Do not use severity colors in the UI.**
  - **Backend timestamps are naive UTC** (`datetime.utcnow`) — `asUTC` helper appends `Z`, don't strip it.

### Design system: Liquid Glass phone shell (don't regress these)

Bright sky/ribbon wallpaper behind **transparent, refractive** glass cards, all in `frontend/src/index.css` (plain CSS variables under `:root`, no Tailwind `@theme` block). Phone-shell layout: `.wrap` is 375px centered on desktop, fullscreen under `@media (max-width:430px)`. Replaces the earlier dark mono-cyan "Open Design" pass — if you see `--accent: #00e4ff` or a near-black `--glass` fill anywhere, that's stale.
- Tokens: `--bg #03176f`, `--accent #ffcf73` (warm gold), `--green #22c55e`, `--rose #ff5e6c`, `--r 26px`, `--rs 18px`. System/SF font, tabular-nums.
- **`.wrap` needs an explicit `z-index` (currently `0`), not just `position: relative`.** Without it, `position:relative` + `z-index:auto` does not establish a real stacking context, so the wallpaper's negative-z-index layers escape it and get compared against `body`'s own background instead — renders as flat navy with no gradient visible. Found and fixed by testing in isolation; don't remove the explicit z-index.
- **Glass cards (`.g`) need real opacity in their scrim**, not just blur — `background: linear-gradient(150deg, rgba(0,8,36,0.56)…, rgba(2,14,60,0.68)…)`. Earlier passes at ~30% opacity looked good empty but made every secondary-text color (`--dim`/`--muted`) unreadable once real content/wallpaper showed through. `--dim`/`--muted`/`--faint` are tuned to that scrim — don't lower the scrim opacity without re-checking text contrast on every tab.
- The `.g::before` corner highlight (refraction sheen) is intentionally subdued (~0.20 not ~0.42) so it doesn't wash out section labels that sit in that same top-left corner.
- **Directional colors**: `.chg-up { color: var(--green) }` / `.chg-dn { color: var(--rose) }` — used for momentum daily change display. These are financial up/down colors, not the old severity coloring.
- `.badge-up` / `.badge-dn` — momentum alert badge variants (green/rose), distinct from gold `.badge` for dip alerts.
- `.momentum-row` / `.momentum-val` / `.momentum-sub` — the `MomentumCard` layout inside `.tracker` glass card.
- `Wallpaper` (in `App.jsx`) — four decorative layers (`.wallpaper`/`.ribbons`/`.grain`/`.glow`), not a single `.atmo` div like the old design.
- Recipes: `.g` (glass card), `.panel`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.field`, `.sheet-overlay`/`.sheet` (portaled to `#phone-shell`), `.nav`/`.nav-indicator` (see Bottom nav below).

### Bottom nav (`.nav`) — design rules locked in

Implemented in `App.jsx`'s `BottomNav` component (measures button positions with `useLayoutEffect` + refs, not a vanilla-JS DOM query like the original design source). The nav is **floating**: `position:absolute; bottom: calc(10px + env(safe-area-inset-bottom)); left/right: 15px; border-radius: 31px`. Must not span full width.

**Single-layer glass only**: `backdrop-filter` on `.nav` itself — NOT a child. Chrome seam bug on child inside `overflow:hidden`.

**Sliding indicator** (`.nav-indicator`): `transform: translateX(...)` + `width`, computed from `getBoundingClientRect()` of the active button. Use `cubic-bezier(0.16, 1, 0.3, 1)` — y > 1.0 causes overshoot.

**Tab switch flash fix**: inactive panels use `opacity: 0; pointer-events: none` (NOT `display: none`). Active tab uses `animation: enter 200ms 80ms ease-out both`.

**Liquid Glass refraction**: `NavLensFilter` in `App.jsx` generates a cubic-power displacement map into a canvas → SVG `feImage` once on mount. `feTurbulence` = WRONG (shaky noise). SVG filter needs `y="-28%" height="156%"`. **This filter is intentionally dormant** — nothing's `.nav` rule actually applies `filter: url(#nav-lq)` yet (the original design source it was ported from doesn't wire it up either). Don't "fix" this without checking with the user first; it may be intentional staging for later.

**`.nav-scrim`**: a separate absolutely-positioned fade layer (`z-index: 5`, between panel content and the nav's `z-index: 10`) sitting behind the nav. Needed because the floating nav leaves a small gap between its own bottom edge and the phone's edge that isn't covered by the nav or clipped by the panel — without the scrim, scrollable content (e.g. the watchlist's first row) shows through as "ghost text" right at the bottom of the Watch tab. The scrim uses **`mask-image`** (not just a `background` gradient) so the `backdrop-filter` blur itself fades in gradually — a plain gradient background only fades the *tint*, not the blur, which left a visible hard seam where the blur snapped on. This is the standard progressive-blur trick (how iOS does it too).

## Gotchas

- Market-hours check uses `Asia/Kolkata` via `zoneinfo` — never compare against UTC or server-local time
- **Momentum assets run on weekdays, no IST hours gate** — checked every N minutes all day. This is safe because when a global market is closed, the price barely moves, so `|daily_change| < threshold` and no alert fires.
- **Known limitation**: NSE holidays not modeled (dip mode). Harmless — prices don't move on holidays.
- yfinance is unauthenticated and rate-limited; don't poll faster than every few minutes. Momentum mode adds `get_prev_close()` per asset per tick — the `fast_info` call is cached by yfinance so it's fast.
- SQLite on Railway needs a volume: `DATABASE_URL=sqlite:////data/dip_alert.db`, else data resets every deploy
- `git add -A` traps: `.playwright-mcp/`, `*.db` are gitignored. Playwright/screenshot debug PNGs accumulate in repo root during design work (e.g. `nav-*.png`, `dashboard-screenshot.png`, `tab-*.png`, `zoom-*.png`, `debug-*.png`) — untracked, safe to delete, never commit. Clean these up at the end of a design session.
- Groww ETF URLs use their internal slug — verify at groww.in before hardcoding
- `alert_direction` in AlertLog is `None` for all legacy dip alerts; only set for momentum rows. Frontend checks `a.alert_direction != null` to detect momentum vs dip in the alerts list.
- **`docs/screenshots/dashboard-desktop.png` is a real screenshot of the live app**, not a mockup — regenerate it (live dev server + Playwright, not the static design source) whenever the dashboard's visual design changes meaningfully, so README stays accurate.
- **Alerts tab ConfigRows are navigation shortcuts, not toggle switches**: the "WhatsApp Alerts" row (and Dip Interval / Deploy Amount / Check Interval) in `AlertsTab.jsx` are `<button>` elements that navigate to the Manage tab on click — the `.toggle` inside is a pure visual status indicator, not a real switch. This is intentional design.
- **WhatsApp Delivery "Save"**: submitting the form with blank phone/apikey fields does NOT overwrite the stored secrets — only `check_interval_min` changes. The UI never echoes back the real values (masked display only), so this blank-means-preserve pattern is load-bearing.
- **A design source file (e.g. dropped into `frontend/index.html` directly) can silently replace the Vite entry point** — it'll still render in the browser (looks like progress) but with zero React, zero live data, and zero of the app's actual logic. If a "redesign" suddenly shows hardcoded/fake numbers instead of real backend data, check `git diff frontend/index.html` first before debugging anything else.
- **`gsap.matchMedia()` isn't used for reduced-motion checks here** — deliberately. It creates its own listener separate from `useGSAP`'s context; in an effect that re-runs often (e.g. on every tab/asset switch), wrapping it without manually tracking/reverting the old instance leaks a media-query listener per run. A plain `prefersReducedMotion()` boolean check (in `gsap.js`) does the same query without that footgun.

## Ownership Model

The friend deploys on **their own** Railway (backend, root dir `backend`) + Vercel (frontend, root dir `frontend`, `VITE_API_URL` env var) accounts and enters their own CallMeBot phone/key via the Manage tab. No developer credentials, phone numbers, or data anywhere in the repo — keep it that way. Full deploy steps are in README.md.

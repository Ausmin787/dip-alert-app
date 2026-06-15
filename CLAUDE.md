# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

A single-user web app (built for a friend — no auth) that watches the Nifty 50 index during NSE market hours, fires a WhatsApp alert (via CallMeBot) each time price crosses a new −1% level below its all-time high, and shows a **mobile-first phone-shell dashboard** with four bottom-nav tabs (Watch · Alerts · History · Manage). Strategy: "buy ₹1L of Nifty 50 ETF for every −1% fall from ATH."

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

```
APScheduler (backend/app/scheduler.py, every N min, 9:15–15:30 IST Mon–Fri)
  → ath_logic.check_all_assets()
    → for each active Watchlist row: check_asset(session, item)
       - fetches current price (price_service.py / yfinance)
       - compares to AthTracker.ath_price
       - level = floor(drop_pct / item.threshold_pct)
       - fires only if level > tracker.last_alerted_level
       - sends WhatsApp (whatsapp.py / CallMeBot), writes AlertLog row,
         advances last_alerted_level
```

State rules that must not be broken (all in `backend/app/ath_logic.py`, verified by `test_logic.py`):
- **No re-alert** at the same level within a dip cycle (`last_alerted_level` gate)
- **Recovery reset**: price within 0.5% of ATH (`RECOVERY_RESET_PCT`) resets `last_alerted_level = 0` so levels re-trigger on the next dip
- **New ATH** updates the tracker and resets the level to 0
- Levels are in units of the asset's `threshold_pct` (default 1.0 → whole percents); the user-facing percentage is `level_pct = level × threshold_pct` (stored on `AlertLog`, shown in WhatsApp + UI)
- **Failed WhatsApp delivery does not consume the level**: no `AlertLog` row, `last_alerted_level` unchanged, next scheduler tick retries. Only an actually-sent alert (or a deliberate unconfigured-credentials run, where the dashboard is the record) advances the level.
- **Scheduler loops must `session.rollback()` in their per-asset exception handlers** (`check_all_assets`/`refresh_all_aths`) — without it, one DB error poisons the shared session (`PendingRollbackError`) for every remaining asset in the pass. Regression-tested in `test_logic.py`.

### Backend layout (`backend/app/`)

- `models.py` — SQLModel tables: `watchlist`, `ath_tracker`, `alert_log`, `settings` (single row)
- `routes.py` — all endpoints under `/api` (status, history, watchlist CRUD, alerts, settings, test-alert)
  - `next_alert_level` in `/api/status` is `(max(last_alerted_level, current_crossed_level) + 1) × threshold_pct` — must account for current price position, not just `last_alerted_level + 1`, or it shows the wrong level when no alerts have fired yet
- `main.py` — lifespan: create tables → seed default `^NSEI` row → refresh ATHs in a background thread → start scheduler
  - Default seed broker URL for SBI Nifty 50 ETF: `https://groww.in/etfs/sbietf-nifty` (Groww's actual slug — not `sbi-nifty-50-etf`, that 404s)
- WhatsApp credentials live in the `settings` DB row (entered via the UI), **never** in env vars or code
- **Settings API is redacted**: GET/PUT `/api/settings` return only `whatsapp_phone_masked` + `apikey_set` + `check_interval_min` + `write_protected` — raw credentials never leave the server. Blank phone/key in a PUT means "keep the stored value" (the UI can't echo secrets back, so don't break this)
- **Optional write protection**: if the `APP_TOKEN` env var is set, all write endpoints (`write_protected` dependency in `routes.py`) require a matching `X-App-Token` header; the frontend stores the token in localStorage (`api.js` interceptor) and the Manage tab's WhatsApp card shows the token field only when the backend reports `write_protected: true`. Unset = open API (local dev default). Reads stay public by design.
- Input validation lives on the Pydantic models in `routes.py`: `threshold_pct` >0 and ≤50 (guards a ZeroDivisionError in status + scheduler), `check_interval_min` 1–60, ticker changes via PUT /watchlist are rejected (would orphan the `ath_tracker` row)
- Changing `check_interval_min` via PUT /api/settings reschedules the running APScheduler job
- Tickers are Yahoo Finance format: `^NSEI`, `SETFNIF50.NS` (NSE), `.BO` (BSE)
- `main.py migrate_db()` holds additive SQLite migrations (`alert_log.level_pct`; `watchlist.threshold_pct`/`invest_amount`/`broker_url`/`active`) — `create_all` only creates missing *tables*, never adds columns to an existing one, so any column added after the first schema needs a guard here or an old DB crashes at `seed_defaults()` on startup. Each block checks `PRAGMA table_info` and is safe to re-run.

### Frontend layout (`frontend/src/`)

The frontend is a **mobile-first single-page app** built on an "Open Design" phone-shell mockup (the user designs the base in the Open Design desktop app; Claude wires it to the backend — implement the design faithfully, don't reinvent it). **No router** — tab switching is React `useState` in `App.jsx`. **No three.js / GSAP / motion / recharts** — those were removed in this redesign; deps are just `axios` + `react` + `react-dom`.

- `api.js` — all backend calls; baseURL is `VITE_API_URL` in production, relative (proxied) in dev. Axios `X-App-Token` interceptor (localStorage) for the optional write-protection path.
- `App.jsx` — the phone shell + 4-tab bottom nav. `StatusBar` (fake 97% battery + real local clock), `AppHeader` (live/closed chip reflects `isMarketOpenIST()`), `AppShell` (the `tab` useState, conditionally renders one tab; `AlertsTab` gets `onManage={() => setTab('manage')}`). The shell `.wrap` carries `id="phone-shell"` — the Manage add/edit bottom sheet **portals** there (see ManageTab below). Default export wraps everything in `<AssetProvider>`.
- `AssetContext.jsx` — the `AssetProvider` component: unified data loading from `/api/status`, parallel 30-day history pre-fetching for all assets, active selection memory (`localStorage`), and a `refresh()` the Manage CRUD calls. The `useAssets` hook + context object live in **`useAssets.js`** (split out so the provider file exports only a component — fast-refresh rule). The 60s poll reads selection via a ref, so it never resets a selection the user just made.
- `tabs/WatchTab.jsx` — hero price card (big split price), the segmented dip **Tracker** (`dipLevels()` windows 5 pills so the next level is always visible — done/next/upcoming states), **NextAlert** (computes `nextPrice = ath × (1 − nextPct/100)` and distance to it), today's alerts, and a mini watchlist for selecting the active asset.
- `tabs/AlertsTab.jsx` — read-only config summary rows (WhatsApp on/off from `settings`, per-asset Dip Interval + Deploy Amount, global Check Interval) that are **tappable → jump to Manage** via `onManage`; recent alerts list; market-hours card. Fetches `getSettings()` + `getAlerts()`.
- `tabs/HistoryTab.jsx` — deployment history. Groups alerts by IST month, sums deployed capital client-side (invest_amount isn't stored on `AlertLog`, so it joins each alert's ticker to the current watchlist item, ₹1L fallback). Stat grid: alerts fired this month, per-trigger amount, max dip today, next target.
- `tabs/ManageTab.jsx` — the management tab (the mockup is display-only; this 4th tab holds all the write actions). `WatchlistManager` (add/edit/delete/pause via `addAsset`/`updateAsset`/`deleteAsset`, `refresh()` after each); `AssetSheet` (a bottom sheet — **rendered through `createPortal` into `#phone-shell`** so the `position:absolute` overlay anchors to the phone shell, not the watchlist card; ticker locked on edit); `WhatsAppCard` (phone/apikey/check_interval/app_token form — same redacted-settings contract as the old Settings page: blank field = keep stored secret); `SetupCard` (CallMeBot onboarding steps).
- `lib.js` — formatters incl. `splitPrice` (whole/frac for the big hero number), `tickerMeta` (exchange + Index/ETF), `fmtLakh` (₹1L style), `severity()` (kept — `lib.test.js` depends on it), `fmtLevel`, IST helpers `isMarketOpenIST` / `isTodayIST` / `fmtTimeIST` / `fmtDayIST` / `monthLabelIST`. **Backend timestamps are naive UTC** (`datetime.utcnow`) — the `asUTC` helper appends `Z` before parsing, so don't strip it.

### Design system: Open Design phone shell (don't regress these)

Dark, glassmorphic **mobile** aesthetic, all in `frontend/src/index.css` (plain CSS variables under `:root`, no Tailwind `@theme` block — `@import 'tailwindcss'` stays at the top for utility classes but the design is hand-rolled CSS). Phone-shell layout: `.wrap` is a 375px centered "device" on desktop and **fullscreen under `@media (max-width:430px)`**; inside it `.app` (absolute, flex column) holds `.sbar` status bar → `.aheader` → scrolling `.panels` → `.bnav` bottom nav.
- Tokens (`:root`): `--bg #040916`, `--accent #00e4ff` (mono-cyan — the single accent, used for highlights/CTAs), `--glass` (translucent card fill), `--green #22c55e`, `--rose #ff5e6c`, radii `--r 20px` / `--rs 14px`. Font: **system / SF stack** (`-apple-system, …`), tabular-nums on numerals. The mono-cyan accent is deliberate — do **not** reintroduce the old mint/amber/rose severity coloring in the UI (the `severity()` helper survives only for the test).
- `.atmo` is the fixed atmospheric background (layered radial gradients + an SVG `feTurbulence` noise overlay) inside the shell.
- Recipes: `.g` = the glass card (`backdrop-filter: blur`); `.panel` = a tab's scroll container; `.btn-primary` = cyan pill, `.btn-ghost` = charcoal pill, `.btn-danger` for destructive; `.field` = form input; `.sheet-overlay` / `.sheet` = the bottom sheet (overlay is `position:absolute; inset:0` and **must be portaled to `#phone-shell`** to cover the phone rather than a nested card); `.bnav` / `.bni` = bottom-nav tabs.

### Bottom nav (`.nav`) — design rules locked in

The nav is **floating**: `position:absolute; bottom: calc(10px + env(safe-area-inset-bottom)); left/right: 15px; border-radius: 31px`. It must not span full width.

**Single-layer glass only**: `backdrop-filter` must stay on `.nav` itself — NOT on a child element. Chrome creates a 1–2px compositing seam ring when `backdrop-filter` is on a child inside `overflow:hidden`. Tested and confirmed; the two-layer approach (`.nav-bg` child) was tried and abandoned for this reason.

**Sliding indicator** (`.nav-indicator`): animates via `transform: translateX(...)` + `width` change. `overflow: hidden` on `.nav` clips it. Use `cubic-bezier(0.16, 1, 0.3, 1)` — any y-value > 1.0 in the easing causes visible overshoot past the nav boundary.

**Tab switch flash fix**: panels must use `opacity: 0; pointer-events: none` when inactive (NOT `display: none`). `display:none → block` forces Chrome to recompute `backdrop-filter` from scratch on frame 1, producing a visible flash. Keeping elements in the DOM lets Chrome pre-compute the backdrop. Active tab uses `animation: enter 200ms 80ms ease-out both` (80ms delay + `fill-mode: both` = stays hidden while Chrome pre-computes the full panel backdrop, eliminating bottom-of-card flash on first render).

**Liquid Glass refraction**: the correct approach uses `feImage` with a pre-computed gradient displacement map (red = X, green = Y, 128 = neutral). `feTurbulence` is WRONG — it produces shaky random noise, not smooth lens bending. The effect is inherently subtle on dark navy backgrounds; most visible when card content scrolls under the nav. Nav SVG filter needs `y="-28%" height="156%"` to accommodate displacement at the edges.

## Gotchas

- Market-hours check uses `Asia/Kolkata` via `zoneinfo` — never compare against UTC or server-local time
- **Known limitation**: NSE holidays are not modeled (weekday + hours only). Harmless — prices don't move on holidays so no level can be crossed — but polls run idle. A holiday calendar would need yearly maintenance; deliberately skipped.
- yfinance is unauthenticated and rate-limited; don't poll faster than every few minutes
- SQLite on Railway needs a volume: `DATABASE_URL=sqlite:////data/dip_alert.db`, else data resets every deploy
- `git add -A` traps: `.playwright-mcp/`, `*.db` are gitignored — keep it that way. Playwright diagnostic screenshots (`nav-*.png`, `kube-*.png`, `specy-demo.png`, `dashboard-screenshot.png`) accumulate in the repo root during investigation sessions — they are untracked and safe to delete, but never commit them.
- Groww ETF URLs use their internal slug, not the fund name — verify at groww.in before hardcoding any broker URL

## Ownership Model

The friend deploys on **their own** Railway (backend, root dir `backend`) + Vercel (frontend, root dir `frontend`, `VITE_API_URL` env var) accounts and enters their own CallMeBot phone/key via the Manage tab. No developer credentials, phone numbers, or data anywhere in the repo — keep it that way. Full deploy steps are in README.md.

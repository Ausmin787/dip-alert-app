# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

A single-user web app (built for a friend — no auth) that watches the Nifty 50 index during NSE market hours, fires a WhatsApp alert (via CallMeBot) each time price crosses a new −1% level below its all-time high, and shows a dark, motion-first dashboard (Framer-style, with a three.js hero and GSAP animation). Strategy: "buy ₹1L of Nifty 50 ETF for every −1% fall from ATH."

GitHub: https://github.com/Ausmin787/dip-alert-app (branch: `master`)

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
- **Optional write protection**: if the `APP_TOKEN` env var is set, all write endpoints (`write_protected` dependency in `routes.py`) require a matching `X-App-Token` header; the frontend stores the token in localStorage (`api.js` interceptor) and Settings shows the token field only when the backend reports `write_protected: true`. Unset = open API (local dev default). Reads stay public by design.
- Input validation lives on the Pydantic models in `routes.py`: `threshold_pct` >0 and ≤50 (guards a ZeroDivisionError in status + scheduler), `check_interval_min` 1–60, ticker changes via PUT /watchlist are rejected (would orphan the `ath_tracker` row)
- Changing `check_interval_min` via PUT /api/settings reschedules the running APScheduler job
- Tickers are Yahoo Finance format: `^NSEI`, `SETFNIF50.NS` (NSE), `.BO` (BSE)
- `main.py migrate_db()` holds additive SQLite migrations (`alert_log.level_pct`; `watchlist.threshold_pct`/`invest_amount`/`broker_url`/`active`) — `create_all` only creates missing *tables*, never adds columns to an existing one, so any column added after the first schema needs a guard here or an old DB crashes at `seed_defaults()` on startup. Each block checks `PRAGMA table_info` and is safe to re-run.

### Frontend layout (`frontend/src/`)

- `api.js` — all backend calls; baseURL is `VITE_API_URL` in production, relative (proxied) in dev
- `pages/` — Dashboard, Watchlist, Alerts, Settings (routed in `App.jsx`)
- `App.jsx` — implements the **Stripe-Style Split Pane** layout:
  - Collapsible Icon Left Sidebar Dock (`SidebarDock`, expands 64px ➔ 200px on hover) containing page routing links and live market chip.
  - Middle Live Asset Feed Pane (`middle-feed-pane`, hidden on mobile) displaying watchlist asset cards with inline SVG sparklines, live prices, severity badges, and an IST clock header.
  - Right Workspace Main Panel (`workspace-pane`) showing page routes.
  - Fallback bottom navigation (`BottomNav`, visible on mobile `sm:hidden`).
- `AssetContext.jsx` — exports `AssetProvider` and custom `useAssets` hook. Handles unified data loading from `/api/status`, parallel 30-day history pre-fetching for all assets, active selection memory (`localStorage`), and context refetch triggers.
- `pages/Dashboard.jsx` — active page view showing hero selected asset metrics, standard `DipLadder`, `RecentAlerts`, and `DipChart` (price history vs. ATH).
  - Refactored to consume `useAssets()` context directly for zero-lag chart loading.
  - **Mobile switcher:** Includes `MobileAssetSwitcher` (rendered `<md` viewports) containing a horizontally scrollable row of asset pill-chips (since the middle pane is hidden on mobile) so users can browse and select assets.
- `pages/Watchlist.jsx` — watchlist CRUD (add/edit/delete/pause). Triggers context `refresh()` on CRUD operations to synchronize the middle feed pane instantly.
- `components/three/IndexOrb.jsx` — the three.js hero (React-Three-Fiber point-cloud sphere); recolors mint→amber→rose with `drop_pct`, ripples a shockwave on each new dip level, slow auto-rotate + pointer parallax. **Lazy-loaded** (own bundle chunk) and `frameloop="never"` under reduced motion.
- `components/anim.jsx` — GSAP helpers: `Reveal` (ScrollTrigger entrance), `CountUp`, `SplitReveal` (headline word stagger), `Magnetic` (cursor-pull buttons). **Gotcha:** `Reveal` blocks start at opacity 0 until scrolled into view, so a *full-page* Playwright screenshot shows below-fold content blank — screenshot per-viewport and scroll to verify.
- `components/useReducedMotion.js` — matchMedia hook gating GSAP + the orb (split into its own file so `anim.jsx` stays component-only for the fast-refresh lint rule).
- `components/motion.jsx` — now just `Page` (route transition). `components/DipLadder.jsx` — signature segmented −1%…−N% ladder (GSAP-staggered fill, gradient by severity, ✓ delivered, pulsing dashed next). `components/Sparkline.jsx` — self-drawing SVG sparkline.
- `lib.js` — formatters, `severity()` (mint <1%, amber 1–3%, rose 3%+ below ATH), `fmtLevel`, and client-side `isMarketOpenIST()`/`istClock()` so the nav chip stays live without polling the backend

### Design system: "Framer" (don't regress these)

Dark, motion-first aesthetic adapted from Framer's DESIGN.md (getdesign.md / VoltAgent/awesome-design-md), in `frontend/src/index.css` + GSAP + `motion`:
- Tokens (`@theme`): Palette 1 / Market Terminal — canvas `#070a0e`, `surface-1 #10161d`, `surface-2 #18212b`, `hairline #263241`, text `ink #f4f7fa` / `ink-muted #8a97a6`, `accent #2d7dff` for links/focus ONLY (**never a generic fill**), gradient palette `violet #2d7dff` / `magenta #20c7b5` / `orange #f6c65b` / `coral #ff5e6c`, severity `mint #2fe6a3` / amber / rose. Font: **Inter** everywhere; display via `.display` (weight 700, hard negative tracking `-0.045em`); numerals via `.num` (tabular-nums) — no separate mono font.
- `.backdrop-grid` (dot grid, z −3) + `.backdrop-glow` (blue→mint bloom, z −2) are fixed layers; **`body` background must stay `transparent`** — an opaque body paints over negative z-index layers (CSS painting order)
- Recipes: `.panel` (surface-1 card, hairline border, `.panel-hover` lift); `.spotlight` (the signature gradient tile — **one per page**, blue→teal default, override the gradient via inline `style`); `.btn-primary` = **white pill**, `.btn-ghost` = charcoal pill (never bordered/squared CTAs)
- Two animation libs, by design: **GSAP** (content reveals + micro-interactions via `anim.jsx`, plus the orb shockwave) and **`motion`** (route transitions, the SidebarDock hover spring, the Watchlist modal). Both honor reduced motion (`useReducedMotion` + `MotionConfig reducedMotion="user"`); route changes go through `AnimatePresence mode="wait"`
- **three.js**: keep the orb lazy-loaded and capped (`dpr={[1, 2]}`); no postprocessing/bloom dep (bundle weight) — emissive + additive blending instead
- Recharts: keep `isAnimationActive={false}` on series — the draw animation renders blank under React StrictMode. The chart lives in `components/DipChart.jsx` and is **lazy-loaded** (recharts is ~330 kB; keep it out of the main bundle)

## Gotchas

- Market-hours check uses `Asia/Kolkata` via `zoneinfo` — never compare against UTC or server-local time
- **Known limitation**: NSE holidays are not modeled (weekday + hours only). Harmless — prices don't move on holidays so no level can be crossed — but polls run idle. A holiday calendar would need yearly maintenance; deliberately skipped.
- yfinance is unauthenticated and rate-limited; don't poll faster than every few minutes
- SQLite on Railway needs a volume: `DATABASE_URL=sqlite:////data/dip_alert.db`, else data resets every deploy
- `git add -A` traps: `.playwright-mcp/`, `*.db` are gitignored — keep it that way
- Groww ETF URLs use their internal slug, not the fund name — verify at groww.in before hardcoding any broker URL

## Ownership Model

The friend deploys on **their own** Railway (backend, root dir `backend`) + Vercel (frontend, root dir `frontend`, `VITE_API_URL` env var) accounts and enters their own CallMeBot phone/key via the Settings page. No developer credentials, phone numbers, or data anywhere in the repo — keep it that way. Full deploy steps are in README.md.

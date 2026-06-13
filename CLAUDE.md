# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

A single-user web app (built for a friend — no auth) that watches the Nifty 50 index during NSE market hours, fires a WhatsApp alert (via CallMeBot) each time price crosses a new −1% level below its all-time high, and shows a glassmorphism dashboard. Strategy: "buy ₹1L of Nifty 50 ETF for every −1% fall from ATH."

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
- **Settings API is redacted**: GET/PUT `/api/settings` return only `whatsapp_phone_masked` + `apikey_set` + `check_interval_min` — raw credentials never leave the server. Blank phone/key in a PUT means "keep the stored value" (the UI can't echo secrets back, so don't break this)
- Input validation lives on the Pydantic models in `routes.py`: `threshold_pct` >0 and ≤50 (guards a ZeroDivisionError in status + scheduler), `check_interval_min` 1–60, ticker changes via PUT /watchlist are rejected (would orphan the `ath_tracker` row)
- Changing `check_interval_min` via PUT /api/settings reschedules the running APScheduler job
- Tickers are Yahoo Finance format: `^NSEI`, `SETFNIF50.NS` (NSE), `.BO` (BSE)
- `main.py migrate_db()` holds additive SQLite migrations (e.g. `alert_log.level_pct`) — `create_all` doesn't alter existing tables

### Frontend layout (`frontend/src/`)

- `api.js` — all backend calls; baseURL is `VITE_API_URL` in production, relative (proxied) in dev
- `pages/` — Dashboard, Watchlist, Alerts, Settings (routed in `App.jsx`)
- `components/DipLadder.jsx` — the signature UI element: segmented track of −1%…−N% levels (filled = crossed, ✓ = alert delivered, pulsing dashed = next trigger)
- `components/Sparkline.jsx` — self-drawing SVG sparkline (Motion `pathLength`); `components/motion.jsx` — `Page` (route transitions), `Reveal` (staggered entrances), `AnimatedNumber` (count-up)
- `lib.js` — formatters, `severity()` (mint <1%, gold 1–3%, blush 3%+ below ATH), `fmtLevel`, and client-side `isMarketOpenIST()`/`istClock()` so the status bar stays live without polling the backend

### Design system: "Precision Terminal" (don't regress these)

Dark trading-terminal aesthetic, defined in `frontend/src/index.css` + Motion (`motion/react`):
- Tokens (`@theme`): canvas `abyss #07080c`, surfaces `pane`/`pane-2`, text `frost`/`mist`, accents `pulse #6e6bff` (indigo) → `flux #22d3ee` (cyan), severity `mint`/`gold`/`blush`. Fonts: Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono (every numeral/ticker via `.num`/`.tag`)
- `.backdrop-grid` (dot grid, z −3) + `.backdrop-glow` (breathing indigo bloom, z −2) are fixed layers; **`body` background must stay `transparent`** — an opaque body paints over negative z-index layers (CSS painting order)
- `.panel` is the card recipe: 1px hairline border + inset top highlight + stacked shadows, never opaque fills; `.panel-hover` adds the lift/glow. Buttons: `.btn-primary` (indigo→cyan gradient) / `.btn-ghost`
- Shell: desktop = fixed left sidebar (`layoutId="side-active"` sliding indicator) + sticky status bar (NSE live chip, ticking IST clock, `.horizon` hairline); mobile = floating bottom tab bar (`layoutId="tab-active"`), bottom-sheet modals, safe-area insets
- Motion everywhere but respectful: `MotionConfig reducedMotion="user"` wraps the app; route changes go through `AnimatePresence mode="wait"`
- Recharts: keep `isAnimationActive={false}` on series — the draw animation renders blank under React StrictMode

## Gotchas

- Market-hours check uses `Asia/Kolkata` via `zoneinfo` — never compare against UTC or server-local time
- **Known limitation**: NSE holidays are not modeled (weekday + hours only). Harmless — prices don't move on holidays so no level can be crossed — but polls run idle. A holiday calendar would need yearly maintenance; deliberately skipped.
- yfinance is unauthenticated and rate-limited; don't poll faster than every few minutes
- SQLite on Railway needs a volume: `DATABASE_URL=sqlite:////data/dip_alert.db`, else data resets every deploy
- `git add -A` traps: `.playwright-mcp/`, `*.db` are gitignored — keep it that way
- Groww ETF URLs use their internal slug, not the fund name — verify at groww.in before hardcoding any broker URL

## Ownership Model

The friend deploys on **their own** Railway (backend, root dir `backend`) + Vercel (frontend, root dir `frontend`, `VITE_API_URL` env var) accounts and enters their own CallMeBot phone/key via the Settings page. No developer credentials, phone numbers, or data anywhere in the repo — keep it that way. Full deploy steps are in README.md.

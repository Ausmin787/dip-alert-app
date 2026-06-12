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
- Levels are in units of the asset's `threshold_pct` (default 1.0 → whole percents)

### Backend layout (`backend/app/`)

- `models.py` — SQLModel tables: `watchlist`, `ath_tracker`, `alert_log`, `settings` (single row)
- `routes.py` — all endpoints under `/api` (status, history, watchlist CRUD, alerts, settings, test-alert)
- `main.py` — lifespan: create tables → seed default `^NSEI` row → refresh ATHs in a background thread → start scheduler
- WhatsApp credentials live in the `settings` DB row (entered via the UI), **never** in env vars or code
- Changing `check_interval_min` via PUT /api/settings reschedules the running APScheduler job
- Tickers are Yahoo Finance format: `^NSEI`, `SETFNIF50.NS` (NSE), `.BO` (BSE)

### Frontend layout (`frontend/src/`)

- `api.js` — all backend calls; baseURL is `VITE_API_URL` in production, relative (proxied) in dev
- `pages/` — Dashboard, Watchlist, Alerts, Settings (routed in `App.jsx`)
- `components/DipLadder.jsx` — the signature UI element: pill ladder of −1%…−N% levels (filled = crossed, ✓ = alerted, dashed = next trigger)
- `lib.js` — formatters and the severity mapping (green <1%, amber 1–3%, red 3%+ below ATH)

### Design system (don't regress these)

The look is dark glassmorphism over an animated "aurora" backdrop, defined entirely in `frontend/src/index.css`:
- `.aurora` (z-index −3) + `.grain` (z-index −1) are fixed background layers; **`body` background must stay `transparent`** — an opaque body background paints over negative z-index layers (CSS painting order) and kills the whole effect
- Reusable classes: `.glass`, `.glass-strong`, `.field`, `.rise`/`.sheet-up` (entry animations), `.pressable`; fonts are Fraunces (display) + Outfit (body), colors via `@theme` tokens (moss/amber-soft/ember/fog/ink)
- Mobile-first: bottom-sheet modals, safe-area insets on the dock/nav, card lists instead of tables on small screens
- Recharts: keep `isAnimationActive={false}` on series — the draw animation renders blank under React StrictMode

## Gotchas

- Market-hours check uses `Asia/Kolkata` via `zoneinfo` — never compare against UTC or server-local time
- yfinance is unauthenticated and rate-limited; don't poll faster than every few minutes
- SQLite on Railway needs a volume: `DATABASE_URL=sqlite:////data/dip_alert.db`, else data resets every deploy
- `git add -A` traps: `.playwright-mcp/`, `*.db` are gitignored — keep it that way

## Ownership Model

The friend deploys on **their own** Railway (backend, root dir `backend`) + Vercel (frontend, root dir `frontend`, `VITE_API_URL` env var) accounts and enters their own CallMeBot phone/key via the Settings page. No developer credentials, phone numbers, or data anywhere in the repo — keep it that way. Full deploy steps are in README.md.

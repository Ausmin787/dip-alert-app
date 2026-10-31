# Dip Alert project guide

`CLAUDE.md` is the canonical engineering guide for this repository. Read it before making changes; update it whenever architecture, behavior, commands, or deployment assumptions change.

## Product

Dip Alert is a personal, single-user market-monitoring app with two alert modes:

- **Dip alerts** track an asset below its all-time high and notify at newly crossed percentage levels.
- **Momentum alerts** notify once per UTC day and direction when an asset's daily move crosses its configured threshold.

The frontend is built to Apple's Human Interface Guidelines and has three tabs: **Watchlist**, **Alerts**, and **Settings**. Tab selection is local React state in `App.jsx`; there is no client-side router.

## Current stack

- Backend: Python 3.11+, FastAPI, SQLModel with SQLite, APScheduler, yfinance, and CallMeBot.
- Frontend: React 19, Vite 8, plain CSS, Axios, and self-hosted Inter as the non-Apple font fallback. No animation library.
- Deployment: Oracle Cloud VM for the backend and Vercel for the frontend.
- Runtime floors: Python 3.11+ and Node.js 20.19+.

The frontend does **not** use Motion, three.js, React Three Fiber, Recharts, or a routing library.

## Architecture

- `backend/app/main.py` creates the FastAPI app, initializes the database, and starts scheduled monitoring.
- `backend/app/routes.py` owns the API; `ath_logic.py` contains alert evaluation; `price_service.py` fetches prices; `whatsapp.py` sends notifications.
- `frontend/src/AssetContext.jsx` polls status and alerts, and caches price history per ticker and period.
- `frontend/src/App.jsx` owns the shell, tab state, and size class (tab bar on phones, sidebar and split view from 1000px).
- `frontend/src/tabs/` contains the three tab views.
- `frontend/src/api.js` is the Axios API client and attaches the optional `X-App-Token` from browser storage.
- `frontend/src/spring.js` is the shared spring physics: damping and response, velocity handoff, projection, rubber-banding.
- `frontend/src/index.css` contains the design tokens, taken from Apple's published HIG values.

### Gestures

`frontend/src/Sheet.jsx` (draggable sheet, velocity handoff, grabbable mid-flight), `PriceChart.jsx` (1:1 scrub, morphing line) and `TabBar.jsx` (draggable lens) all run on `spring.js`. Glass is the floating functional layer only, never the content layer. See "Design system" in `CLAUDE.md` for the rules not to regress.

## Local commands

Backend, from `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
.\.venv\Scripts\python.exe test_logic.py
.\.venv\Scripts\python.exe test_security.py
.\.venv\Scripts\python.exe test_migrations.py
```

Frontend, from `frontend/`:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

The Vite development server runs at `http://localhost:5173` and proxies `/api` to `http://localhost:8000`.

## Configuration and deployment

- `APP_TOKEN` optionally protects backend write endpoints. The frontend stores the matching token only in browser local storage.
- `FRONTEND_ORIGIN` controls production CORS.
- `VITE_API_URL` points the Vercel frontend at the HTTPS backend origin.
- Production backend setup, systemd units, backups, and auto-deploy are documented in `deploy/README.md`.
- Never commit secrets, SQLite databases, virtual environments, `node_modules`, or build output.

Before handing off a change, run the relevant tests plus frontend lint/build and `git diff --check`. For visual changes, refresh `docs/screenshots/dashboard-desktop.png` and verify the live UI at mobile and desktop widths.

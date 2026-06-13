# Architecture

**Analysis Date:** 2026-06-14

## Pattern Overview

**Overall:** Client-Server Monolith (FastAPI + React SPA)

**Key Characteristics:**
- **Decoupled Deployment:** Backend hosts the API and scheduler (Railway + SQLite Volume); Frontend runs as a static application (Vercel).
- **Polling Scheduler:** Time-based Cron-like checks run only during NSE market hours (IST) using APScheduler.
- **Transactional State:** Persistent database updates are committed atomically. Errors roll back SQL transactions to prevent state corruption.
- **Redacted Configuration:** Sensitive credentials (WhatsApp/CallMeBot details) are kept in the database and redacted in public API responses.

## Layers

**FastAPI Backend (`backend/app`):**
- **Entry point:** `main.py` (FastAPI app setup, startup DB creation and migrations, background thread ATH refresh, scheduler registration).
- **Routes Layer:** `routes.py` (API endpoints for status dashboard, history, CRUD operations on watchlist, settings modification, and test alerts).
- **Core Logic:** `ath_logic.py` (Asset-by-asset comparison of price to ATH, recovery check, level calculation, WhatsApp dispatcher trigger).
- **Service Layer:** `price_service.py` (wrapper around yfinance for current and historical price data) and `whatsapp.py` (CallMeBot wrapper).
- **Data Access:** `db.py` (database engine / session creation) and `models.py` (SQLModel table schemas).

**React Frontend (`frontend/src`):**
- **State & Router:** `App.jsx` (Client-side routing, navigation control, layout structure).
- **Page Layer:** `pages/` (Dashboard, Watchlist, Alerts, Settings page components).
- **Component Layer:** `components/` (DipLadder segment fill, Sparkline SVG drawing, GSAP Reveal wrapper, dynamic three.js sphere).
- **API Client:** `api.js` (Axios wrapper with interceptors for `X-App-Token` authentication).
- **Helpers:** `lib.js` (Time and timezone helpers, severity styling logic, clock functions).

## Data Flow

### 1. Alert Checking Flow (Backend-Driven)

```
APScheduler (Mon-Fri 9:15-15:30 IST)
  │
  ▼
ath_logic.check_all_assets()
  │
  ├──► Loop through active Watchlist rows
  │      │
  │      ▼
  │    price_service.get_current_price(ticker)
  │      │
  │      ▼
  │    Compare current price to AthTracker.ath_price
  │      ├─► [Current Price > ATH]: Update ATH, reset levels to 0
  │      │
  │      └─► [Current Price < ATH]: Calculate drop percentage
  │            │
  │            ├─► [Drop <= 0.5% (Recovery)]: Reset level to 0
  │            │
  │            └─► [Drop > Threshold]: Calculate Level = floor(drop % / threshold)
  │                  │
  │                  └─► [Level > last_alerted_level]:
  │                        │
  │                        ├──► Send WhatsApp message (CallMeBot)
  │                        │      │
  │                        │      ├─► [Failed]: Do not save alert, retry on next tick
  │                        │      │
  │                        │      └─► [Success]: Continue
  │                        │
  │                        ├──► Create AlertLog record
  │                        └──► Update last_alerted_level in AthTracker
  │
  └─► Rollback Session on exceptions (prevents PendingRollbackError)
```

### 2. Client Ingestion Flow (Frontend-Driven)

1. User opens the browser dashboard.
2. Frontend queries `/api/status` to get the list of watched assets, current prices, ATH prices, drop percentages, and next target alert levels.
3. Frontend queries `/api/history/{ticker}` (lazy-loaded charts) to draw the Recharts SVG price chart.
4. User changes settings (Settings page) or updates watchlist items (Watchlist page); the changes are posted to backend routes.

---

*Architecture analysis: 2026-06-14*
*Update after major design or structural shifts*

# Dip Alert App — Project Brief

## Agent Operating Instructions (Read First)

You are implementing this project autonomously. These rules override default behavior:

- **Bias to action.** Read this file, form a plan, and start building immediately. Do not summarize the plan back or ask for approval to proceed.
- **Use every tool available.** Spawn subagents for parallel workstreams (e.g. backend + frontend simultaneously). Use file tools, shell, search, browser — whatever gets the job done fastest.
- **Deploy subagents aggressively.** If two or more tasks can run in parallel (e.g. writing the price service while scaffolding the frontend), spin up agents for each. Do not serialize work that can be parallelized.
- **Self-verify.** After each build step, run the code, check for errors, and fix them before moving on. Do not report a step as done unless it actually works.
- **Zero unnecessary questions.** Make all technical decisions yourself using the spec in this file. Only stop and ask if a decision is genuinely impossible to make without the user (e.g. a missing credential that cannot be inferred). Everything else — library choices, file structure, variable names, UI layout details — just decide and build.
- **Handle blockers yourself.** If a library doesn't work, find an alternative. If an API is rate-limited, add a retry. Don't surface every minor obstacle as a question.
- **Commit as you go.** After each working step, commit with a clear message. Keep the repo in a working state at all times.

---

## What This App Does

A personal web app for a single user (Sasanka's friend) that:

1. Monitors the **Nifty 50 index** in real-time during market hours
2. Detects when Nifty crosses a new **-1% level from its all-time high (ATH)**
3. Sends a **WhatsApp alert** with the current drop %, ATH, and a quick-buy link
4. Shows a **dashboard** with live status, alert history, and watchlist management UI
5. Has a **"Buy Now" button** per asset that opens the broker page directly

Inspired by a viral r/IndianStreetBets strategy: "Buy ₹1L of Nifty 50 ETF for every -1% fall from ATH."

---

## The Core Logic (Most Important Part)

### ATH-based level tracking — NOT daily % change

```
ATH = max historical close price of ^NSEI (Nifty 50 index)
current_pct_below_ATH = (ATH - current_price) / ATH * 100

Alert fires when:
  floor(current_pct_below_ATH) > last_alerted_level
  AND that level has not been alerted before in this dip cycle

No re-alert at the same level unless market recovers past ATH, then dips again.
```

Example:
- ATH = 26,000 | Current = 25,470 → 2.03% below ATH → last alerted = 2 → no new alert
- Current drops to 25,219 → 3.00% below ATH → alert fires for level 3

### Alert cooldown rule
- Store `last_alerted_level` in DB
- Only alert when `floor(current_drop_pct) > last_alerted_level`
- Reset `last_alerted_level = 0` if Nifty recovers to within 0.5% of ATH

---

## User Requirements

- **Single user** — no auth system needed (friend's personal tool)
- **Assets to track:** Nifty 50 ETF by default; UI allows adding other NSE/BSE stocks or ETFs
- **Per-asset settings:** custom % threshold, custom investment amount reminder
- **WhatsApp alerts** via CallMeBot (free, personal use)
- **Buy button** links to broker web page (Groww for now, configurable)
- **Deployed 24/7** — Railway or Render (not local machine)

---

## Tech Stack

### Backend
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Scheduler:** APScheduler (runs price checks every 5 min during market hours: 9:15 AM–3:30 PM IST, Mon–Fri)
- **Price data:** `yfinance` library — FREE, no API key
  - Nifty 50 index: ticker `^NSEI`
  - SBI Nifty 50 ETF (NSE): ticker `SETFNIF50.NS`
  - Any NSE stock: append `.NS` (e.g. `RELIANCE.NS`)
  - Any BSE stock: append `.BO`
- **Database:** SQLite via SQLModel (simple, no infra needed)
- **WhatsApp:** CallMeBot API (free for personal use)

### Frontend
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts (for Nifty level history chart)
- **API calls:** Axios

### Hosting
- **Backend:** Railway (supports Python, has free tier, persistent disk for SQLite)
- **Frontend:** Vercel (free, auto-deploys from GitHub)
- OR: combine both on Railway as a single monorepo with static frontend

---

## Database Schema (SQLite)

### `watchlist` table
| column | type | notes |
|---|---|---|
| id | int PK | |
| ticker | str | e.g. `^NSEI`, `SETFNIF50.NS` |
| display_name | str | e.g. "Nifty 50 ETF" |
| threshold_pct | float | default 1.0 (alert every 1% drop) |
| invest_amount | int | default 100000 (₹1L) |
| broker_url | str | link opened by Buy button |
| active | bool | can pause tracking per asset |

### `ath_tracker` table
| column | type | notes |
|---|---|---|
| id | int PK | |
| ticker | str | |
| ath_price | float | updated whenever new high reached |
| ath_date | date | |
| last_alerted_level | int | e.g. 3 means last alert was at -3% |
| updated_at | datetime | |

### `alert_log` table
| column | type | notes |
|---|---|---|
| id | int PK | |
| ticker | str | |
| alert_level | int | which -% level triggered this |
| current_price | float | |
| ath_price | float | |
| drop_pct | float | |
| alerted_at | datetime | |
| whatsapp_sent | bool | |

### `settings` table (single row)
| column | type | notes |
|---|---|---|
| whatsapp_phone | str | with country code, e.g. +919876543210 |
| callmebot_apikey | str | from CallMeBot one-time setup |
| check_interval_min | int | default 5 |

---

## API Endpoints (FastAPI)

```
GET  /api/status          → current price, ATH, drop%, next alert level for all watchlist items
GET  /api/watchlist       → list all tracked assets
POST /api/watchlist       → add new asset
PUT  /api/watchlist/{id}  → update threshold/amount/broker_url
DEL  /api/watchlist/{id}  → remove asset
GET  /api/alerts          → alert history (paginated)
GET  /api/settings        → get WhatsApp config
PUT  /api/settings        → update WhatsApp config
POST /api/test-alert      → send a test WhatsApp message
```

---

## WhatsApp Setup — CallMeBot (One-Time)

1. Add `+34 644 59 89 29` to your contacts on WhatsApp
2. Send the message: `I allow callmebot to send me messages`
3. You receive your personal `apikey` back via WhatsApp
4. Enter phone + apikey in the app's Settings page

Alert message format:
```
🚨 NIFTY DIP ALERT 🚨
Level: -3% from ATH
Current: 25,219 | ATH: 26,000
Drop: 3.00%
Invest: ₹1,00,000 → SBI Nifty 50 ETF
👉 Buy now: https://groww.in/etfs/sbi-nifty-50-etf
```

CallMeBot API call:
```
GET https://api.callmebot.com/whatsapp.php?phone=<phone>&text=<urlencoded_message>&apikey=<key>
```

---

## Frontend Pages

### 1. Dashboard (`/`)
- Live card per watchlist item showing: current price, ATH, % below ATH, next trigger level
- Color: green if within 1% of ATH, yellow 1–3%, red 3%+
- Mini chart: last 30 days of Nifty vs ATH line
- Recent alerts list (last 10)

### 2. Watchlist (`/watchlist`)
- Table of all tracked assets
- Add button → modal form: ticker, name, threshold%, invest amount, broker URL
- Edit / Pause / Delete per row

### 3. Alert History (`/alerts`)
- Full log table: date, ticker, level triggered, price at time, drop %

### 4. Settings (`/settings`)
- WhatsApp phone + API key input
- Check interval setting
- "Send Test Alert" button

---

## Build Sequence (for implementation session)

1. **Backend scaffold** — FastAPI app, SQLite with SQLModel, all tables created on startup
2. **Price service** — `yfinance` wrapper: `get_current_price(ticker)`, `get_historical_max(ticker)` → ATH
3. **ATH tracker logic** — compare current to ATH, detect new level crossing, update DB
4. **Scheduler** — APScheduler job every 5 min, market hours only (IST timezone check)
5. **WhatsApp service** — CallMeBot HTTP call, message formatter
6. **All API endpoints** — CRUD for watchlist, settings, alert log
7. **Frontend scaffold** — React + Vite + Tailwind, React Router, Axios client
8. **Dashboard page** — live status cards + chart + recent alerts
9. **Watchlist page** — table + add/edit modal
10. **Settings page** — WhatsApp config + test button
11. **Alert History page** — full log table
12. **Deploy** — Railway (backend + SQLite volume), Vercel (frontend)

---

## Key Constraints & Gotchas

- **Market hours only:** NSE trades 9:15 AM – 3:30 PM IST, Mon–Fri. Scheduler must check IST timezone, not UTC.
- **yfinance rate limits:** space out calls, don't hammer per-second. 5-min interval is safe.
- **ATH calculation:** fetch max of `period="max"` historical data for the index, store in DB, refresh daily at market open.
- **No duplicate alerts:** the `last_alerted_level` column prevents re-alerting at the same level.
- **Recovery reset:** if Nifty recovers to within 0.5% of ATH, reset `last_alerted_level = 0` so levels can re-trigger on next dip.
- **SQLite on Railway:** use a Railway volume mount for persistent storage; otherwise DB resets on redeploy.
- **Groww buy link:** `https://groww.in/etfs/<etf-slug>` or `https://groww.in/stocks/<stock-slug>` — user sets this manually per asset in watchlist.

---

## Environment Variables Needed

```
DATABASE_URL=sqlite:///./dip_alert.db
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app   # for CORS
```

WhatsApp credentials stored in DB (settings table), not env vars — easier for friend to update via UI.

---

## Ownership & Transfer

This app is built for a friend (the client). Architecture is designed so zero data or credentials stay with the developer:

- **No secrets in code or git** — `.gitignore` must include `*.db`, `.env`, `__pycache__/`, `node_modules/`
- **No hardcoded phone numbers or API keys** — all entered by the friend through the app's Settings UI
- **SQLite DB lives on Railway** — on the friend's own Railway account, not the developer's machine
- **Transfer process:**
  1. Push finished code to a GitHub repo
  2. Friend creates Railway account → connects repo → deploys backend
  3. Friend creates Vercel account → connects repo → deploys frontend
  4. Friend opens `/settings` in the deployed app → enters their own WhatsApp phone + CallMeBot key
  5. Developer's machine has zero involvement in the running system

**.gitignore must include at minimum:**
```
*.db
*.db-journal
.env
.env.local
__pycache__/
node_modules/
dist/
.venv/
```

---

## Status

- [x] Planning complete
- [x] Implementation complete (backend + frontend, core logic verified by backend/test_logic.py)
- [ ] Deployment not done — friend deploys on their own Railway + Vercel accounts (see README.md)

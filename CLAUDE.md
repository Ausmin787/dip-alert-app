# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

A single-user web app (built for a friend — no auth) that watches assets during market hours and fires WhatsApp alerts (via CallMeBot). Built to Apple's Human Interface Guidelines, with three tabs (Watchlist · Alerts · Settings) on a floating tab bar on phones, and a sidebar with a list beside its detail on wide screens.

**Two alert modes on the watchlist:**
- **Dip Alert** (`alert_mode="dip"`, default): watches Indian indices/ETFs, fires when price crosses a new −X% level below its all-time high. Strategy: "buy ₹1L of Nifty 50 ETF for every −1% fall from ATH." Runs only during NSE market hours (9:15–15:30 IST, Mon–Fri).
- **Momentum Alert** (`alert_mode="momentum"`): watches global assets (Gold, Silver, S&P 500, Nasdaq 100, etc.), fires once per UTC day per direction when `|daily change from prev close| >= threshold%`. Evaluated on every scheduler tick because global markets span time zones and weekend-traded symbols are allowed.

**Default seeded assets (5 total):**
- `^NSEI` Nifty 50 Index — dip 1%, ₹1L deploy, Groww broker URL
- `GC=F` Gold (COMEX) — momentum ±2%
- `SI=F` Silver (COMEX) — momentum ±2%
- `^GSPC` S&P 500 — momentum ±2%
- `^NDX` Nasdaq 100 — momentum ±2%

GitHub: https://github.com/Ausmin787/dip-alert-app (branch: `master`)

> **Agent guidance:** `CLAUDE.md` is the detailed repository source of truth. `GEMINI.md` and the current files under `.planning/` are kept as concise, synchronized companion guides. Files under `.planning/phases/` are historical implementation records and are explicitly marked as superseded by the current Apple HIG architecture.

## Commands

**Backend** (Python 3.11+, FastAPI; venv lives at `backend/.venv`):

```powershell
cd backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000   # run API
.venv\Scripts\python test_logic.py                          # run core-logic tests
.venv\Scripts\python test_security.py                       # run security regression tests
.venv\Scripts\python test_migrations.py                     # verify legacy SQLite upgrades and idempotence
.venv\Scripts\pip install -r requirements.txt               # (re)install deps
```

There is no pytest — the three backend checks are standalone scripts that exit non-zero on failure. `test_logic.py` monkeypatches price/delivery functions, `test_security.py` uses a `TestClient` with a temporary database, and `test_migrations.py` upgrades a synthetic legacy SQLite database twice to prove compatibility and idempotence.

Set `DISABLE_SCHEDULER=1` to run the API without APScheduler (useful in dev/tests).

**Frontend** (React + Vite, in `frontend/`):

```powershell
cd frontend
npm run dev      # dev server on :5173, proxies /api -> localhost:8000
npm test         # tiny Node regression tests for shared frontend helpers
npm run build    # production bundle verification
npm run lint
```

Full-stack dev = run both servers; the Vite proxy handles API calls, no CORS config needed locally.

## Architecture

### Alert flow (the core of the app)

**Dip mode** (existing logic, IST-gated):
```
APScheduler (every N min) → market_hours_check()
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

**Momentum mode** (continuous, no NSE gate):
```
APScheduler (every N min) → market_hours_check()
  → check_all_assets(market_open=...)
    → for each active momentum-mode Watchlist row (runs on every tick):
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
- **Missing WhatsApp credentials also leave the alert pending**: no delivery attempt, log row, or state advance
- **Scheduler loops must `session.rollback()`** in per-asset exception handlers — without it one DB error poisons the shared session (`PendingRollbackError`). Regression-tested.

State rules for **momentum mode**:
- At most **one alert per UTC day per direction** (de-duplicated via AlertLog query on `alert_direction` + `ticker` + `alerted_at >= today_start`)
- Failed WhatsApp delivery: same retry pattern as dip mode (no AlertLog row written if `send=False`)
- `AlertLog.ath_price` stores `prev_close` (reference price) for momentum rows; `drop_pct` stores the signed daily change (positive = up, negative = down)

### Backend layout (`backend/app/`)
- `models.py` — SQLModel tables: `watchlist` (now has `alert_mode`), `ath_tracker`, `alert_log` (now has `alert_direction`), `settings` (single row)
- `price_service.py` — validated finite-positive Yahoo reads with short TTL caches and per-key single-flight; `get_current_price`, `get_historical_max`, `get_prev_close`, `get_usd_inr`, and chart history
  - `get_usd_inr()` reads Yahoo's `USDINR=X` on a 15-minute TTL, surfaced as `usd_inr` on `/api/status` (once per request, not per asset; `null` when unavailable so the UI falls back to each asset's own quote currency rather than showing a stale rate). **Display only — it never feeds alert thresholds**, which stay in each asset's own quote currency.
  - **`usd_inr` is supplied unconditionally, on purpose.** *Which* assets are shown in rupees is a presentation decision owned solely by `isMetal()` in `frontend/src/lib.js`. An earlier version guarded the fetch with a `needs_fx` ticker check in `routes.py`, which duplicated that rule in a second language — widening it (adding a US stock, say) would have silently required both edited in step. The backend states a fact; the UI decides what to do with it. The cost is one Yahoo read per 15 min even for an all-Indian watchlist, negligible beside the per-asset price reads the same handler already does per request. **Don't reintroduce a ticker-shape guard here.**
- `ath_logic.py` — `check_asset` (dip), **`check_momentum_asset`** (momentum), `check_all_assets(market_open)`, `refresh_ath`, `refresh_all_aths`
- `whatsapp.py` — `format_alert_message` (dip), **`format_momentum_message`** (momentum: "📈 Gold UP +2.5%"), `send_whatsapp`
- `scheduler.py` — every tick passes `market_open=is_market_open()` to `check_all_assets()`. Dip assets skip when `market_open=False`; momentum assets always run.
- `routes.py` — all endpoints under `/api` (status, history, watchlist CRUD, alerts, settings, test-alert)
  - `WatchlistIn` Pydantic model includes `alert_mode: Literal["dip", "momentum"] = "dip"`
  - `/api/status` returns `alert_mode` and `daily_change_pct` for each asset; momentum items have `ath_price/drop_pct/next_alert_level = None`, dip items have `daily_change_pct = None`
  - `next_alert_level` in dip status is `(max(last_alerted_level, current_crossed_level) + 1) × threshold_pct`
- `main.py` — lifespan: create tables → migrate → seed defaults → refresh ATHs in background thread → start scheduler
  - `seed_defaults()` seeds the starter list once per database; intentionally deleted defaults do not reappear on restart
  - Default seed: 5 assets (^NSEI dip + 4 global momentum)
  - `migrate_db()` includes guarded additions for alert mode/direction, alert investment snapshots, and the one-time seed marker
- WhatsApp credentials live in the `settings` DB row (entered in the Settings tab), **never** in env vars or code
- **Settings API is redacted**: GET/PUT `/api/settings` return only `whatsapp_phone_masked` + `apikey_set` + `check_interval_min` + `write_protected`
- **Optional write protection**: `APP_TOKEN` env var gates all write endpoints; frontend stores token in localStorage. If unset, `warn_if_unprotected()` (`main.py`, called from `lifespan`) logs a loud startup warning since writes are then fully open to anyone with the URL.
- `/api/test-alert` enforces a 60s in-memory cooldown (`TEST_ALERT_COOLDOWN_SECONDS` in `routes.py`) to stop CallMeBot quota burn/spam from repeated calls.
- **Strict input validation** (`WatchlistIn`/`SettingsIn` in `routes.py`): `ticker` capped at 24 chars and regex-restricted to Yahoo-style symbols (`TICKER_RE`); `display_name` capped at 80 chars; `alert_mode` is a `Literal["dip", "momentum"]`; `broker_url` must be blank or `https://`; WhatsApp phone/apikey are length-capped to prevent oversized settings payloads.
- **HTTP security headers**: backend sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` via middleware in `main.py`; frontend sets the equivalent (plus CSP) via `frontend/vercel.json` `headers` block.
- Input validation: `threshold_pct` >0 and ≤50, `check_interval_min` 1–60, ticker changes via PUT rejected
- Tickers are Yahoo Finance format: `^NSEI`, `SETFNIF50.NS` (NSE), `.BO` (BSE), `GC=F` / `SI=F` (COMEX), `^GSPC` / `^NDX` (US indices)
- `migrate_db()` in `main.py` holds all additive SQLite migrations — `create_all` only creates missing tables, never alters columns, so every new column needs a guard here.

### Frontend layout (`frontend/src/`)

The frontend is a **mobile-first single-page app built to Apple's Human Interface Guidelines** (redesigned 2026-10-31; the earlier Liquid Glass wallpaper, phone frame and refraction machinery are gone, see Design system below). **No router**: the tab is React `useState` in `App.jsx`. Deps: `axios`, `react`, `react-dom`, `@fontsource-variable/inter`. **No animation library and no Tailwind**: `spring.js` does the motion, `index.css` is plain CSS. Plan and sample ledger: `docs/designs/apple-redesign-plan.md`.
- `api.js`: all backend calls; baseURL is `VITE_API_URL` in production, relative (proxied) in dev. Axios `X-App-Token` interceptor.
- `App.jsx`: shell, tab state, size class. All three panels stay mounted and hidden ones go `inert`, so tabs keep scroll position and never flash. Inside `#stage`, which is what recedes behind a phone sheet; the tab bar lives in it so a sheet covers the bar.
- `spring.js`: Apple's two-parameter spring (damping ratio, response), plus `project()`, `rubberband()`, `createVelocityTracker()`, `prefersReducedMotion()`. Covered by `lib.test.js`.
- `hooks.js`: `useTick`, `useSizeClass` (regular from 1000px), `useScrollState` (rest / edge / title, for the navigation bar).
- `ui.jsx`: `Screen` (large title that hands off to an inline one, soft scroll edge), `Segmented`, `RollingText` (digit roll on a real value change only), `Sparkline`.
- `TabBar.jsx`: floating 62pt tab bar with a spring-driven lens that can be pressed and dragged across the bar; also exports `Sidebar`, its wide-screen form.
- `Sheet.jsx`: the draggable sheet. One spring on y, grabbable mid-flight, release carries finger velocity, momentum projection decides dismiss or settle. Touch events are deliberate (see Gotchas). If the owner declines `onClose` (unsaved edits), the sheet springs back.
- `AssetDetail.jsx`: detail for one asset, in a sheet on phones and inline on wide screens. Modelled on Apple's Stocks screenshot in HIG Charting data.
- `PriceChart.jsx`: line and area, trailing y-axis, nice ticks, rule lines for next alert and all-time high, whole-plot scrub (1:1, arrow keys, `role="slider"`), and a line that morphs between periods.
- `AlertInstrument.jsx`: `DipLadder` (the app's instrument: alert levels with today's price between the rungs) and `MoveGauge` (centre-zero gauge for daily moves).
- `AlertRow.jsx`, `AssetForm.jsx` (form sheet, Cancel leading, tinted check trailing), `Menu.jsx` (springs from its button), `ConfirmDialog.jsx` (HIG alert), `Toast.jsx`, `Skeleton.jsx`, `ErrorCard.jsx` (`Unavailable`, for empty and failed states), `Icon.jsx`.
- `AssetContext.jsx`: `AssetProvider`. 60-second `/api/status` and `/api/alerts` polling with an in-flight guard, selection memory (localStorage), `lastUpdated` (client epoch of the last successful poll: `/api/status` carries **no** server timestamp), `historyFor`/`ensureHistory` (cache per ticker and period), `unseenAlerts` for the tab badge, and `refresh()`. Sparklines refresh on a 15-minute cadence, never on the 60-second poll, because that is the Yahoo traffic this module exists to avoid. `useAssets` lives in `useAssets.js`.
- `tabs/WatchlistTab.jsx`: asset list, add, the setup notice, and the sheet or split-view detail. Sheets go one at a time (HIG): Edit closes detail, and closing the form brings it back. Dismissing a dirty form asks first.
- `tabs/AlertsTab.jsx`: one feed for what used to be the Alerts and History tabs (same dataset): All, Dips, Moves filter, deployed-this-month summary, sections for Today, Yesterday and IST months.
- `tabs/SettingsTab.jsx`: WhatsApp, check interval (stepper), market hours, access token, CallMeBot setup steps. The tinted save check appears only when something changed.
- `lib.js`: `tickerMeta(ticker)` returns `{ exchange, type, currency }`:
  - `=F` suffix: `{ exchange: 'COMEX', type: 'Futures', currency: '$' }`
  - `^GSPC`: `{ exchange: 'NYSE', type: 'Index', currency: 'pts' }`
  - `^NDX`: `{ exchange: 'NASDAQ', type: 'Index', currency: 'pts' }`
  - Default Indian: `{ ..., currency: '₹' }`
  - `priceParts(ticker, price, usdInr)` returns `{ prefix, value, unit }` and is the **single source of truth for how any price is written**. Covered by `lib.test.js`.
  - **Indian-context metal pricing** (`isMetal`/`metalUnit`/`toIndianMetalPrice`): COMEX quotes gold and silver in USD per troy ounce, which is not a unit anyone in India prices metal in. `=F` assets are therefore shown as **₹ per 10 g (gold) / per kg (silver)**, currency *and* unit converted, with the source `$/oz` quote and the exact rate printed in the detail view. **This is an international-equivalent figure, not the MCX or jeweller rate**: Indian physical metal adds ~6% import duty and 3% GST, so the UI must keep saying "excludes duty and GST" and must never be relabelled as an official Indian rate.
  - **`^GSPC`/`^NDX` are deliberately never converted**: an index level is not a price, so they render in points.
  - **Past prices are never converted at today's rate.** Alert rows pass `usdInr = null`, and the chart axis and scrub readout stay in the quote currency, because a past dollar price at today's FX would invent a rupee number that was never true.
  - `dipLadder(item)`: rung states are `next`, `ahead`, `alerted`, `passed`. `passed` means crossed with no alert recorded, and must never read as an alert having gone out.
  - `RANGES`: chart periods in **trading days** (22, 66, 132, 252). yfinance reads the backend's `days` as market sessions, so "1M" asking for 30 would be a mislabelled six weeks.
  - `severity()` kept: `lib.test.js` depends on it. **Do not use severity colors in the UI.**
  - `timeAgo(ms, now)` takes a **client epoch**, not a backend ISO string. **Backend timestamps are naive UTC** (`datetime.utcnow`): the `asUTC` helper appends `Z`, don't strip it.

### Design system: Apple HIG (don't regress these)

All tokens are in `frontend/src/index.css`, taken from Apple's published values (HIG Color and Typography spec tables), not invented. Follows the device between light and dark with **no in-app switch**, on purpose (HIG Dark Mode: "Avoid offering an app-specific appearance setting").
- **One job per colour** (HIG: "Avoid using the same color to mean different things"): blue is interactive, green and red are price direction, orange is alert level. Nothing else carries chroma.
- **Glass is the floating functional layer only**: tab bar, sidebar, round buttons, menus, alerts, toasts. HIG Materials: "Don't use Liquid Glass in the content layer." Rows, groups and the chart stay solid; `lib.test.js` asserts it. There is no wallpaper, on purpose: glass over a plain system background is the system's own look.
- **Contrast deviates from Apple where Apple fails AA, and only there.** Small coloured text on white and all filled controls use Apple's *increased contrast* values (green `0,137,50`, red `233,21,45`, blue `30,110,244`), because standard system green on white is 2.2:1 and white on standard blue is 3.4:1. `--tint-fill` is the filled-control blue; `--tint-text` is the text blue. Don't "correct" them back.
- **Type is rem-based on the HIG Large scale**, where `1rem` = Body = 17px, so it follows the user's text size. On iPhone, `html { font: -apple-system-body }` makes that real Dynamic Type; the touch guard exists because macOS Safari resolves that keyword to a much smaller size. 11px is the floor (HIG minimum).
- **Font**: `-apple-system` first, so Apple devices get real San Francisco and never download Inter. Inter (OFL, self-hosted, optical-size axis) is the fallback on Windows and Android, because SF can't legally be sent to them. **Do not embed SF Pro or SF Symbols**: `Icon.jsx` draws to SF Symbols' rules instead (Tabler filled glyphs, MIT, plus hand-drawn strokes). Letter-spacing variables go to `normal` under `@supports (font: -apple-system-body)`, because the system font tracks itself.
- **Shape**: capsules for touch controls, 26px groups, 38px sheets, inner radius = outer minus padding (concentricity, WWDC25).
- **Motion**: every moving thing is a spring from its live on-screen value, default damping 1, damping 0.8 only when a gesture carried momentum. Press states are CSS `:active` with no transition on the way in. Tab switches don't animate (HIG Motion: avoid motion on frequent interactions). Nothing animates on arrival except a sheet someone opened. No fade-ups, no staggers.
- **Accessibility preferences are real code paths**: reduced motion jumps with a short fade (dragging still tracks, 1:1 is not vestibular), reduced transparency removes blur, increased contrast uses Apple's IC palette.
- **Scroll edge effects, not dividers**, and never at rest (WWDC25: they "shouldn't be used where there aren't any floating UI elements"). `.tab-edge` uses `mask-image` so the blur itself fades.
- **App icon**: `public/favicon.svg` and the PNGs beside it. No text, no baked-in shine, square for iOS to mask. Icon Composer needs macOS Tahoe, so it has not been built as a layered `.icon` file.

## Gotchas
- **Sheet dragging uses touch events on purpose.** Pointer events get `pointercancel` as soon as the browser starts a pan, so a sheet could never take over a pull-down from its scroller. `touchmove` must be registered `{ passive: false }` by hand; React's is passive. A horizontal first move is left for the chart (`touch-action: pan-y`).
- **Springs need a sane rest tolerance.** A critically damped spring creeps for a long time over its last fraction of a pixel, and `#root` stays `inert` until the sheet has finished, so too fine a `precision` blocks taps with nothing visibly moving. The sheet uses 0.5.
- **In headless Chrome over CDP, `Input.synthesizeTapGesture` produces no click**, even on a bare page. Use `dispatchTouchEvent` start and end. Not an app bug.
- Market-hours check uses `Asia/Kolkata` via `zoneinfo` — never compare against UTC or server-local time
- **Momentum assets run on every scheduler tick, no IST hours gate** — this supports global and weekend-traded symbols; UTC-day directional de-duplication bounds repeat notifications.
- **Known limitation**: NSE holidays not modeled (dip mode). Harmless — prices don't move on holidays.
- yfinance is unauthenticated and rate-limited; don't poll faster than every few minutes. Momentum mode adds `get_prev_close()` per asset per tick — the `fast_info` call is cached by yfinance so it's fast.
- Backend runs on an Oracle Cloud "Always Free" VM (not a container platform), so the default `DATABASE_URL` (a local SQLite file) persists fine across restarts on the VM's own disk — no separate volume needed
- The VM has no TLS by default — a reverse proxy (Caddy or nginx + Let's Encrypt) must sit in front of uvicorn, since the frontend's CSP (`connect-src https:`) and browser mixed-content rules both block a bare `http://` backend
- `git add -A` traps: `.playwright-mcp/`, `*.db` are gitignored. Playwright/screenshot debug PNGs accumulate in repo root during design work (e.g. `nav-*.png`, `dashboard-screenshot.png`, `tab-*.png`, `zoom-*.png`, `debug-*.png`) — untracked, safe to delete, never commit. Clean these up at the end of a design session.
- Groww ETF URLs use their internal slug — verify at groww.in before hardcoding
- `alert_direction` in AlertLog is `None` for all legacy dip alerts; only set for momentum rows. Frontend checks `a.alert_direction != null` to detect momentum vs dip in the alerts list.
- **`docs/screenshots/dashboard-desktop.png` is a real screenshot of the live app**, not a mockup — regenerate it (live dev server + Playwright, not the static design source) whenever the dashboard's visual design changes meaningfully, so README stays accurate.
- **The README banner is an export, not a live page.** GitHub strips CSS and scripts from READMEs, so `docs/designs/readme-banner.html` computes its Liquid Glass refraction per pixel and is exported to `docs/banner-dark.png` and `docs/banner-light.png`, which the README picks between with GitHub's `#gh-dark-mode-only` and `#gh-light-mode-only` markers. Don't use `<picture>` here: `prefers-color-scheme` follows the device, not the viewer's GitHub theme. Its chart is a drawn shape, not market data. Re-export steps are in the file's top comment.
- **Settings save**: submitting with blank phone/apikey fields does NOT overwrite the stored secrets — only `check_interval_min` changes. The UI never echoes back the real values (masked display only), so this blank-means-preserve pattern is load-bearing.
- **A design source file (e.g. dropped into `frontend/index.html` directly) can silently replace the Vite entry point** — it'll still render in the browser (looks like progress) but with zero React, zero live data, and zero of the app's actual logic. If a "redesign" suddenly shows hardcoded/fake numbers instead of real backend data, check `git diff frontend/index.html` first before debugging anything else.



## Ownership Model

The friend deploys on **their own** Oracle Cloud Always Free VM (backend, SSH + systemd service, no platform auto-deploy) + Vercel (frontend, root dir `frontend`, `VITE_API_URL` env var) accounts and enters their own CallMeBot phone/key in the Settings tab. No developer credentials, phone numbers, or data anywhere in the repo — keep it that way. Full deploy steps are in README.md.

**Backend auto-deploy (pull-based, in `deploy/`):** a `dip-alert-deploy.timer` on the VM polls `master` every ~5 min and runs `deploy/deploy.sh` (transactionally consistent DB backup → `git pull --ff-only` → conditional `pip install` → compile/`pip check`/logic/security/migration regression gate → `systemctl restart` → health check on `GET /` at `127.0.0.1:8000` → **auto-rollback to the previous commit on any post-update failure**). Failed commits are quarantined until `master` advances, preventing an endless five-minute retry/restart loop. Chosen over GitHub-Actions-over-SSH so **no secrets ever leave the friend's VM** (fits the ownership model). Key facts: runs as unprivileged user `dipalert`; backend binds `127.0.0.1` (Caddy/nginx terminates TLS in front); DB lives at `/var/lib/dip-alert/dip_alert.db` (env `DATABASE_URL`, 4 slashes) and the env file at `/etc/dip-alert/dip-alert.env` (`APP_TOKEN`/`DATABASE_URL`/`FRONTEND_ORIGIN`), both **outside** the checkout; the only sudo grant is `systemctl restart/is-active dip-alert.service` via a `/etc/sudoers.d/` drop-in. Rollback reverts **code only** (additive migrations are backward-compatible); DB backups under `/var/lib/dip-alert/backups/` are for manual recovery. Changes to copied systemd/sudoers files require a deliberate SSH maintenance step. Full runbook: `deploy/README.md`. **Status (2026-06-21):** built, committed, and pushed to public `master` (exact revision tracked in `docs/SECURITY_AUDIT_PLAN.md` rather than hard-coded here); the full local gate is green, but it has **not** been installed on a VM yet — VM install, `visudo -c`/unit validation, a live timer-deploy, a rollback/quarantine drill, a backup restore drill, and reverse-proxy/TLS/firewall/Vercel checks are all still pending (tracked in `docs/SECURITY_AUDIT_PLAN.md`, SEC-001..004). Deployment-failure alerting **is** built and opt-in: set `DEPLOY_ALERT_PHONE`/`DEPLOY_ALERT_APIKEY` (the developer's own CallMeBot creds, distinct from the friend's app-alert creds in the DB) in `/etc/dip-alert/deploy-alert.env` — a **deploy-only** file (loaded only by `dip-alert-deploy.service`, never by the app, so the internet-facing process can't leak them) — and `deploy.sh`'s `notify_failure()` sends one best-effort WhatsApp ping per rolled-back commit; left unset it's silent (journalctl only). Pre-update refusals (dirty checkout / non-ff / failed fetch) are intentionally not alerted.

Switched from Railway to Oracle Cloud Always Free (2026-06-21): Railway's $5 one-time trial credit isn't a recurring free tier — past it, the only ongoing free allowance is $1/month, far short of what an always-on backend with a persistent SQLite file + in-process APScheduler needs. Render's free tier has no persistent disk and spins down after 15 min idle (kills both the DB and the scheduler); Fly.io dropped its free tier entirely (Oct 2024). Oracle's Always Free tier is the one host that's genuinely free forever **and** matches this app's existing architecture (real VM, persistent disk, always-on process) with zero code changes — the tradeoff is manual VM/systemd setup instead of a one-click GitHub deploy, plus the backend now needs its own reverse-proxy TLS (see Gotchas) since there's no platform-provided HTTPS.

## Health Stack
- typecheck: `npx tsc --noEmit` (frontend) — `tsconfig.json` added with `allowJs`/`checkJs` against plain JS/JSX; this surfaces "untyped JS" findings (missing prop shapes, implicit any), not necessarily real bugs. `src/lib.test.js` is excluded (Node test script, not part of the app bundle).
- lint: `npm run lint` (frontend, `eslint .`)
- test: `.venv\Scripts\python.exe test_logic.py && .venv\Scripts\python.exe test_security.py && .venv\Scripts\python.exe test_migrations.py` (backend, run from `backend/`) + `node src/lib.test.js` (frontend, run from `frontend/`)
- deadcode: `npx knip` (frontend)
- shell: `./.tools/shellcheck.exe deploy/deploy.sh` (project-local Windows binary, gitignored — no system package manager available; downloaded from the official koalaman/shellcheck GitHub releases)
- build (bonus, not scored): `npm run build` (frontend)

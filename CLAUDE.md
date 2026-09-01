# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

A single-user web app (built for a friend — no auth) that watches assets during market hours and fires WhatsApp alerts (via CallMeBot). Shows a **mobile-first phone-shell dashboard** with four bottom-nav tabs (Watch · Alerts · History · Manage).

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

> **Agent guidance:** `CLAUDE.md` is the detailed repository source of truth. `GEMINI.md` and the current files under `.planning/` are kept as concise, synchronized companion guides. Files under `.planning/phases/` are historical implementation records and are explicitly marked as superseded by the current Liquid Glass architecture.

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

**Frontend** (React + Vite + Tailwind v4, in `frontend/`):

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
- `gsap.js` — tiny shared module: registers `useGSAP` + `CustomEase` once and exports `gsap`/`useGSAP`/`prefersReducedMotion()`/`glassSpringEase`. Every component doing GSAP work imports from here instead of `gsap` directly.
- `App.jsx` — phone shell + 4-tab state. `StatusBar`, `AppHeader` (live/closed chip), and `AppShell` (`useState` + `tabMotionKey`). The bottom-nav compositor lives in `GlassNav.jsx`. Shell `.wrap` carries `id="phone-shell"`. Default export wraps in `<AssetProvider>`.
- `Wallpaper.jsx` — the sky/ribbon/glow/grain decorative layers (moved out of `App.jsx`); `wallpaperImage.js` snapshots these layers + their index.css rules live, so wallpaper design edits reach the refraction surfaces automatically.
- `GlassNav.jsx` — floating semantic nav, generated displacement map, memoized SVG filter definitions, stationary highlighted icon/label target, ResizeObserver geometry, and the single-source GSAP lens motion described below.
- **Tiered refraction (2026-09-01, replaced the glass-everywhere pass)** — refraction is now on the **hero + sheets only** (2 live filter graphs, was 14). See "Material tiers" below for the rule. Machinery is unchanged and still earns its keep at n=2:
  - `liquidGlass.js` — SDF displacement-map generator (`createGlassMap`, adapted from samasante/liquid-glass, MIT — erf-feathered rim + spherical-cap dome), per-variant `PRESETS` (`card`/`sheet`), `supportsRefraction()` (Blink-only gate), kill switches (`REFRACTION_ENABLED`, `data-refract="off"`, `?refract=off`).
  - `wallpaperImage.js` — `getWallpaperBitmap()`: serializes the LIVE wallpaper DOM + its CSS into an SVG foreignObject, rasterizes once per shell size into a pre-blurred half-res PNG shared by all surfaces via feImage.
  - `useLiquidGlass.jsx` — `useLiquidGlass(ref, variant)` → `{ defs, layer }`: per-surface SVG filter (3-pass RGB displacement + specular, versioned ids, ResizeObserver + debounced scroll re-align via transform-free offsetParent-chain measurement) and the `.glass-refract` layer.
  - `GlassSurface.jsx` — `<GlassSurface as variant className>` wrapper. Now used at exactly **three** sites: the hero (`WatchTab.jsx`), `AssetSheet` (`ManageTab.jsx`) and `ConfirmDialog.jsx`. Everything else is a plain `div`.
  - **`TodaysAlerts` and the AlertsTab list must stay plain `div`s.** They own a `listRef` that the new-alert GSAP slide-in queries; `GlassSurface` does not forward refs, so wrapping them would break that timeline. They previously called `useLiquidGlass` directly for this reason — that call is gone, the ref is not.
  - `wallpaperImage.js` still earns its keep at n=2: `filter: url()` needs a raster source, Blink re-rasterizes a *vector* `feImage` source on every application (~550ms measured), and the live-DOM serialize is what makes wallpaper edits reach the refraction automatically. Don't "optimize" it into a checked-in static PNG — that trades an automatic invariant for a manual one.
- `AssetContext.jsx` — `AssetProvider`: 60-second `/api/status` polling with an in-flight guard, selected-asset-only 30-day history refreshed every five minutes, active selection memory (localStorage), `lastUpdated` (client epoch of the last successful poll — `/api/status` carries **no** server timestamp, prices are fetched live per request), and `refresh()`. `useAssets` lives in `useAssets.js`.
- `Toast.jsx` — `ToastProvider` + `useToast()` + `ToastViewport`. App-wide action feedback using the same `{kind: 'ok'|'err', msg}` shape as the inline `.status-msg` state in `WhatsAppCard`. Portaled to `#phone-shell` at **z-index 40** (above the nav's 10, below an open sheet's 50); auto-dismisses after 3.2s. **`ToastViewport` is rendered inside `AppShell`, not beside the provider** — `#phone-shell` does not exist on the provider's first render, so a portal mounted there would find `null`. Success is **gold**, not green: green already means "price up" (`.chg-up`) and reusing it for "saved" collides with the financial colours.
- `Skeleton.jsx` — `WatchSkeleton` / `ListSkeleton` cold-start placeholders shaped like the real cards, replacing the old bare "Loading market…" / "Loading…" strings. The `skel-sweep` shimmer is pure CSS, so the global `prefers-reduced-motion` block freezes it and the skeleton correctly degrades to static blocks.
- `ErrorCard.jsx` — shared error surface with a Retry button, used by Watch/Alerts/History. Carries its own `busy` flag because `AssetContext.refresh()`'s in-flight guard makes a concurrent call resolve immediately as a no-op — without a visible busy state the button looks broken when a poll happens to be running.
- `tabs/WatchTab.jsx` — hero price card, **mode-aware display**:
  - **Dip mode**: `Tracker` (5 dip-level pills, windowed) + `NextAlert` (next trigger price + distance)
  - **Momentum mode**: `MomentumCard` (daily change % in green/rose, threshold reminder) — replaces Tracker+NextAlert
  - `Hero` shows `daily_change_pct` (signed, colored) for momentum assets; ATH drop for dip assets. Currency prefix is `$` for futures, blank for index points, `₹` for Indian.
  - `PriceHistory` renders an accessible selected-asset 30-day closing-price SVG chart.
  - `TodaysAlerts` shows directional badge (`.badge-up` green / `.badge-dn` rose) for momentum alerts vs `.badge` gold for dip alerts
  - `WatchlistMini` shows signed daily % for momentum assets, drop % for dip assets
  - `SetupBanner` appears above the hero when WhatsApp credentials aren't saved (`getSettings()` on tab activation), because the app otherwise looks fully operational while no alert can fire. Dismissible per session; "Set up" routes to Manage via the `onManage` prop threaded from `App.jsx`.
  - `Hero`'s `.upd-time` slot shows `timeAgo(lastUpdated)` — freshness, not status. Live/paused is already carried by `.open-lbl` and the dot. A local `useTick(30s)` re-renders it between the 60s polls, following the hand-rolled interval pattern in `StatusBar`/`AppHeader`.
  - **Animations**: the four cards share a `.dash-card` class. Tab switches stay mounted and use CSS `panel-enter` / `card-enter` animations through `.panel.active.animating`; asset switches still use a scoped `useGSAP` timeline (`autoAlpha` + `y`). `Tracker` pulses the pill that just flipped to "done". `TodaysAlerts` slides a new alert in when the top alert id changes (not on initial load).
  - **`.dash-card` stagger trap**: `.panel.active.animating > .dash-card:nth-child(N)` counts **all** panel children, not just `.dash-card`s — inserting anything above the hero (the setup banner, and the planned chip strip) shifts every delay below it. The `nth-child` rules therefore run to 7 with an `:nth-child(n + 8)` catch-all. `lib.test.js` regex-asserts the base `.dash-card` rule and `@keyframes card-enter`; the delay lines beside them are free to edit, those two are not.
- `tabs/AlertsTab.jsx` — read-only config summary rows → jump to Manage; recent alerts (same new-alert slide-in as Watch); market-hours card.
- `tabs/HistoryTab.jsx` — deployment history by IST month (primarily useful for dip-mode assets that have invest_amount).
- `tabs/ManageTab.jsx` — `WatchlistManager` (CRUD); `AssetSheet` now has **Alert type selector** (Dip Alert / Momentum), threshold label adapts to mode, hint text shows global ticker examples; `WhatsAppCard`; `SetupCard`.
- `lib.js` — `tickerMeta(ticker)` now returns `{ exchange, type, currency }`:
  - `=F` suffix → `{ exchange: 'COMEX', type: 'Futures', currency: '$' }`
  - `^GSPC` → `{ exchange: 'NYSE', type: 'Index', currency: 'pts' }`
  - `^NDX` → `{ exchange: 'NASDAQ', type: 'Index', currency: 'pts' }`
  - Default Indian → `{ ..., currency: '₹' }`
  - `priceParts(ticker, price, usdInr)` → `{ prefix, value, unit }` is the **single source of truth for how any price is written**, used by the hero, the watchlist rows and all three alert lists so they can never disagree. Covered by `lib.test.js`.
  - **Indian-context metal pricing** (`isMetal`/`metalUnit`/`toIndianMetalPrice`): COMEX quotes gold and silver in USD per troy ounce, which is not a unit anyone in India prices metal in. `=F` assets are therefore shown as **₹ per 10 g (gold) / per kg (silver)** — currency *and* unit converted — with the source `$/oz` quote and the exact rate (`@ ₹94.93/$`) printed beneath. Pattern from `docs/design-refs/gold-local-currency-treasury.png`; rate disclosure from Wise. **This is an international-equivalent figure, not the MCX/jeweller rate** — Indian physical metal adds ~6% import duty and 3% GST, so the card must keep saying "excludes duty & GST" and must never be relabelled as an official Indian rate.
  - **`^GSPC`/`^NDX` are deliberately never converted** — an index level is not a price, so there is no meaningful rupee value for "29,448 points". They render a `pts` unit suffix instead, which also fixes them previously showing a bare number with no unit at all.
  - **Alert history rows pass `usdInr = null` on purpose.** Converting a *past* dollar price at *today's* rate would invent a rupee number that was never true. Historical rows keep the asset's own quote currency and gain only the unit suffix.
  - `severity()` kept — `lib.test.js` depends on it. **Do not use severity colors in the UI.**
  - `timeAgo(ms, now)` — freshness label for `lastUpdated`. Takes a **client epoch** (`Date.now()`), not a backend ISO string, so `asUTC` is deliberately not involved. Guards against negative durations from clock skew. Covered by `lib.test.js`.
  - **Backend timestamps are naive UTC** (`datetime.utcnow`) — `asUTC` helper appends `Z`, don't strip it.

### Design system: Liquid Glass phone shell (don't regress these)

Bright sky/ribbon wallpaper behind a **tiered** material system — glass reserved for the functional layer, solid cards and bare sections for content (see "Material tiers" below) — all in `frontend/src/index.css` (plain CSS variables under `:root`, no Tailwind `@theme` block). Phone-shell layout: `.wrap` is 375px centered on desktop, fullscreen under `@media (max-width:430px)`. Replaces the earlier dark mono-cyan "Open Design" pass — if you see `--accent: #00e4ff` or a near-black `--glass` fill anywhere, that's stale.
- Tokens: `--bg #03176f`, `--accent #ffcf73` (warm gold), `--green #22c55e`, `--rose #ff5e6c`, `--r 26px`, `--rs 18px`. System/SF font, tabular-nums.
- **`.wrap` needs an explicit `z-index` (currently `0`), not just `position: relative`.** Without it, `position:relative` + `z-index:auto` does not establish a real stacking context, so the wallpaper's negative-z-index layers escape it and get compared against `body`'s own background instead — renders as flat navy with no gradient visible. Found and fixed by testing in isolation; don't remove the explicit z-index.
- **Material tiers — the governing rule (2026-09-01). Apple: "Avoid overusing Liquid Glass effects… Limit these effects to the most important functional elements in your app," and "avoid overcrowding or layering Liquid Glass elements on top of each other."** The app previously had 14 glass cards each with a refraction layer; a card was therefore a *window onto a moving wallpaper*, so one card ran dark grey at the top and bright blue at the bottom and its own rows sat on different grounds.
  - **Tier 1 `.glass`** — the functional/floating layer only: `.hero`, `.nav`, `.sheet` (+ confirm), `.toast`. `.glass` carries the backdrop-filter, the translucent gradient, the bright `--gb` rim and `.glass::before`'s corner sheen (subdued ~0.20, not ~0.42, so it doesn't wash out labels in that same corner). **`.glass` must stay after `.g` in source order** — both are single-class specificity, so the later block wins the properties they share; `.hero` then overrides on top. Order: `.g` → `.glass` → `.hero`.
  - **Tier 2 `.g`** — a **solid** content card (`--card`), no backdrop-filter, no sheen, no refraction. One composed object read as a unit: chart, KPI summary, Next Alert, Tracker/Momentum, config rows, market hours, WhatsApp form, Setup steps, ErrorCard, skeletons.
  - **Tier 3 `.sec` / `.sec-hd`** — no card at all. Homogeneous scannable lists whose rows are self-contained: Watchlist, Today's Alerts, Recent Alerts, History month groups, Manage's asset list. Header is plain text on the background; rows keep their `--faint` hairlines. Pattern from `docs/design-refs/watchlist-borderless-tokenized.png`.
  - `.sec` keeps `dash-card` — that is a layout/animation class, not a surface class.
- **Contrast improved by going solid; don't spend the headroom.** Over the palest wallpaper stop (`#bfd0c1`, the worst case) the old translucent `.g` composited to roughly `#495567`, putting `--dim` body text at ≈3.4:1 — *below AA*, and swinging with wallpaper position. On the solid `--card` the same text is ≈5.1:1 and constant. **Do not lighten `--card` to "keep the glass feel."** `--dim`/`--muted`/`--faint` need no retuning.
- **Translucent things nested in a card must state their own tone.** `.stat-cell` (now `--card-2`), `.field` and `.btn-ghost` used to lean on the wallpaper showing through for their separation. `.btn-ghost` in particular used `var(--glass)` + `var(--gb)` — literally the glass fill and glass border — so it was a glass chip inside a glass card and all but vanished over the bright half. These now carry independent values. `.field` stays translucent on purpose: it must work on both a solid card and the still-glass `AssetSheet`.
- **`.content-scrim`** (`App.jsx`, sibling between `<Wallpaper />` and `.app`, z-index 0) calms the wallpaper below the header strip so Tier-3 bare sections stay readable. The ramp starts high (~11%) because **only Watch has a hero occupying the bright band** — Alerts/History/Manage put real content there, and an earlier version that stayed clear to 28% left Manage's top rows unreadable on the pale ribbon. It is deliberately **not** a child of `Wallpaper`: `wallpaperImage.js` selects `.wallpaper`/`.ribbons`/`.glow` by name, so the hero still refracts the full-strength wallpaper.
- **Directional colors**: `.chg-up { color: var(--green) }` / `.chg-dn { color: var(--rose) }` — used for momentum daily change display. These are financial up/down colors, not the old severity coloring.
- `.badge-up` / `.badge-dn` — momentum alert badge variants (green/rose), distinct from gold `.badge` for dip alerts.
- `.momentum-row` / `.momentum-val` / `.momentum-sub` — the `MomentumCard` layout inside `.tracker` glass card.
- `Wallpaper` (in `App.jsx`) — four decorative layers (`.wallpaper`/`.ribbons`/`.grain`/`.glow`), not a single `.atmo` div like the old design.
- **The `.chips` asset strip sits directly on bare wallpaper** (as do Tier-3 sections and `.setup-banner`; Tier-2 cards have their own solid fill). It therefore needs its own **dark** scrim (`rgba(2,12,48,0.62)`), not a white tint: the original `rgba(255,255,255,0.07)` *lightened* an already-bright background, so over the pale band of the gradient the unselected chips were white-on-white and effectively invisible. Same rule as `.g`. The selected chip keeps (and deepens) that scrim rather than swapping it for `--accent-dim`, which washed out just as badly. Contrast was checked against the palest wallpaper stop (`#bfd0c1`), the worst case — it only improves toward the navy end.
- Recipes: `.g` (**solid** content card), `.glass` (the Liquid Glass material), `.sec`/`.sec-hd` (bare section), `.content-scrim`, `.panel`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.field`, `.sheet-overlay`/`.sheet` (portaled to `#phone-shell`; `.sheet` is now a glass recipe — hero-depth scrim + blur(28px), no longer solid `#0b1222`), `.nav`/`.nav-indicator` (see Bottom nav below), `.glass-refract`/`.glass-refract-window`/`.glass-defs` (refraction layer plumbing).
- **Card/sheet refraction — hard-won rules (2026-07-16), don't regress:**
  - **Never use `backdrop-filter: url(#svg-chain)` for this.** It disables Chromium's compositor fast path: measured 25fps with 117–250ms hitches app-wide vs a 60fps baseline (blink dots/entrance animations/scroll all force full software re-filters). The shipped design filters a **static pre-baked wallpaper bitmap** through `filter: url()` instead (60fps steady, repeat tab-switch worst frame 33ms) — same family of trick as the nav highlight.
  - The wallpaper bitmap must be a **PNG**, not an SVG data URI — Blink re-rasterizes *vector* feImage sources on every filter application (measured 550ms on a first tab switch).
  - **No `will-change: filter`** on the refraction windows — it made early-session frames 10× worse (10fps) by promoting all 14 windows into managed layers. (Historical: there are only 2 windows now, but the rule stands.)
- **The nav container deliberately has NO card-style refraction layer** — the indicator's own backdrop filtering double-processes anything painted beneath it inside the nav and can turn the pill neon while washing out the active icon. The nav keeps CSS frost + the animated indicator lens only.
  - Tiered scope (Apple guidance): **hero + sheet only** — Tier-2 cards, Tier-3 sections, `.btn-*`, `.field`, chips and badges all stay flat.
  - The **sheet runs a deliberately stronger lens than the hero** (`PRESETS.sheet` scale 34 / edgeDepth 36 / dome 0.42, up from 18/26/0.3) plus an inner rim ladder. It is modal and appears one at a time, so the cost is affordable, and it is the one place Apple explicitly sanctions the material. `.sheet-overlay`'s dim was lightened 0.66 → 0.48 to give the lens something to bend — with the content scrim behind it, a darker overlay left nothing to refract.
  - Text contrast is preserved by `.glass-refract::after` repainting the host's own scrim via a `background: inherit` ladder above the bent clone — the host element's scrim/background recipes remain the single source of truth.
  - Surface alignment is measured through the **offsetParent chain minus ancestor scrollTop** (transform-free) so entrance animations can't skew the clone; re-aligned on debounced panel scroll.
  - Fallback: non-Chromium (or any kill switch) renders zero layers/defs — byte-identical to the plain CSS recipes. Verified via `?refract=off`.

### Bottom nav (`.nav`) — design rules locked in

Implemented by `GlassNav.jsx`. The nav is **floating**: `position:absolute; bottom: calc(10px + env(safe-area-inset-bottom)); left/right: 15px; border-radius: 31px`. Must not span full width.

**Single-layer glass only**: `backdrop-filter` on `.nav` itself — NOT a child. Chrome seam bug on child inside `overflow:hidden`.

**Sliding indicator** (`.nav-indicator`): the equal-column lens width is measured once and movement is transform-only. One GSAP proxy owns the live X coordinate; its update paints both the rim transform and SVG filter/map X attributes. Refraction combines tween progress with measured X velocity: the filtered duplicate is hidden and displacement/specular are zero at rest, it rises toward the 32/29/26 RGB peak while the lens is physically travelling, then the duplicate is hidden again on completion. A same-position guard prevents active-tab clicks from triggering stationary refraction. That keeps the parked icon/label structurally crisp while producing the strong chromatic bend as the lens crosses options. Do not restore the old moving clip + counter-translated copy or animate width — those independent paths visibly drifted when interrupted. `prefersReducedMotion()` snaps the same position source and keeps refraction at zero.

**Tab switch flash fix**: all four tab panels stay mounted in `App.jsx` (do NOT go back to conditional `{tab === ... && <Tab />}` rendering). Inactive panels use `opacity: 0; visibility: hidden; pointer-events: none` (NOT `display: none`). Active panels use `.panel.active.animating` with CSS `panel-enter`; direct child `.dash-card` cards use CSS `card-enter` with staggered delays. This preserves the original entrance feel without React remount flicker.

**Liquid Glass refraction** (rebuilt 2026-07-15 from Aave's documented technique — aave.com/design/building-glass-for-the-web): the real buttons remain semantic and stationary. A pointer-inert `.nav-highlight-target` duplicates only the white icons/labels and stays fixed across the full option row. A `userSpaceOnUse` SVG filter crops that target to the current lens bounds and moves its `filter x` + `feImage x`; no source counter-translation is involved. The generated RG displacement map bends X/Y at the pill edge, B supplies the specular mask, and staggered RGB displacement passes create the chromatic fringe. The moving `.nav-indicator` independently owns the glass surface/rim beneath the filtered highlight. Hard-won details, don't regress: (1) `colorInterpolationFilters="sRGB"`; (2) filter and `feImage` use the exact measured lens width/height; (3) output is cropped to the exact lens bounds, with no neutral padded area leaking highlighted content; (4) map generation occurs only when measured geometry changes; (5) each geometry/map update gets a fresh filter ID for Safari caching; (6) `SelectorFilter` remains memoized so ordinary React tab rerenders cannot overwrite imperative SVG coordinates; (7) geometry comes from the real buttons so the basic moving indicator still works when URL filters are unsupported. Chromium is live-verified; Safari/Firefox remain compatibility targets requiring physical-browser spot checks when available.

**`.nav-scrim`**: a separate absolutely-positioned fade layer (`z-index: 5`, between panel content and the nav's `z-index: 10`) sitting behind the nav. Needed because the floating nav leaves a small gap between its own bottom edge and the phone's edge that isn't covered by the nav or clipped by the panel — without the scrim, scrollable content (e.g. the watchlist's first row) shows through as "ghost text" right at the bottom of the Watch tab. The scrim uses **`mask-image`** (not just a `background` gradient) so the `backdrop-filter` blur itself fades in gradually — a plain gradient background only fades the *tint*, not the blur, which left a visible hard seam where the blur snapped on. This is the standard progressive-blur trick (how iOS does it too).

## Gotchas

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
- **Alerts tab ConfigRows are navigation shortcuts, not toggle switches**: the "WhatsApp Alerts" row (and Dip Interval / Deploy Amount / Check Interval) in `AlertsTab.jsx` are `<button>` elements that navigate to the Manage tab on click — the `.toggle` inside is a pure visual status indicator, not a real switch. This is intentional design.
- **WhatsApp Delivery "Save"**: submitting the form with blank phone/apikey fields does NOT overwrite the stored secrets — only `check_interval_min` changes. The UI never echoes back the real values (masked display only), so this blank-means-preserve pattern is load-bearing.
- **A design source file (e.g. dropped into `frontend/index.html` directly) can silently replace the Vite entry point** — it'll still render in the browser (looks like progress) but with zero React, zero live data, and zero of the app's actual logic. If a "redesign" suddenly shows hardcoded/fake numbers instead of real backend data, check `git diff frontend/index.html` first before debugging anything else.
- **Never call `scrollIntoView()` on anything inside the phone shell — scroll the container directly.** `scrollIntoView` scrolls *every* scrollable ancestor, and `.wrap` is ~90px horizontally scrollable because the `.ribbons` wallpaper layer is `width:150%; left:-26%` and overhangs the 375px shell. `AssetChips` centring a right-hand chip therefore set `.wrap.scrollLeft = 90` and slid the **entire phone shell** 90px left. There is no `inline: 'nearest'` escape hatch — `block: 'nearest'` only constrains the vertical axis. Two-part fix, don't regress either half: `AssetChips` computes the offset and calls `strip.scrollTo({left})` itself, and **`.wrap` uses `overflow: clip`, not `overflow: hidden`** — `hidden` still creates a programmatically scrollable box, so plain keyboard focus on an off-screen chip reproduced the same shift; `clip` creates no scroll container at all and is visually identical (it still respects the 50px border-radius).
- **`gsap.matchMedia()` isn't used for reduced-motion checks here** — deliberately. It creates its own listener separate from `useGSAP`'s context; in an effect that re-runs often (e.g. on every tab/asset switch), wrapping it without manually tracking/reverting the old instance leaks a media-query listener per run. A plain `prefersReducedMotion()` boolean check (in `gsap.js`) does the same query without that footgun.

## Ownership Model

The friend deploys on **their own** Oracle Cloud Always Free VM (backend, SSH + systemd service, no platform auto-deploy) + Vercel (frontend, root dir `frontend`, `VITE_API_URL` env var) accounts and enters their own CallMeBot phone/key via the Manage tab. No developer credentials, phone numbers, or data anywhere in the repo — keep it that way. Full deploy steps are in README.md.

**Backend auto-deploy (pull-based, in `deploy/`):** a `dip-alert-deploy.timer` on the VM polls `master` every ~5 min and runs `deploy/deploy.sh` (transactionally consistent DB backup → `git pull --ff-only` → conditional `pip install` → compile/`pip check`/logic/security/migration regression gate → `systemctl restart` → health check on `GET /` at `127.0.0.1:8000` → **auto-rollback to the previous commit on any post-update failure**). Failed commits are quarantined until `master` advances, preventing an endless five-minute retry/restart loop. Chosen over GitHub-Actions-over-SSH so **no secrets ever leave the friend's VM** (fits the ownership model). Key facts: runs as unprivileged user `dipalert`; backend binds `127.0.0.1` (Caddy/nginx terminates TLS in front); DB lives at `/var/lib/dip-alert/dip_alert.db` (env `DATABASE_URL`, 4 slashes) and the env file at `/etc/dip-alert/dip-alert.env` (`APP_TOKEN`/`DATABASE_URL`/`FRONTEND_ORIGIN`), both **outside** the checkout; the only sudo grant is `systemctl restart/is-active dip-alert.service` via a `/etc/sudoers.d/` drop-in. Rollback reverts **code only** (additive migrations are backward-compatible); DB backups under `/var/lib/dip-alert/backups/` are for manual recovery. Changes to copied systemd/sudoers files require a deliberate SSH maintenance step. Full runbook: `deploy/README.md`. **Status (2026-06-21):** built, committed, and pushed to public `master` (exact revision tracked in `docs/SECURITY_AUDIT_PLAN.md` rather than hard-coded here); the full local gate is green, but it has **not** been installed on a VM yet — VM install, `visudo -c`/unit validation, a live timer-deploy, a rollback/quarantine drill, a backup restore drill, and reverse-proxy/TLS/firewall/Vercel checks are all still pending (tracked in `docs/SECURITY_AUDIT_PLAN.md`, SEC-001..004). Deployment-failure alerting **is** built and opt-in: set `DEPLOY_ALERT_PHONE`/`DEPLOY_ALERT_APIKEY` (the developer's own CallMeBot creds, distinct from the friend's app-alert creds in the DB) in `/etc/dip-alert/deploy-alert.env` — a **deploy-only** file (loaded only by `dip-alert-deploy.service`, never by the app, so the internet-facing process can't leak them) — and `deploy.sh`'s `notify_failure()` sends one best-effort WhatsApp ping per rolled-back commit; left unset it's silent (journalctl only). Pre-update refusals (dirty checkout / non-ff / failed fetch) are intentionally not alerted.

Switched from Railway to Oracle Cloud Always Free (2026-06-21): Railway's $5 one-time trial credit isn't a recurring free tier — past it, the only ongoing free allowance is $1/month, far short of what an always-on backend with a persistent SQLite file + in-process APScheduler needs. Render's free tier has no persistent disk and spins down after 15 min idle (kills both the DB and the scheduler); Fly.io dropped its free tier entirely (Oct 2024). Oracle's Always Free tier is the one host that's genuinely free forever **and** matches this app's existing architecture (real VM, persistent disk, always-on process) with zero code changes — the tradeoff is manual VM/systemd setup instead of a one-click GitHub deploy, plus the backend now needs its own reverse-proxy TLS (see Gotchas) since there's no platform-provided HTTPS.

## Health Stack

- typecheck: `npx tsc --noEmit` (frontend) — `tsconfig.json` added with `allowJs`/`checkJs` against plain JS/JSX; this surfaces "untyped JS" findings (missing prop shapes, implicit any), not necessarily real bugs. `src/lib.test.js` is excluded (Node test script, not part of the app bundle).
- lint: `npm run lint` (frontend, `eslint .`)
- test: `.venv\Scripts\python.exe test_logic.py && .venv\Scripts\python.exe test_security.py && .venv\Scripts\python.exe test_migrations.py` (backend, run from `backend/`) + `node src/lib.test.js` (frontend, run from `frontend/`)
- deadcode: `npx knip` (frontend)
- shell: `./.tools/shellcheck.exe deploy/deploy.sh` (project-local Windows binary, gitignored — no system package manager available; downloaded from the official koalaman/shellcheck GitHub releases)
- build (bonus, not scored): `npm run build` (frontend)

## GBrain Configuration (configured by /setup-gbrain)
- Mode: local-stdio
- Engine: pglite
- Config file: ~/.gbrain/config.json (mode 0600)
- Setup date: 2026-07-24
- MCP registered: yes (user scope)
- Embeddings: deferred (no API key) — keyword/FTS search only, doctor reports `warnings` by design
- Repo policy: read-write (this repo's markdown files are imported)
- Artifacts sync: off (kept local-only, no cross-machine/cloud sync)

## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

GBrain is set up locally (PGLite, no embeddings) for this repo. Since there's
no embedding provider configured, search is keyword/FTS only — treat `gbrain
search`/`gbrain query` as a secondary option to Grep, not a semantic-first
replacement, until an embedding provider is added. Grep remains the primary
tool for known exact strings, regex, multiline patterns, and file globs in
this codebase.

<!-- gstack-gbrain-search-guidance:end -->

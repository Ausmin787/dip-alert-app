# Dip Alert

**Current-state planning reference — verified 2026-07-21.** Historical split-pane plans under `.planning/phases/` are archived and are not the current frontend specification.

## What This Is

A single-user, mobile-first market alert dashboard. The backend monitors a small watchlist and sends CallMeBot WhatsApp alerts. The frontend is a four-tab phone-shell interface: **Watch · Alerts · History · Manage**.

Two alert modes are live:

- **Dip:** Indian assets such as Nifty 50 alert at each new configured percentage level below all-time high, with recovery/new-ATH reset behavior and an NSE-hours gate.
- **Momentum:** Global assets alert once per UTC day per direction when the move from previous close crosses the configured threshold.

## Core Value

Deliver dependable, de-duplicated WhatsApp alerts while giving the owner a compact view of live status, history, watchlist configuration, and credentials.

## Current Product

- FastAPI + SQLModel + SQLite backend with APScheduler and yfinance.
- React/Vite frontend with a bright Liquid Glass phone-shell design.
- Four state-driven tabs in `frontend/src/App.jsx`; there is no router.
- `GlassNav.jsx` provides the bottom navigation selector. The parked selection remains crisp; SVG displacement/specular/chromatic refraction appears only while the selector travels.
- Global asset state lives in `AssetContext.jsx`, polls status every 60 seconds, refreshes only the selected asset's 30-day history every five minutes, and persists that selection in `localStorage`.
- Optional `APP_TOKEN` protects writes through the `X-App-Token` header.
- Production target: Oracle Cloud Always Free VM for the backend and Vercel for the frontend. The Oracle deployment automation exists in `deploy/`; live infrastructure still requires independent verification.

## Validated Requirements

- [x] Dip and momentum alert modes with mode-aware de-duplication.
- [x] Five default assets: Nifty 50, Gold, Silver, S&P 500, and Nasdaq 100.
- [x] Watch, Alerts, History, and Manage tab workflows.
- [x] Watchlist CRUD, settings, redacted credentials, and test-alert action.
- [x] Mobile-first Liquid Glass cards and responsive 375px phone shell.
- [x] Velocity-driven refractive bottom-nav selector with reduced-motion handling.
- [x] Backend logic/security scripts and frontend helper/lint/build gates.
- [x] Pull-based Oracle VM deployment assets with backup, health gate, rollback, and rejected-commit quarantine.

## Out of Scope

- Multi-user accounts or a full authentication system.
- Automated broker order placement.
- A hardcoded NSE holiday calendar.
- React Router, desktop sidebar/split-pane navigation, Recharts, Motion, or three.js in the current frontend.

## Constraints

- Preserve the backend data model and existing alert semantics.
- Keep credentials out of source, logs, screenshots, and frontend bundles.
- Keep SQLite on persistent VM storage outside the checkout in production.
- Maintain keyboard semantics and `prefers-reduced-motion` behavior in navigation.
- Regenerate `docs/screenshots/dashboard-desktop.png` after meaningful visual changes.

## Current Decisions

| Decision | Rationale | Status |
|---|---|---|
| Four-tab phone shell | Fits the mobile-first owner workflow better than the former desktop split pane | Current |
| Liquid Glass visual system | Provides depth and selection feedback without a WebGL dependency | Current |
| One GSAP position source for the nav lens | Prevents rim/filter drift during interrupted movement | Current |
| Refraction only while travelling | Keeps the selected icon and label readable at rest | Current |
| Oracle VM + Vercel target | Supports persistent SQLite and an always-on scheduler without a container free-tier mismatch | Current target; live status unverified |

---
*Last updated: 2026-07-21 from the live repository*

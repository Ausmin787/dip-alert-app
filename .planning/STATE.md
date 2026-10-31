---
gsd_state_version: 1.0
milestone: current-product
milestone_name: three-tab-apple-hig
status: maintenance
stopped_at: Full correctness, security, persistence, and request-efficiency audit remediated
last_updated: "2026-10-31T00:00:00+05:30"
last_activity: 2026-10-31 — Frontend rebuilt to Apple HIG; verified in Chromium, real iPhone Safari pending
progress:
  historical_phases: 3
  historical_phases_completed: 3
  percent: 100
---

# Project State

## Current Product

Dip Alert is a working single-user FastAPI/React application with dip and momentum alert modes and a mobile-first three-tab frontend built to Apple's Human Interface Guidelines.

**Current frontend:** `App.jsx`, `AssetContext.jsx`, `spring.js`, `Sheet.jsx`, `PriceChart.jsx`, `TabBar.jsx`, `AssetDetail.jsx`, `api.js`, `lib.js`, and `tabs/{Watchlist,Alerts,Settings}Tab.jsx`.

**Current backend:** FastAPI routes, SQLModel/SQLite, APScheduler, cached/single-flight yfinance reads, CallMeBot integration, additive migrations, optional `APP_TOKEN`, and logic/security/migration regression scripts.

## Current Position

- Frontend rebuilt to Apple HIG (2026-10-31): glass only on the floating layer, springs for all motion, no animation library.
- Real iPhone Safari check still pending: San Francisco, Dynamic Type, safe areas, touch feel.
- Frontend lint, helper tests, and production build are the standard UI gate.
- Alert state advances only after configured, successful delivery; alert history snapshots the investment amount used at alert time.
- Status polling is guarded against overlap and chart history is fetched only for the selected asset.
- Oracle/Vercel is the deployment target; live infrastructure verification remains pending.
- README screenshot and supporting documentation match the current UI.

## Historical Milestone

The June 2026 three-phase Stripe-style split-pane milestone completed, but that visual architecture was later superseded. Its plans and summaries remain archived under `.planning/phases/`; they are not implementation instructions.

## Pending Work

- Complete physical Safari/Firefox SVG filter checks.
- Perform authorized Oracle VM, TLS, DNS, firewall, Vercel, rollback, and restore verification.

## Blockers and Concerns

- SVG filter rendering can differ across browser engines; source/build checks cannot replace physical browser checks.
- Production status must not be inferred from deployment files alone.
- Yahoo Finance remains an unauthenticated, rate-limited upstream.

## Session Continuity

Resume from the live repository and `CLAUDE.md`, not from archived phase plans. Verify current files before applying historical assumptions.

---
*Last updated: 2026-07-21 from the live repository*

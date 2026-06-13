# Requirements: Dip Alert Redesign

**Defined:** 2026-06-14
**Core Value:** Fires real-time WhatsApp alerts when drop thresholds are crossed, enabling the user to immediately buy Nifty 50 ETFs at calculated discount levels.

## v1 Requirements

### App Shell & Layout (LAY)
- [ ] **LAY-01**: Responsive app container constrained inside a viewport-locked `100dvh` flex layout.
- [ ] **LAY-02**: Slim left navigation dock (64px) with icons that expands to show text labels on hover/toggle.
- [ ] **LAY-03**: Desktop multi-pane layout: Sidebar Dock + Middle Feed Column (320px) + Right Workspace Panel.
- [ ] **LAY-04**: Mobile/Tablet responsiveness where middle feed and side panel adjust or collapse via transitions.

### Live Asset Feed (FEED)
- [ ] **FEED-01**: Feed column displaying active watchlist cards with asset ticker, name, current price, and current drop severity badge (mint/amber/rose).
- [ ] **FEED-02**: Inline self-drawing SVG sparkline displayed inside each asset card showing recent price movement.
- [ ] **FEED-03**: Persistent header in the feed pane displaying live NSE open/closed status badge and active IST clock.

### Detailed Workspace Pane (WORKSPACE)
- [ ] **WORKSPACE-01**: Displays high-density key metrics for the selected asset: current price, ATH price, drop percentage, and next target alert level.
- [ ] **WORKSPACE-02**: Integrates a lazy-loaded Recharts SVG chart showing historical prices and drop intervals.
- [ ] **WORKSPACE-03**: Segmented dip ladder showing level thresholds (-1%, -2% etc.) color-coded by severity, marking crossed milestones and indicating the next trigger level.
- [ ] **WORKSPACE-04**: Prominent action bar containing the direct Groww.in buy link reminder button.

### Routing, Configuration & Security (STATE)
- [ ] **STATE-01**: App routes (/ for Dashboard, /watchlist for watchlist CRUD, /alerts for history log, /settings for credentials) integrated into the left navigation dock.
- [ ] **STATE-02**: Persistent selection of the active watchlist asset saved in localStorage or URL query parameter.
- [ ] **STATE-03**: Watchlist additions, settings updates, and test alert triggers execute successfully, sending the `X-App-Token` header if `APP_TOKEN` is enabled.

## v2 Requirements (Deferred)
- **CMD-01**: Keyboard command palette (`Cmd+K` / `Ctrl+K`) for fast navigation and search.
- **COMP-02**: Compare mode overlaying multiple asset drop sparklines on the same grid.
- **STAT-03**: Aggregate statistics page showing total investment reminders triggered and historical level counts.

## Out of Scope
- **USER-AUTH**: Multi-user accounts or auth walls (dashboard remains single-user).
- **ORDER-EXEC**: Auto-purchase order placement (broker APIs are out-of-scope; manual execution via Groww.in links only).
- **HOLIDAY-SYNC**: Hardcoded NSE trading holiday calendar verification.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAY-01 | Phase 1 | Pending |
| LAY-02 | Phase 1 | Pending |
| LAY-03 | Phase 1 | Pending |
| LAY-04 | Phase 1 | Pending |
| FEED-01 | Phase 2 | Pending |
| FEED-02 | Phase 2 | Pending |
| FEED-03 | Phase 2 | Pending |
| WORKSPACE-01 | Phase 3 | Pending |
| WORKSPACE-02 | Phase 3 | Pending |
| WORKSPACE-03 | Phase 3 | Pending |
| WORKSPACE-04 | Phase 3 | Pending |
| STATE-01 | Phase 1 | Pending |
| STATE-02 | Phase 2 | Pending |
| STATE-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ➔ Good

---
*Requirements defined: 2026-06-14*
*Last updated: 2026-06-14 after initial definition*

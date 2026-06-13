# Roadmap: Dip Alert Redesign

## Overview
This roadmap covers the transition of the Dip Alert application from its current scrolling "Dynamic Island" layout to a viewport-locked, high-density "Stripe-Style Split Pane" desktop app shell.

## Phases

- [x] **Phase 1: App Shell & Sidebar Dock** - Setup the `100dvh` layout, collapsible left navigation dock, and configure page routing. (completed 2026-06-13)
- [x] **Phase 2: Live Asset Feed & State** - Build the middle feed pane with watchlist cards, live price/severity tracking, inline SVG sparklines, and active selection state. (completed 2026-06-14)
- [ ] **Phase 3: Workspace Detail Pane & Actions** - Construct the right detail pane containing asset metrics, Recharts drop charts, segment-colored dip ladders, buy triggers, and API write protection.

## Phase Details

### Phase 1: App Shell & Sidebar Dock
**Goal**: Establish the responsive app container, thin collapsible side-dock navigation, and wire up React router navigation.
**Depends on**: Nothing
**Requirements**: LAY-01, LAY-02, LAY-03, LAY-04, STATE-01
**Success Criteria** (what must be TRUE):
  1. The application shell fills the screen exactly using `100dvh` (no document body scrolls).
  2. The left navigation dock displays as a thin 64px column containing icons that expands on hover.
  3. Clicking sidebar icons changes routes correctly between Dashboard, Watchlist, Alerts, and Settings.
  4. On smaller viewports, the sidebar auto-collapses or slides out of canvas.
**Plans**: 1 plan

Plans:
- [x] 01-01: Set up responsive app-shell container, collapsible navigation sidebar, and wire React routing.

### Phase 2: Live Asset Feed & State
**Goal**: Build the middle feed column showcasing the user's watchlist with live indicators, sparklines, and selection memory.
**Depends on**: Phase 1
**Requirements**: FEED-01, FEED-02, FEED-03, STATE-02
**Success Criteria** (what must be TRUE):
  1. The middle panel lists watchlist assets featuring live price, drop %, and severity badges.
  2. Asset feed items render self-drawing inline SVG sparklines indicating price movements.
  3. Selected asset state persists in `localStorage` across page navigations or refreshes.
  4. The feed header displays the live NSE market open/closed status badge and active clock.
**Plans**: 1 plan

Plans:
- [x] 02-01: Implement the middle asset feed list column, inline sparklines, live clock headers, and active state memory.

### Phase 3: Workspace Detail Pane & Actions
**Goal**: Finish the right-hand panel display featuring key metrics, historical drop charts, colored ladders, buy triggers, and token protection.
**Depends on**: Phase 2
**Requirements**: WORKSPACE-01, WORKSPACE-02, WORKSPACE-03, WORKSPACE-04, STATE-03
**Success Criteria** (what must be TRUE):
  1. Selecting an asset in the feed dynamically updates metrics (ATH, drop %, next target level) in the detail pane.
  2. The detail pane loads and displays a custom Recharts SVG price drop chart.
  3. Segmented dip ladder lists all target percentages, color-coded by severity, showing crossed states and a pulsing next target.
  4. Outbound Groww.in button triggers navigation to the broker URL with the correct slug.
  5. Watchlist CRUD, Settings PUT, and test alert triggers work correctly and send `X-App-Token` when enabled.
**Plans**: 1 plan

Plans:
- [ ] 03-01: Build the right detail panel, Recharts chart wrapper, dip ladder component, buy links, and connect write API headers.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 ➔ 2 ➔ 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. App Shell & Sidebar | 1/1 | Complete    | 2026-06-13 |
| 2. Live Asset Feed | 1/1 | Complete    | 2026-06-14 |
| 3. Workspace Detail | 0/1 | Not started | - |

---
*Roadmap defined: 2026-06-14*
*Last updated: 2026-06-14 after initialization*

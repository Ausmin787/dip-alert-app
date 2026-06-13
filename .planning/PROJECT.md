# Dip Alert — Nifty ATH Tracker Redesign

## What This Is
A single-user web app that watches the Nifty 50 index during NSE market hours, fires a WhatsApp alert (via CallMeBot) each time the price crosses a new -1% level below its all-time high (ATH), and shows a high-density, viewport-locked monitoring dashboard.

## Core Value
Fires real-time WhatsApp alerts when drop thresholds are crossed, enabling the user to immediately buy Nifty 50 ETFs at calculated discount levels.

## Requirements

### Validated
- [x] **CORE-01**: Background price checking of watchlist assets during market hours (Mon-Fri 9:15-15:30 IST)
- [x] **CORE-02**: Drop level calculation based on threshold percentages and ATH price
- [x] **CORE-03**: CallMeBot WhatsApp alert dispatcher with failed-delivery retry gate
- [x] **CORE-04**: Recovery reset (price returning within 0.5% of ATH) and new ATH reset triggers
- [x] **DB-01**: SQLite storage with automatic, additive startup migrations
- [x] **API-01**: FastAPI endpoint routing with redacted WhatsApp credentials and write protection interceptor

### Active (Redesign)
- [ ] **UI-01**: Contain layout inside a viewport-locked (`100dvh` flex) app shell
- [ ] **UI-02**: Far-left collapsible navigation dock (64px expandable sidebar)
- [ ] **UI-03**: Middle live-asset feed showing all watchlist cards, current prices, severities, and inline self-drawing sparklines
- [ ] **UI-04**: Right detail pane presenting selected asset charts (lazy-loaded Recharts) and segmented dip ladders
- [ ] **UI-05**: Responsive states collapsing the middle feed or side dock on smaller breakpoints

### Out of Scope
- Multi-user authentication — Single-user dashboard, security is handled via basic `APP_TOKEN` header check.
- Automated order placement / trading integration — Requires complex broker APIs, kept out of scope for simplicity. Direct Groww.in buy links are used instead.
- Hardcoded NSE holiday calendars — Omitted to avoid yearly calendar maintenance (harmless since prices don't update on holidays).

## Context
- The existing codebase is built using FastAPI (Python) and React + Vite + Tailwind CSS v4.
- The user is unsatisfied with the current "Dynamic Island" layout, noting it feels like a website instead of a native application.
- The redesign will restructure the frontend from a scrolling website to a viewport-contained "Stripe-Style Split Pane" desktop dashboard.

## Constraints
- **Tech Stack**: Must remain React + Vite + Tailwind CSS v4 + Motion + GSAP on the frontend.
- **State Limits**: Must not break existing backend SQLModel relationships or alert level checks.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| stripe_split_pane | Layout selected to replace "Dynamic Island" website look with an app-like split-pane monitoring dashboard | ➔ Pending |

## Evolution
This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? ➔ Move to Out of Scope with reason
2. Requirements validated? ➔ Move to Validated with phase reference
3. New requirements emerged? ➔ Add to Active
4. Decisions to log? ➔ Add to Key Decisions
5. "What This Is" still accurate? ➔ Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check ➔ still the right priority?
3. Audit Out of Scope ➔ reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-14 after initialization*

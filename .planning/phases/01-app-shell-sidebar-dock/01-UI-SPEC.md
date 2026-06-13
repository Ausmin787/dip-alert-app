---
phase: 1
slug: app-shell-sidebar-dock
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-14
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for Phase 1: App Shell & Sidebar Dock. Defines layout grids, dimensions, styles, and navigation behaviors for the Stripe-Style Split Pane layout.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Tailwind CSS v4 |
| Preset | Stripe-Style Dark Panel |
| Component library | radix-ui / none |
| Icon library | Custom SVG (from components/icons.jsx) |
| Font | Inter (with tabular-nums for numerical views) |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inner icon spacing, status dot gaps |
| sm | 8px | Button padding, list item gaps |
| md | 16px | Panel padding, content grid gaps |
| lg | 24px | Major sections, outer canvas gaps |
| xl | 32px | Page header paddings |
| 2xl | 48px | Sub-pane separators |
| 3xl | 64px | Sidebar default collapsed width |

Exceptions: Sidebar expanded width is fixed at `240px`; middle feed width is fixed at `320px`.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (text-sm) | 400 (normal) | 1.5 |
| Label | 12px (text-xs) | 600 (semibold) | 1.4 |
| Heading | 18px (text-lg) | 700 (bold) | 1.3 |
| Display | 24px (text-2xl) | 700 (bold) | 1.2 |

Numerals MUST be styled with `.num` / `font-variant-numeric: tabular-nums` to prevent visual jitter during real-time price ticks.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#070a0e` | Main page canvas background |
| Secondary (30%) | `#10161d` | Sidebar background, middle feed panel, selected items |
| Intermediary | `#18212b` | Hovered list items, button backgrounds, inputs |
| Hairline Border | `#263241` | Thin panel dividers, grid borders (1px) |
| Accent (10%) | `#2d7dff` | Active nav indicator lines, focus rings, link outlines |
| Text Ink | `#f4f7fa` | Primary text headings and active labels |
| Text Ink Muted | `#8a97a6` | Secondary labels, descriptions, closed badges |
| Destructive | `#ff5e6c` | Active alarms, delete actions, system error logs |

Accent is strictly reserved for: nav active indicator tabs and focused state boundaries. Never use it as a solid background or primary action button fill.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary Navigation Links | Overview, Watchlist, Alerts, Settings |
| Sidebar Collapse Toggle | Collapse Sidebar / Expand Sidebar (screenreader text) |
| Market Clock Status | NSE Live / NSE Closed |
| Clock Label | HH:MM:SS IST |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| tailwind v4 | `@theme` custom overrides | not required |
| motion/react | `AnimatePresence`, `motion.div` | spring physics config verify |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-14

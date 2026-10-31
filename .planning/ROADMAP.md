# Roadmap: Dip Alert

**Current-state roadmap — verified 2026-07-21.** The three phase files are historical records; their sidebar and split-pane implementation was later replaced.

## Delivered Product

- [x] Dip and momentum alert engine, persistence, scheduler, WhatsApp delivery, and API.
- [x] Three-tab mobile-first interface: Watchlist, Alerts, Settings, with a wide-screen split view.
- [x] Apple HIG redesign: system tokens, draggable sheet, scrubbable chart, spring tab lens.
- [x] Optional app-token write protection and security regressions.
- [x] Oracle VM systemd/auto-deploy assets with backup, rollback, and quarantine.
- [x] Correct delivery-state semantics, migration coverage, credential clearing, strict validation, mode-aware UI, immutable history amounts, and bounded/cached upstream reads.

## Current Workstream

- [x] Rebuild the frontend to Apple's Human Interface Guidelines, removing the wallpaper, phone frame, and refraction machinery.
- [x] Replace GSAP with one small spring module.
- [ ] Check on a real iPhone: San Francisco, Dynamic Type, safe areas, touch feel.
- [x] Refresh the checked-in dashboard screenshot after the visual changes.
- [ ] Perform physical Safari and Firefox spot checks for SVG filter behavior.

## Operations Remaining

- [ ] Install and verify the deployment units on the intended Oracle VM.
- [ ] Verify live deploy, rollback/quarantine, backup restore, reverse proxy, TLS, DNS, firewall, CORS, and Vercel.
- [ ] Record production evidence in `docs/SECURITY_AUDIT_PLAN.md` only after authorized live verification.

## Archived GSD Milestone

| Historical phase | Historical result | Current status |
|---|---|---|
| 1. App Shell & Sidebar Dock | Desktop sidebar and responsive bottom nav | Superseded by the tab bar and sidebar in `TabBar.jsx` |
| 2. Live Asset Feed & State | Middle-feed selection/context work | State concepts retained; split-pane UI superseded |
| 3. Workspace Detail Pane & Actions | Right-pane dashboard/watchlist flow | Superseded by the three tab components and `AssetDetail.jsx` |

Historical plan, summary, and UI-spec files remain under `.planning/phases/`; the directory README marks the entire set as archived provenance.

---
*Last updated: 2026-07-21 from the live repository*

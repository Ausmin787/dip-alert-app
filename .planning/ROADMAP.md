# Roadmap: Dip Alert

**Current-state roadmap — verified 2026-07-15.** The three phase files are historical records; their sidebar and split-pane implementation was later replaced.

## Delivered Product

- [x] Dip and momentum alert engine, persistence, scheduler, WhatsApp delivery, and API.
- [x] Four-tab mobile-first phone shell: Watch, Alerts, History, Manage.
- [x] Bright Liquid Glass redesign and GSAP travelling-refraction bottom-nav selector.
- [x] Optional app-token write protection and security regressions.
- [x] Oracle VM systemd/auto-deploy assets with backup, rollback, and quarantine.

## Current Workstream

- [x] Rebuild bottom navigation around one measured GSAP position source.
- [x] Keep the selected option undistorted while parked.
- [x] Apply SVG displacement, specular lighting, and chromatic separation only while the lens moves.
- [x] Add same-position, resize, cleanup, and reduced-motion guards.
- [x] Refresh the checked-in dashboard screenshot after the visual changes.
- [ ] Perform physical Safari and Firefox spot checks for SVG filter behavior.

## Operations Remaining

- [ ] Install and verify the deployment units on the intended Oracle VM.
- [ ] Verify live deploy, rollback/quarantine, backup restore, reverse proxy, TLS, DNS, firewall, CORS, and Vercel.
- [ ] Record production evidence in `docs/SECURITY_AUDIT_PLAN.md` only after authorized live verification.

## Archived GSD Milestone

| Historical phase | Historical result | Current status |
|---|---|---|
| 1. App Shell & Sidebar Dock | Desktop sidebar and responsive bottom nav | Superseded by phone shell and `GlassNav.jsx` |
| 2. Live Asset Feed & State | Middle-feed selection/context work | State concepts retained; split-pane UI superseded |
| 3. Workspace Detail Pane & Actions | Right-pane dashboard/watchlist flow | Superseded by four tab components |

Historical plan, summary, and UI-spec files remain under `.planning/phases/`; the directory README marks the entire set as archived provenance.

---
*Last updated: 2026-07-15 from the live repository*

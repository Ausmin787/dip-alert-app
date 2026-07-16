# Codebase Concerns

**Verified:** 2026-07-15 from live source and deployment documentation.

## External Data and Messaging

- **Yahoo Finance rate limits/availability:** yfinance is unauthenticated and can throttle or fail. Keep the watchlist modest, avoid aggressive polling, and treat upstream errors as recoverable.
- **CallMeBot delivery:** delivery depends on a third-party personal-use service and network availability. Tracker state must not advance when delivery fails so a later poll can retry.
- **Broker links:** Groww URLs are configured per asset and can become invalid if external slugs change.

## Scheduling and Market Semantics

- The NSE gate checks weekdays and 09:15–15:30 IST but does not include a maintained exchange-holiday calendar. Holiday polls can fetch unchanged data; this is an accepted limitation.
- Momentum de-duplication is by UTC day and direction. Changes to time semantics require regression coverage.

## Persistence and Deployment

- SQLite must live on persistent VM storage outside the git checkout. Container/serverless ephemeral filesystems are incompatible with the scheduler/state model.
- The current target is Oracle Cloud, not Railway. Do not restore `/data` volume instructions or assume platform-provided TLS.
- Auto-rollback reverts code, not database contents. Additive migrations preserve backward compatibility; destructive migrations need a different release design.
- Deployment files do not prove a VM, domain, TLS certificate, firewall, timer, or Vercel project is live. Verify external state before claiming production readiness.

## Glass Navigation

- SVG filter behavior can differ in Safari and Firefox. Keep a physical-browser spot check in the visual release gate.
- The nav rim and filter map must share one position source. Independent clip/counter-translation paths previously drifted under interrupted animations.
- The filtered duplicate must remain hidden at rest; parked chromatic distortion is a regression.
- Reduced-motion, resize, cleanup, completion, and same-tab paths must leave refraction at zero.

## Security

- `APP_TOKEN` is intentionally lightweight write protection for a single-user app, not full authentication. Public reads remain a deliberate exposure decision.
- Never place CallMeBot credentials, app tokens, phone numbers, deploy credentials, or real database content in source, screenshots, logs, or frontend bundles.
- The browser app token lives in `localStorage`; users must treat the browser profile as trusted.
- Reverse proxy/TLS, firewall, OS patching, file permissions, backups, monitoring, and restore behavior remain production verification responsibilities.

## Documentation Drift Risks

- Archived `.planning/phases/` files describe a removed desktop sidebar/split-pane UI.
- `docs/screenshots/dashboard-desktop.png` must be regenerated after meaningful visual changes.
- Marketing assets should describe both dip and momentum modes rather than implying the app only tracks Nifty 50 dips.

---
*Replaces the superseded Railway/Recharts/ScrollTrigger concern map dated 2026-06-14.*

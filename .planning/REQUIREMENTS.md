# Requirements: Dip Alert

**Current-state requirements — verified 2026-07-21.** The old `LAY-*`, `FEED-*`, and `WORKSPACE-*` split-pane requirements are superseded by the implemented phone-shell product.

## Alert Engine

- [x] **ALERT-01:** Poll active watchlist assets through APScheduler and yfinance.
- [x] **ALERT-02:** In dip mode, calculate drop from ATH and alert only on newly crossed configured levels.
- [x] **ALERT-03:** Reset dip progression on a new ATH or recovery to within 0.5% of ATH.
- [x] **ALERT-04:** Apply the NSE weekday and 09:15–15:30 IST gate to Indian dip assets.
- [x] **ALERT-05:** In momentum mode, compare current price with previous close and alert once per UTC day per direction.
- [x] **ALERT-06:** Advance alert state and write history only after successful WhatsApp delivery.

## Frontend Experience

- [x] **UI-01:** Render a mobile-first phone shell with Watch, Alerts, History, and Manage tabs.
- [x] **UI-02:** Keep all tab panels mounted and switch them with local React state rather than URL routes.
- [x] **UI-03:** Show live asset status, mode-aware metrics, alert levels, and 30-day history.
- [x] **UI-04:** Support watchlist CRUD, app-token entry, CallMeBot settings, and test alerts in Manage.
- [x] **UI-05:** Use the current bright wallpaper and transparent Liquid Glass card system.
- [x] **UI-06:** Use a semantic bottom nav with a sliding glass selector that is crisp at rest and refractive only in motion.
- [x] **UI-07:** Respect reduced-motion preferences and keep nav geometry synchronized on resize.

## State, API, and Security

- [x] **STATE-01:** Poll `/api/status` every 60 seconds and load 30-day history only for the selected asset every five minutes.
- [x] **STATE-02:** Persist selected asset and optional app token in browser `localStorage`.
- [x] **STATE-03:** Attach `X-App-Token` to API requests when a browser token is configured.
- [x] **STATE-04:** Protect backend write endpoints when `APP_TOKEN` is set and redact stored messaging credentials in responses.
- [x] **STATE-05:** Keep additive SQLite startup migrations compatible with existing databases.

## Operations

- [x] **OPS-01:** Provide systemd service/timer files and a pull-based deployment script for an Oracle VM.
- [x] **OPS-02:** Back up SQLite consistently before deployment and verify the backup.
- [x] **OPS-03:** Gate deployment on compile, dependency, logic, security, restart, and health checks.
- [x] **OPS-04:** Roll back failed releases and quarantine rejected commits.
- [ ] **OPS-05:** Install and verify the deployment stack on the actual Oracle VM.
- [ ] **OPS-06:** Verify live reverse proxy, TLS, DNS, firewall, Vercel, backup restore, and failure alerting.

## Verification Gate

```powershell
backend\.venv\Scripts\python backend\test_logic.py
backend\.venv\Scripts\python backend\test_security.py
backend\.venv\Scripts\python backend\test_migrations.py
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
backend\.venv\Scripts\python -m pip check
```

Run `backend\.venv\Scripts\python deploy\test_deploy_safety.py` and Bash syntax validation when deployment files change.

## Out of Scope

- Multi-user authentication.
- Automated order execution.
- Hardcoded market-holiday synchronization.
- The archived desktop sidebar, middle feed, right workspace, route-based page shell, Recharts, Motion, and three.js design.

---
*Last updated: 2026-07-21 from live source and package manifests*

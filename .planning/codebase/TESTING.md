# Testing and Verification

**Verified:** 2026-07-21 from live scripts and package commands.

## Backend

`backend/test_logic.py` is a standalone monkeypatched regression script. It covers dip-level crossing/de-duplication, recovery/new-ATH reset, failed or unconfigured delivery behavior, per-asset rollback isolation, and momentum up/down/de-duplication/retry behavior.

`backend/test_security.py` uses FastAPI `TestClient` with a temporary SQLite database to cover optional token enforcement, validation, redaction, headers, and protected writes.

`backend/test_migrations.py` builds a legacy SQLite schema, runs migrations twice, and verifies new columns, one-time seeding state, idempotence, and preservation of customized rows.

```powershell
backend\.venv\Scripts\python backend\test_logic.py
backend\.venv\Scripts\python backend\test_security.py
backend\.venv\Scripts\python backend\test_migrations.py
backend\.venv\Scripts\python -m pip check
```

There is no pytest dependency.

## Frontend

`frontend/src/lib.test.js` is run directly by Node for shared helper regressions. ESLint and a production Vite build are required for source/UI changes.

```powershell
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

The frontend has no Jest suite. Glass-nav behavior also needs live visual checks: crisp parked state, strong but aligned travel refraction, interruption, same-tab click, resize, keyboard navigation, and reduced motion. Physical Safari/Firefox checks remain necessary because SVG filters vary by browser engine.

## Deployment

When `deploy/` changes:

```powershell
backend\.venv\Scripts\python deploy\test_deploy_safety.py
& 'C:\Program Files\Git\bin\bash.exe' -n deploy/deploy.sh
```

The safety script checks deployment structure, backup behavior, rollback/quarantine safeguards, and credential separation. VM install, timer, rollback, restore, proxy, and TLS behavior require authorized live verification.

---
*Replaces the obsolete severity/sparkline-only testing map dated 2026-06-14.*

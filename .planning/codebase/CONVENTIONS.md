# Coding Conventions

**Analysis Date:** 2026-06-14

## Naming Patterns

**Files:**
- Backend: `snake_case.py` for all python script files.
- Frontend React components: `PascalCase.jsx` (e.g. `DipLadder.jsx`, `IndexOrb.jsx`).
- Frontend vanilla scripts and hooks: `camelCase.js` (e.g. `useReducedMotion.js`, `api.js`).

**Functions:**
- Backend: `snake_case` with explicit type annotations (e.g. `def refresh_ath(session: Session, ticker: str) -> AthTracker | None:`).
- Frontend: `camelCase` (e.g. `isMarketOpenIST()`). Component names are `PascalCase`.

**Variables:**
- Backend & Frontend variables: `camelCase` for Javascript, `snake_case` for Python.
- Constants: `UPPER_SNAKE_CASE` (e.g., `RECOVERY_RESET_PCT = 0.5` in python, `@theme` variables in index.css).

## Code Style

**Python Style (Backend):**
- Standard PEP 8 rules.
- Double quotes `"` for docstrings and strings where appropriate, single quotes `'` for dictionary keys or simple strings.
- Explicit database transaction handling:
  ```python
  try:
      check_asset(session, item)
  except Exception:
      session.rollback()
      logger.exception("Check failed for %s", ticker)
  ```
  *Rule:* Always perform `session.rollback()` inside asset scheduler loops when encountering errors, to avoid poisoning the session with `PendingRollbackError`.

**Javascript Style (Frontend):**
- Strict module formatting (ES Modules).
- Dark mode theme tokens under Tailwind CSS v4 `@theme` block:
  - Canvas: `#070a0e`
  - Surface-1: `#10161d`
  - Surface-2: `#18212b`
  - Hairline: `#263241`
  - Text ink: `#f4f7fa`
  - Text ink-muted: `#8a97a6`
  - Accent: `#2d7dff` (strictly for interactive highlights, never solid backgrounds)
- Numerical formatting using `.num` utility class (forces tabular numbers font features for aligned digit columns).

## Error Handling

**Backend Routes:**
- Returns standard HTTP exceptions (`raise HTTPException(status_code=400, detail="...")`).
- Input validation: Pydantic schemas (e.g., validating `threshold_pct > 0` to prevent division by zero in calculations).

**Frontend API:**
- Interactive REST endpoints handle failures using Toast / state alerts.
- Mashed token headers: settings configurations redact key parts of saved passwords or access tokens. PUT payloads must accept empty strings to avoid clearing existing records.

---

*Convention audit: 2026-06-14*
*Update when introducing new style guides*
```

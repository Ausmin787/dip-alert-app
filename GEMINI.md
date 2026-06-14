<!-- GSD:project-start source:PROJECT.md -->
## Project

**Dip Alert — Nifty ATH Tracker Redesign**

A single-user web app that watches the Nifty 50 index during NSE market hours, fires a WhatsApp alert (via CallMeBot) each time the price crosses a new -1% level below its all-time high (ATH), and shows a high-density, viewport-locked monitoring dashboard.

**Core Value:** Fires real-time WhatsApp alerts when drop thresholds are crossed, enabling the user to immediately buy Nifty 50 ETFs at calculated discount levels.

### Constraints

- **Tech Stack**: Must remain React + Vite + Tailwind CSS v4 + Motion + GSAP on the frontend.
- **State Limits**: Must not break existing backend SQLModel relationships or alert level checks.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3.14.3 - Backend server, database queries, and scheduler tasks
- JavaScript (ES6+ / React JSX) - Frontend dashboard and settings pages
- HTML5 / CSS3 (Vanilla + Tailwind CSS v4) - Frontend layout, styling, and animations
## Runtime
- Python 3.14.3
- Node.js 20.19+ (Vite 8 floor requirement)
- Modern Web Browsers (Chrome, Safari, Firefox, Edge)
- pip - Python packages
- npm 10.x - Node.js packages (lockfile: `package-lock.json` present)
## Frameworks
- FastAPI 0.136.3 - Python async web API framework
- SQLModel 0.0.38 - SQL database ORM combining SQLAlchemy and Pydantic
- React 19.2.6 - Frontend component framework
- Vite 8.0.12 - Frontend build tool and dev server
- Python standard library (monkeypatched scripting in `test_logic.py`)
- Node.js (regression tests in `src/lib.test.js` run via `npm test`)
- Tailwind CSS v4 - Styling compiler
- ESLint 10.3.0 - JS static analysis / linting
- Uvicorn 0.49.0 - ASGI server for FastAPI
## Key Dependencies
- yfinance 1.4.1 - Market price ingestion (Yahoo Finance API)
- apscheduler 3.11.2 - Cron-like job scheduling for market hours polling
- three 0.184.0 & @react-three/fiber 9.6.1 & @react-three/drei 10.7.7 - WebGL Point-Cloud Sphere (three.js hero)
- gsap 3.15.0 - ScrollTrigger entrance animations and CountUp counters
- motion 12.40.0 - Dynamic Island morph animations and route transitions
- recharts 3.8.1 - Asset price history charts (lazy-loaded)
- axios 1.17.0 - HTTP client for API requests
## Configuration
- Backend configuration:
- Frontend configuration:
- WhatsApp config: stored directly in the `settings` SQLite DB row.
- `eslint.config.js` - ESLint configuration
- `vite.config.js` - Vite configuration with Tailwind CSS integration
## Platform Requirements
- Windows/macOS/Linux
- Python 3.11+
- Node.js 20.19+
- Backend: Railway (requires persistent volume for SQLite DB)
- Frontend: Vercel (static deployment with environment proxy/API URL)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Backend: `snake_case.py` for all python script files.
- Frontend React components: `PascalCase.jsx` (e.g. `DipLadder.jsx`, `IndexOrb.jsx`).
- Frontend vanilla scripts and hooks: `camelCase.js` (e.g. `useReducedMotion.js`, `api.js`).
- Backend: `snake_case` with explicit type annotations (e.g. `def refresh_ath(session: Session, ticker: str) -> AthTracker | None:`).
- Frontend: `camelCase` (e.g. `isMarketOpenIST()`). Component names are `PascalCase`.
- Backend & Frontend variables: `camelCase` for Javascript, `snake_case` for Python.
- Constants: `UPPER_SNAKE_CASE` (e.g., `RECOVERY_RESET_PCT = 0.5` in python, `@theme` variables in index.css).
## Code Style
- Standard PEP 8 rules.
- Double quotes `"` for docstrings and strings where appropriate, single quotes `'` for dictionary keys or simple strings.
- Explicit database transaction handling:
- Strict module formatting (ES Modules).
- Dark mode theme tokens under Tailwind CSS v4 `@theme` block:
- Numerical formatting using `.num` utility class (forces tabular numbers font features for aligned digit columns).
## Error Handling
- Returns standard HTTP exceptions (`raise HTTPException(status_code=400, detail="...")`).
- Input validation: Pydantic schemas (e.g., validating `threshold_pct > 0` to prevent division by zero in calculations).
- Interactive REST endpoints handle failures using Toast / state alerts.
- Mashed token headers: settings configurations redact key parts of saved passwords or access tokens. PUT payloads must accept empty strings to avoid clearing existing records.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- **Decoupled Deployment:** Backend hosts the API and scheduler (Railway + SQLite Volume); Frontend runs as a static application (Vercel).
- **Polling Scheduler:** Time-based Cron-like checks run only during NSE market hours (IST) using APScheduler.
- **Transactional State:** Persistent database updates are committed atomically. Errors roll back SQL transactions to prevent state corruption.
- **Redacted Configuration:** Sensitive credentials (WhatsApp/CallMeBot details) are kept in the database and redacted in public API responses.
## Layers
- **Entry point:** `main.py` (FastAPI app setup, startup DB creation and migrations, background thread ATH refresh, scheduler registration).
- **Routes Layer:** `routes.py` (API endpoints for status dashboard, history, CRUD operations on watchlist, settings modification, and test alerts).
- **Core Logic:** `ath_logic.py` (Asset-by-asset comparison of price to ATH, recovery check, level calculation, WhatsApp dispatcher trigger).
- **Service Layer:** `price_service.py` (wrapper around yfinance for current and historical price data) and `whatsapp.py` (CallMeBot wrapper).
- **Data Access:** `db.py` (database engine / session creation) and `models.py` (SQLModel table schemas).
- **State & Router:** `App.jsx` (Client-side routing, navigation control, layout structure).
- **Page Layer:** `pages/` (Dashboard, Watchlist, Alerts, Settings page components).
- **Component Layer:** `components/` (DipLadder segment fill, Sparkline SVG drawing, GSAP Reveal wrapper, dynamic three.js sphere).
- **API Client:** `api.js` (Axios wrapper with interceptors for `X-App-Token` authentication).
- **Helpers:** `lib.js` (Time and timezone helpers, severity styling logic, clock functions).
## Data Flow
### 1. Alert Checking Flow (Backend-Driven)
```
```
### 2. Client Ingestion Flow (Frontend-Driven)
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.agent/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

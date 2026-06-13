# Technology Stack

**Analysis Date:** 2026-06-14

## Languages

**Primary:**
- Python 3.14.3 - Backend server, database queries, and scheduler tasks
- JavaScript (ES6+ / React JSX) - Frontend dashboard and settings pages

**Secondary:**
- HTML5 / CSS3 (Vanilla + Tailwind CSS v4) - Frontend layout, styling, and animations

## Runtime

**Environment:**
- Python 3.14.3
- Node.js 20.19+ (Vite 8 floor requirement)
- Modern Web Browsers (Chrome, Safari, Firefox, Edge)

**Package Manager:**
- pip - Python packages
- npm 10.x - Node.js packages (lockfile: `package-lock.json` present)

## Frameworks

**Core:**
- FastAPI 0.136.3 - Python async web API framework
- SQLModel 0.0.38 - SQL database ORM combining SQLAlchemy and Pydantic
- React 19.2.6 - Frontend component framework
- Vite 8.0.12 - Frontend build tool and dev server

**Testing:**
- Python standard library (monkeypatched scripting in `test_logic.py`)
- Node.js (regression tests in `src/lib.test.js` run via `npm test`)

**Build/Dev:**
- Tailwind CSS v4 - Styling compiler
- ESLint 10.3.0 - JS static analysis / linting
- Uvicorn 0.49.0 - ASGI server for FastAPI

## Key Dependencies

**Critical:**
- yfinance 1.4.1 - Market price ingestion (Yahoo Finance API)
- apscheduler 3.11.2 - Cron-like job scheduling for market hours polling
- three 0.184.0 & @react-three/fiber 9.6.1 & @react-three/drei 10.7.7 - WebGL Point-Cloud Sphere (three.js hero)
- gsap 3.15.0 - ScrollTrigger entrance animations and CountUp counters
- motion 12.40.0 - Dynamic Island morph animations and route transitions
- recharts 3.8.1 - Asset price history charts (lazy-loaded)
- axios 1.17.0 - HTTP client for API requests

## Configuration

**Environment:**
- Backend configuration:
  - `DATABASE_URL` (SQLite file location, e.g. `sqlite:////data/dip_alert.db` in production)
  - `DISABLE_SCHEDULER` (1 to skip scheduling in dev/testing)
  - `FRONTEND_ORIGIN` (CORS configuration)
  - `APP_TOKEN` (optional API write protection token)
- Frontend configuration:
  - `VITE_API_URL` (backend API endpoint)
- WhatsApp config: stored directly in the `settings` SQLite DB row.

**Build:**
- `eslint.config.js` - ESLint configuration
- `vite.config.js` - Vite configuration with Tailwind CSS integration

## Platform Requirements

**Development:**
- Windows/macOS/Linux
- Python 3.11+
- Node.js 20.19+

**Production:**
- Backend: Railway (requires persistent volume for SQLite DB)
- Frontend: Vercel (static deployment with environment proxy/API URL)

---

*Stack analysis: 2026-06-14*
*Update after major dependency changes*

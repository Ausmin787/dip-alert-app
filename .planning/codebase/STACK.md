# Technology Stack

**Verified:** 2026-07-21 from `requirements.txt`, `package.json`, and `package-lock.json`.

## Backend

- Python 3.11+
- FastAPI 0.136.3, Starlette 1.3.1, Uvicorn 0.49.0
- SQLModel 0.0.38 + SQLite
- APScheduler 3.11.2
- yfinance 1.4.1
- httpx 0.28.1

## Frontend

- Node.js 20.19+ and npm (`package-lock.json` tracked)
- React/React DOM 19.2.7 resolved (`^19.2.6` declared)
- Vite 8.0.16 and `@vitejs/plugin-react` 6.0.2 resolved (`^8.0.12` / `^6.0.1` declared)
- Tailwind CSS 4.3.0 through `@tailwindcss/vite`
- GSAP 3.15.0 and `@gsap/react` 2.1.2
- Axios 1.18.0
- ESLint 10.4.1 resolved (`^10.3.0` declared)

The current frontend has no Motion, Recharts, three.js, React Router, Jest, or TypeScript dependency.

## Configuration

- Backend: `DATABASE_URL`, `DISABLE_SCHEDULER`, `FRONTEND_ORIGIN`, optional `APP_TOKEN`.
- Frontend: `VITE_API_URL`; Vite proxies local `/api` to `localhost:8000`.
- Production target: Oracle VM backend plus Vercel frontend. Railway is obsolete.

## Verification

- Backend: standalone `test_logic.py`, `test_security.py`, and `test_migrations.py` scripts; no pytest dependency.
- Frontend: Node helper test, ESLint, and Vite production build.
- Deployment: `deploy/test_deploy_safety.py` plus Bash syntax validation.

---
*Replaces the stale Python 3.14/Railway/three.js/Motion/Recharts stack map.*

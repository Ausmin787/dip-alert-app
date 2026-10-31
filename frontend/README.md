# Dip Alert frontend

The React/Vite frontend for the Dip Alert market-monitoring app. It is a mobile-first, three-tab single-page interface built to Apple's Human Interface Guidelines.

## Requirements

- Node.js 20.19+
- npm 10+
- The backend running at `http://localhost:8000` for live local data

## Run locally

From this directory:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Vite proxies relative `/api` requests to `http://localhost:8000`.

## Verification

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

- `lint` checks the frontend source with ESLint.
- `test` runs the Node regression tests in `src/lib.test.js`.
- `build` creates the production bundle in `dist/`.

## Environment

Set `VITE_API_URL` to the deployed backend's HTTPS origin for production. Leave it unset in local development so the Vite proxy handles `/api`.

If the backend enables `APP_TOKEN`, enter the matching access token in the app's Settings tab. The token is kept in browser local storage and attached to API writes as `X-App-Token`.

## Structure

- `src/App.jsx` — shell, tab state, and size class; there is no router.
- `src/AssetContext.jsx` — 60-second status and alert polling, and price history cached per ticker and period.
- `src/tabs/` — Watchlist, Alerts, and Settings views.
- `src/api.js` — Axios client and optional app-token header.
- `src/spring.js` — Apple's damping-and-response spring, velocity tracking, projection, and rubber-banding.
- `src/Sheet.jsx`, `src/PriceChart.jsx`, `src/TabBar.jsx` — the draggable sheet, scrubbable chart, and floating tab bar.
- `src/index.css` — plain-CSS design tokens from Apple's published values, plus the components.

## Design rules

The rules not to regress live under "Design system" in the repository's `CLAUDE.md`. In short: glass only on the floating layer, one job per colour, springs from the live on-screen value, and no in-app appearance switch.

The production Vercel configuration is in `vercel.json`; it serves the SPA and applies security headers.

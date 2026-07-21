# Dip Alert frontend

The React/Vite frontend for the Dip Alert market-monitoring app. It is a mobile-first, four-tab single-page interface using the repository's Liquid Glass design system.

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

If the backend enables `APP_TOKEN`, enter the matching access token in the app's Manage tab. The token is kept in browser local storage and attached to API writes as `X-App-Token`.

## Structure

- `src/App.jsx` — phone shell and four-tab state; there is no router.
- `src/AssetContext.jsx` — 60-second shared status polling and five-minute selected-asset history refresh.
- `src/tabs/` — Watch, Alerts, History, and Manage views.
- `src/api.js` — Axios client and optional app-token header.
- `src/gsap.js` — shared GSAP registration, reduced-motion helper, and glass easing.
- `src/GlassNav.jsx` — floating glass bottom-navigation compositor.
- `src/index.css` — Tailwind import plus the app's plain-CSS Liquid Glass tokens and components.

## Glass navigation

`GlassNav.jsx` follows the Aave web-glass technique adapted for this app. The real nav buttons stay semantic and stationary. While the indicator travels, a pointer-inert duplicate of the icon/label row is cropped by a generated SVG displacement filter, producing velocity-driven RGB refraction. The duplicate and filter strength return to zero at rest, which keeps the selected content crisp.

Keep indicator position and SVG-filter position driven from the same GSAP coordinate source. Preserve the same-tab guard, `prefers-reduced-motion` snap, ResizeObserver geometry updates, and the usable CSS indicator fallback when SVG URL filters are unsupported.

The production Vercel configuration is in `vercel.json`; it serves the SPA, applies security headers, and permits the data URL used by the generated displacement map.

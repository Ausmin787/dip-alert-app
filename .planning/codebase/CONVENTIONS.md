# Coding Conventions

**Verified:** 2026-07-21 from live source.

## Naming and Files

- Python modules/functions/variables use `snake_case`; constants use `UPPER_SNAKE_CASE`.
- React component files/components use `PascalCase.jsx`.
- Shared JavaScript modules/hooks use descriptive camel-case names such as `api.js`, `spring.js`, `lib.js`, and `useAssets.js`.
- The three primary views live under `frontend/src/tabs/` and end in `Tab.jsx`.

## Backend

- Keep route validation in Pydantic/SQLModel schemas and return explicit `HTTPException` responses.
- Roll back the SQLModel session after an asset-level exception so one failure does not poison later scheduler work.
- Preserve delivery ordering: send WhatsApp first; commit tracker/log changes only after success.
- Schema evolution is additive and idempotent at startup.
- Settings responses must redact stored credentials; blank masked fields on update mean retain existing values.

## Frontend

- Use ES modules and functional React components.
- `App.jsx` owns tab state; do not introduce route assumptions without an explicit architecture change.
- API access goes through `api.js`; write-token injection stays centralized in the Axios interceptor.
- Shared asset state is consumed through `useAssets.js` and provided by `AssetContext.jsx`.
- Motion goes through `createSpring` in `spring.js`, stopped on unmount. CSS transitions are fine for things no gesture can touch.
- Prefer transform/opacity animation; avoid width/layout animation in the bottom nav.

## Apple HIG System

- Visual tokens are CSS custom properties under `:root` in `index.css`, with values taken from Apple's HIG tables.
- Preserve semantic HTML beneath effects. The nav is a labelled `<nav>` with real buttons.
- The stationary nav target is the normal icon/label. The filtered duplicate is an in-motion effect layer only.
- Rim movement and SVG filter/map coordinates must be painted from the same measured position source.
- Honor `prefers-reduced-motion` by snapping position and keeping refraction disabled.

## Verification

- Backend behavior changes require `test_logic.py`, `test_security.py`, and `test_migrations.py` as applicable.
- Frontend changes require `npm test`, `npm run lint`, and `npm run build`.
- Deployment changes also require `deploy/test_deploy_safety.py` and Bash syntax validation.
- Use `npm.cmd` in Windows PowerShell when the `.ps1` shim is blocked by execution policy.

---
*Replaces the superseded dark split-pane convention map dated 2026-06-14.*

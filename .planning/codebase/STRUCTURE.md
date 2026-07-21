# Codebase Structure

**Verified:** 2026-07-21 from the live tree.

```text
dip-alert-app/
├── backend/
│   ├── app/
│   │   ├── main.py, routes.py, ath_logic.py, scheduler.py
│   │   ├── price_service.py, whatsapp.py
│   │   └── db.py, models.py
│   ├── requirements.txt
│   ├── test_logic.py
│   ├── test_security.py
│   └── test_migrations.py
├── frontend/
│   ├── public/{favicon.svg,manifest.webmanifest}
│   ├── src/
│   │   ├── App.jsx, main.jsx
│   │   ├── AssetContext.jsx, useAssets.js
│   │   ├── GlassNav.jsx, gsap.js
│   │   ├── Wallpaper.jsx, wallpaperImage.js
│   │   ├── liquidGlass.js, useLiquidGlass.jsx, GlassSurface.jsx
│   │   ├── api.js, lib.js, lib.test.js, index.css
│   │   └── tabs/{WatchTab,AlertsTab,HistoryTab,ManageTab}.jsx
│   ├── package.json, package-lock.json
│   ├── vite.config.js, eslint.config.js, vercel.json
│   └── README.md
├── deploy/
│   ├── deploy.sh, backup_sqlite.py, test_deploy_safety.py
│   ├── *.service, *.timer, sudoers drop-in
│   └── environment examples and README.md
├── docs/
│   ├── screenshots/, designs/, banner.png, banner.svg
│   └── SECURITY_AUDIT_PLAN.md
├── .planning/
├── README.md
└── CLAUDE.md
```

## Key Responsibilities

- `App.jsx`: phone shell, wallpaper/header, four-tab state.
- `GlassNav.jsx`: semantic bottom nav, geometry, SVG filter, selector motion.
- `liquidGlass.js` / `useLiquidGlass.jsx` / `GlassSurface.jsx` / `wallpaperImage.js`: static-bitmap refraction for cards + sheet.
- `AssetContext.jsx`: status/history polling, selected ticker, refresh.
- `tabs/`: user-facing Watch, Alerts, History, and Manage workflows.
- `ath_logic.py`: dip/momentum alert decisions.
- `routes.py`: API boundary and write operations.
- `deploy/`: Oracle VM operations; it is not proof of live deployment.

Removed historical paths such as `frontend/src/pages/`, `components/three/`, Recharts chart components, and Motion wrappers must not be referenced as current.

---
*Replaces the superseded split-pane directory map dated 2026-06-14.*

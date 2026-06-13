# Codebase Structure

**Analysis Date:** 2026-06-14

## Directory Layout

```
dip-alert-app/
├── backend/                  # Backend application root
│   ├── app/                  # FastAPI source code
│   │   ├── ath_logic.py      # Core price checking and alerting logic
│   │   ├── db.py             # Database engine setup and session dependency
│   │   ├── main.py           # Web application instantiation and lifespan setups
│   │   ├── models.py         # SQLModel database schemas
│   │   ├── price_service.py  # Wrapper service fetching from yfinance
│   │   ├── routes.py         # REST controller route definitions
│   │   ├── scheduler.py      # Background APScheduler configurations
│   │   └── whatsapp.py       # CallMeBot WhatsApp webhook driver
│   ├── .venv/                # Python virtual environment (gitignored)
│   ├── Procfile              # Heroku/Railway process runner instruction
│   ├── railway.json          # Deployment parameters for Railway
│   ├── requirements.txt      # Python dependencies
│   ├── runtime.txt           # Python version pin
│   └── test_logic.py         # Regression tests runner (no pytest dependency)
├── docs/                     # Media, screenshots, and guidelines
│   └── screenshots/
└── frontend/                 # Frontend client application root
    ├── public/               # Static browser assets
    ├── src/                  # React source files
    │   ├── components/       # Custom React controls
    │   │   ├── three/        # 3D visuals
    │   │   │   └── IndexOrb.jsx # Three.js hero sphere
    │   │   ├── DipChart.jsx  # Chart showing historical asset drops
    │   │   ├── DipLadder.jsx # Signage status ladder of crossed levels
    │   │   ├── Sparkline.jsx # Canvas/SVG self-drawing micro sparklines
    │   │   ├── anim.jsx      # GSAP wrappers for page/word reveals
    │   │   ├── icons.jsx     # SVG dashboard iconography
    │   │   ├── motion.jsx    # Framer Motion transitions
    │   │   └── useReducedMotion.js # Accessibility layout checker
    │   ├── pages/            # View components tied to router endpoints
    │   │   ├── Alerts.jsx    # Alert history ledger
    │   │   ├── Dashboard.jsx # Main overview screen
    │   │   ├── Settings.jsx  # Config page for target phone / token
    │   │   └── Watchlist.jsx # Watchlist CRUD page
    │   ├── App.jsx           # Routing config, Dynamic Island, and shell template
    │   ├── api.js            # Axios client with local storage token interceptors
    │   ├── index.css         # Theme layout styling and core variables
    │   ├── lib.js            # Shared JS functions (severity classification)
    │   ├── lib.test.js       # Node-level frontend helper regression tests
    │   └── main.jsx          # Bundle entry point
    ├── eslint.config.js      # Linter overrides
    ├── package.json          # Client dependencies
    ├── vercel.json           # Vercel configuration
    └── vite.config.js        # Vite build engine setup
```

## Directory Purposes

**backend/**:
- Purpose: REST API and cron worker engine.
- Contains: Python 3.14 files, configuration setups, and data seed hooks.
- Key files: [test_logic.py](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/backend/test_logic.py) (run to verify backend changes).

**frontend/**:
- Purpose: Dark theme client dashboard.
- Contains: Single page React code, bundle configs, three.js canvas, and GSAP micro-animations.
- Key files: [package.json](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/frontend/package.json) (install requirements), [src/index.css](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/frontend/src/index.css) (color tokens and recipes).

## Key File Locations

**Entry Points:**
- [backend/app/main.py](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/backend/app/main.py): FastAPI API startup.
- [frontend/src/main.jsx](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/frontend/src/main.jsx): React dashboard bootstrap file.

**Configuration:**
- [backend/requirements.txt](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/backend/requirements.txt): Backend dependencies.
- [frontend/vite.config.js](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/frontend/vite.config.js): Bundler settings.
- [frontend/src/index.css](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/frontend/src/index.css): Colors, gradients, and custom utility classes.

---

*Structure analysis: 2026-06-14*
*Update after directory structure reorganization*

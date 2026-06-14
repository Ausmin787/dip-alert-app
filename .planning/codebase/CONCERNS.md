# Codebase Concerns

**Analysis Date:** 2026-06-14

## Tech Debt & System Constraints

**yfinance Rate Limits:**
- **Issue:** The backend fetches market prices from Yahoo Finance via the `yfinance` package without authentication.
- **Impact:** High frequency checking (e.g. less than 5 min intervals) or having too many watchlist assets can cause Yahoo to block the server IP.
- **Mitigation:** Default poll interval is capped, and watchlist should be restricted to a modest size.

**SQLite Persistence on Serverless Hosting:**
- **Issue:** SQLite runs in a local file. Serverless setups (like Railway or render) destroy local files on every git deploy.
- **Impact:** Watchlist settings, database alerts history, and ATH tracking levels reset on every build unless configured correctly.
- **Mitigation:** Must configure a persistent volume mounted at `/data` and set `DATABASE_URL=sqlite:////data/dip_alert.db` in production.

**Groww.in ETF URL Mapping:**
- **Issue:** Buy links require Groww's internal URL slug format (e.g., `sbietf-nifty` for SBI Nifty 50 ETF). Fund names or standard symbol names (like `SETFNIF50.NS`) do not map cleanly.
- **Impact:** Buying ETF links from the dashboard or WhatsApp notifications will result in 404 pages on Groww if inputted incorrectly.
- **Mitigation:** Slugs must be looked up manually on Groww.in before adding assets to the watchlist.

## Known Limitations

**NSE Holiday Calendars:**
- **Issue:** The scheduling loop only verifies weekday (Mon-Fri) and hour range (9:15 AM to 3:30 PM IST). NSE holiday calendars are not hardcoded.
- **Impact:** On market holidays, backend polling ticks continue to run. They fetch stagnant prices, which is harmless, but waste server cycles and api calls.
- **Mitigation:** Deliberately omitted to avoid yearly holiday schedule maintenance.

## Animation & Visual Testing Gotchas

**GSAP ScrollTrigger Entrance Opacities:**
- **Issue:** `Reveal` wrappers start element opacity at `0` until they are scrolled into view.
- **Impact:** Automated testing/scraping tools (like Playwright) capturing full-page screenshots will capture blank blocks below the fold.
- **Mitigation:** Test suites must issue scroll events to trigger the GSAP reveals before taking screenshots.

**Recharts StrictMode Render Error:**
- **Issue:** Recharts drawing animations frequently fail to render and show up blank when wrapped in React StrictMode.
- **Impact:** Price charts on the dashboard render blank in dev mode.
- **Mitigation:** Keep `isAnimationActive={false}` on Recharts chart series.

## Security Considerations

**API Write Access Protection:**
- **Issue:** The API endpoints (Watchlist CRUD, Settings PUT, Test Alerts) are open by default.
- **Impact:** Anyone discovering the Railway backend URL could change watchlist items or trigger spam WhatsApp messages.
- **Mitigation:** An optional `APP_TOKEN` env var can be set on the backend. When active, all write endpoints require a matching `X-App-Token` header.
- **Masking Secrets:** The settings GET/PUT route masks the phone number and API key. When PUT requests are sent, blank values must be interpreted as "retain existing secrets" to prevent overwriting the DB with asterisks.

---

*Concerns audit: 2026-06-14*
*Update as new dependencies or system issues arise*

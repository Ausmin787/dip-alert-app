# Dip Alert Security Audit Plan and Findings Ledger

> Living handoff document for future security-audit sessions. This file defines the audit scope, procedures, evidence requirements, findings format, and completion criteria. Update it during each audit rather than relying on chat history.

## Quick Resume Instructions

Start a future session with:

> Read `CLAUDE.md` and `docs/SECURITY_AUDIT_PLAN.md` completely. Verify the current local branch, public GitHub `master`, and recent changes before trusting the recorded baseline. Continue the security audit from the first unchecked item. Audit read-only first, record evidence and findings in the ledger, and do not change code or deployment state until I approve the proposed fixes.

Before auditing:

- [ ] Read the current `CLAUDE.md`; it is the repository source of truth.
- [ ] Run `git status --short --branch` and record any pre-existing user changes.
- [ ] Compare local HEAD with `git ls-remote origin refs/heads/master`.
- [ ] Review commits newer than the baseline recorded below.
- [ ] Reconcile those changes into this document before testing.
- [ ] Confirm whether the target is source only, local runtime, staging, or production.
- [ ] Confirm explicit authorization and safe-testing limits for every live target.
- [ ] Never place real `APP_TOKEN`, CallMeBot keys, phone numbers, SSH keys, or cloud credentials in this file.

## Current Baseline

| Item | Recorded state |
|---|---|
| Baseline date | 2026-06-21 |
| Local branch | `master` |
| Local and public GitHub commit | `d0e60dd0d8fc2b56a3aea1936b5e9bcf489ebaa2` |
| Application model | Single-user dashboard; no user accounts or password authentication |
| Frontend | React/Vite SPA hosted on Vercel |
| Backend | FastAPI/SQLModel/SQLite/APScheduler on an Oracle Cloud Always Free VM |
| Public API protection | Reads are public; `APP_TOKEN` optionally protects writes through `X-App-Token` |
| Sensitive application data | CallMeBot phone/API key, `APP_TOKEN`, alert history, watchlist/settings data |
| External services | Yahoo Finance through `yfinance`, CallMeBot, Groww links, Vercel, Oracle Cloud, DNS/TLS provider |

The baseline is historical context, not proof of the current state. A future session must verify it again.

### Important changes already incorporated

- Backend hosting changed from Railway to an Oracle Cloud VM. Railway-specific volume and platform-TLS assumptions are obsolete.
- The Oracle VM requires explicit OS, SSH, firewall, process, reverse-proxy, TLS, patching, backup, and monitoring controls.
- When `APP_TOKEN` is set at process startup, FastAPI disables `/docs` and `/openapi.json`.
- Existing controls include Pydantic input validation, redacted settings responses, timing-safe token comparison, frontend/backend security headers, and a test-alert cooldown. These are audit targets, not assumed passes.

## Status Vocabulary

Use one status for every checklist item:

- **Not started** — no current evidence.
- **In progress** — testing has begun but no conclusion is justified.
- **Pass** — current evidence meets the stated acceptance criterion.
- **Finding** — a confirmed weakness or missing control exists.
- **Not applicable** — excluded with a written technical reason.
- **Blocked** — cannot be evaluated; record exactly what evidence or access is missing.

Do not mark an item **Pass** from source inspection alone when runtime or deployment behavior is part of the requirement.

## Audit Principles and Safety Boundaries

- Begin read-only. Propose fixes only after findings have evidence and severity.
- Treat local code, public GitHub state, local runtime behavior, and deployed behavior as separate proof points.
- Use disposable local/staging data for mutations. Do not alter a real watchlist, settings row, alert history, or credentials during production checks.
- Live testing is low-volume and non-destructive unless the owner separately authorizes a staging stress test.
- Do not perform denial-of-service testing, credential guessing, persistence, privilege escalation, destructive file operations, or scanning outside explicitly authorized hosts.
- Redact secrets from commands, screenshots, logs, issue text, commits, and this ledger.
- Re-test every accepted fix independently and preserve the before/after evidence.

## How the Six Supplied Images Apply

The images are generic prompts, and some headings/descriptions are mismatched. They must be adapted to this application rather than executed literally.

### Image 1 — Secure authentication: partially applicable

There are no user accounts, passwords, email verification flows, password-reset tokens, or login sessions. Those checks are **Not applicable** unless accounts are introduced later.

The relevant equivalent is administrative write authorization and browser-held credentials:

- Strength, generation, storage, entry, rotation, and revocation of `APP_TOKEN`.
- Enforcement on every state-changing endpoint and every HTTP method/path variation.
- Constant-time comparison and failure behavior that does not reveal token details.
- Absence of the token from source, Git, frontend bundles, URLs, logs, analytics, errors, and screenshots.
- Risks of storing the token in `localStorage`, especially under any future XSS.
- Exact CORS behavior for `X-App-Token`, preflights, untrusted origins, `null` origins, and origin variations.
- FastAPI `/docs`, `/redoc`, and `/openapi.json` exposure in protected production mode.
- Clear production fail-safe: an unset token currently leaves writes open by design and must not be accepted silently for production.

### Images 2 and 4 — Input handling plus data authorization: applicable after correction

Together these cover two distinct areas:

1. Validate every input at the server boundary: JSON bodies, path parameters, query parameters, headers, environment variables, database values, and third-party responses.
2. Ensure each endpoint exposes or modifies only intentionally public data and authorized functions.

Although classic multi-user IDOR does not apply, object/function authorization still matters because numeric watchlist IDs and all write functions are reachable over a public API.

### Image 3 — Secrets and API keys: fully applicable

Audit `APP_TOKEN`, CallMeBot credentials, Oracle/Vercel credentials, SSH keys, DNS/TLS credentials, GitHub tokens, environment files, SQLite data, backups, logs, and compiled frontend assets.

### Image 5 — Abuse and bot resistance: fully applicable

The public endpoints can trigger database work and outbound Yahoo Finance requests. The write endpoints can change alert behavior or trigger CallMeBot. Rate limits, request bounds, caching, concurrency, timeouts, and reverse-proxy controls are therefore required even though the app has one intended user.

### Image 6 — Secure deployment: fully applicable and expanded

Oracle Cloud does not provide a managed application security boundary. The audit must include the VM, SSH, network security lists, host firewall, reverse proxy, TLS, systemd unit, service account, filesystem, environment files, SQLite/backups, OS updates, logs, alerts, and recovery.

## Scope Inventory

### Application entry points

Inventory and verify every current route instead of relying on this snapshot:

- `GET /` — backend health/status response.
- `GET /api/status` — watchlist plus live third-party price lookups.
- `GET /api/history/{ticker}` — third-party historical-price lookup.
- `GET /api/watchlist` — stored watchlist data.
- `POST /api/watchlist` — protected create plus ATH initialization/outbound lookup.
- `PUT /api/watchlist/{item_id}` — protected update.
- `DELETE /api/watchlist/{item_id}` — protected delete.
- `GET /api/alerts` — paginated alert history.
- `GET /api/settings` — redacted settings state.
- `PUT /api/settings` — protected credential/configuration update.
- `POST /api/test-alert` — protected outbound WhatsApp action.
- FastAPI metadata routes: `/docs`, `/redoc`, and `/openapi.json`.
- Vercel SPA routes, static assets, manifest, and fallback rewrites.

### Trust boundaries and data flows

```text
User browser
  -> Vercel static frontend
  -> HTTPS API domain / reverse proxy
  -> FastAPI running as a systemd service
  -> SQLite database on VM disk
  -> Yahoo Finance / yfinance
  -> CallMeBot WhatsApp API

GitHub source
  -> manual VM clone/update and Vercel build

Oracle/Vercel/DNS accounts
  -> production infrastructure and deployment configuration
```

For each boundary, record authentication, authorization, encryption, validation, timeout, logging, failure, and recovery behavior.

## Phase 1 — Repository and Change Baseline

- [ ] **Not started:** Verify clean/dirty worktree and preserve unrelated user changes.
- [ ] **Not started:** Compare local HEAD, configured remote, and public `master` hash.
- [ ] **Not started:** Review every commit since the recorded baseline for new inputs, routes, dependencies, secrets, deployment assumptions, or data flows.
- [ ] **Not started:** Reconcile `README.md`, `CLAUDE.md`, deployment instructions, code, and this file; flag documentation drift.
- [ ] **Not started:** Inventory tracked and untracked configuration files, example env files, databases, certificates, keys, and deployment artifacts.
- [ ] **Not started:** Record language/runtime versions and lockfile state.

Evidence to retain: commands, hashes, relevant file/line references, and a short conclusion. Do not paste secrets or entire sensitive files.

## Phase 2 — Authentication and Administrative Writes

- [ ] **Not started:** Enumerate every state-changing route and prove that `APP_TOKEN` is enforced when configured.
- [ ] **Not started:** Test missing, empty, incorrect, malformed, duplicated, differently cased, and oversized `X-App-Token` headers.
- [ ] **Not started:** Check alternate methods, trailing slashes, encoded paths, and method-override headers for bypasses.
- [ ] **Not started:** Verify the comparison remains timing-safe and tokens are never returned.
- [ ] **Not started:** Verify production refuses or prominently detects unsafe open-write mode; decide whether fail-closed startup is required.
- [ ] **Not started:** Verify `/docs`, `/redoc`, and `/openapi.json` behavior with `APP_TOKEN` both set and unset before application import/startup.
- [ ] **Not started:** Assess `localStorage` exposure and document the security consequence: any successful same-origin XSS can read the administrative token.
- [ ] **Not started:** Define secure token generation entropy, rotation, revocation, incident response, and friend handoff procedures.
- [ ] **Not started:** Check CORS preflight and actual requests from the exact Vercel origin and hostile origins.
- [ ] **Not started:** Verify unauthorized responses do not leak whether a protected resource exists or expose sensitive internals.

Acceptance: all writes require the correct token in production, no bypass is found, the token never leaks, and the owner has a practical rotation/recovery procedure.

## Phase 3 — Authorization and Data Exposure

- [ ] **Not started:** Classify each response field as intentionally public or sensitive.
- [ ] **Not started:** Verify raw phone numbers and CallMeBot keys never appear in settings responses, errors, logs, API docs, or frontend state.
- [ ] **Not started:** Determine whether public watchlist, alert history, investment amounts, broker links, and market strategy are acceptable to expose without read authentication.
- [ ] **Not started:** Test direct object references for nonexistent, negative, huge, boolean-like, and malformed watchlist IDs.
- [ ] **Not started:** Confirm mass assignment cannot set model/internal fields not present in approved request schemas.
- [ ] **Not started:** Check deletion/update consistency across watchlist and ATH tracker records.
- [ ] **Not started:** Verify pagination cannot bypass bounds or disclose unintended data.
- [ ] **Not started:** Verify response models do not accidentally serialize future database columns or secrets.

Decision required during audit: either formally accept public reads or add read authentication. Do not silently treat “single user” as authorization.

## Phase 4 — Input Validation, Injection, and Output Safety

- [ ] **Not started:** Build an input matrix for every body, path, query, header, and environment variable.
- [ ] **Not started:** Test required/optional fields, exact bounds, Unicode, control characters, whitespace, numeric edge cases, `NaN`, infinity, duplicate JSON keys, wrong content types, and oversized bodies.
- [ ] **Not started:** Validate ticker syntax consistently on create, history lookup, database reads, and third-party calls.
- [ ] **Not started:** Verify `display_name` cannot produce stored/reflected DOM injection or malicious WhatsApp content.
- [ ] **Not started:** Verify `broker_url` rejects non-HTTPS schemes, userinfo tricks, malformed hosts, control characters, and unsafe navigation targets.
- [ ] **Not started:** Review SQLModel/SQLAlchemy usage for string-built SQL, unsafe migrations, and injection opportunities.
- [ ] **Not started:** Search for `dangerouslySetInnerHTML`, raw DOM HTML insertion, `eval`, dynamic script creation, command execution, unsafe deserialization, and template injection.
- [ ] **Not started:** Verify React output encoding and external link protections (`noopener`, `noreferrer`, destination restrictions where appropriate).
- [ ] **Not started:** Test malformed/untrusted responses from Yahoo Finance and CallMeBot for crashes, invalid calculations, or unsafe rendering.
- [ ] **Not started:** Verify FastAPI validation errors and exception responses do not expose stack traces, filesystem paths, SQL, secrets, or environment details.

Acceptance: invalid data is rejected server-side before database or network side effects, and untrusted data cannot become code, markup, commands, or unsafe navigation.

## Phase 5 — Secrets and Sensitive Data

- [ ] **Not started:** Scan the current tree for high-entropy values and known credential formats.
- [ ] **Not started:** Scan Git history, branches, tags, and deleted files; a secret removed from HEAD is still compromised.
- [ ] **Not started:** Review GitHub secret-scanning/Dependabot status where accessible.
- [ ] **Not started:** Build the production frontend and scan emitted assets/source maps for secrets and unintended environment values.
- [ ] **Not started:** Verify only `VITE_` variables intended to be public are included in the browser build.
- [ ] **Not started:** Audit Oracle systemd environment storage, shell history, process listings, journald, reverse-proxy logs, backups, and file permissions.
- [ ] **Not started:** Audit SQLite file and backup permissions; CallMeBot credentials are stored there in plaintext and require host-level protection.
- [ ] **Not started:** Check outbound CallMeBot URLs: phone/key are query parameters and must not be logged by application, HTTP client, proxy, monitoring, or exception tooling.
- [ ] **Not started:** Confirm TLS verification is enabled for all outbound HTTPS calls.
- [ ] **Not started:** Define credential rotation after leakage and before ownership transfer.
- [ ] **Not started:** Ensure examples, screenshots, test fixtures, documentation, and issue/PR text contain no real credentials or personal phone numbers.

Acceptance: no repository/history/build leakage, least-readable production storage, redacted logs, protected backups, and documented rotation.

## Phase 6 — Abuse, Rate Limits, and Resource Consumption

- [ ] **Not started:** Measure which endpoints cause outbound network requests, database scans, writes, scheduler changes, or messaging side effects.
- [ ] **Not started:** Assess `/api/status` fan-out across all active assets and repeated `yfinance` calls.
- [ ] **Not started:** Assess `/api/history/{ticker}` scraping and its `days` bound.
- [ ] **Not started:** Assess watchlist creation triggering ATH refresh and third-party calls.
- [ ] **Not started:** Verify page/page-size bounds and replace full-table count patterns if they create avoidable load.
- [ ] **Not started:** Test request body limits, header limits, connection timeouts, worker timeouts, and maximum concurrent requests.
- [ ] **Not started:** Review the test-alert cooldown: it is in-memory, per process, resets on restart, and is not a general rate limiter.
- [ ] **Not started:** Define reverse-proxy limits for public reads, protected writes, and expensive/outbound endpoints.
- [ ] **Not started:** Verify upstream timeouts, retry limits, circuit-breaking/backoff behavior, and failure isolation for Yahoo Finance and CallMeBot.
- [ ] **Not started:** Check scheduler overlap, duplicate jobs, restart behavior, SQLite locking, and unbounded logs/database growth.
- [ ] **Not started:** Verify error responses do not amplify load and that failed outbound calls do not consume alert state incorrectly.

Production acceptance: reasonable per-IP/request limits, bounded payloads and concurrency, outbound timeouts, scheduler safety, and no trivial unauthenticated resource-exhaustion path.

## Phase 7 — Frontend and Browser Security

- [ ] **Not started:** Validate the deployed Content Security Policy against actual frontend resources and API domain.
- [ ] **Not started:** Minimize/remove CSP allowances such as `'unsafe-inline'` where feasible; document any required exception.
- [ ] **Not started:** Verify `connect-src` is no broader than required; `https:` permits every HTTPS destination and may weaken containment.
- [ ] **Not started:** Verify clickjacking protection through CSP `frame-ancestors` and headers.
- [ ] **Not started:** Verify HSTS, referrer policy, MIME sniffing protection, permissions policy, and cache behavior on sensitive responses.
- [ ] **Not started:** Check source maps, development artifacts, verbose console logging, React errors, and exposed environment/configuration.
- [ ] **Not started:** Test token persistence/removal, failed-token UX, shared-device risk, and browser logout/clear procedure.
- [ ] **Not started:** Review PWA manifest/service-worker behavior if a service worker is introduced; ensure sensitive API responses are never cached.
- [ ] **Not started:** Verify all external navigation and dynamic content under realistic hostile stored data.

## Phase 8 — Dependencies and Software Supply Chain

- [ ] **Not started:** Run the committed frontend test, lint, and build commands with the required Node version.
- [ ] **Not started:** Run `npm.cmd audit` for production and full dependency sets; record exact advisories and reachability.
- [ ] **Not started:** Validate `package-lock.json` integrity and investigate unexpected lifecycle scripts.
- [ ] **Not started:** Run Python dependency consistency and vulnerability checks against `backend/requirements.txt` and the actual virtual environment.
- [ ] **Not started:** Review direct dependency pins, transitive exposure, abandoned packages, and security-supported runtime versions.
- [ ] **Not started:** Audit GitHub Actions if workflows are added: pin third-party actions, minimize permissions, protect secrets, and avoid untrusted script interpolation.
- [ ] **Not started:** Verify VM installation/update commands use trusted repositories and do not pipe unauthenticated remote scripts into a shell.
- [ ] **Not started:** Establish an update cadence and regression checks after dependency upgrades.

Tools may include npm audit, pip check, pip-audit/OSV, GitHub Dependabot/secret scanning, and a reputable secret scanner. Tool output is evidence to investigate, not an automatic vulnerability verdict.

## Phase 9 — Oracle Cloud VM and Network Hardening

- [ ] **Not started:** Record OS image/version, architecture, tenancy/compartment, region, and responsible owner without exposing account identifiers.
- [ ] **Not started:** Verify Oracle network security lists/NSGs expose only required ports.
- [ ] **Not started:** Verify host firewall rules independently of Oracle controls.
- [ ] **Not started:** Restrict SSH to keys; disable password login and direct root login; review authorized keys and recovery access.
- [ ] **Not started:** Prefer source-IP restriction or a secure administrative access path for SSH where practical.
- [ ] **Not started:** Run uvicorn as a dedicated unprivileged service account, never root.
- [ ] **Not started:** Bind uvicorn to loopback/private interface so port 8000 is not publicly reachable.
- [ ] **Not started:** Expose only reverse-proxy ports 80/443 publicly; redirect HTTP to HTTPS.
- [ ] **Not started:** Review the systemd unit: absolute paths, restricted environment file, restart policy, working directory, resource limits, and sandboxing directives.
- [ ] **Not started:** Ensure repository, virtualenv, SQLite database, environment file, and backups have least-privilege ownership/modes.
- [ ] **Not started:** Enable timely OS security updates and define reboot/maintenance handling.
- [ ] **Not started:** Remove/disable unused packages, services, default accounts, and listening ports.
- [ ] **Not started:** Configure time synchronization; scheduler and certificate behavior depend on correct time.
- [ ] **Not started:** Establish disk, memory, CPU, process, certificate-expiry, and service-health monitoring.

## Phase 10 — Reverse Proxy, TLS, DNS, CORS, and Headers

- [ ] **Not started:** Verify domain ownership and DNS records point only to the intended VM.
- [ ] **Not started:** Verify Caddy/nginx configuration from the real file, not only deployment instructions.
- [ ] **Not started:** Verify valid certificate chain, hostname, renewal, modern protocols/ciphers, and failure alerting.
- [ ] **Not started:** Prevent direct origin bypass and untrusted `Host`/forwarded-header behavior.
- [ ] **Not started:** Set safe request/header/body limits, timeouts, and rate limits at the proxy.
- [ ] **Not started:** Ensure access/error logs redact query strings or otherwise cannot capture secrets.
- [ ] **Not started:** Set `FRONTEND_ORIGIN` to the exact production Vercel origin; test previews and custom domains deliberately rather than using wildcards.
- [ ] **Not started:** Verify preflight responses do not combine permissive origins, credentials, methods, or headers unexpectedly.
- [ ] **Not started:** Verify security headers on backend successes, validation errors, authentication failures, 404/405 responses, and proxy-generated errors.
- [ ] **Not started:** Verify Vercel headers on HTML, JS, CSS, manifest, icons, SPA fallbacks, and errors.
- [ ] **Not started:** Evaluate whether `includeSubDomains` in HSTS is safe for every subdomain before retaining it.

## Phase 11 — Database, Backups, Privacy, and Recovery

- [ ] **Not started:** Confirm the actual SQLite path is outside the repository and survives service updates/reboots.
- [ ] **Not started:** Verify only the service account and authorized administrator can read the database.
- [ ] **Not started:** Check SQLite concurrency, transactions, integrity, migration idempotence, and recovery after interrupted writes.
- [ ] **Not started:** Define backup frequency, encryption, retention, off-host storage, and deletion.
- [ ] **Not started:** Perform a restore drill into an isolated location; an untested backup is not a recovery control.
- [ ] **Not started:** Ensure backup copies do not spread CallMeBot credentials indefinitely.
- [ ] **Not started:** Define alert-history/log retention and a process for removing the friend’s data and credentials.
- [ ] **Not started:** Verify deployment/update rollback does not destroy or expose the database.
- [ ] **Not started:** Document disaster recovery for VM loss, domain loss, token loss, and credential compromise.

## Phase 12 — Logging, Detection, and Incident Response

- [ ] **Not started:** Inventory application, systemd/journald, reverse-proxy, Oracle, Vercel, DNS, and GitHub logs.
- [ ] **Not started:** Verify logs capture useful security events: failed write authorization, rate-limit triggers, service restarts, scheduler failures, upstream failures, and repeated invalid requests.
- [ ] **Not started:** Ensure logs do not contain tokens, credentials, full CallMeBot URLs, phone numbers, sensitive request bodies, or stack traces in production.
- [ ] **Not started:** Configure log rotation and disk limits.
- [ ] **Not started:** Define alerting thresholds and who receives alerts.
- [ ] **Not started:** Write concise response steps for leaked `APP_TOKEN`, leaked CallMeBot key, compromised SSH key, VM compromise, dependency advisory, and anomalous messaging.
- [ ] **Not started:** Preserve evidence safely without copying secrets into public systems.

## Phase 13 — Automated and Manual Verification

Minimum local regression suite (confirm commands from current `CLAUDE.md` first):

```powershell
backend\.venv\Scripts\python backend\test_logic.py
backend\.venv\Scripts\python backend\test_security.py
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
backend\.venv\Scripts\python -m pip check
npm.cmd --prefix frontend audit --omit=dev
```

Expand `backend/test_security.py` or a proper test suite to cover, after approval:

- Every protected write route with missing/wrong/correct tokens.
- Open/protected docs behavior across clean process starts.
- CORS allowed and denied origins/preflights.
- Validation boundaries and oversized/malformed inputs.
- Redaction on settings success and error paths.
- Security headers across success/error/not-found/method-not-allowed responses.
- Rate-limit behavior where implemented.
- No side effects after rejected requests.
- Legacy SQLite migration/startup security invariants.

Manual browser/runtime checks must include desktop and mobile layouts because the access-token field and management actions must remain usable without exposing secrets.

## Phase 14 — Staging and Production Verification

Do not begin until authorized URLs exist.

### Required target inventory

| Target | URL/identifier | Owner confirmed | Data class | Authorized test level |
|---|---|---|---|---|
| Vercel frontend | Not deployed | No | None yet | Pending |
| HTTPS backend domain | Not deployed | No | None yet | Pending |
| Oracle VM | Not provisioned/recorded | No | None yet | Pending |
| Disposable staging | Not available | No | Synthetic only | Pending |

### Safe live checks

- [ ] **Not started:** DNS and certificate validation.
- [ ] **Not started:** Public-port and direct-uvicorn exposure check limited to the authorized IP/hostname.
- [ ] **Not started:** HTTP-to-HTTPS redirect and HSTS behavior.
- [ ] **Not started:** Vercel CSP/security headers and backend security headers.
- [ ] **Not started:** Exact CORS behavior.
- [ ] **Not started:** API docs disabled in protected mode.
- [ ] **Not started:** Unauthorized writes rejected without persistent mutation.
- [ ] **Not started:** Low-volume rate-limit and malformed-request checks.
- [ ] **Not started:** Error and information-disclosure checks.
- [ ] **Not started:** Service restart, certificate renewal, monitoring, backup, and restore evidence.

No high-volume load testing against production. Use a disposable staging VM/database for broader concurrency or failure-injection tests.

## Severity and Decision Rules

| Severity | Meaning | Typical examples for this app |
|---|---|---|
| Critical | Immediate compromise of infrastructure or sensitive credentials; trivial destructive control | Public SSH key compromise with access, exposed cloud credential, unauthenticated arbitrary code execution |
| High | Practical unauthorized administrative action or secret disclosure | Production writes open to the internet, exposed CallMeBot key, public uvicorn/debug interface with exploitable weakness |
| Medium | Meaningful security/availability weakness requiring conditions or limited impact | Missing rate limit on expensive public calls, overly broad CORS/CSP, sensitive strategy/history unintentionally public |
| Low | Defense-in-depth weakness with limited direct impact | Minor header inconsistency, excessive version disclosure, weak operational documentation |
| Informational | Observation or improvement without a demonstrated vulnerability | Optional hardening, accepted architectural limitation |

Severity must consider likelihood, impact, exposure, exploit prerequisites, existing controls, and the single-user/personal nature of the system. Do not inflate scanner output without confirming reachability and impact.

## Findings Ledger

Add one section per confirmed finding using this template:

```markdown
### SEC-001 — Short finding title

- Status: Open | Accepted risk | Fix approved | Fixed, pending retest | Closed
- Severity: Critical | High | Medium | Low | Informational
- First observed: YYYY-MM-DD
- Last verified: YYYY-MM-DD
- Affected version/commit:
- Affected component/endpoint:
- Environment: Source | Local | Staging | Production
- Evidence: Redacted commands, responses, file/line references, or screenshots
- Reproduction: Minimal safe steps
- Expected behavior:
- Actual behavior:
- Security impact:
- Root cause:
- Recommended remediation:
- Scope/compatibility considerations:
- Fix commit/PR:
- Retest evidence:
- Residual risk:
```

### Current findings

### SEC-001 — Auto-deploy rollback did not cover every post-pull failure

- Status: Fixed locally, pending VM retest
- Severity: Medium
- First observed: 2026-06-21
- Last verified: 2026-06-21
- Affected version/commit: Uncommitted deployment automation based on `d0e60dd`
- Affected component/endpoint: `deploy/deploy.sh`
- Environment: Source/local review; not yet installed on a VM
- Evidence: The original script rolled back explicit test/health failures only. A failed dependency installation, service restart, or other command after `git pull` could leave the checkout on the new commit while the old process continued running. Its dependency-change check was also performed after `reset --hard`, making the comparison empty.
- Security impact: Deployment state could diverge from the running process and automatic recovery could silently fail.
- Root cause: Failure handling was branch-specific rather than centralized around the complete post-update transaction.
- Remediation: Added ERR/signal failure handling, persistent pre-update state, dependency restoration, health verification after rollback, and a regression assertion.
- Retest evidence: Local regression checks and Bash syntax pass; actual systemd/VM failure injection remains required.
- Residual risk: Python dependency rollback is not a fully atomic virtual-environment swap. A future major dependency change should be deployed through versioned release directories/venvs if stronger atomicity is required.

### SEC-002 — Live SQLite backup used a raw file copy

- Status: Fixed locally, pending VM retest
- Severity: Medium
- First observed: 2026-06-21
- Last verified: 2026-06-21
- Affected version/commit: Uncommitted deployment automation based on `d0e60dd`
- Affected component/endpoint: `deploy/deploy.sh`
- Environment: Source/local review; not yet installed on a VM
- Evidence: The original `cp "$DB_PATH" "$dest"` could race with a live SQLite write and did not verify backup integrity.
- Security impact: A backup accepted as recoverable could be inconsistent or unusable during incident recovery.
- Root cause: Filesystem copying was treated as an application-consistent database snapshot.
- Remediation: Added `backup_sqlite.py` using SQLite's online backup API, destination integrity checking, cleanup on failure, and mode `0600`.
- Retest evidence: Automated test creates a database, backs it up, verifies `PRAGMA integrity_check`, and verifies preserved data.
- Residual risk: A real VM restore drill is still required.

### SEC-003 — Failed releases could be retried indefinitely

- Status: Fixed locally, pending VM retest
- Severity: Medium
- First observed: 2026-06-21
- Last verified: 2026-06-21
- Affected component/endpoint: `deploy/deploy.sh`, `dip-alert-deploy.service`
- Environment: Source/local review; not yet installed on a VM
- Evidence: After rollback, `origin/master` still pointed to the rejected commit, so the five-minute timer would attempt it again. Exit code `1` was also configured as successful in systemd, masking failed releases.
- Security impact: Repeated test/restart/rollback cycles, noisy logs, unnecessary downtime, and weak failure detection.
- Root cause: No rejected-release state and an incorrect assumption that a failed oneshot would stop the timer chain.
- Remediation: Added failed-commit quarantine until `master` advances and restored nonzero systemd failure visibility.
- Retest evidence: Structural regression checks pass; a VM rollback drill remains required.
- Residual risk: Monitoring/alert delivery for a failed deploy must be configured on the actual VM.

### SEC-004 — Initial service-account setup did not create the documented home

- Status: Fixed locally, pending VM setup verification
- Severity: Low
- First observed: 2026-06-21
- Last verified: 2026-06-21
- Affected component/endpoint: `deploy/README.md`
- Environment: Setup documentation
- Evidence: The original setup did not explicitly create `/home/dipalert`, but the next command cloned into that path as `dipalert`. A follow-up `mkdir` fixed the directory only; the remaining Debian-style `adduser --group` command was itself incompatible with Oracle Linux's `adduser`/`useradd` interface.
- Security impact: One-time deployment could fail or require unsafe ad-hoc ownership changes.
- Remediation: Setup now uses cross-family `useradd --system --user-group --create-home`, idempotently enforces the home ownership/mode, uses a non-login shell, restricts database directories, and documents privileged installation of the executable script.
- Retest evidence: Regression assertions reject the incompatible Debian `adduser --group` form and require the portable home-creation commands; real Oracle setup remains required.

## Audit Session Log

Append, do not overwrite:

| Date | Commit/target | Work performed | Evidence summary | Findings changed | Next action |
|---|---|---|---|---|---|
| 2026-06-21 | `d0e60dd` source baseline | Created audit plan and ledger; no security tests executed as part of document creation | Local and public GitHub baseline were matched before writing | None | Begin Phase 1 in a future authorized audit session |
| 2026-06-21 | Local uncommitted deployment automation on `d0e60dd` | Reviewed all deploy assets, compared public GitHub, ran application/build/dependency checks, added deployment safety regressions, and fixed rollback/backup/retry/setup gaps | Local GitHub remained `d0e60dd`; deploy tests and Bash syntax passed after fixes; npm and Python audits reported zero known vulnerabilities | Added SEC-001 through SEC-004 | Commit/push only after review; then perform the documented real-VM installation and rollback drill |

## Completion Gate Before Friend Handoff

The application is not security-approved merely because automated tests pass. All of the following are required:

- [ ] Local, public GitHub, staging, and intended production revisions are identified and consistent.
- [ ] Every endpoint/input/data flow is inventoried and tested at the appropriate layer.
- [ ] Production has `APP_TOKEN` set, all writes are protected, and token rotation is documented.
- [ ] Public-read exposure is explicitly accepted or protected.
- [ ] No real secret exists in source, Git history, frontend bundles, logs, screenshots, or documentation.
- [ ] Oracle VM, SSH, firewall, systemd, filesystem, reverse proxy, TLS, DNS, CORS, and headers meet the stated controls.
- [ ] Uvicorn is not directly reachable from the public internet.
- [ ] Rate limits and resource bounds protect expensive and side-effecting endpoints.
- [ ] SQLite and credential backups are access-controlled, encrypted where appropriate, and restore-tested.
- [ ] Dependency findings are resolved, mitigated, or explicitly accepted with rationale.
- [ ] Automated regression suites and safe live probes pass on the exact release candidate.
- [ ] No unresolved Critical or High finding remains.
- [ ] Every fixed finding has independent retest evidence.
- [ ] The friend receives a secure setup, credential entry, rotation, backup, update, and incident-response guide.

## Reference Standards

Use current official versions during the actual audit and record the version/date consulted:

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [OWASP API Security Top 10 — 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [GitHub secret scanning documentation](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning)
- [Vercel security documentation](https://vercel.com/docs/security)
- [Oracle Cloud security documentation](https://docs.oracle.com/en-us/iaas/Content/Security/Concepts/security_guide.htm)
- [Caddy documentation](https://caddyserver.com/docs/) or [nginx documentation](https://nginx.org/en/docs/), matching the deployed reverse proxy

These sources define coverage; the application’s actual code, configuration, and runtime behavior determine the findings.

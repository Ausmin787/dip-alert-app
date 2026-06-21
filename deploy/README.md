# Backend auto-deploy (Oracle Cloud VM)

Pull-based deployment for the Dip Alert backend. A `systemd` timer on the VM
polls GitHub every few minutes; when `master` has new commits it runs a safe
deploy (consistent DB backup → pull → install → **test gate** → restart →
**health check**) and **auto-rolls-back** to the previous commit if any
post-update step fails. A rejected commit is quarantined until `master` advances,
so the VM does not retry the same broken release every five minutes.

**Why pull-based:** no SSH keys, IPs, or secrets ever leave the VM or land in
the repo. The friend does nothing — you just `git push`, and the VM updates
itself within the poll interval. The frontend keeps auto-deploying on Vercel.

> Prerequisite: the VM already serves HTTPS via a reverse proxy (Caddy or
> nginx + Let's Encrypt) in front of the backend — see the main `README.md`.
> uvicorn binds to `127.0.0.1:8000`; the proxy terminates TLS and forwards to it.

---

## Files in this directory

| File | Installs to | Purpose |
|---|---|---|
| `dip-alert.service` | `/etc/systemd/system/` | Long-running backend (uvicorn) |
| `dip-alert-deploy.service` | `/etc/systemd/system/` | One-shot that runs `deploy.sh` |
| `dip-alert-deploy.timer` | `/etc/systemd/system/` | Fires the one-shot every 5 min |
| `deploy.sh` | stays in repo (`deploy/`) | The deploy logic |
| `backup_sqlite.py` | stays in repo (`deploy/`) | Consistent live SQLite backup helper |
| `test_deploy_safety.py` | stays in repo (`deploy/`) | Deployment regression checks |
| `dip-alert.env.example` | copy to `/etc/dip-alert/dip-alert.env` | App secrets / config (NOT in git) |
| `deploy-alert.env.example` | copy to `/etc/dip-alert/deploy-alert.env` | Optional deploy-failure alert creds (deploy-only, NOT in git) |
| `10-dipalert-deploy.sudoers` | `/etc/sudoers.d/` | Lets `dipalert` restart only this service |

---

## One-time setup (run once over SSH)

Paths below assume the service account `dipalert` and checkout at
`/home/dipalert/dip-alert-app`. Adjust if you use different ones (and update the
`*.service`, `deploy.sh`, and sudoers paths to match).

```bash
# 1. Unprivileged service account with the checkout's expected home directory.
#    Use useradd directly: Debian's adduser wrapper and Oracle/RHEL's adduser
#    alias accept different flags. These useradd options work on both families.
if ! id -u dipalert >/dev/null 2>&1; then
  sudo useradd --system --user-group --create-home \
    --home-dir /home/dipalert --shell /sbin/nologin dipalert
fi
sudo install -d -m 0750 -o dipalert -g dipalert /home/dipalert

# 2. Clone the repo as that user
sudo -u dipalert git clone https://github.com/Ausmin787/dip-alert-app \
  /home/dipalert/dip-alert-app

# 3. Python venv + deps
cd /home/dipalert/dip-alert-app/backend
sudo -u dipalert python3 -m venv .venv
sudo -u dipalert .venv/bin/pip install -r requirements.txt

# 4. Persistent DB + backups dir, owned by the service account
sudo mkdir -p /var/lib/dip-alert/backups
sudo chown -R dipalert:dipalert /var/lib/dip-alert
sudo chmod 700 /var/lib/dip-alert /var/lib/dip-alert/backups
#   If a DB already exists from an earlier manual run, move it here once:
#   sudo mv /home/dipalert/dip-alert-app/backend/dip_alert.db /var/lib/dip-alert/dip_alert.db
#   sudo chown dipalert:dipalert /var/lib/dip-alert/dip_alert.db

# 5. Secrets / config file (outside the checkout)
sudo mkdir -p /etc/dip-alert
sudo cp /home/dipalert/dip-alert-app/deploy/dip-alert.env.example \
  /etc/dip-alert/dip-alert.env
sudo nano /etc/dip-alert/dip-alert.env       # set APP_TOKEN + FRONTEND_ORIGIN
sudo chown root:root /etc/dip-alert/dip-alert.env
sudo chmod 600 /etc/dip-alert/dip-alert.env
#   Optional deploy-failure alert creds (deploy-only; skip to disable alerts):
#   sudo cp /home/dipalert/dip-alert-app/deploy/deploy-alert.env.example \
#     /etc/dip-alert/deploy-alert.env
#   sudo nano /etc/dip-alert/deploy-alert.env  # set DEPLOY_ALERT_PHONE + _APIKEY
#   sudo chown root:root /etc/dip-alert/deploy-alert.env
#   sudo chmod 600 /etc/dip-alert/deploy-alert.env

# 6. Install the systemd units + sudoers drop-in
cd /home/dipalert/dip-alert-app/deploy
sudo cp dip-alert.service dip-alert-deploy.service dip-alert-deploy.timer \
  /etc/systemd/system/
sudo install -m 0440 -o root -g root 10-dipalert-deploy.sudoers \
  /etc/sudoers.d/10-dipalert-deploy
sudo visudo -c                               # MUST report "parsed OK"
sudo chmod 0755 deploy.sh

# 7. Enable + start the backend and the deploy timer
sudo systemctl daemon-reload
sudo systemctl enable --now dip-alert.service dip-alert-deploy.timer

# 8. Verify
curl http://127.0.0.1:8000/                  # -> {"app":"Dip Alert","status":"running"}
systemctl status dip-alert.service           # active (running)
systemctl list-timers dip-alert-deploy.timer # shows next fire time
```

> **sudoers path check:** if `command -v systemctl` is **not** `/usr/bin/systemctl`,
> edit the two paths in `/etc/sudoers.d/10-dipalert-deploy` to match, then
> re-run `sudo visudo -c`.

---

## Day-to-day (the payoff)

1. Fix the bug locally, run the same gate the VM will run:
   `backend\.venv\Scripts\python test_logic.py` and `… test_security.py`.
2. `git commit` and `git push` to `master`.
3. Vercel redeploys the frontend automatically. Within ~5 min the VM timer
   picks up the backend change, deploys it safely, and **rolls back on its own**
   if any post-update step fails. The failed commit stays quarantined until you
   push a newer commit. **The friend does nothing.**

Before pushing deployment-file changes, also run:

```powershell
backend\.venv\Scripts\python deploy\test_deploy_safety.py
& 'C:\Program Files\Git\bin\bash.exe' -n deploy/deploy.sh
```

**Deploy now instead of waiting for the timer:**
```bash
sudo -u dipalert /home/dipalert/dip-alert-app/deploy/deploy.sh
```

**See what happened:**
```bash
journalctl -u dip-alert-deploy.service -n 50   # last deploy run
journalctl -u dip-alert.service -f             # live app logs
```

> Changes to files copied into `/etc` (`*.service`, `*.timer`, or the sudoers
> drop-in) are not installed by a normal code deployment. Re-copy those files,
> run `sudo systemctl daemon-reload`, validate sudoers when applicable, and
> restart the affected unit during an authorized maintenance session.

**Deploy-failure alerts (optional — to you, not the friend):** create
`/etc/dip-alert/deploy-alert.env` from `deploy-alert.env.example` (root:root,
chmod 600) and set `DEPLOY_ALERT_PHONE` + `DEPLOY_ALERT_APIKEY` (your *own*
CallMeBot phone + key, from the same one-time CallMeBot handshake in the main
`README.md`). When a release fails its test/health gate and is rolled back,
`deploy.sh` makes one best-effort WhatsApp attempt naming the rejected commit —
fired **once per bad commit** (it's quarantined immediately after, so no repeat
spam; delivery isn't guaranteed if CallMeBot/network is down). Leave both blank
to disable. Kept in a separate file (not `dip-alert.env`) so the internet-facing
app process never carries these creds. The deploy unit already references it via
`EnvironmentFile=-/etc/dip-alert/deploy-alert.env` and re-reads it on every run,
so **creating or editing the file needs no `daemon-reload`** — the next deploy
tick picks it up (daemon-reload is only for changing the unit definition itself).
**Not** alerted: pre-update refusals (dirty checkout, non-fast-forward, or a
failed `git fetch`) — those simply don't deploy and show up as your push not
landing plus a line in `journalctl`.

**Change the poll interval:** edit `OnUnitActiveSec=` in
`/etc/systemd/system/dip-alert-deploy.timer`, then
`sudo systemctl daemon-reload && sudo systemctl restart dip-alert-deploy.timer`.

---

## Recovery notes

- **Auto-rollback reverts code only.** Migrations are additive (new columns
  only), so the previous build runs fine against the current DB. The DB is
  **not** auto-restored — that would discard alerts logged since the backup.
- **Manual DB restore** (only if a migration corrupted data):
  ```bash
  sudo systemctl stop dip-alert.service
  sudo -u dipalert cp /var/lib/dip-alert/backups/dip_alert.<stamp>.db \
    /var/lib/dip-alert/dip_alert.db
  sudo systemctl start dip-alert.service
  ```
  The last 10 backups are kept under `/var/lib/dip-alert/backups/`.
- **Failed-commit quarantine:** after a rollback, the rejected SHA is stored in
  `/var/lib/dip-alert/backups/blocked-commit`. A newer push is attempted
  normally. To deliberately retry the same SHA after an external outage, remove
  that file and start `dip-alert-deploy.service` manually.
- **Pin to a known-good commit** (stops auto-updates until you push again past it
  — note the next push to `master` will move it forward again):
  ```bash
  sudo -u dipalert git -C /home/dipalert/dip-alert-app reset --hard <good-sha>
  sudo systemctl restart dip-alert.service
  ```

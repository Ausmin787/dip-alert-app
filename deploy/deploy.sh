#!/usr/bin/env bash
#
# Safe pull-based deploy for the Dip Alert backend on the Oracle Cloud VM.
#
# Run by the dip-alert-deploy.timer every few minutes (or manually as the
# dipalert user). It is a no-op when master has no new commits, so it is cheap
# to run on a tight schedule. On a real update it:
#   fetch -> backup DB -> pull -> (pip install if reqs changed) -> test gate
#   -> restart service -> health check, with auto-rollback to the previous
#   commit if any post-update step fails. A failed commit is quarantined until
#   master advances again, preventing a five-minute rollback/retry loop.
#
# Rollback reverts CODE ONLY. The app's migrations are additive (new columns
# only), so older code runs fine against a newer DB. The DB is NOT auto-restored
# (that would discard alerts logged since the backup) — backups under
# $BACKUP_DIR are kept for MANUAL recovery if a migration ever goes wrong.

set -Eeuo pipefail

# --- config -----------------------------------------------------------------
REPO_DIR="/home/dipalert/dip-alert-app"
BACKEND_DIR="$REPO_DIR/backend"
VENV_PY="$BACKEND_DIR/.venv/bin/python"
VENV_PIP="$BACKEND_DIR/.venv/bin/pip"
DB_PATH="/var/lib/dip-alert/dip_alert.db"
BACKUP_DIR="/var/lib/dip-alert/backups"
SERVICE="dip-alert.service"
HEALTH_URL="http://127.0.0.1:8000/"
BRANCH="master"
KEEP_BACKUPS=10
HEALTH_RETRIES=10
LOCK_FILE="/tmp/dip-alert-deploy.lock"
BLOCKED_COMMIT_FILE="$BACKUP_DIR/blocked-commit"

UPDATED=0
REQS_CHANGED=0
REMOTE=""

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# --- single-instance lock ---------------------------------------------------
# Re-exec under flock so two timer firings (or a manual run colliding with the
# timer) can never deploy at the same time.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another deploy is already running; exiting."
  exit 0
fi

cd "$BACKEND_DIR"
PREV="$(git -C "$REPO_DIR" rev-parse HEAD)"

health_check() {
  local i
  for ((i = 1; i <= HEALTH_RETRIES; i++)); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      log "health check OK (attempt $i)"
      return 0
    fi
    log "health check attempt $i/$HEALTH_RETRIES failed; retrying..."
    sleep $((i < 5 ? 2 : 4))
  done
  return 1
}

rollback() {
  local original_rc="$1"
  local rollback_ok=1
  trap - ERR INT TERM
  set +e

  mkdir -p "$BACKUP_DIR"
  printf '%s\n' "$REMOTE" >"$BLOCKED_COMMIT_FILE"
  log "ROLLBACK: reverting code to $PREV"
  git -C "$REPO_DIR" reset --hard "$PREV" || rollback_ok=0
  if ((REQS_CHANGED)); then
    log "ROLLBACK: restoring dependencies for $PREV"
    "$VENV_PIP" install -r "$BACKEND_DIR/requirements.txt" || rollback_ok=0
  fi
  sudo systemctl restart "$SERVICE" || rollback_ok=0
  health_check || rollback_ok=0

  if ((rollback_ok)); then
    log "ROLLBACK complete; service healthy on $PREV"
  else
    log "ROLLBACK INCOMPLETE; manual recovery is required"
  fi
  log "commit ${REMOTE:0:8} quarantined until origin/$BRANCH advances"
  exit "$original_rc"
}

deploy_error() {
  local rc=$?
  ((rc == 0)) && rc=1
  if ((UPDATED)); then
    log "deployment failed after updating the checkout (exit $rc)"
    rollback "$rc"
  fi
  trap - ERR INT TERM
  log "deployment failed before changing the checkout (exit $rc); service unchanged"
  exit "$rc"
}

backup_db() {
  if [[ -f "$DB_PATH" ]]; then
    mkdir -p "$BACKUP_DIR"
    local stamp dest
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    dest="$BACKUP_DIR/dip_alert.$stamp.db"
    "$VENV_PY" "$REPO_DIR/deploy/backup_sqlite.py" "$DB_PATH" "$dest"
    log "DB backed up -> $dest"
    # prune to the most recent $KEEP_BACKUPS
    ls -1t "$BACKUP_DIR"/dip_alert.*.db 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
  else
    log "no DB at $DB_PATH yet (first run?), skipping backup"
  fi
}

trap deploy_error ERR
trap deploy_error INT TERM

# --- 1. is there anything new? ---------------------------------------------
if [[ -n "$(git -C "$REPO_DIR" status --porcelain --untracked-files=no)" ]]; then
  log "tracked checkout changes detected; refusing automatic deployment"
  exit 1
fi
git -C "$REPO_DIR" fetch --quiet origin "$BRANCH"
REMOTE="$(git -C "$REPO_DIR" rev-parse "origin/$BRANCH")"
if [[ "$PREV" == "$REMOTE" ]]; then
  log "up to date at ${PREV:0:8}; nothing to deploy."
  exit 0
fi
if [[ -f "$BLOCKED_COMMIT_FILE" ]] && [[ "$(<"$BLOCKED_COMMIT_FILE")" == "$REMOTE" ]]; then
  log "commit ${REMOTE:0:8} previously failed; waiting for origin/$BRANCH to advance"
  exit 0
fi
if ! git -C "$REPO_DIR" merge-base --is-ancestor "$PREV" "$REMOTE"; then
  log "origin/$BRANCH is not a fast-forward from $PREV; refusing deployment"
  exit 1
fi
if git -C "$REPO_DIR" diff --name-only "$PREV" "$REMOTE" | grep -q '^backend/requirements.txt$'; then
  REQS_CHANGED=1
fi
log "new commits: ${PREV:0:8} -> ${REMOTE:0:8}; deploying."

# --- 2. backup + pull -------------------------------------------------------
backup_db
git -C "$REPO_DIR" pull --ff-only origin "$BRANCH"
UPDATED=1

# --- 3. install deps only if requirements.txt changed -----------------------
if ((REQS_CHANGED)); then
  log "requirements.txt changed; installing deps"
  "$VENV_PIP" install -r "$BACKEND_DIR/requirements.txt"
else
  log "requirements.txt unchanged; skipping pip install"
fi

# --- 4. test gate (service still running OLD code at this point) -------------
log "running test gate..."
"$VENV_PY" -m compileall -q "$BACKEND_DIR/app"
"$VENV_PY" -m pip check
"$VENV_PY" test_logic.py
"$VENV_PY" test_security.py
log "test gate passed."

# --- 5. restart + health check ----------------------------------------------
sudo systemctl restart "$SERVICE"
health_check

UPDATED=0
rm -f "$BLOCKED_COMMIT_FILE"
trap - ERR INT TERM
log "DEPLOY OK -> now on ${REMOTE:0:8}"

"""Security-focused API regressions. Run: python test_security.py"""
import os
import sys
import tempfile

fd, db_path = tempfile.mkstemp(suffix=".db")
os.close(fd)

os.environ["DATABASE_URL"] = "sqlite:///" + db_path.replace("\\", "/")
os.environ["DISABLE_SCHEDULER"] = "1"
os.environ["APP_TOKEN"] = "right-token"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
import app.routes as routes  # noqa: E402

routes.refresh_ath = lambda session, ticker: None

failures = []


def check(name, cond):
    print(("PASS" if cond else "FAIL"), "-", name)
    if not cond:
        failures.append(name)


with TestClient(app) as client:
    token = {"X-App-Token": "right-token"}

    check("write requires app token", client.post("/api/watchlist", json={
        "ticker": "ABC",
        "display_name": "ABC",
    }).status_code == 401)

    check("valid yahoo ticker accepted", client.post("/api/watchlist", headers=token, json={
        "ticker": "SETFNIF50.NS",
        "display_name": "Nifty ETF",
        "broker_url": "https://groww.in/etfs/sbietf-nifty",
        "alert_mode": "dip",
    }).status_code == 201)

    check("invalid alert_mode rejected", client.post("/api/watchlist", headers=token, json={
        "ticker": "MODE",
        "display_name": "Mode",
        "alert_mode": "weird",
    }).status_code == 422)

    check("oversized ticker rejected", client.post("/api/watchlist", headers=token, json={
        "ticker": "A" * 5000,
        "display_name": "Long",
    }).status_code == 422)

    check("unsafe broker_url scheme rejected", client.post("/api/watchlist", headers=token, json={
        "ticker": "URL",
        "display_name": "URL",
        "broker_url": "javascript:alert(1)",
    }).status_code == 422)

    check("oversized settings secret rejected", client.put("/api/settings", headers=token, json={
        "whatsapp_phone": "+" + ("9" * 200),
        "callmebot_apikey": "k",
        "check_interval_min": 5,
    }).status_code == 422)

    response = client.get("/")
    check("content type sniffing disabled", response.headers.get("x-content-type-options") == "nosniff")
    check("referrer policy set", response.headers.get("referrer-policy") == "strict-origin-when-cross-origin")
    check("frame embedding blocked", response.headers.get("x-frame-options") == "DENY")
    check("permissions policy restricts clipboard", "clipboard-write=()" in response.headers.get("permissions-policy", ""))

print()
if failures:
    print(f"{len(failures)} FAILED")
    sys.exit(1)
print("ALL SECURITY TESTS PASSED")

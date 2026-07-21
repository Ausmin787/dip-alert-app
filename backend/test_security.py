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
from sqlmodel import Session, select  # noqa: E402

from app.main import app  # noqa: E402
import app.routes as routes  # noqa: E402
from app.db import engine  # noqa: E402
from app.models import AthTracker, Settings  # noqa: E402

refreshed_tickers = []
routes.refresh_ath = lambda session, ticker: refreshed_tickers.append(ticker)

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

    created = client.post("/api/watchlist", headers=token, json={
        "ticker": "SETFNIF50.NS",
        "display_name": "Nifty ETF",
        "broker_url": "https://groww.in/etfs/sbietf-nifty",
        "alert_mode": "dip",
    })
    check("valid yahoo ticker accepted", created.status_code == 201)

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
    check("broker URL userinfo rejected", client.post("/api/watchlist", headers=token, json={
        "ticker": "USERINFO",
        "display_name": "URL",
        "broker_url": "https://trusted.example@evil.example/buy",
    }).status_code == 422)
    check("display-name control characters rejected", client.post("/api/watchlist", headers=token, json={
        "ticker": "CONTROL",
        "display_name": "Injected\nmessage",
    }).status_code == 422)

    check("oversized settings secret rejected", client.put("/api/settings", headers=token, json={
        "whatsapp_phone": "+" + ("9" * 200),
        "callmebot_apikey": "k",
        "check_interval_min": 5,
    }).status_code == 422)
    check("malformed phone rejected", client.put("/api/settings", headers=token, json={
        "whatsapp_phone": "+91 call me",
        "callmebot_apikey": "key",
        "check_interval_min": 5,
    }).status_code == 422)
    check("control characters in API key rejected", client.put("/api/settings", headers=token, json={
        "whatsapp_phone": "+919876543210",
        "callmebot_apikey": "key\nvalue",
        "check_interval_min": 5,
    }).status_code == 422)

    check("history ticker uses watchlist validation", client.get("/api/history/not/a/ticker").status_code == 422)
    check("history is limited to tracked assets", client.get("/api/history/UNTRACKED").status_code == 404)
    check("investment amount has an upper bound", client.post("/api/watchlist", headers=token, json={
        "ticker": "HUGE",
        "display_name": "Huge",
        "invest_amount": 10**30,
    }).status_code == 422)

    item_id = created.json()["id"]
    with Session(engine) as session:
        session.add(AthTracker(ticker="SETFNIF50.NS", ath_price=100.0, last_alerted_level=4))
        session.commit()
    updated = client.put(f"/api/watchlist/{item_id}", headers=token, json={
        "ticker": "SETFNIF50.NS",
        "display_name": "Nifty ETF",
        "threshold_pct": 2.0,
        "broker_url": "https://groww.in/etfs/sbietf-nifty",
        "alert_mode": "dip",
    })
    with Session(engine) as session:
        tracker = session.exec(select(AthTracker).where(AthTracker.ticker == "SETFNIF50.NS")).first()
        check("threshold update re-arms alert state", updated.status_code == 200 and tracker.last_alerted_level == 0)

    momentum = client.post("/api/watchlist", headers=token, json={
        "ticker": "MODETEST",
        "display_name": "Mode test",
        "threshold_pct": 2.0,
        "invest_amount": 0,
        "alert_mode": "momentum",
    })
    switched = client.put(f"/api/watchlist/{momentum.json()['id']}", headers=token, json={
        "ticker": "MODETEST",
        "display_name": "Mode test",
        "threshold_pct": 2.0,
        "invest_amount": 1000,
        "alert_mode": "dip",
    })
    check("switching to dip mode initializes ATH state", switched.status_code == 200 and "MODETEST" in refreshed_tickers)

    saved = client.put("/api/settings", headers=token, json={
        "whatsapp_phone": "+919876543210",
        "callmebot_apikey": "secret",
        "check_interval_min": 5,
    })
    cleared = client.put("/api/settings", headers=token, json={
        "check_interval_min": 5,
        "clear_credentials": True,
    })
    check("credentials can be explicitly cleared", saved.status_code == 200 and not cleared.json()["apikey_set"])

    client.put("/api/settings", headers=token, json={
        "whatsapp_phone": "+919876543210",
        "callmebot_apikey": "bad-key",
        "check_interval_min": 5,
    })
    routes.send_whatsapp = lambda phone, key, message: False
    routes._last_test_alert_at = None
    first_attempt = client.post("/api/test-alert", headers=token)
    repeated_attempt = client.post("/api/test-alert", headers=token)
    check("failed external test alert starts cooldown", first_attempt.status_code == 502 and repeated_attempt.status_code == 429)

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

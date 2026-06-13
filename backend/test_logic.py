"""Sanity tests for the ATH level-crossing logic, with mocked prices. Run: python test_logic.py"""
import os
import sys
from datetime import date

os.environ["DATABASE_URL"] = "sqlite:///./test_dip_alert.db"

from sqlmodel import Session, select  # noqa: E402

from app import ath_logic  # noqa: E402
from app.db import create_db_and_tables, engine  # noqa: E402
from app.models import AlertLog, AthTracker, Settings, Watchlist  # noqa: E402

PRICE = {"value": 26000.0}
ath_logic.get_current_price = lambda ticker: PRICE["value"]
ath_logic.get_historical_max = lambda ticker: (26000.0, date(2026, 1, 1))
ath_logic.send_whatsapp = lambda phone, key, msg: True

failures = []


def check(name, cond):
    print(("PASS" if cond else "FAIL"), "-", name)
    if not cond:
        failures.append(name)


if os.path.exists("test_dip_alert.db"):
    os.remove("test_dip_alert.db")
create_db_and_tables()

with Session(engine) as s:
    item = Watchlist(ticker="^NSEI", display_name="Nifty 50", threshold_pct=1.0,
                     invest_amount=100000, broker_url="https://example.com")
    s.add(item)
    s.add(Settings(whatsapp_phone="+910000000000", callmebot_apikey="test"))
    s.commit()
    s.refresh(item)

    def tracker():
        return s.exec(select(AthTracker).where(AthTracker.ticker == "^NSEI")).first()

    # 1. At ATH -> no alert
    PRICE["value"] = 26000.0
    check("no alert at ATH", ath_logic.check_asset(s, item) is None)

    # 2. 2.03% below ATH -> alert at level 2 (first check of the dip)
    PRICE["value"] = 25470.0
    a = ath_logic.check_asset(s, item)
    check("alert fires at level 2 (2.03% drop)", a is not None and a.alert_level == 2)

    # 3. Same level again -> no re-alert
    PRICE["value"] = 25460.0
    check("no re-alert at same level", ath_logic.check_asset(s, item) is None)

    # 4. Drops to 3.00% -> alert level 3
    PRICE["value"] = 25219.0
    a = ath_logic.check_asset(s, item)
    check("alert fires at level 3 (3.00% drop)", a is not None and a.alert_level == 3)

    # 5. Partial recovery to 1.5% below -> no alert (level lower than last alerted)
    PRICE["value"] = 25610.0
    check("no alert on partial recovery", ath_logic.check_asset(s, item) is None)

    # 6. Recovery to within 0.5% of ATH -> resets last_alerted_level
    PRICE["value"] = 25900.0  # 0.38% below
    ath_logic.check_asset(s, item)
    check("recovery resets level to 0", tracker().last_alerted_level == 0)

    # 7. Dips again to 1.2% -> level 1 re-triggers in new cycle
    PRICE["value"] = 25688.0
    a = ath_logic.check_asset(s, item)
    check("level 1 re-triggers after reset", a is not None and a.alert_level == 1)

    # 8. New ATH -> tracker updates and resets
    PRICE["value"] = 26500.0
    ath_logic.check_asset(s, item)
    t = tracker()
    check("new ATH updates tracker", t.ath_price == 26500.0 and t.last_alerted_level == 0)

    # 9. Custom threshold 2%: 3% drop => level 1 (floor(3/2))
    item2 = Watchlist(ticker="TEST.NS", display_name="Test ETF", threshold_pct=2.0,
                      invest_amount=50000, broker_url="")
    s.add(item2)
    s.commit()
    s.refresh(item2)
    ath_logic.get_historical_max = lambda ticker: (1000.0, date(2026, 1, 1))
    PRICE["value"] = 970.0  # 3% below 1000
    a = ath_logic.check_asset(s, item2)
    check("custom 2% threshold: 3% drop = level 1", a is not None and a.alert_level == 1)

    check("level_pct = 2.0 for 2% threshold level 1", a.level_pct == 2.0)

    n_alerts = len(s.exec(select(AlertLog)).all())
    check("alert log has 4 rows", n_alerts == 4)

    def tracker2():
        return s.exec(select(AthTracker).where(AthTracker.ticker == "TEST.NS")).first()

    # 10. Failed WhatsApp send: no log row, level NOT consumed (retries next tick)
    ath_logic.send_whatsapp = lambda phone, key, msg: False
    PRICE["value"] = 958.0  # 4.2% below 1000 => level 2 on 2% threshold
    check("failed send returns no alert", ath_logic.check_asset(s, item2) is None)
    check("failed send does not advance level", tracker2().last_alerted_level == 1)
    check("failed send writes no log row", len(s.exec(select(AlertLog)).all()) == 4)

    # 11. Next tick with working delivery fires the same level
    ath_logic.send_whatsapp = lambda phone, key, msg: True
    a = ath_logic.check_asset(s, item2)
    check("retry after failure fires level 2",
          a is not None and a.alert_level == 2 and a.whatsapp_sent)
    check("retry level_pct = 4.0", a.level_pct == 4.0)

    # 12. Unconfigured credentials: alert still logged (dashboard is the record), level advances
    settings_row = s.exec(select(Settings)).first()
    settings_row.whatsapp_phone = ""
    s.commit()
    PRICE["value"] = 939.0  # 6.1% below 1000 => level 3
    a = ath_logic.check_asset(s, item2)
    check("unconfigured creds still logs alert", a is not None and a.whatsapp_sent is False)
    check("unconfigured creds advances level", tracker2().last_alerted_level == 3)

    # 13. Scheduler pass survives a DB error mid-loop (handler must rollback,
    # or the poisoned session raises PendingRollbackError for every later asset)
    real_check_asset = ath_logic.check_asset
    loop_log = []

    def poison_then_query(session, item):
        if not loop_log:
            loop_log.append('poisoned')
            session.add(AlertLog(ticker=None, alert_level=1, current_price=1.0,
                                 ath_price=1.0, drop_pct=1.0))
            session.flush()  # NOT NULL violation -> session enters failed state
        else:
            session.exec(select(Settings)).first()  # raises unless rolled back
            loop_log.append('recovered')

    ath_logic.check_asset = poison_then_query
    ath_logic.check_all_assets()
    ath_logic.check_asset = real_check_asset
    check("scheduler recovers after a DB error", loop_log == ['poisoned', 'recovered'])

print()
if failures:
    print(f"{len(failures)} FAILED")
    sys.exit(1)
print("ALL TESTS PASSED")

"""Regression test for additive upgrades from the original SQLite schema."""
import os
import sqlite3
import sys
import tempfile
from contextlib import closing


fd, db_path = tempfile.mkstemp(suffix=".db")
os.close(fd)

with closing(sqlite3.connect(db_path)) as connection:
    connection.executescript(
        """
        CREATE TABLE watchlist (
            id INTEGER PRIMARY KEY,
            ticker VARCHAR NOT NULL UNIQUE,
            display_name VARCHAR NOT NULL
        );
        INSERT INTO watchlist (ticker, display_name) VALUES ('CUSTOM', 'Custom asset');
        CREATE TABLE alert_log (
            id INTEGER PRIMARY KEY,
            ticker VARCHAR NOT NULL,
            alert_level INTEGER NOT NULL,
            current_price FLOAT NOT NULL,
            ath_price FLOAT NOT NULL,
            drop_pct FLOAT NOT NULL,
            alerted_at DATETIME NOT NULL,
            whatsapp_sent BOOLEAN NOT NULL
        );
        CREATE TABLE settings (
            id INTEGER PRIMARY KEY,
            whatsapp_phone VARCHAR NOT NULL DEFAULT '',
            callmebot_apikey VARCHAR NOT NULL DEFAULT '',
            check_interval_min INTEGER NOT NULL DEFAULT 5
        );
        INSERT INTO settings DEFAULT VALUES;
        """
    )

os.environ["DATABASE_URL"] = "sqlite:///" + db_path.replace("\\", "/")
os.environ["DISABLE_SCHEDULER"] = "1"

from app.db import create_db_and_tables, engine  # noqa: E402
from app.main import migrate_db, seed_defaults  # noqa: E402


failures = []


def check(name, condition):
    print(("PASS" if condition else "FAIL"), "-", name)
    if not condition:
        failures.append(name)


create_db_and_tables()
migrate_db()
seed_defaults()
migrate_db()  # idempotence

with closing(sqlite3.connect(db_path)) as connection:
    watchlist_columns = {row[1] for row in connection.execute("PRAGMA table_info(watchlist)")}
    alert_columns = {row[1] for row in connection.execute("PRAGMA table_info(alert_log)")}
    settings_columns = {row[1] for row in connection.execute("PRAGMA table_info(settings)")}
    tickers = [row[0] for row in connection.execute("SELECT ticker FROM watchlist")]
    seeded = connection.execute("SELECT defaults_seeded FROM settings").fetchone()[0]

check("legacy watchlist receives current columns", {"threshold_pct", "invest_amount", "broker_url", "active", "alert_mode"} <= watchlist_columns)
check("legacy alert log receives snapshot columns", {"level_pct", "alert_direction", "invest_amount"} <= alert_columns)
check("legacy settings records seed completion", "defaults_seeded" in settings_columns and seeded == 1)
check("existing deletion/customization is preserved", tickers == ["CUSTOM"])

engine.dispose()
os.remove(db_path)

if failures:
    print(f"{len(failures)} FAILED")
    sys.exit(1)
print("ALL MIGRATION TESTS PASSED")

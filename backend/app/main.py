import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .db import create_db_and_tables, engine
from .models import Settings, Watchlist
from .ath_logic import refresh_all_aths
from .routes import router
from .scheduler import scheduler, start_scheduler

logging.basicConfig(level=logging.INFO)

DEFAULT_ASSETS = [
    Watchlist(
        ticker="^NSEI",
        display_name="Nifty 50 Index",
        threshold_pct=1.0,
        invest_amount=100000,
        broker_url="https://groww.in/etfs/sbietf-nifty",
        alert_mode="dip",
    ),
    Watchlist(ticker="GC=F", display_name="Gold (COMEX)", threshold_pct=2.0, invest_amount=0, broker_url="", alert_mode="momentum"),
    Watchlist(ticker="SI=F", display_name="Silver (COMEX)", threshold_pct=2.0, invest_amount=0, broker_url="", alert_mode="momentum"),
    Watchlist(ticker="^GSPC", display_name="S&P 500", threshold_pct=2.0, invest_amount=0, broker_url="", alert_mode="momentum"),
    Watchlist(ticker="^NDX", display_name="Nasdaq 100", threshold_pct=2.0, invest_amount=0, broker_url="", alert_mode="momentum"),
]


def seed_defaults() -> None:
    with Session(engine) as session:
        if not session.exec(select(Settings)).first():
            session.add(Settings())
        # Add any DEFAULT_ASSETS not yet in the DB (safe to run on existing installs)
        existing = {item.ticker for item in session.exec(select(Watchlist)).all()}
        for asset in DEFAULT_ASSETS:
            if asset.ticker not in existing:
                session.add(asset)
        session.commit()


def migrate_db() -> None:
    """Additive SQLite migrations for DBs created before new columns existed.

    `create_all` only creates missing *tables*, never alters existing ones, so a
    DB created with an older schema keeps its old columns. Each block here adds a
    column only if it's absent, with the model's default, and is safe to re-run.
    """
    with engine.connect() as conn:
        alert_cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(alert_log)")]
        if alert_cols and "level_pct" not in alert_cols:
            conn.exec_driver_sql(
                "ALTER TABLE alert_log ADD COLUMN level_pct FLOAT NOT NULL DEFAULT 0"
            )
            # Old rows were all written with threshold_pct=1.0, so level == pct
            conn.exec_driver_sql("UPDATE alert_log SET level_pct = alert_level")

        # watchlist gained per-asset settings after the original (ticker/name) schema
        wl_cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(watchlist)")]
        if wl_cols:
            for col, ddl in (
                ("threshold_pct", "FLOAT NOT NULL DEFAULT 1.0"),
                ("invest_amount", "INTEGER NOT NULL DEFAULT 100000"),
                ("broker_url", "VARCHAR NOT NULL DEFAULT ''"),
                ("active", "BOOLEAN NOT NULL DEFAULT 1"),
                ("alert_mode", "VARCHAR NOT NULL DEFAULT 'dip'"),
            ):
                if col not in wl_cols:
                    conn.exec_driver_sql(f"ALTER TABLE watchlist ADD COLUMN {col} {ddl}")

        al_cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(alert_log)")]
        if al_cols and "alert_direction" not in al_cols:
            conn.exec_driver_sql("ALTER TABLE alert_log ADD COLUMN alert_direction VARCHAR")

        conn.commit()


def warn_if_unprotected() -> None:
    if not os.environ.get("APP_TOKEN"):
        logging.warning(
            "!!! APP_TOKEN is not set — all write endpoints (watchlist, settings, "
            "test-alert) are open to anyone with the deployed URL. Set APP_TOKEN "
            "in your environment to require an X-App-Token header for writes. !!!"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    migrate_db()
    seed_defaults()
    warn_if_unprotected()
    # Populate ATH in the background so the dashboard has data immediately
    threading.Thread(target=refresh_all_aths, daemon=True).start()
    if os.environ.get("DISABLE_SCHEDULER") != "1":
        start_scheduler()
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Dip Alert", lifespan=lifespan)

frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin, "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"app": "Dip Alert", "status": "running"}

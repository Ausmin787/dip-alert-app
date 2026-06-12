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
        broker_url="https://groww.in/etfs/sbi-nifty-50-etf",
    ),
]


def seed_defaults() -> None:
    with Session(engine) as session:
        if not session.exec(select(Settings)).first():
            session.add(Settings())
        if not session.exec(select(Watchlist)).first():
            for asset in DEFAULT_ASSETS:
                session.add(asset)
        session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    seed_defaults()
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

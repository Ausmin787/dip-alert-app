"""APScheduler setup: price checks every N minutes during NSE market hours (IST)."""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlmodel import Session, select

from .ath_logic import check_all_assets, refresh_all_aths
from .db import engine
from .models import Settings

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")

scheduler = BackgroundScheduler(timezone=IST)


def is_market_open(now: datetime | None = None) -> bool:
    """NSE: 9:15 AM - 3:30 PM IST, Mon-Fri."""
    now = now or datetime.now(IST)
    if now.weekday() >= 5:
        return False
    minutes = now.hour * 60 + now.minute
    return (9 * 60 + 15) <= minutes <= (15 * 60 + 30)


def market_hours_check() -> None:
    if not is_market_open():
        return
    check_all_assets()


def get_check_interval() -> int:
    with Session(engine) as session:
        settings = session.exec(select(Settings)).first()
        return settings.check_interval_min if settings else 5


def start_scheduler() -> None:
    interval = get_check_interval()
    scheduler.add_job(
        market_hours_check,
        "interval",
        minutes=interval,
        id="price_check",
        replace_existing=True,
    )
    # Refresh ATH daily just after market open
    scheduler.add_job(
        refresh_all_aths,
        CronTrigger(day_of_week="mon-fri", hour=9, minute=16, timezone=IST),
        id="ath_refresh",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: price check every %d min during market hours", interval)


def reschedule_price_check(interval_min: int) -> None:
    """Called when the user changes the check interval in Settings."""
    scheduler.reschedule_job("price_check", trigger="interval", minutes=interval_min)
    logger.info("Price check rescheduled to every %d min", interval_min)

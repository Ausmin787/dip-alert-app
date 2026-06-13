"""Core dip-detection logic: ATH tracking, level crossing, alert firing."""
import logging
import math
from datetime import datetime

from sqlmodel import Session, select

from .db import engine
from .models import AlertLog, AthTracker, Settings, Watchlist
from .price_service import get_current_price, get_historical_max
from .whatsapp import format_alert_message, send_whatsapp

logger = logging.getLogger(__name__)

# If price recovers to within this % of ATH, reset alert levels for next dip cycle
RECOVERY_RESET_PCT = 0.5


def refresh_ath(session: Session, ticker: str) -> AthTracker | None:
    """Fetch all-time-high from history and upsert the tracker row."""
    result = get_historical_max(ticker)
    if result is None:
        return None
    ath_price, ath_date = result

    tracker = session.exec(select(AthTracker).where(AthTracker.ticker == ticker)).first()
    if tracker is None:
        tracker = AthTracker(ticker=ticker)
        session.add(tracker)
    if ath_price > tracker.ath_price:
        tracker.ath_price = ath_price
        tracker.ath_date = ath_date
    tracker.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(tracker)
    return tracker


def check_asset(session: Session, item: Watchlist) -> AlertLog | None:
    """Check one watchlist asset; fire an alert if a new drop level was crossed."""
    tracker = session.exec(select(AthTracker).where(AthTracker.ticker == item.ticker)).first()
    if tracker is None or tracker.ath_price <= 0:
        tracker = refresh_ath(session, item.ticker)
        if tracker is None or tracker.ath_price <= 0:
            logger.warning("No ATH available for %s; skipping", item.ticker)
            return None

    price = get_current_price(item.ticker)
    if price is None:
        logger.warning("No current price for %s; skipping", item.ticker)
        return None

    # New all-time high: update tracker and reset levels
    if price > tracker.ath_price:
        tracker.ath_price = price
        tracker.ath_date = datetime.utcnow().date()
        tracker.last_alerted_level = 0
        tracker.updated_at = datetime.utcnow()
        session.commit()
        return None

    drop_pct = (tracker.ath_price - price) / tracker.ath_price * 100

    # Recovery reset: back within 0.5% of ATH re-arms all levels
    if drop_pct <= RECOVERY_RESET_PCT and tracker.last_alerted_level != 0:
        tracker.last_alerted_level = 0
        tracker.updated_at = datetime.utcnow()
        session.commit()
        return None

    # Level in units of the asset's threshold (default 1.0 => whole percents)
    level = math.floor(drop_pct / item.threshold_pct)
    if level <= tracker.last_alerted_level or level < 1:
        return None

    # New level crossed — fire alert
    settings = session.exec(select(Settings)).first()
    configured = bool(settings and settings.whatsapp_phone and settings.callmebot_apikey)
    level_pct = level * item.threshold_pct
    message = format_alert_message(
        display_name=item.display_name,
        level_pct=level_pct,
        current_price=price,
        ath_price=tracker.ath_price,
        drop_pct=drop_pct,
        invest_amount=item.invest_amount,
        broker_url=item.broker_url,
    )
    sent = False
    if configured:
        sent = send_whatsapp(settings.whatsapp_phone, settings.callmebot_apikey, message)
        if not sent:
            # Delivery failed: don't consume the level — the next scheduler
            # tick retries naturally, so the user never silently loses an alert.
            logger.warning(
                "WhatsApp send failed for %s level -%g%%; will retry next check",
                item.ticker, level_pct,
            )
            return None

    alert = AlertLog(
        ticker=item.ticker,
        alert_level=level,
        level_pct=round(level_pct, 2),
        current_price=price,
        ath_price=tracker.ath_price,
        drop_pct=round(drop_pct, 2),
        whatsapp_sent=sent,
    )
    session.add(alert)
    tracker.last_alerted_level = level
    tracker.updated_at = datetime.utcnow()
    session.commit()
    session.refresh(alert)
    logger.info("Alert fired for %s at level -%g%% (drop %.2f%%)", item.ticker, level_pct, drop_pct)
    return alert


def check_all_assets() -> None:
    """Scheduler entrypoint: check every active watchlist asset."""
    with Session(engine) as session:
        items = session.exec(select(Watchlist).where(Watchlist.active == True)).all()  # noqa: E712
        for item in items:
            ticker = item.ticker  # read while the session is healthy
            try:
                check_asset(session, item)
            except Exception:
                # Roll back so one bad asset can't poison the shared session
                # (PendingRollbackError) for the rest of the pass.
                session.rollback()
                logger.exception("Check failed for %s", ticker)


def refresh_all_aths() -> None:
    """Daily job at market open: refresh ATH from full history."""
    with Session(engine) as session:
        items = session.exec(select(Watchlist).where(Watchlist.active == True)).all()  # noqa: E712
        for item in items:
            ticker = item.ticker
            try:
                refresh_ath(session, ticker)
            except Exception:
                session.rollback()
                logger.exception("ATH refresh failed for %s", ticker)

"""All API endpoints."""
import math
import os
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, desc, select

from .ath_logic import refresh_ath
from .db import get_session
from .models import AlertLog, AthTracker, Settings, Watchlist
from .price_service import get_current_price, get_prev_close, get_recent_history
from .scheduler import is_market_open, reschedule_price_check
from .whatsapp import format_alert_message, send_whatsapp

router = APIRouter(prefix="/api")


def require_write_token(x_app_token: str | None = Header(default=None)):
    """If APP_TOKEN is set in the environment, every write endpoint requires
    the matching X-App-Token header. Unset = open (local dev, default)."""
    expected = os.environ.get("APP_TOKEN", "")
    if expected and not secrets.compare_digest(x_app_token or "", expected):
        raise HTTPException(401, "Invalid or missing X-App-Token")


write_protected = [Depends(require_write_token)]


# ---------- status ----------

@router.get("/status")
def get_status(session: Session = Depends(get_session)):
    items = session.exec(select(Watchlist)).all()
    result = []
    for item in items:
        tracker = session.exec(
            select(AthTracker).where(AthTracker.ticker == item.ticker)
        ).first()
        price = get_current_price(item.ticker) if item.active else None

        if item.alert_mode == "momentum":
            prev_close = get_prev_close(item.ticker) if item.active and price else None
            daily_change = (
                round((price - prev_close) / prev_close * 100, 2)
                if price and prev_close and prev_close > 0
                else None
            )
            result.append({
                "id": item.id,
                "ticker": item.ticker,
                "display_name": item.display_name,
                "active": item.active,
                "alert_mode": "momentum",
                "current_price": price,
                "daily_change_pct": daily_change,
                "threshold_pct": item.threshold_pct,
                "invest_amount": item.invest_amount,
                "broker_url": item.broker_url,
                # dip-specific fields absent
                "ath_price": None,
                "ath_date": None,
                "drop_pct": None,
                "last_alerted_level": 0,
                "next_alert_level": None,
            })
        else:
            ath = tracker.ath_price if tracker else None
            drop_pct = None
            next_level = None
            if price is not None and ath:
                drop_pct = round((ath - price) / ath * 100, 2)
                last = tracker.last_alerted_level if tracker else 0
                crossed = math.floor(drop_pct / item.threshold_pct) if drop_pct > 0 else 0
                next_level = (max(last, crossed) + 1) * item.threshold_pct
            result.append({
                "id": item.id,
                "ticker": item.ticker,
                "display_name": item.display_name,
                "active": item.active,
                "alert_mode": "dip",
                "current_price": price,
                "daily_change_pct": None,
                "ath_price": ath,
                "ath_date": tracker.ath_date.isoformat() if tracker and tracker.ath_date else None,
                "drop_pct": drop_pct,
                "last_alerted_level": tracker.last_alerted_level if tracker else 0,
                "next_alert_level": next_level,
                "threshold_pct": item.threshold_pct,
                "invest_amount": item.invest_amount,
                "broker_url": item.broker_url,
            })
    return {"market_open": is_market_open(), "items": result}


@router.get("/history/{ticker:path}")
def get_history(ticker: str, days: int = Query(30, ge=1, le=365)):
    return get_recent_history(ticker, days)


# ---------- watchlist ----------

class WatchlistIn(BaseModel):
    ticker: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    threshold_pct: float = Field(1.0, gt=0, le=50)
    invest_amount: int = Field(100000, ge=0)
    broker_url: str = ""
    active: bool = True
    alert_mode: str = "dip"


@router.get("/watchlist")
def list_watchlist(session: Session = Depends(get_session)):
    return session.exec(select(Watchlist)).all()


@router.post("/watchlist", status_code=201, dependencies=write_protected)
def add_watchlist(body: WatchlistIn, session: Session = Depends(get_session)):
    existing = session.exec(select(Watchlist).where(Watchlist.ticker == body.ticker)).first()
    if existing:
        raise HTTPException(409, f"{body.ticker} is already tracked")
    item = Watchlist(**body.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    # Initialize ATH right away so the dashboard has data
    refresh_ath(session, item.ticker)
    return item


@router.put("/watchlist/{item_id}", dependencies=write_protected)
def update_watchlist(item_id: int, body: WatchlistIn, session: Session = Depends(get_session)):
    item = session.get(Watchlist, item_id)
    if not item:
        raise HTTPException(404, "Watchlist item not found")
    if body.ticker != item.ticker:
        # Ticker is the key linking watchlist <-> ath_tracker; changing it would
        # orphan the tracker. Delete + re-add instead.
        raise HTTPException(400, "Ticker cannot be changed — delete this asset and add a new one")
    for key, value in body.model_dump().items():
        setattr(item, key, value)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/watchlist/{item_id}", status_code=204, dependencies=write_protected)
def delete_watchlist(item_id: int, session: Session = Depends(get_session)):
    item = session.get(Watchlist, item_id)
    if not item:
        raise HTTPException(404, "Watchlist item not found")
    tracker = session.exec(select(AthTracker).where(AthTracker.ticker == item.ticker)).first()
    if tracker:
        session.delete(tracker)
    session.delete(item)
    session.commit()


# ---------- alerts ----------

@router.get("/alerts")
def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    offset = (page - 1) * page_size
    alerts = session.exec(
        select(AlertLog).order_by(desc(AlertLog.alerted_at)).offset(offset).limit(page_size)
    ).all()
    total = len(session.exec(select(AlertLog)).all())
    return {"alerts": alerts, "total": total, "page": page, "page_size": page_size}


# ---------- settings ----------

class SettingsIn(BaseModel):
    # Blank phone/apikey mean "keep the stored value" — the UI never sees the
    # real secrets, so it can't echo them back.
    whatsapp_phone: str = ""
    callmebot_apikey: str = ""
    check_interval_min: int = Field(5, ge=1, le=60)


def _mask_phone(phone: str) -> str:
    if not phone:
        return ""
    if len(phone) < 8:
        return "••••"
    return f"{phone[:3]}••••{phone[-4:]}"


def _redacted(settings: Settings) -> dict:
    """Public shape of the settings row — never includes raw credentials."""
    return {
        "whatsapp_phone_masked": _mask_phone(settings.whatsapp_phone),
        "apikey_set": bool(settings.callmebot_apikey),
        "check_interval_min": settings.check_interval_min,
        # Lets the UI know whether writes need an X-App-Token header
        "write_protected": bool(os.environ.get("APP_TOKEN")),
    }


@router.get("/settings")
def get_settings(session: Session = Depends(get_session)):
    settings = session.exec(select(Settings)).first()
    if not settings:
        settings = Settings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return _redacted(settings)


@router.put("/settings", dependencies=write_protected)
def update_settings(body: SettingsIn, session: Session = Depends(get_session)):
    settings = session.exec(select(Settings)).first()
    if not settings:
        settings = Settings()
        session.add(settings)
    old_interval = settings.check_interval_min
    if body.whatsapp_phone.strip():
        settings.whatsapp_phone = body.whatsapp_phone.strip()
    if body.callmebot_apikey.strip():
        settings.callmebot_apikey = body.callmebot_apikey.strip()
    settings.check_interval_min = body.check_interval_min
    session.commit()
    session.refresh(settings)
    if body.check_interval_min != old_interval:
        try:
            reschedule_price_check(body.check_interval_min)
        except Exception:
            pass  # scheduler may not be running in dev
    return _redacted(settings)


# ---------- test alert ----------

@router.post("/test-alert", dependencies=write_protected)
def test_alert(session: Session = Depends(get_session)):
    settings = session.exec(select(Settings)).first()
    if not settings or not settings.whatsapp_phone or not settings.callmebot_apikey:
        raise HTTPException(400, "WhatsApp phone and API key must be configured first")
    message = format_alert_message(
        display_name="Test Asset",
        level_pct=1.0,
        current_price=25740.0,
        ath_price=26000.0,
        drop_pct=1.0,
        invest_amount=100000,
        broker_url="https://groww.in/etfs/sbietf-nifty",
    )
    message = "✅ TEST ALERT ✅\n" + message
    sent = send_whatsapp(settings.whatsapp_phone, settings.callmebot_apikey, message)
    if not sent:
        raise HTTPException(502, "CallMeBot request failed — check phone/apikey")
    return {"sent": True, "sent_at": datetime.utcnow().isoformat()}

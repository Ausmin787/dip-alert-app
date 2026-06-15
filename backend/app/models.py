from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Watchlist(SQLModel, table=True):
    __tablename__ = "watchlist"

    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True, unique=True)
    display_name: str
    threshold_pct: float = 1.0
    invest_amount: int = 100000
    broker_url: str = ""
    active: bool = True
    # "dip" = ATH-drop levels (existing logic); "momentum" = |daily % change| > threshold
    alert_mode: str = "dip"


class AthTracker(SQLModel, table=True):
    __tablename__ = "ath_tracker"

    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True, unique=True)
    ath_price: float = 0.0
    ath_date: Optional[date] = None
    last_alerted_level: int = 0
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AlertLog(SQLModel, table=True):
    __tablename__ = "alert_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    alert_level: int
    level_pct: float = 0.0  # alert_level × threshold_pct at fire time (what the user sees)
    current_price: float
    ath_price: float  # for momentum alerts: stores prev_close instead
    drop_pct: float   # for momentum alerts: signed daily change (positive = up, negative = down)
    alerted_at: datetime = Field(default_factory=datetime.utcnow)
    whatsapp_sent: bool = False
    alert_direction: Optional[str] = None  # "up" | "down" for momentum; None for dip


class Settings(SQLModel, table=True):
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    whatsapp_phone: str = ""
    callmebot_apikey: str = ""
    check_interval_min: int = 5

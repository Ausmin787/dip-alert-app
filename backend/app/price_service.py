"""yfinance wrapper for current prices, ATH, and recent history."""
import logging
from datetime import date
from typing import Optional

import yfinance as yf

logger = logging.getLogger(__name__)


def get_current_price(ticker: str) -> Optional[float]:
    """Latest traded price; falls back through fast_info -> 1d history."""
    try:
        t = yf.Ticker(ticker)
        price = t.fast_info.get("last_price")
        if price:
            return float(price)
        hist = t.history(period="1d", interval="5m")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        logger.exception("Failed to fetch current price for %s", ticker)
    return None


def get_historical_max(ticker: str) -> Optional[tuple[float, date]]:
    """All-time-high close and its date from max-period daily history."""
    try:
        hist = yf.Ticker(ticker).history(period="max")
        if hist.empty:
            return None
        ath_price = float(hist["Close"].max())
        ath_date = hist["Close"].idxmax().date()
        return ath_price, ath_date
    except Exception:
        logger.exception("Failed to fetch historical max for %s", ticker)
        return None


def get_recent_history(ticker: str, days: int = 30) -> list[dict]:
    """Daily closes for the last `days` days, for the dashboard chart."""
    try:
        hist = yf.Ticker(ticker).history(period=f"{days}d")
        return [
            {"date": idx.strftime("%Y-%m-%d"), "close": round(float(row["Close"]), 2)}
            for idx, row in hist.iterrows()
        ]
    except Exception:
        logger.exception("Failed to fetch recent history for %s", ticker)
        return []

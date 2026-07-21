"""yfinance wrapper for current prices, ATH, and recent history."""
import logging
import math
import threading
import time
from datetime import date
from typing import Optional

import yfinance as yf

logger = logging.getLogger(__name__)

_cache: dict[tuple, tuple[float, object]] = {}
_cache_lock = threading.Lock()
_key_locks: dict[tuple, threading.Lock] = {}


def _cached(key: tuple, ttl_seconds: int, loader):
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < ttl_seconds:
            return hit[1]
        key_lock = _key_locks.setdefault(key, threading.Lock())
    # Collapse concurrent requests for the same upstream resource. Without the
    # second check, a burst of public status requests can all miss together.
    with key_lock:
        now = time.monotonic()
        with _cache_lock:
            hit = _cache.get(key)
            if hit and now - hit[0] < ttl_seconds:
                return hit[1]
        value = loader()
        with _cache_lock:
            _cache[key] = (time.monotonic(), value)
        return value


def _finite_float(value) -> Optional[float]:
    number = float(value)
    return number if math.isfinite(number) and number > 0 else None


def get_current_price(ticker: str) -> Optional[float]:
    """Latest traded price; falls back through fast_info -> 1d history."""
    def load():
        try:
            t = yf.Ticker(ticker)
            price = t.fast_info.get("last_price")
            if price:
                return _finite_float(price)
            hist = t.history(period="1d", interval="5m")
            if not hist.empty:
                return _finite_float(hist["Close"].iloc[-1])
        except Exception:
            logger.exception("Failed to fetch current price for %s", ticker)
        return None

    return _cached(("current", ticker), 45, load)


def get_historical_max(ticker: str) -> Optional[tuple[float, date]]:
    """All-time-high close and its date from max-period daily history."""
    def load():
        try:
            hist = yf.Ticker(ticker).history(period="max")
            if hist.empty:
                return None
            ath_price = _finite_float(hist["Close"].max())
            if ath_price is None:
                return None
            ath_date = hist["Close"].idxmax().date()
            return ath_price, ath_date
        except Exception:
            logger.exception("Failed to fetch historical max for %s", ticker)
            return None

    return _cached(("ath", ticker), 6 * 60 * 60, load)


def get_prev_close(ticker: str) -> Optional[float]:
    """Previous trading day's closing price, for daily % change in momentum mode."""
    def load():
        try:
            t = yf.Ticker(ticker)
            price = t.fast_info.get("previous_close")
            if price:
                return _finite_float(price)
            hist = t.history(period="5d")
            if len(hist) >= 2:
                return _finite_float(hist["Close"].iloc[-2])
        except Exception:
            logger.exception("Failed to fetch previous close for %s", ticker)
        return None

    return _cached(("previous", ticker), 5 * 60, load)


def get_recent_history(ticker: str, days: int = 30) -> list[dict]:
    """Daily closes for the last `days` days, for the dashboard chart."""
    def load():
        try:
            hist = yf.Ticker(ticker).history(period=f"{days}d")
            result = []
            for idx, row in hist.iterrows():
                close = _finite_float(row["Close"])
                if close is not None:
                    result.append({"date": idx.strftime("%Y-%m-%d"), "close": round(close, 2)})
            return result
        except Exception:
            logger.exception("Failed to fetch recent history for %s", ticker)
            return []

    return _cached(("history", ticker, days), 5 * 60, load)

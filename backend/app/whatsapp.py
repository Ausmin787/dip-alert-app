"""WhatsApp alerts via CallMeBot (free, personal use)."""
import logging
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php"


def format_alert_message(
    display_name: str,
    level_pct: float,
    current_price: float,
    ath_price: float,
    drop_pct: float,
    invest_amount: int,
    broker_url: str,
) -> str:
    invest_str = f"₹{invest_amount:,}"
    msg = (
        "\U0001f6a8 NIFTY DIP ALERT \U0001f6a8\n"
        f"Level: -{level_pct:g}% from ATH\n"
        f"Current: {current_price:,.2f} | ATH: {ath_price:,.2f}\n"
        f"Drop: {drop_pct:.2f}%\n"
        f"Invest: {invest_str} → {display_name}"
    )
    if broker_url:
        msg += f"\n\U0001f449 Buy now: {broker_url}"
    return msg


def format_momentum_message(
    display_name: str,
    change_pct: float,
    current_price: float,
    threshold_pct: float,
) -> str:
    arrow = "\U0001f4c8" if change_pct > 0 else "\U0001f4c9"
    direction = "UP" if change_pct > 0 else "DOWN"
    sign = "+" if change_pct > 0 else ""
    return (
        f"{arrow} {display_name} {direction} {sign}{change_pct:.2f}%\n"
        f"Current: {current_price:,.2f}\n"
        f"Daily move: {sign}{change_pct:.2f}% (threshold: ±{threshold_pct:g}%)"
    )


def send_whatsapp(phone: str, apikey: str, message: str) -> bool:
    if not phone or not apikey:
        logger.warning("WhatsApp not configured; skipping send")
        return False
    params = {
        "phone": phone,
        "text": message,
        "apikey": apikey,
    }
    url = f"{CALLMEBOT_URL}?{urllib.parse.urlencode(params)}"
    try:
        resp = httpx.get(url, timeout=30)
        ok = resp.status_code == 200
        if not ok:
            logger.error("CallMeBot returned %s: %s", resp.status_code, resp.text[:200])
        return ok
    except Exception:
        logger.exception("Failed to send WhatsApp message")
        return False

# Testing Patterns

**Analysis Date:** 2026-06-14

## Backend Testing

**Framework:**
- Standalone python scripts with monkeypatching (no pytest dependency).

**Key Test Suite:**
- [backend/test_logic.py](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/backend/test_logic.py)

**Run Command:**
```bash
cd backend
.venv\Scripts\python test_logic.py
```

**Verifications Covered:**
1. **Level-Crossing Alerts:** Asserts that crossing a drop boundary (e.g. -1%) fires a WhatsApp alert and logs it.
2. **Alert Level Guard:** Asserts that the app does not send multiple alerts for the same level during the same dip.
3. **Recovery Reset:** Asserts that when the price rises back to within `0.5%` of the ATH (`RECOVERY_RESET_PCT`), the tracker's `last_alerted_level` resets to `0`, allowing alerts to fire again if the price dips later.
4. **New ATH Reset:** Asserts that a price exceeding the current ATH updates the tracker to the new price, sets the ATH date, and resets `last_alerted_level` to `0`.
5. **WhatsApp Fail Protection:** Asserts that if the CallMeBot webhook fails (returns non-200), the tracker level does not advance and no AlertLog is written, ensuring a retry on the next tick.
6. **DB Transaction Isolation:** Asserts that exceptions on a single Watchlist asset during a scheduler pass trigger a `session.rollback()` and do not poison subsequent asset lookups.

## Frontend Testing

**Runner:**
- Standard Node.js execution.

**Key Test Suite:**
- [frontend/src/lib.test.js](file:///C:/Users/Sasanka/ClaudeWork/dip-alert-app/frontend/src/lib.test.js)

**Run Command:**
```bash
cd frontend
npm test
```

**Verifications Covered:**
- Verifies severity scoring (mint vs amber vs rose colors depending on drop percentage).
- Verifies decimal level string representations.
- Verifies timezone clock conversions (`Asia/Kolkata` time checks).

---

*Testing audit: 2026-06-14*
*Update when adding test coverage tools*

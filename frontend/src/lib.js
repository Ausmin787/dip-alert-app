export const fmtPrice = (n) =>
  n == null ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

// "-2%" not "-2.0%", but "-1.5%" keeps its decimal
export const fmtLevel = (pct) => (pct == null ? '—' : pct % 1 === 0 ? `${pct}` : pct.toFixed(1))

// Severity by % below ATH: mint within 1%, amber 1-3%, rose 3%+
export const severity = (dropPct) => {
  if (dropPct == null)
    return {
      label: 'no data',
      text: 'text-ink-muted',
      chip: 'bg-white/5 text-ink-muted ring-1 ring-white/10',
      bar: '#8A97A6',
    }
  if (dropPct < 1)
    return {
      label: 'near high',
      text: 'text-mint',
      chip: 'bg-mint/10 text-mint ring-1 ring-mint/30',
      bar: '#2FE6A3',
    }
  if (dropPct < 3)
    return {
      label: 'dipping',
      text: 'text-orange',
      chip: 'bg-orange/10 text-orange ring-1 ring-orange/30',
      bar: '#F6C65B',
    }
  return {
    label: 'deep dip',
    text: 'text-coral',
    chip: 'bg-coral/10 text-coral ring-1 ring-coral/30',
    bar: '#FF5E6C',
  }
}

// NSE hours client-side (9:15–15:30 IST, Mon–Fri) so the status bar stays live
// without polling the backend.
export const isMarketOpenIST = (now = new Date()) => {
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = ist.getDay()
  if (day === 0 || day === 6) return false
  const mins = ist.getHours() * 60 + ist.getMinutes()
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30
}

// Backend timestamps are naive UTC (datetime.utcnow); add 'Z' so the browser
// converts to local/IST instead of treating them as local.
const asUTC = (iso) => new Date(iso + (iso.endsWith('Z') ? '' : 'Z'))

// Split a price into integer + 2-decimal fraction for the hero display
// e.g. 23890.15 → { whole: '23,890', frac: '.15' }
export const splitPrice = (n) => {
  if (n == null) return { whole: '—', frac: '' }
  const [int, dec] = n.toFixed(2).split('.')
  return { whole: Number(int).toLocaleString('en-IN'), frac: `.${dec}` }
}

// Exchange + instrument type label from a Yahoo Finance ticker
export const tickerMeta = (ticker = '') => {
  if (ticker.endsWith('=F')) return { exchange: 'COMEX', type: 'Futures', currency: '$' }
  if (ticker === '^GSPC') return { exchange: 'NYSE', type: 'Index', currency: 'pts' }
  if (ticker === '^NDX') return { exchange: 'NASDAQ', type: 'Index', currency: 'pts' }
  if (ticker === '^DJI') return { exchange: 'NYSE', type: 'Index', currency: 'pts' }
  const isIndex = ticker.startsWith('^')
  let exchange = 'NSE'
  if (ticker.endsWith('.BO') || ticker.startsWith('^BSE')) exchange = 'BSE'
  return { exchange, type: isIndex ? 'Index' : 'ETF', currency: '₹' }
}

/* ── Indian-context pricing for dollar-quoted metals ───────────────────────
   COMEX quotes gold and silver in USD per *troy ounce*, which is not a unit
   anyone in India prices metal in — jewellers and MCX quote gold per 10 grams
   and silver per kilogram. Converting to plain ₹/oz would be a rupee number in
   a foreign unit, so we convert the unit as well as the currency. Pattern taken
   from docs/design-refs/gold-local-currency-treasury.png (Mobbin), which prices
   the same global metal as "Rp2.301.436 /gram" for an Indonesian audience.

   IMPORTANT — this is an *international-equivalent* price, not the Indian
   retail or MCX rate. Indian physical gold additionally carries ~6% import duty
   and 3% GST, so the real counter price runs roughly 10% above this. The UI must
   keep saying so; do not quietly relabel these as "MCX" or "jeweller" rates. */
const TROY_OUNCE_G = 31.1034768

/* The USD-quoted family we convert. US indices are points, not prices, and are
   deliberately excluded. This is the *only* place that decision lives — the
   backend supplies `usd_inr` unconditionally rather than second-guessing which
   tickers need it, so widening the rule (a US stock, say) is a one-line change
   here with no backend edit to keep in step. */
export const isMetal = (ticker = '') => ticker.endsWith('=F')

// Indian quoting convention per metal: gold in 10g lots, silver by the kilo.
export const metalUnit = (ticker = '') => {
  if (ticker.startsWith('SI')) return { label: '/kg', grams: 1000 }
  return { label: '/10g', grams: 10 }
}

/* USD per troy ounce -> INR per Indian unit. Returns null (not 0, not NaN) when
   either input is missing so callers can drop the rupee line entirely rather
   than render an invented number. */
export const toIndianMetalPrice = (usdPerOz, ticker, usdInr) => {
  if (usdPerOz == null || usdInr == null || !(usdPerOz > 0) || !(usdInr > 0)) return null
  return (usdPerOz * usdInr * metalUnit(ticker).grams) / TROY_OUNCE_G
}

/* Single source of truth for "how is this asset's price written", used by the
   hero, the watchlist rows and both alert lists so they can never disagree.
   `unit` is a suffix the caller renders muted after the number; null when the
   currency prefix already says everything (₹24,042 needs no trailing unit). */
export const priceParts = (ticker, price, usdInr) => {
  const inr = isMetal(ticker) ? toIndianMetalPrice(price, ticker, usdInr) : null
  if (inr != null) return { prefix: '₹', value: inr, unit: metalUnit(ticker).label }
  const { currency } = tickerMeta(ticker)
  // An index level is not a price — show the unit so a bare number can't be
  // mistaken for one, and never put a currency symbol in front of it.
  if (currency === 'pts') return { prefix: '', value: price, unit: 'pts' }
  return { prefix: currency, value: price, unit: null }
}

// Compact rupee deployment: ₹1L, ₹1.5L, ₹2L (≥1 lakh), else full ₹ amount
export const fmtLakh = (n) => {
  if (n == null) return '—'
  if (n < 100000) return `₹${n.toLocaleString('en-IN')}`
  const l = n / 100000
  return `₹${l % 1 === 0 ? l : l.toFixed(1)}L`
}

const istParts = (iso) =>
  asUTC(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // YYYY-MM-DD

export const isTodayIST = (iso) =>
  iso && istParts(iso) === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export const fmtTimeIST = (iso) =>
  iso
    ? asUTC(iso).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '—'

// "14 Jun" day label in IST
export const fmtDayIST = (iso) =>
  iso
    ? asUTC(iso).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
      })
    : '—'

// Freshness label for the last successful /api/status poll. Takes a client-side
// epoch (Date.now()), not a backend timestamp, so asUTC is deliberately not
// involved here. Prices poll every 60s, so minute resolution is enough.
export const timeAgo = (ms, now = Date.now()) => {
  if (ms == null) return '—'
  const secs = Math.floor((now - ms) / 1000)
  if (secs < 0) return 'just now'
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// "June 2025" month bucket key/label in IST
export const monthLabelIST = (iso) =>
  asUTC(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  })

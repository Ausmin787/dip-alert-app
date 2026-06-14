export const fmtPrice = (n) =>
  n == null ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export const fmtAmount = (n) => (n == null ? '—' : `₹${n.toLocaleString('en-IN')}`)

export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

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

export const istClock = (now = new Date()) =>
  now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

export const todayLine = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

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

// Best-effort exchange + instrument type label from a Yahoo Finance ticker
export const tickerMeta = (ticker = '') => {
  const isIndex = ticker.startsWith('^')
  let exchange = 'NSE'
  if (ticker.endsWith('.BO') || ticker.startsWith('^BSE')) exchange = 'BSE'
  return { exchange, type: isIndex ? 'Index' : 'ETF' }
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

// "June 2025" month bucket key/label in IST
export const monthLabelIST = (iso) =>
  asUTC(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  })

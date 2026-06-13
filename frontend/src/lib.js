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

// Severity by % below ATH: mint within 1%, orange 1-3%, coral 3%+
export const severity = (dropPct) => {
  if (dropPct == null)
    return {
      label: 'no data',
      text: 'text-ink-muted',
      chip: 'bg-white/5 text-ink-muted ring-1 ring-white/10',
      bar: '#999999',
    }
  if (dropPct < 1)
    return {
      label: 'near high',
      text: 'text-mint',
      chip: 'bg-mint/10 text-mint ring-1 ring-mint/30',
      bar: '#34d399',
    }
  if (dropPct < 3)
    return {
      label: 'dipping',
      text: 'text-orange',
      chip: 'bg-orange/10 text-orange ring-1 ring-orange/30',
      bar: '#ff7a3d',
    }
  return {
    label: 'deep dip',
    text: 'text-coral',
    chip: 'bg-coral/10 text-coral ring-1 ring-coral/30',
    bar: '#ff5577',
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

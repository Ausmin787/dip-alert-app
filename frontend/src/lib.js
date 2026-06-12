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

// Severity by % below ATH: green within 1%, amber 1-3%, red 3%+
export const severity = (dropPct) => {
  if (dropPct == null)
    return { label: 'no data', text: 'text-fog-dim', chip: 'bg-white/10 text-fog-dim', glow: '' }
  if (dropPct < 1)
    return {
      label: 'near high',
      text: 'text-moss',
      chip: 'bg-moss/20 text-moss ring-1 ring-moss/30',
      glow: 'shadow-[0_0_70px_-12px_rgba(163,233,116,0.35)]',
    }
  if (dropPct < 3)
    return {
      label: 'dipping',
      text: 'text-amber-soft',
      chip: 'bg-amber-soft/20 text-amber-soft ring-1 ring-amber-soft/30',
      glow: 'shadow-[0_0_70px_-12px_rgba(245,196,81,0.3)]',
    }
  return {
    label: 'deep dip',
    text: 'text-ember',
    chip: 'bg-ember/20 text-ember ring-1 ring-ember/30',
    glow: 'shadow-[0_0_70px_-12px_rgba(255,138,101,0.35)]',
  }
}

export const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export const todayLine = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

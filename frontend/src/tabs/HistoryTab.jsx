import { useCallback, useEffect, useState } from 'react'
import { getAlerts } from '../api.js'
import { useAssets } from '../useAssets.js'
import { fmtDayIST, fmtLakh, fmtLevel, fmtPrice, fmtTimeIST, isTodayIST, monthLabelIST, priceParts } from '../lib.js'
import { ListSkeleton } from '../Skeleton.jsx'
import ErrorCard from '../ErrorCard.jsx'

export default function HistoryTab({ active }) {
  const { selectedItem } = useAssets()
  const [alerts, setAlerts] = useState(null)
  const [error, setError] = useState(null)
  const panelClass = `panel ${active ? 'active animating' : ''}`

  // A failed fetch used to be swallowed into an empty list, which rendered as
  // "No deployment history yet" — indistinguishable from a genuinely empty log.
  const load = useCallback(
    () => getAlerts(1, 100)
      .then((d) => {
        setAlerts(d.alerts)
        setError(null)
      })
      .catch((err) => {
        console.error('Failed to load deployment history', err)
        setError('Deployment history is unavailable — the API server may be down.')
      }),
    [],
  )

  useEffect(() => {
    if (!active) return undefined
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [active, load])

  if (error && alerts === null)
    return (
      <div className={panelClass}>
        <div className="tab-title">History</div>
        <ErrorCard message={error} onRetry={load} />
      </div>
    )

  if (alerts === null)
    return <div className={panelClass}><div className="tab-title">History</div><ListSkeleton rows={3} label="Loading deployment history…" /></div>

  const dipAlerts = alerts.filter((alert) => alert.alert_direction == null)
  const investFor = (alert) => alert.invest_amount ?? 0
  const thisMonth = monthLabelIST(new Date().toISOString())

  // Group into months, preserving the desc order the API returns.
  const groups = []
  const index = new Map()
  for (const a of dipAlerts) {
    const key = monthLabelIST(a.alerted_at)
    if (!index.has(key)) {
      index.set(key, groups.length)
      groups.push({ key, rows: [], total: 0 })
    }
    const g = groups[index.get(key)]
    g.rows.push(a)
    g.total += investFor(a)
  }

  const monthAlerts = dipAlerts.filter((a) => monthLabelIST(a.alerted_at) === thisMonth)
  const deployedThisMonth = monthAlerts.reduce((s, a) => s + investFor(a), 0)
  const maxDipToday = dipAlerts.filter((a) => isTodayIST(a.alerted_at)).reduce((m, a) => Math.max(m, a.drop_pct), 0)
  const selectedIsDip = selectedItem?.alert_mode !== 'momentum'
  const perTrigger = selectedIsDip ? selectedItem?.invest_amount : null
  const nextTarget = selectedIsDip ? selectedItem?.next_alert_level : null

  const { whole } = (() => {
    const [int] = deployedThisMonth.toFixed(0).split('.')
    return { whole: Number(int).toLocaleString('en-IN') }
  })()

  return (
    <div className={panelClass}>
      <div className="tab-title">History</div>

      <div className="g" style={{ padding: 0 }}>
        <div className="summ-top">
          <div className="summ-val"><span>₹</span>{whole}</div>
          <div className="summ-sub">Deployed this month · {thisMonth}</div>
        </div>
        <div className="stat-grid">
          <div className="stat-cell"><div className="stat-v">{monthAlerts.length}</div><div className="stat-l">Alerts fired</div></div>
          <div className="stat-cell"><div className="stat-v">{perTrigger == null ? '—' : fmtLakh(perTrigger)}</div><div className="stat-l">Per trigger</div></div>
          <div className="stat-cell"><div className="stat-v">{maxDipToday > 0 ? `−${maxDipToday.toFixed(0)}%` : '—'}</div><div className="stat-l">Max dip today</div></div>
          <div className="stat-cell"><div className="stat-v">{nextTarget != null ? `−${fmtLevel(nextTarget)}%` : '—'}</div><div className="stat-l">Next target</div></div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="g"><div className="empty">No deployment history yet.<br />Alerts land here as dip levels are crossed.</div></div>
      ) : (
        groups.map((g) => (
          <div className="sec alist" key={g.key}>
            <div className="sec-hd">
              <span className="sec-lbl">{g.key}</span>
              <span style={{ fontSize: 11, color: 'var(--dim)' }}>{fmtLakh(g.total)} deployed</span>
            </div>
            {g.rows.map((a) => {
              // Historical price — no FX conversion, see TodaysAlerts.
              const p = priceParts(a.ticker, a.current_price, null)
              return (
              <div className="ai" key={a.id}>
                <div className="badge old">−{fmtLevel(a.level_pct ?? a.alert_level)}%</div>
                <div className="ai-body">
                  <div className="ai-price">
                    {p.prefix}{fmtPrice(p.value)}
                    {p.unit && <span className="wp-unit">{p.unit}</span>}
                  </div>
                  <div className="ai-sub">{fmtDayIST(a.alerted_at)} · {fmtTimeIST(a.alerted_at)}</div>
                </div>
                <div className="ai-time">{a.invest_amount == null ? 'legacy amount unknown' : `+${fmtLakh(investFor(a))}`}</div>
              </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

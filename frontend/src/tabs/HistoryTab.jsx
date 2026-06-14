import { useEffect, useState } from 'react'
import { getAlerts } from '../api.js'
import { useAssets } from '../useAssets.js'
import { fmtDayIST, fmtLakh, fmtLevel, fmtPrice, fmtTimeIST, isTodayIST, monthLabelIST } from '../lib.js'

export default function HistoryTab() {
  const { items, selectedItem } = useAssets()
  const [alerts, setAlerts] = useState(null)

  useEffect(() => {
    getAlerts(1, 100)
      .then((d) => setAlerts(d.alerts))
      .catch(() => setAlerts([]))
  }, [])

  if (alerts === null)
    return <div className="panel"><div className="tab-title">History</div><div className="empty">Loading…</div></div>

  const investFor = (ticker) => items.find((i) => i.ticker === ticker)?.invest_amount ?? 100000
  const thisMonth = monthLabelIST(new Date().toISOString())

  // Group into months, preserving the desc order the API returns.
  const groups = []
  const index = new Map()
  for (const a of alerts) {
    const key = monthLabelIST(a.alerted_at)
    if (!index.has(key)) {
      index.set(key, groups.length)
      groups.push({ key, rows: [], total: 0 })
    }
    const g = groups[index.get(key)]
    g.rows.push(a)
    g.total += investFor(a.ticker)
  }

  const monthAlerts = alerts.filter((a) => monthLabelIST(a.alerted_at) === thisMonth)
  const deployedThisMonth = monthAlerts.reduce((s, a) => s + investFor(a.ticker), 0)
  const maxDipToday = alerts.filter((a) => isTodayIST(a.alerted_at)).reduce((m, a) => Math.max(m, a.drop_pct), 0)
  const perTrigger = selectedItem?.invest_amount ?? 100000
  const nextTarget = selectedItem?.next_alert_level

  const { whole } = (() => {
    const [int] = deployedThisMonth.toFixed(0).split('.')
    return { whole: Number(int).toLocaleString('en-IN') }
  })()

  return (
    <div className="panel">
      <div className="tab-title">History</div>

      <div className="g" style={{ padding: 0 }}>
        <div className="summ-top">
          <div className="summ-val"><span>₹</span>{whole}</div>
          <div className="summ-sub">Deployed this month · {thisMonth}</div>
        </div>
        <div className="stat-grid">
          <div className="stat-cell"><div className="stat-v">{monthAlerts.length}</div><div className="stat-l">Alerts fired</div></div>
          <div className="stat-cell"><div className="stat-v">{fmtLakh(perTrigger)}</div><div className="stat-l">Per trigger</div></div>
          <div className="stat-cell"><div className="stat-v">{maxDipToday > 0 ? `−${maxDipToday.toFixed(0)}%` : '—'}</div><div className="stat-l">Max dip today</div></div>
          <div className="stat-cell"><div className="stat-v">{nextTarget != null ? `−${fmtLevel(nextTarget)}%` : '—'}</div><div className="stat-l">Next target</div></div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="g"><div className="empty">No deployment history yet.<br />Alerts land here as dip levels are crossed.</div></div>
      ) : (
        groups.map((g) => (
          <div className="g alist" key={g.key}>
            <div className="alist-hd">
              <span className="sec-lbl">{g.key}</span>
              <span style={{ fontSize: 11, color: 'var(--dim)' }}>{fmtLakh(g.total)} deployed</span>
            </div>
            {g.rows.map((a) => (
              <div className="ai" key={a.id}>
                <div className="badge old">−{fmtLevel(a.level_pct ?? a.alert_level)}%</div>
                <div className="ai-body">
                  <div className="ai-price">₹{fmtPrice(a.current_price)}</div>
                  <div className="ai-sub">{fmtDayIST(a.alerted_at)} · {fmtTimeIST(a.alerted_at)}</div>
                </div>
                <div className="ai-time">+{fmtLakh(investFor(a.ticker))}</div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

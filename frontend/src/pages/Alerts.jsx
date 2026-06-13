import { useEffect, useState } from 'react'
import { getAlerts } from '../api.js'
import { Reveal } from '../components/anim.jsx'
import { IconAlertTriangle, IconCheck } from '../components/icons.jsx'
import { fmtDateTime, fmtLevel, fmtPrice, severity } from '../lib.js'

const PAGE_SIZE = 20

export default function Alerts() {
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    let active = true
    getAlerts(page, PAGE_SIZE)
      .then((d) => active && setState({ status: 'ready', data: d }))
      .catch(() => active && setState({ status: 'error', data: null }))
    return () => {
      active = false
    }
  }, [page])

  const goto = (p) => {
    setState({ status: 'loading', data: null })
    setPage(p)
  }

  const data = state.data ?? { alerts: [], total: 0 }
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <Reveal>
        <p className="tag mb-3">Every dip level crossing, logged</p>
        <h1 className="display text-4xl font-bold tracking-tight text-ink">Alert history</h1>
      </Reveal>

      {state.status === 'loading' ? (
        <div className="panel p-8 text-center text-sm text-ink-muted">Loading…</div>
      ) : state.status === 'error' ? (
        <Reveal>
          <div className="panel flex items-center justify-between gap-4 border-coral/40 p-5">
            <p className="flex items-center gap-3 text-sm text-coral">
              <IconAlertTriangle className="h-4 w-4 shrink-0" />
              Couldn't load alerts — the backend may be unreachable.
            </p>
            <button onClick={() => goto(page)} className="btn-ghost shrink-0 !py-2 text-xs">
              Retry
            </button>
          </div>
        </Reveal>
      ) : data.alerts.length === 0 ? (
        <Reveal>
          <div className="panel p-10 text-center text-sm text-ink-muted">
            No alerts logged yet — they'll show up here once a dip level is crossed.
          </div>
        </Reveal>
      ) : (
        <Reveal>
          <div className="panel divide-y divide-hairline">
            {data.alerts.map((a) => {
              const pct = a.level_pct ?? a.alert_level
              const sev = severity(pct)
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`num flex h-10 w-14 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${sev.chip}`}
                    >
                      −{fmtLevel(pct)}%
                    </span>
                    <div>
                      <p className="num text-sm font-medium text-ink">{a.ticker}</p>
                      <p className="num mt-0.5 text-[0.68rem] text-ink-muted">
                        at {fmtPrice(a.current_price)} · ATH {fmtPrice(a.ath_price)} · drop{' '}
                        <span className={sev.text}>{a.drop_pct.toFixed(2)}%</span>
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-[0.65rem] text-ink-muted">{fmtDateTime(a.alerted_at)}</p>
                    <p
                      className={`mt-1 flex items-center justify-end gap-1 text-[0.65rem] font-medium ${
                        a.whatsapp_sent ? 'text-mint' : 'text-ink-muted'
                      }`}
                    >
                      {a.whatsapp_sent && <IconCheck className="h-3 w-3" />}
                      {a.whatsapp_sent ? 'WhatsApp' : 'not sent'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Reveal>
      )}

      {totalPages > 1 && state.status === 'ready' && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => goto(page - 1)}
            className="btn-ghost !py-2 text-xs"
          >
            ← Prev
          </button>
          <span className="num text-xs text-ink-muted">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => goto(page + 1)}
            className="btn-ghost !py-2 text-xs"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

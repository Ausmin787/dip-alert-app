import { useEffect, useState } from 'react'
import { getAlerts } from '../api.js'
import { fmtDateTime, fmtPrice } from '../lib.js'

const PAGE_SIZE = 20

export default function Alerts() {
  const [data, setData] = useState({ alerts: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getAlerts(page, PAGE_SIZE)
      .then(setData)
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <div className="rise pt-3">
        <h1 className="text-gradient font-display text-4xl font-light">Alert History</h1>
        <p className="mt-1.5 text-sm text-fog-dim">
          Every dip level crossing that triggered a WhatsApp alert
        </p>
      </div>

      {loading ? (
        <p className="glass rounded-3xl p-8 text-center text-sm text-fog-dim">Loading…</p>
      ) : data.alerts.length === 0 ? (
        <p className="glass rise rounded-3xl p-8 text-center text-sm text-fog-dim">
          No alerts logged yet — they'll show up here once a dip level is crossed.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.alerts.map((a, i) => (
            <li
              key={a.id}
              className="glass rise rounded-[1.5rem] p-4 sm:p-5"
              style={{ animationDelay: `${60 + i * 40}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="num flex h-11 w-14 shrink-0 items-center justify-center rounded-2xl bg-ember/20 text-sm font-bold text-ember ring-1 ring-ember/30">
                    −{a.alert_level}%
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fog">{a.ticker}</p>
                    <p className="num mt-0.5 text-xs text-fog-dim">
                      at {fmtPrice(a.current_price)} · ATH {fmtPrice(a.ath_price)} · drop{' '}
                      <span className="text-amber-soft">{a.drop_pct.toFixed(2)}%</span>
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[0.7rem] text-fog-dim">{fmtDateTime(a.alerted_at)}</p>
                  <p className={`mt-1 text-[0.7rem] font-medium ${a.whatsapp_sent ? 'text-moss' : 'text-fog-dim'}`}>
                    {a.whatsapp_sent ? 'WhatsApp ✓' : 'not sent'}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="pressable rounded-full px-4 py-2.5 text-fog-dim hover:bg-white/10 hover:text-fog disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="num text-fog-dim">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="pressable rounded-full px-4 py-2.5 text-fog-dim hover:bg-white/10 hover:text-fog disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

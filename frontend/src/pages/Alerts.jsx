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
    <div className="space-y-6">
      <div className="rise pt-4">
        <h1 className="font-display text-4xl font-light text-fog">Alert History</h1>
        <p className="mt-1 text-sm text-fog-dim">
          Every dip level crossing that triggered a WhatsApp alert
        </p>
      </div>

      <div className="glass rise overflow-hidden rounded-3xl" style={{ animationDelay: '100ms' }}>
        {loading ? (
          <p className="p-8 text-center text-sm text-fog-dim">Loading…</p>
        ) : data.alerts.length === 0 ? (
          <p className="p-8 text-center text-sm text-fog-dim">
            No alerts logged yet. They'll show up here once a dip level is crossed.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/8 text-xs tracking-wide text-fog-dim uppercase">
                <th className="px-5 py-4 font-medium">When</th>
                <th className="px-5 py-4 font-medium">Ticker</th>
                <th className="px-5 py-4 font-medium">Level</th>
                <th className="hidden px-5 py-4 font-medium sm:table-cell">Price</th>
                <th className="hidden px-5 py-4 font-medium sm:table-cell">ATH</th>
                <th className="px-5 py-4 font-medium">Drop</th>
                <th className="hidden px-5 py-4 font-medium sm:table-cell">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {data.alerts.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-white/4">
                  <td className="px-5 py-4 text-fog-dim">{fmtDateTime(a.alerted_at)}</td>
                  <td className="px-5 py-4 text-fog">{a.ticker}</td>
                  <td className="px-5 py-4">
                    <span className="num rounded-full bg-ember/15 px-2.5 py-1 text-xs font-semibold text-ember">
                      −{a.alert_level}%
                    </span>
                  </td>
                  <td className="num hidden px-5 py-4 text-fog sm:table-cell">
                    {fmtPrice(a.current_price)}
                  </td>
                  <td className="num hidden px-5 py-4 text-fog-dim sm:table-cell">
                    {fmtPrice(a.ath_price)}
                  </td>
                  <td className="num px-5 py-4 text-amber-soft">{a.drop_pct.toFixed(2)}%</td>
                  <td className="hidden px-5 py-4 sm:table-cell">
                    {a.whatsapp_sent ? (
                      <span className="text-moss">sent ✓</span>
                    ) : (
                      <span className="text-fog-dim">not sent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-full px-4 py-2 text-fog-dim hover:bg-white/8 hover:text-fog disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="num text-fog-dim">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-full px-4 py-2 text-fog-dim hover:bg-white/8 hover:text-fog disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

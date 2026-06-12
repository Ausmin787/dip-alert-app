import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getAlerts, getHistory, getStatus } from '../api.js'
import { IconExternal, IconTrendDown } from '../components/icons.jsx'
import { fmtAmount, fmtDate, fmtDateTime, fmtPrice, greeting, severity } from '../lib.js'

function StatusCard({ item, delay }) {
  const sev = severity(item.drop_pct)
  return (
    <div
      className={`glass rise rounded-3xl p-6 ${sev.glow}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-fog">{item.display_name}</h3>
          <p className="text-xs tracking-wide text-fog-dim">{item.ticker}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${sev.chip}`}>
          {item.active ? sev.label : 'paused'}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="num font-display text-4xl font-light text-fog">
            {fmtPrice(item.current_price)}
          </p>
          <p className="num mt-1 text-xs text-fog-dim">
            ATH {fmtPrice(item.ath_price)} · {fmtDate(item.ath_date)}
          </p>
        </div>
        <div className="text-right">
          <p className={`num text-2xl font-semibold ${sev.text}`}>
            {item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}
          </p>
          <p className="text-xs text-fog-dim">below ATH</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
        <div className="text-xs text-fog-dim">
          <p>
            Next alert at{' '}
            <span className="num font-medium text-fog">
              −{item.next_alert_level != null ? item.next_alert_level.toFixed(1) : '?'}%
            </span>
          </p>
          <p className="mt-0.5">
            Reminder <span className="num text-fog">{fmtAmount(item.invest_amount)}</span> per dip
          </p>
        </div>
        {item.broker_url && (
          <a
            href={item.broker_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-ink transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Buy Now <IconExternal className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

function DipChart({ ticker, ath }) {
  const [data, setData] = useState([])

  useEffect(() => {
    if (!ticker) return
    getHistory(ticker, 30).then(setData).catch(() => setData([]))
  }, [ticker])

  if (!data.length) return null

  const min = Math.min(...data.map((d) => d.close), ath ?? Infinity)
  const max = Math.max(...data.map((d) => d.close), ath ?? 0)
  const pad = (max - min) * 0.08

  return (
    <div className="glass rise rounded-3xl p-6" style={{ animationDelay: '200ms' }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium tracking-wide text-fog-dim uppercase">
          Last 30 days vs ATH
        </h3>
        <span className="text-xs text-fog-dim">{ticker}</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mossFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9fe870" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#9fe870" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9aa39a', fontSize: 11 }}
            tickFormatter={(d) => d.slice(5)}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fill: '#9aa39a', fontSize: 11 }}
            tickFormatter={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(10,14,11,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              color: '#e8ece6',
              fontSize: 13,
            }}
            formatter={(v) => [fmtPrice(v), 'Close']}
          />
          {ath && (
            <ReferenceLine
              y={ath}
              stroke="#f5c451"
              strokeDasharray="6 4"
              label={{ value: 'ATH', fill: '#f5c451', fontSize: 11, position: 'insideTopRight' }}
            />
          )}
          <Area
            type="monotone"
            dataKey="close"
            stroke="#9fe870"
            strokeWidth={2}
            fill="url(#mossFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState(null)

  const load = () => {
    getStatus()
      .then((s) => {
        setStatus(s)
        setError(null)
      })
      .catch(() => setError('Backend unreachable — is the API server running?'))
    getAlerts(1, 10)
      .then((a) => setAlerts(a.alerts))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  const primary = status?.items?.find((i) => i.active) ?? status?.items?.[0]

  return (
    <div className="space-y-6">
      <section className="rise pt-4 pb-2" style={{ animationDelay: '0ms' }}>
        <p className="mb-2 flex items-center gap-2 text-xs tracking-widest text-fog-dim uppercase">
          <span
            className={`live-dot inline-block h-2 w-2 rounded-full ${
              status?.market_open ? 'bg-moss' : 'bg-fog-dim'
            }`}
          />
          {status ? (status.market_open ? 'Market open · NSE' : 'Market closed · NSE') : 'Connecting…'}
        </p>
        <h1 className="font-display text-5xl font-light tracking-tight text-fog sm:text-6xl">
          {greeting()}
        </h1>
        <p className="font-display mt-1 text-2xl font-light text-moss/80 italic sm:text-3xl">
          watching the dips for you
        </p>
      </section>

      {error && (
        <div className="glass rounded-2xl border-ember/40 p-4 text-sm text-ember">{error}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {status?.items?.map((item, i) => (
          <StatusCard key={item.id} item={item} delay={100 + i * 80} />
        ))}
      </div>

      {primary && <DipChart ticker={primary.ticker} ath={primary.ath_price} />}

      <section className="glass rise rounded-3xl p-6" style={{ animationDelay: '300ms' }}>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wide text-fog-dim uppercase">
          <IconTrendDown className="h-4 w-4" /> Recent alerts
        </h3>
        {alerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-fog-dim">
            No alerts yet — they'll appear here when Nifty crosses a new dip level.
          </p>
        ) : (
          <ul className="divide-y divide-white/6">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="num rounded-full bg-ember/15 px-2.5 py-1 text-xs font-semibold text-ember">
                    −{a.alert_level}%
                  </span>
                  <div>
                    <p className="text-sm text-fog">{a.ticker}</p>
                    <p className="num text-xs text-fog-dim">
                      {fmtPrice(a.current_price)} · drop {a.drop_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <span className="text-xs text-fog-dim">{fmtDateTime(a.alerted_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

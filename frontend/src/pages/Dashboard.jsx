import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getAlerts, getHistory, getStatus } from '../api.js'
import DipLadder from '../components/DipLadder.jsx'
import { IconExternal, IconTrendDown } from '../components/icons.jsx'
import { fmtAmount, fmtDate, fmtDateTime, fmtPrice, greeting, severity, todayLine } from '../lib.js'

function StatusCard({ item, delay }) {
  const sev = severity(item.drop_pct)
  return (
    <article
      className={`glass rise min-w-0 rounded-[1.75rem] p-5 sm:p-6 ${sev.glow}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.05rem] font-medium text-fog">{item.display_name}</h3>
          <p className="text-xs tracking-wide text-fog-dim">{item.ticker}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold tracking-wide uppercase ${sev.chip}`}>
          {item.active ? sev.label : 'paused'}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="num font-display text-[2.6rem] leading-none font-light text-fog sm:text-5xl">
            {fmtPrice(item.current_price)}
          </p>
          <p className="num mt-2 text-xs text-fog-dim">
            ATH {fmtPrice(item.ath_price)} · {fmtDate(item.ath_date)}
          </p>
        </div>
        <div className="text-right">
          <p className={`num text-2xl font-semibold ${sev.text}`}>
            {item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}
          </p>
          <p className="text-[0.7rem] tracking-wide text-fog-dim uppercase">below ATH</p>
        </div>
      </div>

      <div className="mt-5">
        <DipLadder
          thresholdPct={item.threshold_pct}
          dropPct={item.drop_pct}
          lastAlertedLevel={item.last_alerted_level}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-fog-dim">
          Next alert at{' '}
          <span className="num font-semibold text-fog">
            −{item.next_alert_level != null ? item.next_alert_level.toFixed(1) : '?'}%
          </span>{' '}
          · reminder <span className="num text-fog">{fmtAmount(item.invest_amount)}</span> per dip
        </p>
        {item.broker_url && (
          <a
            href={item.broker_url}
            target="_blank"
            rel="noreferrer"
            className="pressable flex items-center justify-center gap-2 rounded-full bg-moss px-6 py-3 text-sm font-semibold text-ink shadow-[0_8px_24px_-8px_rgba(163,233,116,0.6)] sm:py-2.5"
          >
            Buy Now <IconExternal className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
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
    <section className="glass rise rounded-[1.75rem] p-5 sm:p-6" style={{ animationDelay: '200ms' }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[0.7rem] font-semibold tracking-[0.18em] text-fog-dim uppercase">
          Last 30 days vs ATH
        </h3>
        <span className="text-xs text-fog-dim">{ticker}</span>
      </div>
      <div className="-mx-2">
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mossFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a3e974" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#a3e974" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: '#a8b3a6', fontSize: 10 }}
              tickFormatter={(d) => d.slice(5)}
              axisLine={false}
              tickLine={false}
              minTickGap={50}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tick={{ fill: '#a8b3a6', fontSize: 10 }}
              tickFormatter={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(12, 18, 13, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 14,
                color: '#eef2ea',
                fontSize: 13,
              }}
              formatter={(v) => [fmtPrice(v), 'Close']}
            />
            {ath && (
              <ReferenceLine
                y={ath}
                stroke="#f5c451"
                strokeDasharray="5 5"
                label={{ value: 'ATH', fill: '#f5c451', fontSize: 10, position: 'insideTopRight' }}
              />
            )}
            <Area
              type="monotone"
              dataKey="close"
              stroke="#a3e974"
              strokeWidth={2.5}
              fill="url(#mossFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

const subtitleFor = (status) => {
  const worst = Math.max(0, ...(status?.items ?? []).map((i) => i.drop_pct ?? 0))
  if (worst >= 3) return 'the dip is here — stay ready'
  if (worst >= 1) return 'a dip is forming, eyes open'
  return 'watching the dips for you'
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
    getAlerts(1, 8)
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
    <div className="space-y-5">
      <section className="rise pt-3 pb-1" style={{ animationDelay: '0ms' }}>
        <p className="mb-3 flex items-center gap-2 text-[0.65rem] font-medium tracking-[0.2em] text-fog-dim uppercase">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              status?.market_open ? 'live-dot bg-moss' : 'bg-fog-dim/70'
            }`}
          />
          {status
            ? `${status.market_open ? 'Market open' : 'Market closed'} · ${todayLine()}`
            : 'Connecting…'}
        </p>
        <h1 className="text-gradient font-display text-[3rem] leading-[1.02] font-light tracking-tight sm:text-6xl">
          {greeting()}
        </h1>
        <p className="font-display mt-2 text-xl font-light text-moss/90 italic sm:text-2xl">
          {subtitleFor(status)}
        </p>
      </section>

      {error && (
        <div className="glass rounded-3xl p-4 text-sm text-ember">{error}</div>
      )}

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        {status?.items?.map((item, i) => (
          <StatusCard key={item.id} item={item} delay={90 + i * 80} />
        ))}
      </div>

      {primary && <DipChart ticker={primary.ticker} ath={primary.ath_price} />}

      <section className="glass rise rounded-[1.75rem] p-5 sm:p-6" style={{ animationDelay: '280ms' }}>
        <h3 className="mb-4 flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.18em] text-fog-dim uppercase">
          <IconTrendDown className="h-4 w-4" /> Recent alerts
        </h3>
        {alerts.length === 0 ? (
          <p className="py-5 text-center text-sm text-fog-dim">
            No alerts yet — they'll land here when Nifty crosses a new dip level.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/4 px-4 py-3 ring-1 ring-white/8"
              >
                <div className="flex items-center gap-3">
                  <span className="num rounded-full bg-ember/20 px-2.5 py-1 text-xs font-bold text-ember ring-1 ring-ember/30">
                    −{a.alert_level}%
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fog">{a.ticker}</p>
                    <p className="num text-xs text-fog-dim">
                      {fmtPrice(a.current_price)} · drop {a.drop_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[0.7rem] text-fog-dim">{fmtDateTime(a.alerted_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

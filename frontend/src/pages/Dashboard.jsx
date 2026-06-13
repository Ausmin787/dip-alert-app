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
import Sparkline from '../components/Sparkline.jsx'
import { AnimatedNumber, Reveal } from '../components/motion.jsx'
import { IconAlertTriangle, IconExternal, IconTrendDown } from '../components/icons.jsx'
import { fmtAmount, fmtDate, fmtDateTime, fmtLevel, fmtPrice, severity, todayLine } from '../lib.js'

function HeroAsset({ item, history }) {
  const sev = severity(item.drop_pct)
  const closes = history.map((d) => d.close)

  return (
    <Reveal delay={0.08}>
      <article className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-frost">
              {item.display_name}
            </h2>
            <span className="num mt-1 inline-block rounded-md bg-white/4 px-2 py-0.5 text-[0.65rem] text-mist ring-1 ring-white/8">
              {item.ticker}
            </span>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.14em] uppercase ${sev.chip}`}>
            {item.active ? sev.label : 'paused'}
          </span>
        </div>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
          <div>
            <p className="tag mb-2">Last price</p>
            <AnimatedNumber
              value={item.current_price}
              format={fmtPrice}
              className="num block text-[2.75rem] leading-none font-semibold tracking-tight text-frost sm:text-[3.4rem]"
            />
            <p className="num mt-3 text-xs text-mist">
              ATH {fmtPrice(item.ath_price)} · {fmtDate(item.ath_date)}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-end justify-between gap-x-7 gap-y-5 lg:w-auto lg:justify-end">
            {closes.length > 1 && <Sparkline data={closes} stroke={sev.bar} />}
            <div className="text-right">
              <p className="tag mb-2">Drawdown</p>
              <p className={`num text-3xl font-semibold sm:text-4xl ${sev.text}`}>
                {item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <DipLadder
            thresholdPct={item.threshold_pct}
            dropPct={item.drop_pct}
            lastAlertedLevel={item.last_alerted_level}
          />
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/6 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-mist">
            Next alert at{' '}
            <span className="num font-semibold text-pulse">
              −{item.next_alert_level != null ? fmtLevel(item.next_alert_level) : '?'}%
            </span>{' '}
            · deploy <span className="num font-semibold text-frost">{fmtAmount(item.invest_amount)}</span>{' '}
            per level
          </p>
          {item.broker_url && (
            <a href={item.broker_url} target="_blank" rel="noreferrer" className="btn-primary">
              Buy the dip <IconExternal className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </article>
    </Reveal>
  )
}

function CompactAsset({ item, delay }) {
  const sev = severity(item.drop_pct)
  return (
    <Reveal delay={delay}>
      <article className="panel panel-hover p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-frost">{item.display_name}</h3>
            <p className="num mt-0.5 text-[0.65rem] text-mist">{item.ticker}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[0.6rem] font-semibold tracking-[0.12em] uppercase ${sev.chip}`}>
            {item.active ? sev.label : 'paused'}
          </span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <p className="num text-2xl font-semibold text-frost">{fmtPrice(item.current_price)}</p>
          <p className={`num text-sm font-semibold ${sev.text}`}>
            {item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}
          </p>
        </div>
        <p className="num mt-2 text-[0.65rem] text-mist">
          next −{item.next_alert_level != null ? fmtLevel(item.next_alert_level) : '?'}% · ATH{' '}
          {fmtPrice(item.ath_price)}
        </p>
      </article>
    </Reveal>
  )
}

function DipChart({ ticker, ath, data }) {
  if (!data.length) return null
  const min = Math.min(...data.map((d) => d.close), ath ?? Infinity)
  const max = Math.max(...data.map((d) => d.close), ath ?? 0)
  const pad = (max - min) * 0.08

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="tag">30-day trace vs ATH</h3>
        <span className="num text-[0.65rem] text-mist">{ticker}</span>
      </div>
      <div className="-mx-2">
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6e6bff" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#6e6bff" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: '#878da1', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(d) => d.slice(5)}
              axisLine={false}
              tickLine={false}
              minTickGap={50}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tick={{ fill: '#878da1', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(19, 22, 34, 0.95)',
                border: '1px solid rgba(110,107,255,0.3)',
                borderRadius: 10,
                color: '#e9ebf1',
                fontSize: 12,
                fontFamily: 'JetBrains Mono',
              }}
              formatter={(v) => [fmtPrice(v), 'close']}
            />
            {ath && (
              <ReferenceLine
                y={ath}
                stroke="#fbbf24"
                strokeDasharray="5 5"
                label={{
                  value: 'ATH',
                  fill: '#fbbf24',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                  position: 'insideTopRight',
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="close"
              stroke="#6e6bff"
              strokeWidth={2}
              fill="url(#pulseFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function RecentAlerts({ alerts }) {
  return (
    <section className="panel flex h-full flex-col p-5 sm:p-6">
      <h3 className="tag mb-4 flex items-center gap-2">
        <IconTrendDown className="h-3.5 w-3.5" /> Recent alerts
      </h3>
      {alerts.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-xs leading-relaxed text-mist">
          No alerts yet — they land here when
          <br />a new dip level is crossed.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const pct = a.level_pct ?? a.alert_level
            const sev = severity(pct)
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/2 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className={`num rounded-lg px-2 py-1 text-[0.7rem] font-bold ${sev.chip}`}>
                    −{fmtLevel(pct)}%
                  </span>
                  <div>
                    <p className="num text-xs font-medium text-frost">{a.ticker}</p>
                    <p className="num text-[0.65rem] text-mist">{fmtPrice(a.current_price)}</p>
                  </div>
                </div>
                <span className="num shrink-0 text-[0.62rem] text-mist">{fmtDateTime(a.alerted_at)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const subtitleFor = (status) => {
  const worst = Math.max(0, ...(status?.items ?? []).map((i) => i.drop_pct ?? 0))
  if (worst >= 3) return 'The dip is here. Stay ready.'
  if (worst >= 1) return 'A dip is forming — eyes open.'
  return 'All quiet near the highs.'
}

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)

  const load = () => {
    getStatus()
      .then((s) => {
        setStatus(s)
        setError(null)
      })
      .catch(() => setError('Backend unreachable — is the API server running?'))
    getAlerts(1, 6)
      .then((a) => setAlerts(a.alerts))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  const primary = status?.items?.find((i) => i.active) ?? status?.items?.[0]
  const rest = status?.items?.filter((i) => i.id !== primary?.id) ?? []

  useEffect(() => {
    if (!primary?.ticker) return
    getHistory(primary.ticker, 30)
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [primary?.ticker])

  return (
    <div className="space-y-5">
      <Reveal>
        <p className="tag mb-3">{todayLine()} · refreshed every 60s</p>
        <h1 className="text-gradient font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {subtitleFor(status)}
        </h1>
      </Reveal>

      {error && (
        <Reveal>
          <div className="panel flex items-center gap-3 border-blush/30 p-4 text-sm text-blush">
            <IconAlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        </Reveal>
      )}

      {primary && <HeroAsset item={primary} history={history} />}

      {rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((item, i) => (
            <CompactAsset key={item.id} item={item} delay={0.16 + i * 0.07} />
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Reveal delay={0.2} className="xl:col-span-2">
          {primary && <DipChart ticker={primary.ticker} ath={primary.ath_price} data={history} />}
        </Reveal>
        <Reveal delay={0.26}>
          <RecentAlerts alerts={alerts} />
        </Reveal>
      </div>
    </div>
  )
}

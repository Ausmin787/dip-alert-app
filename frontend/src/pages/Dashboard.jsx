import { Suspense, lazy, useEffect, useState } from 'react'
import { getAlerts } from '../api.js'
import DipLadder from '../components/DipLadder.jsx'
import Sparkline from '../components/Sparkline.jsx'
import { CountUp, Magnetic, Reveal, SplitReveal } from '../components/anim.jsx'
import { useReducedMotion } from '../components/useReducedMotion.js'
import { IconAlertTriangle, IconExternal, IconTrendDown } from '../components/icons.jsx'
import { fmtAmount, fmtDate, fmtDateTime, fmtLevel, fmtPrice, severity, todayLine } from '../lib.js'
import { useAssets } from '../useAssets.js'

const IndexOrb = lazy(() => import('../components/three/IndexOrb.jsx'))
const DipChart = lazy(() => import('../components/DipChart.jsx'))

function OrbFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(45,125,255,0.45),transparent_70%)] blur-2xl" />
    </div>
  )
}

const spotlightBg = (dropPct) => {
  const linear =
    dropPct == null || dropPct < 1
      ? 'linear-gradient(135deg, #2D7DFF, #20C7B5)'
      : dropPct < 3
        ? 'linear-gradient(135deg, #F6C65B, #2D7DFF)'
        : 'linear-gradient(135deg, #FF5E6C, #2D7DFF)'
  return `radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.18), transparent 45%), ${linear}`
}

function HeroAsset({ item, history }) {
  const sev = severity(item.drop_pct)
  const closes = history.map((d) => d.close)

  return (
    <Reveal>
      <article className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="display text-xl font-bold tracking-tight text-ink">{item.display_name}</h2>
            <span className="num mt-1 inline-block rounded-md bg-surface-2 px-2 py-0.5 text-[0.65rem] text-ink-muted ring-1 ring-hairline">
              {item.ticker}
            </span>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.1em] uppercase ${sev.chip}`}
          >
            {item.active ? sev.label : 'paused'}
          </span>
        </div>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
          <div>
            <p className="tag mb-2">Last price</p>
            <CountUp
              value={item.current_price}
              format={fmtPrice}
              className="num display block text-[2.75rem] leading-none font-bold text-ink sm:text-[3.4rem]"
            />
            <p className="num mt-3 text-xs text-ink-muted">
              ATH {fmtPrice(item.ath_price)} · {fmtDate(item.ath_date)}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-end justify-between gap-x-7 gap-y-5 lg:w-auto lg:justify-end">
            {closes.length > 1 && <Sparkline data={closes} stroke={sev.bar} />}
            <div className="text-right">
              <p className="tag mb-2">Drawdown</p>
              <p className={`num display text-3xl font-bold sm:text-4xl ${sev.text}`}>
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
      </article>
    </Reveal>
  )
}

function SpotlightCTA({ item }) {
  const sev = severity(item.drop_pct)
  return (
    <Reveal>
      <article
        className="spotlight flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: spotlightBg(item.drop_pct) }}
      >
        <div>
          <p className="text-sm font-medium tracking-wide text-white/75 uppercase">Next buy signal</p>
          <p className="display mt-2 text-5xl font-bold text-white">
            −{item.next_alert_level != null ? fmtLevel(item.next_alert_level) : '?'}%
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
            Deploy <span className="num font-semibold text-white">{fmtAmount(item.invest_amount)}</span>{' '}
            at every −{fmtLevel(item.threshold_pct)}% step from the all-time high · {sev.label}.
          </p>
        </div>
        {item.broker_url && (
          <Magnetic className="shrink-0">
            <a href={item.broker_url} target="_blank" rel="noreferrer" className="btn-primary">
              Buy the dip <IconExternal className="h-3.5 w-3.5" />
            </a>
          </Magnetic>
        )}
      </article>
    </Reveal>
  )
}

function RecentAlerts({ alerts }) {
  return (
    <section className="panel flex h-full flex-col p-5 sm:p-6">
      <h3 className="tag mb-4 flex items-center gap-2">
        <IconTrendDown className="h-3.5 w-3.5" /> Recent alerts
      </h3>
      {alerts.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-xs leading-relaxed text-ink-muted">
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
                className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-2 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className={`num rounded-lg px-2 py-1 text-[0.7rem] font-bold ${sev.chip}`}>
                    −{fmtLevel(pct)}%
                  </span>
                  <div>
                    <p className="num text-xs font-medium text-ink">{a.ticker}</p>
                    <p className="num text-[0.65rem] text-ink-muted">{fmtPrice(a.current_price)}</p>
                  </div>
                </div>
                <span className="num shrink-0 text-[0.62rem] text-ink-muted">
                  {fmtDateTime(a.alerted_at)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function MobileAssetSwitcher({ items, selectedAsset, setSelectedAsset }) {
  if (!items || items.length <= 1) return null

  return (
    <div className="md:hidden w-full overflow-x-auto scrollbar-none py-2 -mx-4 px-4 flex gap-2.5">
      {items.map((item) => {
        const isSelected = selectedAsset === item.ticker
        const sev = severity(item.drop_pct)
        return (
          <button
            key={item.id}
            onClick={() => setSelectedAsset(item.ticker)}
            className={`num flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              isSelected
                ? 'bg-surface-2 border-accent text-ink shadow-[0_2px_10px_-4px_rgba(45,125,255,0.4)]'
                : 'bg-surface-1/40 border-hairline text-ink-muted hover:bg-surface-2/40'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${item.active ? (item.drop_pct < 1 ? 'bg-mint' : sev.bar === '#FF5E6C' ? 'bg-coral' : 'bg-orange') : 'bg-ink-muted/50'}`} />
            <span>{item.ticker}</span>
            <span className={item.active ? sev.text : 'text-ink-muted'}>
              {item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const subtitleFor = (items) => {
  const worst = Math.max(0, ...(items ?? []).map((i) => i.drop_pct ?? 0))
  if (worst >= 3) return 'The dip is here. Stay ready.'
  if (worst >= 1) return 'A dip is forming — eyes open.'
  return 'All quiet near the highs.'
}

export default function Dashboard() {
  const { items, selectedAsset, setSelectedAsset, selectedItem, history, loading, error } = useAssets()
  const [alerts, setAlerts] = useState([])
  const reduced = useReducedMotion()

  useEffect(() => {
    getAlerts(1, 6)
      .then((a) => setAlerts(a.alerts))
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-ink-muted">
        Loading dashboard...
      </div>
    )
  }

  const primary = selectedItem
  const orbDrop = primary?.drop_pct ?? null
  const orbLevel =
    primary && primary.drop_pct != null ? Math.floor(primary.drop_pct / primary.threshold_pct) : 0

  return (
    <div className="space-y-6">
      <section className="grid items-center gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="tag mb-4">{todayLine()} · refreshed every 60s</p>
          <h1 className="display text-5xl text-ink sm:text-6xl">
            <SplitReveal text={subtitleFor(items)} />
          </h1>
          <p className="mt-5 max-w-md leading-relaxed text-ink-muted">
            ₹1L deployed for every −1% fall from the all-time high. The orb glows calm near the top and
            burns coral as the drawdown deepens.
          </p>
          
          <div className="mt-6">
            <MobileAssetSwitcher items={items} selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} />
          </div>
        </div>
        <div className="relative h-[260px] sm:h-[340px]">
          <Suspense fallback={<OrbFallback />}>
            <IndexOrb dropPct={orbDrop} level={orbLevel} reduced={reduced} className="absolute inset-0" />
          </Suspense>
        </div>
      </section>

      {error && (
        <Reveal>
          <div className="panel flex items-center gap-3 border-coral/40 p-4 text-sm text-coral">
            <IconAlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        </Reveal>
      )}

      {primary ? (
        <>
          <HeroAsset item={primary} history={history} />
          <SpotlightCTA item={primary} />

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {history.length > 0 && (
                <Suspense fallback={<div className="panel h-[296px]" />}>
                  <DipChart ticker={primary.ticker} ath={primary.ath_price} data={history} />
                </Suspense>
              )}
            </div>
            <RecentAlerts alerts={alerts} />
          </div>
        </>
      ) : (
        <Reveal>
          <div className="panel p-10 text-center">
            <p className="text-sm text-ink-muted">No assets under watch — add your first asset in the Watchlist tab.</p>
          </div>
        </Reveal>
      )}
    </div>
  )
}

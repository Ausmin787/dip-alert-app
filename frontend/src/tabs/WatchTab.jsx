import { useEffect, useRef, useState } from 'react'
import { getAlerts, getSettings } from '../api.js'
import { useAssets } from '../useAssets.js'
import { gsap, useGSAP, prefersReducedMotion } from '../gsap.js'
import GlassSurface from '../GlassSurface.jsx'
import { WatchSkeleton } from '../Skeleton.jsx'
import ErrorCard from '../ErrorCard.jsx'
import {
  fmtLakh,
  fmtLevel,
  fmtPrice,
  fmtTimeIST,
  isMarketOpenIST,
  isMetal,
  isTodayIST,
  priceParts,
  splitPrice,
  tickerMeta,
  timeAgo,
} from '../lib.js'

// Re-render on an interval so relative timestamps stay honest between the 60s
// status polls. Mirrors the hand-rolled interval pattern in StatusBar/AppHeader.
function useTick(ms) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

// Five dip-level pills, windowed so the next level to fire is always visible.
function dipLevels(item) {
  const threshold = item.threshold_pct || 1
  const fired = item.last_alerted_level || 0
  const nextIdx = item.next_alert_level != null ? Math.round(item.next_alert_level / threshold) : null
  const lastIdx = Math.max(5, nextIdx ?? 0)
  const start = Math.max(1, lastIdx - 4)
  return Array.from({ length: 5 }, (_, k) => {
    const i = start + k
    const state = i <= fired ? 'done' : i === nextIdx ? 'next' : ''
    return { i, pct: i * threshold, state }
  })
}

function Hero({ item, lastUpdated, usdInr }) {
  useTick(30_000)
  const { exchange } = tickerMeta(item.ticker)

  /* Metals lead in Indian units (₹/10g, ₹/kg) with the COMEX dollar quote and
     the exact rate used disclosed underneath — the Wise "using this exchange
     rate ×1.1723" honesty pattern from docs/design-refs. If FX is unavailable
     `priceParts` falls back to the plain dollar quote rather than showing a
     stale or invented rupee figure. */
  const { prefix, value, unit } = priceParts(item.ticker, item.current_price, usdInr)
  const { whole, frac } = splitPrice(value)
  const showFx = isMetal(item.ticker) && prefix === '₹'

  const isMomentum = item.alert_mode === 'momentum'
  const open = isMomentum ? item.active : isMarketOpenIST()
  const change = item.daily_change_pct
  const changeUp = change != null && change > 0
  const changeDown = change != null && change < 0

  return (
    <GlassSurface className="g glass hero dash-card">
      <div className="hero-asset">
        <div className={`green-dot ${item.active ? '' : 'off'}`} />
        {item.display_name} · {exchange}
      </div>
      <div className="hero-price-row">
        {prefix && <span className="hcur">{prefix}</span>}
        <span className="hnum">{whole}</span>
        <span className="hdec">{frac}</span>
        {/* Unit rides as a muted suffix: "/10g" for metals, "pts" for indices.
            A bare index number with no unit read as if it were a price. */}
        {unit && <span className="hunit">{unit}</span>}
      </div>
      {showFx && (
        <div className="hero-fx">
          <span className="hfx-src">${fmtPrice(item.current_price)}/oz</span>
          <span className="hfx-rate">@ ₹{usdInr.toFixed(2)}/$</span>
          {/* Never let this read as the jeweller/MCX rate — Indian physical
              metal adds ~6% import duty and 3% GST on top of this figure. */}
          <span className="hfx-note">International equivalent · excludes duty &amp; GST</span>
        </div>
      )}
      <div className="hero-dip-row">
        {isMomentum ? (
          <>
            <span className={`hdip ${changeUp ? 'chg-up' : changeDown ? 'chg-dn' : ''}`}>
              {change != null ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
            </span>
            <div className="hath-block">
              <div className="hath-lbl">vs yesterday's close</div>
              <div className="hath-val">Daily change</div>
            </div>
          </>
        ) : (
          <>
            <span className="hdip">{item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}</span>
            <div className="hath-block">
              <div className="hath-lbl">from all-time high</div>
              <div className="hath-val">ATH {fmtPrice(item.ath_price)}</div>
            </div>
          </>
        )}
      </div>
      <div className="hero-divider" />
      <div className="hero-meta">
        <div className={`open-dot ${open ? '' : 'off'}`} />
        <span className="open-lbl">
          {isMomentum ? (open ? 'Momentum monitoring' : 'Monitoring paused') : (open ? 'Market open' : 'Market closed')}
        </span>
        {/* Freshness, not status — a price-watching app has to say how old the
            number is. Live/paused is already carried by open-lbl and the dot. */}
        <span className="upd-time" title="Time since the last successful price update">
          {item.active ? timeAgo(lastUpdated) : 'Paused'}
        </span>
      </div>
    </GlassSurface>
  )
}

function Tracker({ item }) {
  const levels = dipLevels(item)
  const fired = item.last_alerted_level || 0
  const deployed = fired * (item.invest_amount || 0)
  const pillRefs = useRef({})
  const prevFired = useRef(fired)

  useGSAP(() => {
    if (fired > prevFired.current) {
      const el = pillRefs.current[fired]
      if (el && !prefersReducedMotion()) {
        gsap.fromTo(el, { scale: 1 }, { scale: 1.14, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 })
      }
    }
    prevFired.current = fired
  }, [fired])

  return (
    <div className="g tracker dash-card">
      <div className="row-hd">
        <span className="sec-lbl">Dip Levels</span>
        <span className="dep-note">
          <strong>{fired}</strong> fired{fired > 0 ? ` · ${fmtLakh(deployed)} deployed` : ''}
        </span>
      </div>
      <div className="levels">
        {levels.map(({ i, pct, state }) => (
          <div key={i} ref={(el) => { pillRefs.current[i] = el }} className={`lv ${state}`}>
            <div className="lv-pct">−{fmtLevel(pct)}%</div>
            <div className="lv-st">{state === 'done' ? '✓' : state === 'next' ? '→' : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MomentumCard({ item }) {
  const change = item.daily_change_pct
  const crossed = change != null && Math.abs(change) >= item.threshold_pct
  const dir = change > 0 ? 'up' : change < 0 ? 'down' : null
  return (
    <div className="g tracker dash-card">
      <div className="row-hd">
        <span className="sec-lbl">Daily Move</span>
        <span className="dep-note">Alert at ±{fmtLevel(item.threshold_pct)}%</span>
      </div>
      <div className="momentum-row">
        <div className={`momentum-val ${dir === 'up' ? 'chg-up' : dir === 'down' ? 'chg-dn' : ''}`}>
          {change != null ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </div>
        <div className="momentum-sub">
          {crossed
            ? `⚡ Crossed ±${fmtLevel(item.threshold_pct)}% — alert condition active`
            : `±${fmtLevel(item.threshold_pct)}% triggers WhatsApp`}
        </div>
      </div>
    </div>
  )
}

function NextAlert({ item }) {
  const nextPct = item.next_alert_level
  const nextPrice = item.ath_price != null && nextPct != null ? item.ath_price * (1 - nextPct / 100) : null
  const distance = nextPrice != null && item.current_price != null ? item.current_price - nextPrice : null
  const { currency } = tickerMeta(item.ticker)
  const unit = currency === 'pts' ? '' : currency
  return (
    <div className="g next-card dash-card">
      <div className="next-bell">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div className="next-body">
        <div className="next-lbl">Next Alert</div>
        <div className="next-val">
          {nextPrice != null ? `${unit}${fmtPrice(nextPrice)} · −${fmtLevel(nextPct)}%` : '—'}
        </div>
        <div className="next-sub">
          {distance != null && distance > 0
            ? `${unit}${fmtPrice(distance)} below · WhatsApp will fire`
            : 'WhatsApp fires when crossed'}
        </div>
      </div>
    </div>
  )
}

function PriceHistory({ history, item }) {
  if (!history || history.length < 2) {
    return (
      <div className="g history-card dash-card">
        <div className="row-hd"><span className="sec-lbl">30-Day Price</span></div>
        <div className="empty">Price history is not available yet.</div>
      </div>
    )
  }

  const width = 320
  const height = 84
  const values = history.map((point) => point.close)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - ((value - min) / range) * (height - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const { currency } = tickerMeta(item.ticker)
  const unit = currency === 'pts' ? '' : currency

  return (
    <div className="g history-card dash-card">
      <div className="row-hd">
        <span className="sec-lbl">30-Day Price</span>
        <span className="dep-note">{unit}{fmtPrice(values[values.length - 1])}</span>
      </div>
      <svg
        className="history-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${item.display_name} 30-day closing-price trend`}
      >
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="history-range"><span>{history[0].date}</span><span>{history[history.length - 1].date}</span></div>
    </div>
  )
}

function TodaysAlerts({ alerts }) {
  const today = alerts.filter((a) => isTodayIST(a.alerted_at))
  // listRef is the querySelector target for the new-alert slide-in below.
  // Keep this a plain div: GlassSurface doesn't forward refs, so wrapping it
  // would break that timeline.
  const listRef = useRef(null)
  const topId = today[0]?.id
  const prevTopId = useRef(topId)

  useGSAP(() => {
    if (topId != null && topId !== prevTopId.current && !prefersReducedMotion()) {
      const first = listRef.current?.querySelector('.ai')
      if (first) gsap.fromTo(first, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.4, ease: 'power2.out' })
    }
    prevTopId.current = topId
  }, [topId])

  return (
    <div className="sec alist dash-card" ref={listRef}>
      <div className="sec-hd">
        <span className="sec-lbl">Today's Alerts</span>
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      {today.length === 0 ? (
        <div className="empty">No alerts fired today.</div>
      ) : (
        today.map((a, idx) => {
          const isMomentum = a.alert_direction != null
          const sign = isMomentum ? (a.alert_direction === 'up' ? '+' : '−') : '−'
          const badgeClass = isMomentum
            ? (a.alert_direction === 'up' ? 'badge-up' : 'badge-dn')
            : (idx === 0 ? '' : 'old')
          /* usdInr is deliberately omitted: this is the price at the moment the
             alert fired, and converting a past dollar figure at today's rate
             would invent a rupee number that was never true. Historical rows
             keep the asset's own quote currency — they still pick up the unit
             suffix, which is what was missing for index alerts. */
          const p = priceParts(a.ticker, a.current_price, null)
          return (
            <div className="ai" key={a.id}>
              <div className={`badge ${badgeClass}`}>{sign}{fmtLevel(a.level_pct ?? a.alert_level)}%</div>
              <div className="ai-body">
                <div className="ai-price">
                  {p.prefix}{fmtPrice(p.value)}
                  {p.unit && <span className="wp-unit">{p.unit}</span>}
                </div>
                <div className="ai-sub">
                  {isMomentum
                    ? `Daily move · ${a.ticker}`
                    : a.invest_amount == null
                      ? `Amount not recorded · ${a.ticker}`
                      : `Buy ₹${a.invest_amount.toLocaleString('en-IN')} · ${a.ticker}`}
                </div>
              </div>
              <div className="ai-time">{fmtTimeIST(a.alerted_at)}</div>
            </div>
          )
        })
      )}
    </div>
  )
}

function WatchlistMini({ items, selectedAsset, setSelectedAsset, usdInr }) {
  return (
    <div className="sec wlist dash-card">
      <div className="sec-hd"><span className="sec-lbl">Watchlist</span></div>
      <div className="wit">
        {items.map((item) => {
          const { exchange, type } = tickerMeta(item.ticker)
          const p = priceParts(item.ticker, item.current_price, usdInr)
          const isMomentum = item.alert_mode === 'momentum'
          const change = item.daily_change_pct
          return (
            <button
              key={item.id}
              className={`wr ${selectedAsset === item.ticker ? 'sel' : ''}`}
              onClick={() => setSelectedAsset(item.ticker)}
            >
              <div className={`wd ${item.active ? 'on' : 'off'}`} />
              <div>
                <div className="wn">{item.display_name}</div>
                <div className="wf">{exchange} · {type}</div>
              </div>
              <div className="wp">
                <div className="wp-val">
                  {p.prefix}{fmtPrice(p.value)}
                  {p.unit && <span className="wp-unit">{p.unit}</span>}
                </div>
                <div className={`wp-dip ${item.active ? '' : 'off'} ${isMomentum && change > 0 ? 'chg-up' : isMomentum && change < 0 ? 'chg-dn' : ''}`}>
                  {isMomentum
                    ? (change != null ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%` : '—')
                    : (item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—')}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* Fast asset switching without scrolling to the bottom of the tab. Modelled on
   docs/design-refs/asset-switcher-okx.png — the scrolling text-tab pattern, not
   the equal-width filled pill, because our labels are very uneven ("Nifty 50"
   vs "Gold (COMEX)"). Selection is marked by weight AND colour: gold is already
   the accent everywhere else, so colour alone would be ambiguous. */
function AssetChips({ items, selectedAsset, setSelectedAsset }) {
  const stripRef = useRef(null)

  // A selection restored from localStorage can sit off-screen on mount.
  // Scroll the strip itself rather than calling scrollIntoView on the chip:
  // scrollIntoView walks up and scrolls EVERY scrollable ancestor, and .wrap is
  // ~90px horizontally scrollable (the .ribbons wallpaper layer overhangs it),
  // so centering a right-hand chip used to slide the whole phone shell left.
  useEffect(() => {
    const strip = stripRef.current
    const el = strip?.querySelector('.chip-a.sel')
    if (!strip || !el) return
    const left = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2
    strip.scrollTo({
      left: Math.max(0, Math.min(left, strip.scrollWidth - strip.clientWidth)),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [selectedAsset])

  if (items.length < 2) return null

  return (
    <div className="chips dash-card" ref={stripRef} role="tablist" aria-label="Select asset">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={selectedAsset === item.ticker}
          className={`chip-a ${selectedAsset === item.ticker ? 'sel' : ''}`}
          onClick={() => setSelectedAsset(item.ticker)}
        >
          {!item.active && <span className="chip-dot off" aria-hidden="true" />}
          {item.display_name}
        </button>
      ))}
    </div>
  )
}

/* Until CallMeBot credentials are saved the app looks fully operational — live
   prices, populated watchlist — but no alert can ever fire. The Alerts tab was
   the only place that said so, and only if you went looking. */
function SetupBanner({ onManage, onDismiss }) {
  return (
    <div className="setup-banner dash-card" role="status">
      <div className="setup-banner-body">
        <div className="setup-banner-title">Alerts aren't switched on yet</div>
        <div className="setup-banner-sub">Prices are live, but WhatsApp delivery needs a one-time setup.</div>
      </div>
      <div className="setup-banner-actions">
        <button type="button" className="btn btn-primary btn-xs" onClick={onManage}>Set up</button>
        <button type="button" className="setup-banner-x" onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>
    </div>
  )
}

export default function WatchTab({ active, activeKey, onManage }) {
  const { items, selectedItem, selectedAsset, setSelectedAsset, history, loading, error, lastUpdated, usdInr, refresh } = useAssets()
  const [alerts, setAlerts] = useState([])
  const [needsSetup, setNeedsSetup] = useState(false)
  const [setupDismissed, setSetupDismissed] = useState(false)
  const panelRef = useRef(null)
  const panelClass = `panel ${active ? 'active animating' : ''}`
  const selectedItemId = selectedItem?.id

  useEffect(() => {
    if (!active) return undefined
    const loadAlerts = () => getAlerts(1, 100)
      .then((d) => setAlerts(d.alerts))
      .catch((err) => console.error('Failed to load alerts', err))
    loadAlerts()
    const interval = setInterval(loadAlerts, 60_000)
    return () => clearInterval(interval)
  }, [active])

  useEffect(() => {
    if (!active) return
    getSettings()
      .then((s) => setNeedsSetup(!(s?.apikey_set && s?.whatsapp_phone_masked)))
      .catch(() => setNeedsSetup(false)) // Never nag on a failed settings read.
  }, [active])

  // Stagger the dashboard cards in whenever the selected asset changes (incl.
  // first mount) — not on every 60s poll, since selectedAsset is a stable string.
  useGSAP(() => {
    if (!active || loading || error || !selectedItemId || prefersReducedMotion()) return
    gsap.timeline({ defaults: { duration: 0.45, ease: 'power2.out' } })
      .fromTo('.dash-card', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, stagger: 0.08 })
  }, { scope: panelRef, dependencies: [selectedAsset, loading, error, selectedItemId] })

  if (loading) return <div className={panelClass} data-active-key={activeKey}><WatchSkeleton /></div>
  if (error)
    return (
      <div className={panelClass} data-active-key={activeKey}>
        <ErrorCard message={error} onRetry={refresh} />
      </div>
    )
  if (!selectedItem)
    return (
      <div className={panelClass} data-active-key={activeKey}>
        <div className="empty">No assets under watch.<br />Add your first asset in the Manage tab.</div>
      </div>
    )

  const isMomentum = selectedItem.alert_mode === 'momentum'
  const showSetup = needsSetup && !setupDismissed
  return (
    <div className={panelClass} ref={panelRef} data-active-key={activeKey}>
      {showSetup && <SetupBanner onManage={onManage} onDismiss={() => setSetupDismissed(true)} />}
      <Hero item={selectedItem} lastUpdated={lastUpdated} usdInr={usdInr} />
      <AssetChips items={items} selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} />
      <PriceHistory history={history} item={selectedItem} />
      {isMomentum ? (
        <MomentumCard item={selectedItem} />
      ) : (
        <>
          <Tracker item={selectedItem} />
          <NextAlert item={selectedItem} />
        </>
      )}
      <TodaysAlerts alerts={alerts} />
      <WatchlistMini items={items} selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} usdInr={usdInr} />
    </div>
  )
}

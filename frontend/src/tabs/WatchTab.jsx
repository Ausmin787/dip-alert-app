import { useEffect, useRef, useState } from 'react'
import { getAlerts } from '../api.js'
import { useAssets } from '../useAssets.js'
import { gsap, useGSAP, prefersReducedMotion } from '../gsap.js'
import {
  fmtLakh,
  fmtLevel,
  fmtPrice,
  fmtTimeIST,
  isMarketOpenIST,
  isTodayIST,
  splitPrice,
  tickerMeta,
} from '../lib.js'

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

function Hero({ item }) {
  const { whole, frac } = splitPrice(item.current_price)
  const { exchange, currency } = tickerMeta(item.ticker)
  const open = isMarketOpenIST()
  const isMomentum = item.alert_mode === 'momentum'
  const change = item.daily_change_pct
  const changeUp = change != null && change > 0
  const changeDown = change != null && change < 0

  return (
    <div className="g hero dash-card">
      <div className="hero-asset">
        <div className={`green-dot ${item.active ? '' : 'off'}`} />
        {item.display_name} · {exchange}
      </div>
      <div className="hero-price-row">
        {currency !== 'pts' && <span className="hcur">{currency}</span>}
        <span className="hnum">{whole}</span>
        <span className="hdec">{frac}</span>
      </div>
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
        <span className="open-lbl">{open ? 'Market open' : 'Market closed'}</span>
        <span className="upd-time">{item.active ? 'Live' : 'Paused'}</span>
      </div>
    </div>
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
            ? `⚡ Crossed ±${fmtLevel(item.threshold_pct)}% — alert sent`
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
  return (
    <div className="g next-card dash-card">
      <div className="next-bell">
        <svg viewBox="0 0 24 24" fill="none" stroke="#00e4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div className="next-body">
        <div className="next-lbl">Next Alert</div>
        <div className="next-val">
          {nextPrice != null ? `₹${fmtPrice(nextPrice)} · −${fmtLevel(nextPct)}%` : '—'}
        </div>
        <div className="next-sub">
          {distance != null && distance > 0
            ? `₹${fmtPrice(distance)} below · WhatsApp will fire`
            : 'WhatsApp fires when crossed'}
        </div>
      </div>
    </div>
  )
}

function TodaysAlerts({ alerts, items }) {
  const today = alerts.filter((a) => isTodayIST(a.alerted_at))
  const investFor = (ticker) => items.find((i) => i.ticker === ticker)?.invest_amount ?? 100000
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
    <div className="g alist dash-card" ref={listRef}>
      <div className="alist-hd">
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
          const { currency } = tickerMeta(a.ticker)
          return (
            <div className="ai" key={a.id}>
              <div className={`badge ${badgeClass}`}>{sign}{fmtLevel(a.level_pct ?? a.alert_level)}%</div>
              <div className="ai-body">
                <div className="ai-price">{currency !== 'pts' ? currency : ''}{fmtPrice(a.current_price)}</div>
                <div className="ai-sub">
                  {isMomentum
                    ? `Daily move · ${a.ticker}`
                    : `Buy ₹${investFor(a.ticker).toLocaleString('en-IN')} · ${a.ticker}`}
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

function WatchlistMini({ items, selectedAsset, setSelectedAsset }) {
  return (
    <div className="g wlist dash-card">
      <span className="sec-lbl">Watchlist</span>
      <div className="wit">
        {items.map((item) => {
          const { exchange, type, currency } = tickerMeta(item.ticker)
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
                <div className="wp-val">{currency !== 'pts' ? currency : ''}{fmtPrice(item.current_price)}</div>
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

export default function WatchTab() {
  const { items, selectedItem, selectedAsset, setSelectedAsset, loading, error } = useAssets()
  const [alerts, setAlerts] = useState([])
  const panelRef = useRef(null)

  useEffect(() => {
    getAlerts(1, 20)
      .then((d) => setAlerts(d.alerts))
      .catch(() => {})
  }, [])

  // Stagger the dashboard cards in whenever the selected asset changes (incl.
  // first mount) — not on every 60s poll, since selectedAsset is a stable string.
  useGSAP(() => {
    if (prefersReducedMotion()) return
    gsap.timeline({ defaults: { duration: 0.45, ease: 'power2.out' } })
      .from('.dash-card', { autoAlpha: 0, y: 16, stagger: 0.08 })
  }, { scope: panelRef, dependencies: [selectedAsset] })

  if (loading) return <div className="panel"><div className="empty">Loading market…</div></div>
  if (error) return <div className="panel"><div className="empty">{error}</div></div>
  if (!selectedItem)
    return (
      <div className="panel">
        <div className="empty">No assets under watch.<br />Add your first asset in the Manage tab.</div>
      </div>
    )

  const isMomentum = selectedItem.alert_mode === 'momentum'
  return (
    <div className="panel" ref={panelRef}>
      <Hero item={selectedItem} />
      {isMomentum ? (
        <MomentumCard item={selectedItem} />
      ) : (
        <>
          <Tracker item={selectedItem} />
          <NextAlert item={selectedItem} />
        </>
      )}
      <TodaysAlerts alerts={alerts} items={items} />
      <WatchlistMini items={items} selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} />
    </div>
  )
}

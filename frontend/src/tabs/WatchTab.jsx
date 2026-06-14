import { useEffect, useState } from 'react'
import { getAlerts } from '../api.js'
import { useAssets } from '../useAssets.js'
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
  const { exchange } = tickerMeta(item.ticker)
  const open = isMarketOpenIST()
  return (
    <div className="g hero">
      <div className="hero-asset">
        <div className={`green-dot ${item.active ? '' : 'off'}`} />
        {item.display_name} · {exchange}
      </div>
      <div className="hero-price-row">
        <span className="hcur">₹</span>
        <span className="hnum">{whole}</span>
        <span className="hdec">{frac}</span>
      </div>
      <div className="hero-dip-row">
        <span className="hdip">{item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}</span>
        <div className="hath-block">
          <div className="hath-lbl">from all-time high</div>
          <div className="hath-val">ATH {fmtPrice(item.ath_price)}</div>
        </div>
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
  return (
    <div className="g tracker">
      <div className="row-hd">
        <span className="sec-lbl">Dip Levels</span>
        <span className="dep-note">
          <strong>{fired}</strong> fired{fired > 0 ? ` · ${fmtLakh(deployed)} deployed` : ''}
        </span>
      </div>
      <div className="levels">
        {levels.map(({ i, pct, state }) => (
          <div key={i} className={`lv ${state}`}>
            <div className="lv-pct">−{fmtLevel(pct)}%</div>
            <div className="lv-st">{state === 'done' ? '✓' : state === 'next' ? '→' : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NextAlert({ item }) {
  const nextPct = item.next_alert_level
  const nextPrice = item.ath_price != null && nextPct != null ? item.ath_price * (1 - nextPct / 100) : null
  const distance = nextPrice != null && item.current_price != null ? item.current_price - nextPrice : null
  return (
    <div className="g next-card">
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
  return (
    <div className="g alist">
      <div className="alist-hd">
        <span className="sec-lbl">Today's Alerts</span>
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>
          {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      {today.length === 0 ? (
        <div className="empty">No alerts fired today.</div>
      ) : (
        today.map((a, idx) => (
          <div className="ai" key={a.id}>
            <div className={`badge ${idx === 0 ? '' : 'old'}`}>−{fmtLevel(a.level_pct ?? a.alert_level)}%</div>
            <div className="ai-body">
              <div className="ai-price">₹{fmtPrice(a.current_price)}</div>
              <div className="ai-sub">
                Buy ₹{investFor(a.ticker).toLocaleString('en-IN')} · {a.ticker}
              </div>
            </div>
            <div className="ai-time">{fmtTimeIST(a.alerted_at)}</div>
          </div>
        ))
      )}
    </div>
  )
}

function WatchlistMini({ items, selectedAsset, setSelectedAsset }) {
  return (
    <div className="g wlist">
      <span className="sec-lbl">Watchlist</span>
      <div className="wit">
        {items.map((item) => {
          const { exchange, type } = tickerMeta(item.ticker)
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
                <div className="wp-val">₹{fmtPrice(item.current_price)}</div>
                <div className={`wp-dip ${item.active ? '' : 'off'}`}>
                  {item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}
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

  useEffect(() => {
    getAlerts(1, 20)
      .then((d) => setAlerts(d.alerts))
      .catch(() => {})
  }, [])

  if (loading) return <div className="panel"><div className="empty">Loading market…</div></div>
  if (error) return <div className="panel"><div className="empty">{error}</div></div>
  if (!selectedItem)
    return (
      <div className="panel">
        <div className="empty">No assets under watch.<br />Add your first asset in the Manage tab.</div>
      </div>
    )

  return (
    <div className="panel">
      <Hero item={selectedItem} />
      <Tracker item={selectedItem} />
      <NextAlert item={selectedItem} />
      <TodaysAlerts alerts={alerts} items={items} />
      <WatchlistMini items={items} selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} />
    </div>
  )
}

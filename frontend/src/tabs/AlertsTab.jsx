import { useCallback, useEffect, useRef, useState } from 'react'
import { getAlerts, getSettings } from '../api.js'
import { useAssets } from '../useAssets.js'
import { gsap, useGSAP, prefersReducedMotion } from '../gsap.js'
import { fmtLakh, fmtLevel, fmtPrice, fmtTimeIST, isMarketOpenIST, priceParts } from '../lib.js'
import ErrorCard from '../ErrorCard.jsx'

function ConfigRow({ label, sub, value, toggle, onManage }) {
  return (
    <button className="cfg-row" onClick={onManage}>
      <div>
        <div className="cfg-lbl">{label}</div>
        <div className="cfg-sub">{sub}</div>
      </div>
      {toggle !== undefined ? (
        <div className={`toggle ${toggle ? '' : 'off'}`}><div className="toggle-k" /></div>
      ) : (
        <div className="cfg-val">{value}</div>
      )}
    </button>
  )
}

export default function AlertsTab({ active, onManage }) {
  const { selectedItem } = useAssets()
  const [settings, setSettings] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState(null)
  const open = isMarketOpenIST()

  // Both fetches used to fail silently into console.error, leaving the tab
  // showing stale config and "No alerts logged yet" with no hint of a problem.
  const load = useCallback(() => {
    const settingsReq = getSettings().then(setSettings)
    const alertsReq = getAlerts(1, 100).then((d) => setAlerts(d.alerts))
    return Promise.all([settingsReq, alertsReq])
      .then(() => setError(null))
      .catch((err) => {
        console.error('Failed to load alerts tab', err)
        setError('Alert settings and history are unavailable — the API server may be down.')
      })
  }, [])

  useEffect(() => {
    if (!active) return undefined
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [active, load])

  const configured = Boolean(settings?.apikey_set && settings?.whatsapp_phone_masked)
  const isMomentum = selectedItem?.alert_mode === 'momentum'
  // Plain div on purpose: GlassSurface can't forward the ref the slide-in needs.
  const listRef = useRef(null)
  const topId = alerts[0]?.id
  const prevTopId = useRef(topId)

  useGSAP(() => {
    if (topId != null && topId !== prevTopId.current && !prefersReducedMotion()) {
      const first = listRef.current?.querySelector('.ai')
      if (first) gsap.fromTo(first, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.4, ease: 'power2.out' })
    }
    prevTopId.current = topId
  }, [topId])

  return (
    <div className={`panel ${active ? 'active animating' : ''}`}>
      <div className="tab-title">Alerts</div>

      {error && <ErrorCard message={error} onRetry={load} />}

      <div className="g">
        <ConfigRow
          label="WhatsApp Alerts"
          sub={settings?.whatsapp_phone_masked || 'Not configured — tap to set up'}
          toggle={configured}
          onManage={onManage}
        />
        <ConfigRow
          label={isMomentum ? 'Momentum Threshold' : 'Dip Interval'}
          sub={isMomentum ? 'Alert on ± daily move' : 'Alert every N% from ATH'}
          value={selectedItem ? `${fmtLevel(selectedItem.threshold_pct)}%` : '—'}
          onManage={onManage}
        />
        <ConfigRow
          label={isMomentum ? 'Alert Direction' : 'Deploy Amount'}
          sub={isMomentum ? 'Up and down tracked separately' : 'Per alert trigger'}
          value={isMomentum ? '±' : selectedItem ? fmtLakh(selectedItem.invest_amount) : '—'}
          onManage={onManage}
        />
        <ConfigRow
          label="Check Interval"
          sub={isMomentum ? 'Continuous polling cadence' : 'Polling cadence in market hours'}
          value={settings ? `${settings.check_interval_min} min` : '—'}
          onManage={onManage}
        />
      </div>

      <div className="sec alist" ref={listRef}>
        <div className="sec-hd">
          <span className="sec-lbl">Recent Alerts</span>
        </div>
        {alerts.length === 0 ? (
          <div className="empty">No alerts logged yet — they appear after a configured condition is delivered.</div>
        ) : (
          alerts.slice(0, 8).map((a, idx) => {
            const momentum = a.alert_direction != null
            const sign = momentum ? (a.alert_direction === 'up' ? '+' : '−') : '−'
            const badgeClass = momentum ? (a.alert_direction === 'up' ? 'badge-up' : 'badge-dn') : (idx === 0 ? '' : 'old')
            // Historical price — no FX conversion, see the note in WatchTab's
            // TodaysAlerts. The unit suffix is what index alerts were missing.
            const p = priceParts(a.ticker, a.current_price, null)
            return (
              <div className="ai" key={a.id}>
                <div className={`badge ${badgeClass}`}>{sign}{fmtLevel(a.level_pct ?? a.alert_level)}%</div>
                <div className="ai-body">
                  <div className="ai-price">
                    {p.prefix}{fmtPrice(p.value)}
                    {p.unit && <span className="wp-unit">{p.unit}</span>}
                  </div>
                  <div className="ai-sub">{a.ticker} · {momentum ? `${a.alert_direction} daily move` : `drop ${a.drop_pct.toFixed(2)}%`}</div>
                </div>
                <div className="ai-time">
                  {fmtTimeIST(a.alerted_at)}
                  <br />
                  <span className={a.whatsapp_sent ? 'ai-sent' : ''} style={a.whatsapp_sent ? {} : { color: 'var(--dim)' }}>
                    {a.whatsapp_sent ? 'Sent ✓' : 'not sent'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="g" style={{ padding: '16px 18px' }}>
        {isMomentum ? (
          <>
            <div className="sec-lbl" style={{ marginBottom: 12 }}>Momentum Monitoring</div>
            <div className="mh-row"><span className="mh-lbl">Schedule</span><span className="mh-val live">Every day</span></div>
            <div className="mh-row"><span className="mh-lbl">Reference</span><span className="mh-val">Previous close</span></div>
            <div className="mh-row"><span className="mh-lbl">De-duplication</span><span className="mh-val dim">Once per UTC day/direction</span></div>
          </>
        ) : (
          <>
        <div className="sec-lbl" style={{ marginBottom: 12 }}>Market Hours · IST</div>
        <div className="mh-row">
          <span className="mh-lbl">Pre-open session</span>
          <span className="mh-val">9:00 – 9:15 AM</span>
        </div>
        <div className="mh-row">
          <span className="mh-lbl">Market open</span>
          <span className={`mh-val ${open ? 'live' : ''}`}>9:15 AM – 3:30 PM</span>
        </div>
        <div className="mh-row">
          <span className="mh-lbl">Monitoring paused</span>
          <span className="mh-val dim">After 3:30 PM</span>
        </div>
          </>
        )}
      </div>
    </div>
  )
}

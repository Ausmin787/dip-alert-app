import { useEffect, useState } from 'react'
import { getAlerts, getSettings } from '../api.js'
import { useAssets } from '../useAssets.js'
import { fmtLakh, fmtLevel, fmtPrice, fmtTimeIST, isMarketOpenIST } from '../lib.js'

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

export default function AlertsTab({ onManage }) {
  const { selectedItem } = useAssets()
  const [settings, setSettings] = useState(null)
  const [alerts, setAlerts] = useState([])
  const open = isMarketOpenIST()

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {})
    getAlerts(1, 20).then((d) => setAlerts(d.alerts)).catch(() => {})
  }, [])

  const configured = Boolean(settings?.apikey_set && settings?.whatsapp_phone_masked)

  return (
    <div className="panel">
      <div className="tab-title">Alerts</div>

      <div className="g">
        <ConfigRow
          label="WhatsApp Alerts"
          sub={settings?.whatsapp_phone_masked || 'Not configured — tap to set up'}
          toggle={configured}
          onManage={onManage}
        />
        <ConfigRow
          label="Dip Interval"
          sub="Alert every N% from ATH"
          value={selectedItem ? `${fmtLevel(selectedItem.threshold_pct)}%` : '—'}
          onManage={onManage}
        />
        <ConfigRow
          label="Deploy Amount"
          sub="Per alert trigger"
          value={selectedItem ? fmtLakh(selectedItem.invest_amount) : '—'}
          onManage={onManage}
        />
        <ConfigRow
          label="Check Interval"
          sub="Polling cadence in market hours"
          value={settings ? `${settings.check_interval_min} min` : '—'}
          onManage={onManage}
        />
      </div>

      <div className="g alist">
        <div className="alist-hd">
          <span className="sec-lbl">Recent Alerts</span>
        </div>
        {alerts.length === 0 ? (
          <div className="empty">No alerts logged yet — they appear once a dip level is crossed.</div>
        ) : (
          alerts.slice(0, 8).map((a, idx) => (
            <div className="ai" key={a.id}>
              <div className={`badge ${idx === 0 ? '' : 'old'}`}>−{fmtLevel(a.level_pct ?? a.alert_level)}%</div>
              <div className="ai-body">
                <div className="ai-price">₹{fmtPrice(a.current_price)}</div>
                <div className="ai-sub">{a.ticker} · drop {a.drop_pct.toFixed(2)}%</div>
              </div>
              <div className="ai-time">
                {fmtTimeIST(a.alerted_at)}
                <br />
                <span className={a.whatsapp_sent ? 'ai-sent' : ''} style={a.whatsapp_sent ? {} : { color: 'var(--dim)' }}>
                  {a.whatsapp_sent ? 'Sent ✓' : 'not sent'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="g" style={{ padding: '16px 18px' }}>
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
      </div>
    </div>
  )
}

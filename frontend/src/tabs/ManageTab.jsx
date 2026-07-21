import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addAsset,
  deleteAsset,
  getAppToken,
  getSettings,
  sendTestAlert,
  setAppToken,
  updateAsset,
  updateSettings,
} from '../api.js'
import { useAssets } from '../useAssets.js'
import { fmtLakh, fmtLevel, tickerMeta } from '../lib.js'
import GlassSurface from '../GlassSurface.jsx'

const Icon = ({ d, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {d}
  </svg>
)
const PencilIcon = () => <Icon d={<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>} />
const PauseIcon = () => <Icon d={<><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>} />
const PlayIcon = () => <Icon d={<polygon points="5 3 19 12 5 21 5 3" />} />
const TrashIcon = () => <Icon d={<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />

const emptyForm = {
  ticker: '',
  display_name: '',
  threshold_pct: 1,
  invest_amount: 100000,
  broker_url: '',
  active: true,
  alert_mode: 'dip',
}

function AssetSheet({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial ?? emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const isEdit = Boolean(initial?.id)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ticker: form.ticker,
        display_name: form.display_name,
        broker_url: form.broker_url,
        active: form.active,
        alert_mode: form.alert_mode,
        threshold_pct: parseFloat(form.threshold_pct),
        invest_amount: form.alert_mode === 'momentum' ? 0 : parseInt(form.invest_amount, 10),
      })
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to save')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="sheet-overlay" onClick={onClose} role="presentation">
      <GlassSurface variant="sheet" className="sheet" role="dialog" aria-modal="true" aria-labelledby="asset-sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title" id="asset-sheet-title">{isEdit ? 'Edit asset' : 'Track a new asset'}</div>
        <div className="sheet-sub">
          {isEdit
            ? 'Ticker is locked — delete and re-add to change it.'
            : 'Tickers: ^NSEI, SETFNIF50.NS · Global: GC=F, SI=F, ^GSPC, ^NDX'}
        </div>
        <form onSubmit={submit}>
          <div className="field-group">
            <div className="field-row"><label className="flabel" htmlFor="asset-ticker">Ticker</label></div>
            <input id="asset-ticker" className="field" placeholder="^NSEI" value={form.ticker} onChange={set('ticker')} required disabled={isEdit} autoFocus={!isEdit} />
          </div>
          <div className="field-group">
            <div className="field-row"><label className="flabel" htmlFor="asset-name">Display name</label></div>
            <input id="asset-name" className="field" placeholder="Nifty 50" value={form.display_name} onChange={set('display_name')} required />
          </div>
          <div className="field-group">
            <div className="field-row"><label className="flabel" htmlFor="asset-mode">Alert type</label></div>
            <select id="asset-mode" className="field" value={form.alert_mode} onChange={set('alert_mode')}>
              <option value="dip">Dip Alert — buy on ATH dip levels</option>
              <option value="momentum">Momentum — ±% daily move notification</option>
            </select>
          </div>
          <div className="grid-2">
            <div className="field-group">
              <div className="field-row">
                <label className="flabel" htmlFor="asset-threshold">{form.alert_mode === 'momentum' ? 'Threshold (%)' : 'Alert every (%)'}</label>
              </div>
              <input id="asset-threshold" className="field" type="number" step="0.1" min="0.1" max="50" value={form.threshold_pct} onChange={set('threshold_pct')} required />
            </div>
            {form.alert_mode === 'dip' && (
            <div className="field-group">
              <div className="field-row"><label className="flabel" htmlFor="asset-amount">Amount (₹)</label></div>
              <input id="asset-amount" className="field" type="number" step="1000" min="0" max="1000000000" value={form.invest_amount} onChange={set('invest_amount')} required />
            </div>
            )}
          </div>
          <div className="field-group">
            <div className="field-row"><label className="flabel" htmlFor="asset-broker">Broker URL (buy button)</label></div>
            <input id="asset-broker" className="field" type="url" placeholder="https://groww.in/etfs/sbietf-nifty" value={form.broker_url} onChange={set('broker_url')} />
          </div>
          {error && <div className="status-msg err">{error}</div>}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Start tracking'}
            </button>
          </div>
        </form>
      </GlassSurface>
    </div>,
    document.getElementById('phone-shell') ?? document.body,
  )
}

function WatchlistManager() {
  const { items, refresh } = useAssets()
  const [sheet, setSheet] = useState(null) // null | 'new' | item

  const save = async (form) => {
    if (sheet === 'new') await addAsset(form)
    else await updateAsset(sheet.id, form)
    refresh()
  }
  const togglePause = async (item) => {
    try {
      await updateAsset(item.id, { ...item, active: !item.active })
      refresh()
    } catch (err) {
      window.alert(err.response?.data?.detail ?? 'Update failed')
    }
  }
  const remove = async (item) => {
    if (!window.confirm(`Stop tracking ${item.display_name}? Alert history is kept.`)) return
    try {
      await deleteAsset(item.id)
      refresh()
    } catch (err) {
      window.alert(err.response?.data?.detail ?? 'Delete failed')
    }
  }

  return (
    <GlassSurface className="g mcard">
      <div className="row-hd" style={{ marginBottom: 6 }}>
        <span className="sec-lbl">Watchlist</span>
        <button className="btn btn-primary" style={{ flex: 'none', padding: '7px 14px', fontSize: 12 }} onClick={() => setSheet('new')}>
          + Add
        </button>
      </div>
      {items.length === 0 ? (
        <div className="empty">Nothing tracked yet — add your first asset.</div>
      ) : (
        items.map((item) => {
          const { exchange, type } = tickerMeta(item.ticker)
          return (
            <div className="mrow" key={item.id}>
              <div className={`mrow-bar ${item.active ? '' : 'off'}`} />
              <div className="mrow-body">
                <div className="mrow-name">{item.display_name}</div>
                <div className="mrow-meta">
                  {item.ticker} · {exchange} {type} ·{' '}
                  {item.alert_mode === 'momentum'
                    ? `±${fmtLevel(item.threshold_pct)}% momentum`
                    : `−${fmtLevel(item.threshold_pct)}% · ${fmtLakh(item.invest_amount)}`}
                </div>
              </div>
              <div className="mrow-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setSheet(item)} aria-label="Edit"><PencilIcon /></button>
                <button className="btn btn-ghost btn-sm" onClick={() => togglePause(item)} aria-label={item.active ? 'Pause' : 'Resume'}>
                  {item.active ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(item)} aria-label="Delete"><TrashIcon /></button>
              </div>
            </div>
          )
        })
      )}
      {sheet && <AssetSheet initial={sheet === 'new' ? null : sheet} onClose={() => setSheet(null)} onSave={save} />}
    </GlassSurface>
  )
}

const blankSettings = { whatsapp_phone: '', callmebot_apikey: '', check_interval_min: 5 }

function WhatsAppCard() {
  const [loadState, setLoadState] = useState('loading')
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(() => ({ ...blankSettings, app_token: getAppToken() }))
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    getSettings()
      .then((s) => {
        setSaved(s)
        setForm((f) => ({ ...f, check_interval_min: s.check_interval_min ?? 5 }))
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))

  useEffect(() => {
    load()
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    const previousToken = getAppToken()
    setAppToken((form.app_token ?? '').trim())
    try {
      const s = await updateSettings({
        whatsapp_phone: form.whatsapp_phone,
        callmebot_apikey: form.callmebot_apikey,
        check_interval_min: parseInt(form.check_interval_min, 10),
      })
      setSaved(s)
      setForm({ ...blankSettings, check_interval_min: s.check_interval_min, app_token: getAppToken() })
      setStatus({ kind: 'ok', msg: 'Settings saved.' })
    } catch (err) {
      setAppToken(previousToken)
      setForm((current) => ({ ...current, app_token: previousToken }))
      setStatus({ kind: 'err', msg: err.response?.data?.detail ?? 'Failed to save settings.' })
    } finally {
      setBusy(false)
    }
  }

  const clearCredentials = async () => {
    if (!window.confirm('Clear the saved WhatsApp phone number and API key? Alerts will remain pending until new credentials are saved.')) return
    setBusy(true)
    setStatus(null)
    const previousToken = getAppToken()
    setAppToken((form.app_token ?? '').trim())
    try {
      const s = await updateSettings({
        check_interval_min: parseInt(form.check_interval_min, 10),
        clear_credentials: true,
      })
      setSaved(s)
      setForm((current) => ({ ...current, whatsapp_phone: '', callmebot_apikey: '' }))
      setStatus({ kind: 'ok', msg: 'Saved WhatsApp credentials cleared.' })
    } catch (err) {
      setAppToken(previousToken)
      setForm((current) => ({ ...current, app_token: previousToken }))
      setStatus({ kind: 'err', msg: err.response?.data?.detail ?? 'Failed to clear credentials.' })
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    setStatus(null)
    try {
      await sendTestAlert()
      setStatus({ kind: 'ok', msg: 'Test alert sent — check WhatsApp!' })
    } catch (err) {
      setStatus({ kind: 'err', msg: err.response?.data?.detail ?? 'Test alert failed.' })
    } finally {
      setBusy(false)
    }
  }

  const ready = loadState === 'ready'

  return (
    <GlassSurface as="form" className="g mcard" onSubmit={save}>
      <div className="mcard-hd">WhatsApp Delivery</div>

      {loadState === 'error' && (
        <div className="status-msg err" style={{ marginTop: 0, marginBottom: 12 }}>
          Couldn't load saved settings — saving is disabled so nothing gets wiped.
        </div>
      )}

      <div className="field-group">
        <div className="field-row">
          <label className="flabel" htmlFor="whatsapp-phone">WhatsApp phone (with country code)</label>
          {saved?.whatsapp_phone_masked && <span className="fhint ok">✓ {saved.whatsapp_phone_masked}</span>}
        </div>
        <input
          id="whatsapp-phone"
          className="field"
          type="tel"
          placeholder={saved?.whatsapp_phone_masked ? 'Leave blank to keep saved number' : '+919876543210'}
          value={form.whatsapp_phone}
          onChange={set('whatsapp_phone')}
          disabled={!ready}
        />
      </div>

      <div className="field-group">
        <div className="field-row">
          <label className="flabel" htmlFor="callmebot-key">CallMeBot API key</label>
          {saved?.apikey_set && <span className="fhint ok">✓ key saved</span>}
        </div>
        <input
          id="callmebot-key"
          className="field"
          type="password"
          placeholder={saved?.apikey_set ? 'Leave blank to keep saved key' : '123456'}
          value={form.callmebot_apikey}
          onChange={set('callmebot_apikey')}
          disabled={!ready}
          autoComplete="off"
        />
        <div className="fhint">Stored secrets are never returned to the browser — only a masked preview is shown here.</div>
      </div>

      <div className="field-group">
        <div className="field-row"><label className="flabel" htmlFor="check-interval">Check interval (minutes)</label></div>
        <input id="check-interval" className="field" type="number" min="1" max="60" value={form.check_interval_min} onChange={set('check_interval_min')} disabled={!ready} />
      </div>

      {saved?.write_protected && (
        <div className="field-group">
          <div className="field-row">
            <label className="flabel" htmlFor="app-token">Access token (write protection)</label>
            {form.app_token
              ? <span className="fhint ok">✓ stored in this browser</span>
              : <span className="fhint" style={{ color: 'var(--rose)' }}>required</span>}
          </div>
          <input
            id="app-token"
            className="field"
            type="password"
            placeholder="The APP_TOKEN value set on the backend server"
            value={form.app_token}
            onChange={set('app_token')}
            disabled={!ready}
            autoComplete="off"
          />
        </div>
      )}

      {status && <div className={`status-msg ${status.kind}`}>{status.msg}</div>}

      <div className="btn-row">
        {(saved?.apikey_set || saved?.whatsapp_phone_masked) && (
          <button type="button" className="btn btn-danger" onClick={clearCredentials} disabled={busy || !ready}>Clear credentials</button>
        )}
        <button type="button" className="btn btn-ghost" onClick={test} disabled={busy || !ready}>Send test</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !ready}>{busy ? 'Working…' : 'Save'}</button>
      </div>
    </GlassSurface>
  )
}

function SetupCard() {
  const steps = [
    <>Save <b>+34 644 59 89 29</b> in your phone's contacts.</>,
    <>From WhatsApp, send it: <em>"I allow callmebot to send me messages"</em></>,
    <>Your personal API key arrives back on WhatsApp within a minute.</>,
    <>Enter your number and that key above, save, then fire a test alert.</>,
  ]
  return (
    <GlassSurface className="g mcard">
      <div className="mcard-hd">One-time CallMeBot setup</div>
      <div className="ol-steps">
        {steps.map((s, i) => (
          <div className="ol-step" key={i}>
            <span className="ol-num">0{i + 1}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}

export default function ManageTab({ active }) {
  return (
    <div className={`panel ${active ? 'active animating' : ''}`}>
      <div className="tab-title">Manage</div>
      <WatchlistManager />
      <WhatsAppCard />
      <SetupCard />
    </div>
  )
}

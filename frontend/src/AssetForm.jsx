import { useEffect, useId, useState } from 'react'
import { Segmented } from './ui.jsx'
import Icon from './Icon.jsx'

const emptyForm = {
  ticker: '',
  display_name: '',
  threshold_pct: 1,
  invest_amount: 100000,
  broker_url: '',
  active: true,
  alert_mode: 'dip',
}

const MODES = [
  { id: 'dip', label: 'Dip Alert' },
  { id: 'momentum', label: 'Daily Move' },
]

/* Add or edit an asset, as a form sheet. HIG Sheets: Cancel on the leading edge, the
   tinted Done on the trailing edge, and the two never compete with a third button. */
export default function AssetForm({ initial, onClose, onSave, onDirtyChange }) {
  const [form, setForm] = useState(initial ?? emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const formId = useId()
  const isEdit = Boolean(initial?.id)
  const isDip = form.alert_mode === 'dip'
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // Lets the sheet ask before a swipe throws away unsaved edits (HIG Sheets).
  const dirty = JSON.stringify(form) !== JSON.stringify(initial ?? emptyForm)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

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
        invest_amount: isDip ? parseInt(form.invest_amount, 10) : 0,
      })
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Couldn’t save this asset.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="form-toolbar">
        <button type="button" className="gbtn glass" aria-label="Cancel" onClick={onClose}>
          <Icon name="x" />
        </button>
        <h2 className="t-head clip">{isEdit ? 'Edit Alert' : 'Add Asset'}</h2>
        <button type="submit" form={formId} className="gbtn tinted" aria-label={isEdit ? 'Save changes' : 'Start tracking'} disabled={saving}>
          <Icon name="check" weight={2.6} />
        </button>
      </div>

      <form id={formId} className="form-body" onSubmit={submit}>
        <div className="group">
          <label className="frow">
            <span className="frow-label">Symbol</span>
            <input
              className="frow-input"
              name="ticker"
              autoComplete="off"
              placeholder="^NSEI"
              value={form.ticker}
              onChange={set('ticker')}
              required
              disabled={isEdit}
              autoFocus={!isEdit && window.matchMedia('(pointer: fine)').matches}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="frow">
            <span className="frow-label">Name</span>
            <input className="frow-input" name="display_name" autoComplete="off" placeholder="Nifty 50" value={form.display_name} onChange={set('display_name')} required />
          </label>
        </div>
        <p className="group-foot">
          {isEdit
            ? 'The symbol can’t change. Stop tracking this asset and add it again to use a different one.'
            : 'A Yahoo Finance symbol, such as ^NSEI, SETFNIF50.NS, GC=F or ^GSPC.'}
        </p>

        <div style={{ margin: '22px 0 8px' }}>
          <Segmented
            label="Alert type"
            options={MODES}
            value={form.alert_mode}
            onChange={(alert_mode) => setForm({ ...form, alert_mode })}
          />
        </div>

        <div className="group">
          <label className="frow">
            <span className="frow-label">{isDip ? 'Alert Every' : 'Alert At'}</span>
            <input className="frow-input num" name="threshold_pct" autoComplete="off" type="number" inputMode="decimal" step="0.1" min="0.1" max="50" value={form.threshold_pct} onChange={set('threshold_pct')} required />
            <span className="c-2" aria-hidden="true">%</span>
          </label>
          {isDip && (
            <label className="frow">
              <span className="frow-label">Amount per Level (₹)</span>
              <input className="frow-input num" name="invest_amount" autoComplete="off" type="number" inputMode="numeric" step="1000" min="0" max="1000000000" value={form.invest_amount} onChange={set('invest_amount')} required />
            </label>
          )}
        </div>
        <p className="group-foot">
          {isDip
            ? 'Alerts each time the price falls another step below its all-time high, during NSE hours.'
            : 'Alerts once a day in each direction when the day’s move passes this size, checked around the clock.'}
        </p>

        <div className="group" style={{ marginTop: 22 }}>
          <label className="frow">
            <span className="frow-label">Broker Link</span>
            <input className="frow-input" name="broker_url" autoComplete="off" type="url" inputMode="url" placeholder="https://groww.in/etfs/…" value={form.broker_url} onChange={set('broker_url')} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </label>
        </div>
        <p className="group-foot">Added to each WhatsApp alert, so buying is one tap away. Optional.</p>

        {error && <p className="group-foot" role="alert" style={{ color: 'var(--down)', paddingTop: 16 }}>{error}</p>}
      </form>
    </>
  )
}

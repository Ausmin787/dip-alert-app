import { useEffect, useId, useState } from 'react'
import { getAppToken, getSettings, sendTestAlert, setAppToken, updateSettings } from '../api.js'
import { useToast } from '../Toast.jsx'
import { useConfirm } from '../ConfirmDialog.jsx'
import { Screen } from '../ui.jsx'
import Icon from '../Icon.jsx'
import { isMarketOpenIST } from '../lib.js'

const MIN_INTERVAL = 1
const MAX_INTERVAL = 60
const blankSecrets = { whatsapp_phone: '', callmebot_apikey: '' }

const SETUP_STEPS = [
  <>Save <b>+34 644 59 89 29</b> in your phone’s contacts.</>,
  <>From WhatsApp, send it: “I allow callmebot to send me messages”</>,
  <>Your personal API key arrives on WhatsApp within a minute.</>,
  <>Enter your number and that key above, tap the checkmark, then send a test alert.</>,
]

export default function SettingsTab({ active }) {
  const toast = useToast()
  const { confirm } = useConfirm()
  const formId = useId()
  const [loadState, setLoadState] = useState('loading')
  const [saved, setSaved] = useState(null)
  const [secrets, setSecrets] = useState(blankSecrets)
  const [interval, setCheckInterval] = useState(5)
  const [token, setToken] = useState(() => getAppToken())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!active) return
    getSettings()
      .then((s) => {
        setSaved(s)
        setCheckInterval(s.check_interval_min ?? 5)
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [active])

  const ready = loadState === 'ready'
  const connected = Boolean(saved?.apikey_set && saved?.whatsapp_phone_masked)
  // Blank secrets mean "keep what's stored": the UI never receives the real values,
  // so a blank field can't be read as an instruction to erase them.
  const dirty = ready && (
    secrets.whatsapp_phone !== ''
    || secrets.callmebot_apikey !== ''
    || interval !== saved?.check_interval_min
    || (token ?? '').trim() !== getAppToken()
  )

  const setSecret = (key) => (e) => setSecrets((s) => ({ ...s, [key]: e.target.value }))

  const save = async (e) => {
    e?.preventDefault()
    if (!dirty || busy) return
    setBusy(true)
    const previousToken = getAppToken()
    setAppToken((token ?? '').trim())
    try {
      const s = await updateSettings({ ...secrets, check_interval_min: interval })
      setSaved(s)
      setSecrets(blankSecrets)
      setCheckInterval(s.check_interval_min)
      toast.ok('Settings saved')
    } catch (err) {
      setAppToken(previousToken)
      setToken(previousToken)
      toast.err(err.response?.data?.detail ?? 'Couldn’t save settings.')
    } finally {
      setBusy(false)
    }
  }

  const clearCredentials = async () => {
    const ok = await confirm({
      title: 'Disconnect WhatsApp?',
      body: 'Alerts stay pending until you save a new number and key. Nothing else changes.',
      confirmLabel: 'Disconnect',
    })
    if (!ok) return
    setBusy(true)
    const previousToken = getAppToken()
    setAppToken((token ?? '').trim())
    try {
      const s = await updateSettings({ check_interval_min: interval, clear_credentials: true })
      setSaved(s)
      setSecrets(blankSecrets)
      toast.ok('WhatsApp disconnected')
    } catch (err) {
      setAppToken(previousToken)
      setToken(previousToken)
      toast.err(err.response?.data?.detail ?? 'Couldn’t disconnect WhatsApp.')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      await sendTestAlert()
      toast.ok('Test alert sent. Check WhatsApp.')
    } catch (err) {
      toast.err(err.response?.data?.detail ?? 'Test alert failed.')
    } finally {
      setBusy(false)
    }
  }

  // The one tinted control, and only when there is something to confirm (WWDC25:
  // a primary action stays separate and appears tinted, often as a blue checkmark).
  const saveButton = dirty && (
    <button type="submit" form={formId} className="gbtn tinted" aria-label="Save settings" disabled={busy}>
      <Icon name="check" weight={2.6} />
    </button>
  )

  const marketOpen = isMarketOpenIST()

  return (
    <Screen title="Settings" actions={saveButton}>
      <form id={formId} onSubmit={save}>
        {loadState === 'error' && (
          <p className="group-foot" role="alert" style={{ color: 'var(--down)', padding: '0 16px 12px' }}>
            Couldn’t load saved settings. Saving is off so nothing gets wiped.
          </p>
        )}

        <h2 className="group-title" style={{ paddingTop: 4 }}>WhatsApp</h2>
        <div className="group">
          <div className="frow">
            <span className="frow-label">Status</span>
            <span className={`frow-value ${connected ? 'c-up' : ''}`}>
              {!ready ? '—' : connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <label className="frow">
            <span className="frow-label">Phone</span>
            <input
              className="frow-input"
              type="tel"
              placeholder={saved?.whatsapp_phone_masked || '+919876543210'}
              value={secrets.whatsapp_phone}
              onChange={setSecret('whatsapp_phone')}
              disabled={!ready}
              autoComplete="off"
            />
          </label>
          <label className="frow">
            <span className="frow-label">API Key</span>
            <input
              className="frow-input"
              type="password"
              placeholder={saved?.apikey_set ? 'Saved' : '123456'}
              value={secrets.callmebot_apikey}
              onChange={setSecret('callmebot_apikey')}
              disabled={!ready}
              autoComplete="off"
            />
          </label>
        </div>
        <p className="group-foot">Your number and key are never sent back to this browser. Leave a field blank to keep what’s saved.</p>

        <div className="group" style={{ marginTop: 22 }}>
          <button type="button" className="frow tint-action" onClick={test} disabled={busy || !ready}>
            Send Test Alert
          </button>
          {(saved?.apikey_set || saved?.whatsapp_phone_masked) && (
            <button type="button" className="frow danger-action" onClick={clearCredentials} disabled={busy || !ready}>
              Disconnect WhatsApp
            </button>
          )}
        </div>

        <h2 className="group-title">Monitoring</h2>
        <div className="group">
          <div className="frow">
            <span className="frow-label">Check Every</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="c-2 num">{interval} min</span>
              <div className="stepper" role="group" aria-label="Check interval in minutes">
                <button type="button" aria-label="One minute fewer" disabled={!ready || interval <= MIN_INTERVAL} onClick={() => setCheckInterval((v) => Math.max(MIN_INTERVAL, v - 1))}>
                  <Icon name="minus" weight={2.6} />
                </button>
                <i />
                <button type="button" aria-label="One minute more" disabled={!ready || interval >= MAX_INTERVAL} onClick={() => setCheckInterval((v) => Math.min(MAX_INTERVAL, v + 1))}>
                  <Icon name="plus" weight={2.6} />
                </button>
              </div>
            </div>
          </div>
          <div className="frow">
            <span className="frow-label">NSE</span>
            <span className={`frow-value ${marketOpen ? 'c-up' : ''}`}>{marketOpen ? 'Open' : 'Closed'}</span>
          </div>
          <div className="frow">
            <span className="frow-label">Pre-Open</span>
            <span className="frow-value num">9:00 AM to 9:15 AM IST</span>
          </div>
          <div className="frow">
            <span className="frow-label">Market Hours</span>
            <span className="frow-value num">9:15 AM to 3:30 PM IST</span>
          </div>
        </div>
        <p className="group-foot">Dip alerts run during market hours, Monday to Friday. Daily moves are checked at this interval around the clock, once a day in each direction.</p>

        {saved?.write_protected && (
          <>
            <h2 className="group-title">Security</h2>
            <div className="group">
              <label className="frow">
                <span className="frow-label">Access Token</span>
                <input
                  className="frow-input"
                  type="password"
                  placeholder="Required"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={!ready}
                  autoComplete="off"
                />
              </label>
            </div>
            <p className="group-foot">The APP_TOKEN set on the server. Stored only in this browser, and needed for any change.</p>
          </>
        )}

        <h2 className="group-title">Connect WhatsApp</h2>
        <div className="group">
          <details open={!connected}>
            <summary className="frow">
              <span>One-Time CallMeBot Setup</span>
              <Icon name="chevron" className="frow-chevron" weight={3} />
            </summary>
            <ol className="steps t-sub" style={{ paddingBottom: 8 }}>
              {SETUP_STEPS.map((step, i) => (
                <li key={i}>
                  <span className="step-n">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </form>
    </Screen>
  )
}

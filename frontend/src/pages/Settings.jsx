import { useEffect, useState } from 'react'
import { getAppToken, getSettings, sendTestAlert, setAppToken, updateSettings } from '../api.js'
import { Reveal } from '../components/motion.jsx'
import { IconAlertTriangle, IconCheck } from '../components/icons.jsx'

const blankForm = { whatsapp_phone: '', callmebot_apikey: '', check_interval_min: 5 }

export default function Settings() {
  const [loadState, setLoadState] = useState('loading') // loading | error | ready
  const [saved, setSaved] = useState(null) // redacted server state
  const [form, setForm] = useState(() => ({ ...blankForm, app_token: getAppToken() }))
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'err', msg }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    getSettings()
      .then((s) => {
        if (!active) return
        setSaved(s)
        setForm((f) => ({ ...f, check_interval_min: s.check_interval_min ?? 5 }))
        setLoadState('ready')
      })
      .catch(() => active && setLoadState('error'))
    return () => {
      active = false
    }
  }, [])

  const retry = () => {
    setLoadState('loading')
    getSettings()
      .then((s) => {
        setSaved(s)
        setForm((f) => ({ ...f, check_interval_min: s.check_interval_min ?? 5 }))
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    setAppToken((form.app_token ?? '').trim()) // store locally before the PUT carries it
    try {
      const s = await updateSettings({
        whatsapp_phone: form.whatsapp_phone,
        callmebot_apikey: form.callmebot_apikey,
        check_interval_min: parseInt(form.check_interval_min, 10),
      })
      setSaved(s)
      setForm({ ...blankForm, check_interval_min: s.check_interval_min, app_token: getAppToken() })
      setStatus({ kind: 'ok', msg: 'Settings saved.' })
    } catch (err) {
      setStatus({ kind: 'err', msg: err.response?.data?.detail ?? 'Failed to save settings.' })
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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Reveal>
        <p className="tag mb-3">Delivery & polling</p>
        <h1 className="text-gradient font-display text-4xl font-semibold tracking-tight">Settings</h1>
      </Reveal>

      {loadState === 'error' && (
        <Reveal>
          <div className="panel flex items-center justify-between gap-4 border-blush/30 p-5">
            <p className="flex items-center gap-3 text-sm text-blush">
              <IconAlertTriangle className="h-4 w-4 shrink-0" />
              Couldn't load saved settings — saving is disabled so nothing gets wiped.
            </p>
            <button onClick={retry} className="btn-ghost shrink-0 !py-2 text-xs">
              Retry
            </button>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.08}>
        <form onSubmit={save} className="panel space-y-5 p-5 sm:p-7">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="tag">WhatsApp phone (with country code)</label>
              {saved?.whatsapp_phone_masked && (
                <span className="num flex items-center gap-1 text-[0.62rem] text-mint">
                  <IconCheck className="h-3 w-3" /> {saved.whatsapp_phone_masked}
                </span>
              )}
            </div>
            <input
              className="field"
              type="tel"
              placeholder={saved?.whatsapp_phone_masked ? 'Leave blank to keep saved number' : '+919876543210'}
              value={form.whatsapp_phone}
              onChange={set('whatsapp_phone')}
              disabled={loadState !== 'ready'}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="tag">CallMeBot API key</label>
              {saved?.apikey_set && (
                <span className="num flex items-center gap-1 text-[0.62rem] text-mint">
                  <IconCheck className="h-3 w-3" /> key saved
                </span>
              )}
            </div>
            <input
              className="field"
              type="password"
              placeholder={saved?.apikey_set ? 'Leave blank to keep saved key' : '123456'}
              value={form.callmebot_apikey}
              onChange={set('callmebot_apikey')}
              disabled={loadState !== 'ready'}
              autoComplete="off"
            />
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-mist">
              Secrets never leave the server — only a masked preview is shown here.
            </p>
          </div>
          <div>
            <label className="tag mb-1.5 block">Check interval (minutes, during market hours)</label>
            <input
              className="field"
              type="number"
              min="1"
              max="60"
              value={form.check_interval_min}
              onChange={set('check_interval_min')}
              disabled={loadState !== 'ready'}
            />
          </div>
          {saved?.write_protected && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="tag">Access token (write protection)</label>
                {form.app_token ? (
                  <span className="num flex items-center gap-1 text-[0.62rem] text-mint">
                    <IconCheck className="h-3 w-3" /> stored in this browser
                  </span>
                ) : (
                  <span className="num text-[0.62rem] text-gold">required — writes will fail without it</span>
                )}
              </div>
              <input
                className="field"
                type="password"
                placeholder="The APP_TOKEN value set on Railway"
                value={form.app_token}
                onChange={set('app_token')}
                disabled={loadState !== 'ready'}
                autoComplete="off"
              />
              <p className="mt-1.5 text-[0.68rem] leading-relaxed text-mist">
                This backend requires a token for changes. It's saved only in this browser.
              </p>
            </div>
          )}

          {status && (
            <p className={`text-sm ${status.kind === 'ok' ? 'text-mint' : 'text-blush'}`}>{status.msg}</p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={test} disabled={busy || loadState !== 'ready'} className="btn-ghost">
              Send test alert
            </button>
            <button type="submit" disabled={busy || loadState !== 'ready'} className="btn-primary">
              {busy ? 'Working…' : 'Save settings'}
            </button>
          </div>
        </form>
      </Reveal>

      <Reveal delay={0.16}>
        <div className="panel p-5 sm:p-7">
          <h3 className="tag mb-5">One-time CallMeBot setup</h3>
          <ol className="space-y-4">
            {[
              <>Save <span className="num font-medium text-frost">+34 644 59 89 29</span> in your phone's contacts.</>,
              <>From WhatsApp, send it: <em className="text-frost">"I allow callmebot to send me messages"</em></>,
              <>Your personal API key arrives back on WhatsApp within a minute.</>,
              <>Enter your number and that key above, save, then fire a test alert.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-4 text-sm leading-relaxed text-mist">
                <span className="num shrink-0 pt-0.5 text-[0.7rem] font-semibold text-pulse">
                  0{i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { getSettings, sendTestAlert, updateSettings } from '../api.js'

export default function Settings() {
  const [form, setForm] = useState({ whatsapp_phone: '', callmebot_apikey: '', check_interval_min: 5 })
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'err', msg }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSettings().then((s) =>
      setForm({
        whatsapp_phone: s.whatsapp_phone ?? '',
        callmebot_apikey: s.callmebot_apikey ?? '',
        check_interval_min: s.check_interval_min ?? 5,
      }),
    )
  }, [])

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      await updateSettings({ ...form, check_interval_min: parseInt(form.check_interval_min, 10) })
      setStatus({ kind: 'ok', msg: 'Settings saved.' })
    } catch {
      setStatus({ kind: 'err', msg: 'Failed to save settings.' })
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
      <div className="rise pt-3">
        <h1 className="text-gradient font-display text-4xl font-light">Settings</h1>
        <p className="mt-1.5 text-sm text-fog-dim">WhatsApp delivery and check frequency</p>
      </div>

      <form
        onSubmit={save}
        className="glass rise space-y-5 rounded-[1.75rem] p-5 sm:p-6"
        style={{ animationDelay: '90ms' }}
      >
        <div>
          <label className="mb-1.5 block text-[0.65rem] font-medium tracking-[0.15em] text-fog-dim uppercase">
            WhatsApp phone (with country code)
          </label>
          <input
            className="field"
            type="tel"
            placeholder="+919876543210"
            value={form.whatsapp_phone}
            onChange={set('whatsapp_phone')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[0.65rem] font-medium tracking-[0.15em] text-fog-dim uppercase">
            CallMeBot API key
          </label>
          <input
            className="field"
            placeholder="123456"
            value={form.callmebot_apikey}
            onChange={set('callmebot_apikey')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[0.65rem] font-medium tracking-[0.15em] text-fog-dim uppercase">
            Check interval (minutes, during market hours)
          </label>
          <input
            className="field"
            type="number"
            min="1"
            max="60"
            value={form.check_interval_min}
            onChange={set('check_interval_min')}
          />
        </div>

        {status && (
          <p className={`text-sm ${status.kind === 'ok' ? 'text-moss' : 'text-ember'}`}>
            {status.msg}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={test}
            disabled={busy}
            className="pressable rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-fog hover:border-moss/50 hover:text-moss disabled:opacity-50"
          >
            Send test alert
          </button>
          <button
            type="submit"
            disabled={busy}
            className="pressable rounded-full bg-moss px-6 py-3 text-sm font-semibold text-ink shadow-[0_8px_24px_-8px_rgba(163,233,116,0.6)] disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Save settings'}
          </button>
        </div>
      </form>

      <div className="glass rise rounded-[1.75rem] p-5 sm:p-6" style={{ animationDelay: '180ms' }}>
        <h3 className="mb-3 text-[0.7rem] font-semibold tracking-[0.18em] text-fog-dim uppercase">
          One-time CallMeBot setup
        </h3>
        <ol className="list-inside list-decimal space-y-2.5 text-sm leading-relaxed text-fog-dim">
          <li>
            Save <span className="num font-medium text-fog">+34 644 59 89 29</span> in your phone's
            contacts.
          </li>
          <li>
            From WhatsApp, send it the message:{' '}
            <em className="text-fog">"I allow callmebot to send me messages"</em>
          </li>
          <li>You'll receive your personal API key back on WhatsApp within a minute.</li>
          <li>Paste your phone number and that key above, save, then send a test alert.</li>
        </ol>
      </div>
    </div>
  )
}

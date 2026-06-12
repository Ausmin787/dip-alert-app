import { useEffect, useState } from 'react'
import { getSettings, sendTestAlert, updateSettings } from '../api.js'

const field =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-fog placeholder:text-fog-dim/60 focus:border-moss/50 focus:outline-none'

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rise pt-4">
        <h1 className="font-display text-4xl font-light text-fog">Settings</h1>
        <p className="mt-1 text-sm text-fog-dim">WhatsApp delivery and check frequency</p>
      </div>

      <form
        onSubmit={save}
        className="glass rise space-y-5 rounded-3xl p-6"
        style={{ animationDelay: '100ms' }}
      >
        <div>
          <label className="mb-1.5 block text-xs tracking-wide text-fog-dim uppercase">
            WhatsApp phone (with country code)
          </label>
          <input
            className={field}
            placeholder="+919876543210"
            value={form.whatsapp_phone}
            onChange={set('whatsapp_phone')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs tracking-wide text-fog-dim uppercase">
            CallMeBot API key
          </label>
          <input
            className={field}
            placeholder="123456"
            value={form.callmebot_apikey}
            onChange={set('callmebot_apikey')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs tracking-wide text-fog-dim uppercase">
            Check interval (minutes, during market hours)
          </label>
          <input
            className={field}
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

        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={test}
            disabled={busy}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-fog transition-colors hover:border-moss/50 hover:text-moss disabled:opacity-50"
          >
            Send test alert
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-moss px-6 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-105 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Save settings'}
          </button>
        </div>
      </form>

      <div className="glass rise rounded-3xl p-6" style={{ animationDelay: '200ms' }}>
        <h3 className="mb-3 text-sm font-medium tracking-wide text-fog-dim uppercase">
          One-time CallMeBot setup
        </h3>
        <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-fog-dim">
          <li>
            Save <span className="num text-fog">+34 644 59 89 29</span> in your phone's contacts.
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

import { useEffect, useState } from 'react'
import { addAsset, deleteAsset, getWatchlist, updateAsset } from '../api.js'
import { IconPause, IconPencil, IconPlay, IconPlus, IconTrash } from '../components/icons.jsx'
import { fmtAmount } from '../lib.js'

const emptyForm = {
  ticker: '',
  display_name: '',
  threshold_pct: 1.0,
  invest_amount: 100000,
  broker_url: '',
  active: true,
}

function AssetModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial ?? emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const isEdit = Boolean(initial?.id)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ...form,
        threshold_pct: parseFloat(form.threshold_pct),
        invest_amount: parseInt(form.invest_amount, 10),
      })
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to save')
      setSaving(false)
    }
  }

  const field =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-fog placeholder:text-fog-dim/60 focus:border-moss/50 focus:outline-none'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-deep rise w-full max-w-md rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display mb-5 text-2xl font-light text-fog">
          {isEdit ? 'Edit asset' : 'Track a new asset'}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs tracking-wide text-fog-dim uppercase">
              Ticker (Yahoo Finance)
            </label>
            <input
              className={field}
              placeholder="^NSEI, SETFNIF50.NS, RELIANCE.NS…"
              value={form.ticker}
              onChange={set('ticker')}
              required
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs tracking-wide text-fog-dim uppercase">
              Display name
            </label>
            <input
              className={field}
              placeholder="SBI Nifty 50 ETF"
              value={form.display_name}
              onChange={set('display_name')}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs tracking-wide text-fog-dim uppercase">
                Alert every (%)
              </label>
              <input
                className={field}
                type="number"
                step="0.1"
                min="0.1"
                value={form.threshold_pct}
                onChange={set('threshold_pct')}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs tracking-wide text-fog-dim uppercase">
                Invest amount (₹)
              </label>
              <input
                className={field}
                type="number"
                step="1000"
                min="0"
                value={form.invest_amount}
                onChange={set('invest_amount')}
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs tracking-wide text-fog-dim uppercase">
              Broker URL (Buy button)
            </label>
            <input
              className={field}
              type="url"
              placeholder="https://groww.in/etfs/sbi-nifty-50-etf"
              value={form.broker_url}
              onChange={set('broker_url')}
            />
          </div>
          {error && <p className="text-sm text-ember">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-sm text-fog-dim hover:text-fog"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-moss px-6 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-105 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Start tracking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Watchlist() {
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(null) // null | 'new' | item
  const [loading, setLoading] = useState(true)

  const load = () =>
    getWatchlist()
      .then(setItems)
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const save = async (form) => {
    if (modal === 'new') await addAsset(form)
    else await updateAsset(modal.id, form)
    await load()
  }

  const togglePause = async (item) => {
    await updateAsset(item.id, { ...item, active: !item.active })
    await load()
  }

  const remove = async (item) => {
    if (!window.confirm(`Stop tracking ${item.display_name}? Alert history is kept.`)) return
    await deleteAsset(item.id)
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="rise flex items-end justify-between pt-4">
        <div>
          <h1 className="font-display text-4xl font-light text-fog">Watchlist</h1>
          <p className="mt-1 text-sm text-fog-dim">Assets being watched for ATH dips</p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-ink transition-transform hover:scale-105"
        >
          <IconPlus className="h-4 w-4" /> Add asset
        </button>
      </div>

      <div className="glass rise overflow-hidden rounded-3xl" style={{ animationDelay: '100ms' }}>
        {loading ? (
          <p className="p-8 text-center text-sm text-fog-dim">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-fog-dim">Nothing tracked yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/8 text-xs tracking-wide text-fog-dim uppercase">
                <th className="px-5 py-4 font-medium">Asset</th>
                <th className="hidden px-5 py-4 font-medium sm:table-cell">Threshold</th>
                <th className="hidden px-5 py-4 font-medium sm:table-cell">Reminder</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-white/4">
                  <td className="px-5 py-4">
                    <p className="font-medium text-fog">{item.display_name}</p>
                    <p className="text-xs text-fog-dim">{item.ticker}</p>
                  </td>
                  <td className="num hidden px-5 py-4 text-fog sm:table-cell">
                    every −{item.threshold_pct}%
                  </td>
                  <td className="num hidden px-5 py-4 text-fog sm:table-cell">
                    {fmtAmount(item.invest_amount)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.active ? 'bg-moss/15 text-moss' : 'bg-white/8 text-fog-dim'
                      }`}
                    >
                      {item.active ? 'tracking' : 'paused'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setModal(item)}
                        title="Edit"
                        className="rounded-full p-2 text-fog-dim hover:bg-white/8 hover:text-fog"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => togglePause(item)}
                        title={item.active ? 'Pause' : 'Resume'}
                        className="rounded-full p-2 text-fog-dim hover:bg-white/8 hover:text-fog"
                      >
                        {item.active ? (
                          <IconPause className="h-4 w-4" />
                        ) : (
                          <IconPlay className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => remove(item)}
                        title="Delete"
                        className="rounded-full p-2 text-fog-dim hover:bg-ember/15 hover:text-ember"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <AssetModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  )
}

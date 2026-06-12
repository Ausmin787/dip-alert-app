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

// Bottom sheet on mobile, centered dialog on larger screens
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="glass-strong sheet-up w-full rounded-t-[2rem] p-6 sm:max-w-md sm:rounded-[2rem]"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25 sm:hidden" />
        <h2 className="font-display mb-5 text-2xl font-light text-fog">
          {isEdit ? 'Edit asset' : 'Track a new asset'}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[0.65rem] font-medium tracking-[0.15em] text-fog-dim uppercase">
              Ticker (Yahoo Finance)
            </label>
            <input
              className="field"
              placeholder="^NSEI, SETFNIF50.NS, RELIANCE.NS…"
              value={form.ticker}
              onChange={set('ticker')}
              required
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[0.65rem] font-medium tracking-[0.15em] text-fog-dim uppercase">
              Display name
            </label>
            <input
              className="field"
              placeholder="SBI Nifty 50 ETF"
              value={form.display_name}
              onChange={set('display_name')}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[0.65rem] font-medium tracking-[0.15em] text-fog-dim uppercase">
                Alert every (%)
              </label>
              <input
                className="field"
                type="number"
                step="0.1"
                min="0.1"
                value={form.threshold_pct}
                onChange={set('threshold_pct')}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[0.65rem] font-medium tracking-[0.15em] text-fog-dim uppercase">
                Amount (₹)
              </label>
              <input
                className="field"
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
            <label className="mb-1.5 block text-[0.65rem] font-medium tracking-[0.15em] text-fog-dim uppercase">
              Broker URL (Buy button)
            </label>
            <input
              className="field"
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
              className="pressable rounded-full px-5 py-3 text-sm text-fog-dim hover:text-fog"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="pressable rounded-full bg-moss px-6 py-3 text-sm font-semibold text-ink shadow-[0_8px_24px_-8px_rgba(163,233,116,0.6)] disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Start tracking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssetCard({ item, delay, onEdit, onToggle, onDelete }) {
  return (
    <article
      className="glass rise rounded-[1.5rem] p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-fog">{item.display_name}</h3>
          <p className="text-xs tracking-wide text-fog-dim">{item.ticker}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold tracking-wide uppercase ${
            item.active
              ? 'bg-moss/20 text-moss ring-1 ring-moss/30'
              : 'bg-white/10 text-fog-dim ring-1 ring-white/10'
          }`}
        >
          {item.active ? 'tracking' : 'paused'}
        </span>
      </div>

      <div className="num mt-4 flex gap-5 text-sm text-fog">
        <span>
          every <span className="font-semibold">−{item.threshold_pct}%</span>
        </span>
        <span>
          reminds <span className="font-semibold">{fmtAmount(item.invest_amount)}</span>
        </span>
      </div>

      <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
        <button
          onClick={onEdit}
          className="pressable flex flex-1 items-center justify-center gap-2 rounded-full bg-white/8 py-2.5 text-xs font-medium text-fog ring-1 ring-white/10 hover:bg-white/12"
        >
          <IconPencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          onClick={onToggle}
          className="pressable flex flex-1 items-center justify-center gap-2 rounded-full bg-white/8 py-2.5 text-xs font-medium text-fog ring-1 ring-white/10 hover:bg-white/12"
        >
          {item.active ? (
            <>
              <IconPause className="h-3.5 w-3.5" /> Pause
            </>
          ) : (
            <>
              <IconPlay className="h-3.5 w-3.5" /> Resume
            </>
          )}
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete"
          className="pressable flex items-center justify-center rounded-full bg-white/8 px-4 py-2.5 text-ember ring-1 ring-white/10 hover:bg-ember/15"
        >
          <IconTrash className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
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
    <div className="space-y-5">
      <div className="rise flex items-end justify-between gap-3 pt-3">
        <div>
          <h1 className="text-gradient font-display text-4xl font-light">Watchlist</h1>
          <p className="mt-1.5 text-sm text-fog-dim">Assets being watched for ATH dips</p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="pressable flex shrink-0 items-center gap-2 rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ink shadow-[0_8px_24px_-8px_rgba(163,233,116,0.6)]"
        >
          <IconPlus className="h-4 w-4" /> <span className="hidden sm:inline">Add asset</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {loading ? (
        <p className="glass rounded-3xl p-8 text-center text-sm text-fog-dim">Loading…</p>
      ) : items.length === 0 ? (
        <p className="glass rounded-3xl p-8 text-center text-sm text-fog-dim">
          Nothing tracked yet — add your first asset.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item, i) => (
            <AssetCard
              key={item.id}
              item={item}
              delay={90 + i * 70}
              onEdit={() => setModal(item)}
              onToggle={() => togglePause(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </div>
      )}

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

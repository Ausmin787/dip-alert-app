import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { addAsset, deleteAsset, getWatchlist, updateAsset } from '../api.js'
import { Magnetic, Reveal } from '../components/anim.jsx'
import { IconPause, IconPencil, IconPlay, IconPlus, IconTrash } from '../components/icons.jsx'
import { fmtAmount, fmtLevel } from '../lib.js'
import { useAssets } from '../AssetContext.jsx'

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

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-canvas/70 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full rounded-t-3xl border border-hairline bg-surface-2 p-6 shadow-[0_-24px_80px_-12px_rgba(0,0,0,0.9)] sm:max-w-md sm:rounded-3xl"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        initial={{ y: 48, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 32, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline sm:hidden" />
        <h2 className="display mb-1 text-xl font-bold tracking-tight text-ink">
          {isEdit ? 'Edit asset' : 'Track a new asset'}
        </h2>
        <p className="mb-5 text-xs text-ink-muted">
          {isEdit
            ? 'Ticker is locked — delete and re-add to change it.'
            : 'Yahoo Finance tickers: ^NSEI, SETFNIF50.NS, RELIANCE.NS…'}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="tag mb-1.5 block">Ticker</label>
            <input
              className="field"
              placeholder="^NSEI"
              value={form.ticker}
              onChange={set('ticker')}
              required
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="tag mb-1.5 block">Display name</label>
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
              <label className="tag mb-1.5 block">Alert every (%)</label>
              <input
                className="field"
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={form.threshold_pct}
                onChange={set('threshold_pct')}
                required
              />
            </div>
            <div>
              <label className="tag mb-1.5 block">Amount (₹)</label>
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
            <label className="tag mb-1.5 block">Broker URL (buy button)</label>
            <input
              className="field"
              type="url"
              placeholder="https://groww.in/etfs/sbietf-nifty"
              value={form.broker_url}
              onChange={set('broker_url')}
            />
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Start tracking'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function AssetRow({ item, onEdit, onToggle, onDelete }) {
  return (
    <Reveal>
      <article className="panel panel-hover flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            className={`h-9 w-1 shrink-0 rounded-full ${
              item.active ? 'bg-gradient-to-b from-violet to-magenta' : 'bg-hairline'
            }`}
          />
          <div>
            <h3 className="text-sm font-semibold text-ink">{item.display_name}</h3>
            <p className="num mt-0.5 text-[0.65rem] text-ink-muted">{item.ticker}</p>
          </div>
        </div>

        <div className="num flex items-center gap-6 text-xs text-ink-muted sm:gap-8">
          <span>
            <span className="tag mr-2 normal-case">step</span>
            <span className="font-semibold text-ink">−{fmtLevel(item.threshold_pct)}%</span>
          </span>
          <span>
            <span className="tag mr-2 normal-case">deploys</span>
            <span className="font-semibold text-ink">{fmtAmount(item.invest_amount)}</span>
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[0.6rem] font-semibold tracking-[0.08em] uppercase ring-1 ${
              item.active
                ? 'bg-mint/10 text-mint ring-mint/25'
                : 'bg-surface-2 text-ink-muted ring-hairline'
            }`}
          >
            {item.active ? 'tracking' : 'paused'}
          </span>
        </div>

        <div className="flex gap-2">
          <button onClick={onEdit} className="btn-ghost !px-3.5 !py-2.5" aria-label="Edit">
            <IconPencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="btn-ghost !px-3.5 !py-2.5"
            aria-label={item.active ? 'Pause' : 'Resume'}
          >
            {item.active ? <IconPause className="h-3.5 w-3.5" /> : <IconPlay className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onDelete}
            className="btn-ghost !px-3.5 !py-2.5 text-coral hover:!border-coral/40"
            aria-label="Delete"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </article>
    </Reveal>
  )
}

export default function Watchlist() {
  const [items, setItems] = useState(null) // null = loading
  const [modal, setModal] = useState(null) // null | 'new' | item
  const { refresh } = useAssets()

  const load = () =>
    getWatchlist()
      .then(setItems)
      .catch(() => setItems([]))

  useEffect(() => {
    load()
  }, [])

  const save = async (form) => {
    if (modal === 'new') await addAsset(form)
    else await updateAsset(modal.id, form)
    await load()
    refresh()
  }

  const togglePause = async (item) => {
    try {
      await updateAsset(item.id, { ...item, active: !item.active })
    } catch (err) {
      window.alert(err.response?.data?.detail ?? 'Update failed')
    }
    await load()
    refresh()
  }

  const remove = async (item) => {
    if (!window.confirm(`Stop tracking ${item.display_name}? Alert history is kept.`)) return
    try {
      await deleteAsset(item.id)
    } catch (err) {
      window.alert(err.response?.data?.detail ?? 'Delete failed')
    }
    await load()
    refresh()
  }

  return (
    <div className="space-y-5">
      <Reveal className="flex items-end justify-between gap-3">
        <div>
          <p className="tag mb-3">Assets under watch</p>
          <h1 className="display text-4xl font-bold tracking-tight text-ink">Watchlist</h1>
        </div>
        <Magnetic className="shrink-0">
          <button onClick={() => setModal('new')} className="btn-primary">
            <IconPlus className="h-4 w-4" /> <span className="hidden sm:inline">Add asset</span>
            <span className="sm:hidden">Add</span>
          </button>
        </Magnetic>
      </Reveal>

      {items === null ? (
        <div className="panel p-8 text-center text-sm text-ink-muted">Loading…</div>
      ) : items.length === 0 ? (
        <Reveal>
          <div className="panel p-10 text-center">
            <p className="text-sm text-ink-muted">Nothing tracked yet — add your first asset.</p>
          </div>
        </Reveal>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AssetRow
              key={item.id}
              item={item}
              onEdit={() => setModal(item)}
              onToggle={() => togglePause(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <AssetModal
            initial={modal === 'new' ? null : modal}
            onClose={() => setModal(null)}
            onSave={save}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

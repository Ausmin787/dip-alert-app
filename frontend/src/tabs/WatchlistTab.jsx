import { useCallback, useEffect, useRef, useState } from 'react'
import { addAsset, getSettings, updateAsset } from '../api.js'
import { useAssets } from '../useAssets.js'
import { useToast } from '../Toast.jsx'
import { useConfirm } from '../ConfirmDialog.jsx'
import { useTick } from '../hooks.js'
import { RollingText, Screen, Sparkline } from '../ui.jsx'
import AssetDetail from '../AssetDetail.jsx'
import AssetForm from '../AssetForm.jsx'
import ErrorCard, { Unavailable } from '../ErrorCard.jsx'
import Icon from '../Icon.jsx'
import Sheet from '../Sheet.jsx'
import { WatchlistSkeleton } from '../Skeleton.jsx'
import { SPARK_DAYS, fmtPrice, fmtSigned, isMarketOpenIST, priceParts, shortName, timeAgo, unitWords } from '../lib.js'

/* The row names what its capsule measures, because the two alert modes measure
   different things: distance below the high, or today's move. A column of bare
   percentages would quietly mix the two. */
function AssetRow({ item, usdInr, selected, onOpen }) {
  const { historyFor } = useAssets()
  const p = priceParts(item.ticker, item.current_price, usdInr)
  const isDip = item.alert_mode === 'dip'
  const metric = isDip ? (item.drop_pct != null ? -item.drop_pct : null) : item.daily_change_pct
  const history = historyFor(item.ticker, SPARK_DAYS)
  const first = history?.[0]?.close
  const last = history?.[history.length - 1]?.close
  const unit = unitWords(p.unit)
  const what = !item.active ? 'Paused' : isDip ? 'Below high' : 'Today'
  const name = shortName(item.display_name)

  return (
    <button
      type="button"
      className={`wrow ${item.active ? '' : 'paused'}`}
      aria-current={selected ? 'true' : undefined}
      aria-label={`${name}, ${p.prefix}${fmtPrice(p.value)}${unit ? ` ${unit}` : ''}, ${fmtSigned(metric)} ${isDip ? 'below all-time high' : 'today'}${item.active ? '' : ', paused'}`}
      onClick={onOpen}
    >
      <div style={{ minWidth: 0 }}>
        <div className="t-head clip">{name}</div>
        <div className="t-sub c-2 clip">{what}{unit ? ` · ${unit}` : ''}</div>
      </div>
      <Sparkline history={history} up={first == null || last >= first} />
      <div className="wrow-right">
        <RollingText text={`${p.prefix}${fmtPrice(p.value)}`} className="t-body num clip" />
        <div>
          <span className={`chg ${metric == null || metric === 0 ? 'none' : metric > 0 ? 'up' : 'down'}`}>{fmtSigned(metric)}</span>
        </div>
      </div>
    </button>
  )
}

/* Until CallMeBot credentials are saved the app looks fully operational, with live
   prices, but no alert can ever fire. HIG Feedback: say so in place, without
   interrupting; HIG Alerts: never with an alert on launch. */
function SetupNotice({ onSetup, onDismiss }) {
  return (
    <div className="notice" role="status">
      <div className="notice-glyph"><Icon name="bell" filled /></div>
      <div style={{ minWidth: 0 }}>
        <div className="t-head">Alerts Are Off</div>
        <div className="t-sub c-2">WhatsApp isn’t connected.</div>
      </div>
      <div className="notice-actions">
        <button type="button" className="btn btn-plain" onClick={onSetup}>Set Up</button>
        <button type="button" className="iconbtn" onClick={onDismiss} aria-label="Dismiss"><Icon name="x" weight={3} /></button>
      </div>
    </div>
  )
}

export default function WatchlistTab({ active, regular, onOpenSettings }) {
  const { items, selectedItem, setSelectedAsset, selectedAsset, loading, error, lastUpdated, usdInr, refresh } = useAssets()
  const toast = useToast()
  const { confirm } = useConfirm()
  const [detailOpen, setDetailOpen] = useState(false)
  const [form, setForm] = useState(null) // null | { initial, reopenDetail }
  const [needsSetup, setNeedsSetup] = useState(false)
  const [setupDismissed, setSetupDismissed] = useState(false)
  const formDirty = useRef(false)
  const onFormDirty = useCallback((dirty) => {
    formDirty.current = dirty
  }, [])
  useTick(30_000)

  useEffect(() => {
    if (!active) return
    getSettings()
      .then((s) => setNeedsSetup(!(s?.apikey_set && s?.whatsapp_phone_masked)))
      .catch(() => setNeedsSetup(false)) // Never nag on a failed settings read.
  }, [active])

  /* HIG Sheets: one sheet at a time. Editing closes the detail sheet, and closing the
     form brings it back, so people return to where they were. */
  const openEdit = () => {
    const reopenDetail = !regular
    setDetailOpen(false)
    setForm({ initial: selectedItem, reopenDetail })
  }
  const closeForm = () => {
    if (form?.reopenDetail) setDetailOpen(true)
    setForm(null)
    formDirty.current = false
  }

  /* Every way out of the form that isn't saving: Cancel, swipe, Esc, tap outside.
     HIG Sheets: confirm before unsaved changes are lost to a swipe. */
  const requestCloseForm = async () => {
    if (formDirty.current) {
      const discard = await confirm({
        title: 'Discard your changes?',
        body: 'What you’ve entered here won’t be saved.',
        confirmLabel: 'Discard',
      })
      if (!discard) return
    }
    closeForm()
  }

  const saveForm = async (values) => {
    const isNew = !form?.initial
    if (isNew) await addAsset(values)
    else await updateAsset(form.initial.id, values)
    await refresh()
    if (isNew) setSelectedAsset(values.ticker)
    toast.ok(isNew ? `Now tracking ${values.display_name}` : `${values.display_name} updated`)
    closeForm()
  }

  const subtitle = error
    ? null
    : `${lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Updating'} · NSE ${isMarketOpenIST() ? 'open' : 'closed'}`

  const addButton = (
    <button
      type="button"
      className="gbtn glass"
      aria-label="Add asset"
      onClick={() => {
        setDetailOpen(false)
        setForm({ initial: null, reopenDetail: false })
      }}
    >
      <Icon name="plus" />
    </button>
  )

  const list = (
    <Screen title="Watchlist" subtitle={subtitle} actions={addButton}>
      {needsSetup && !setupDismissed && !loading && !error && (
        <SetupNotice onSetup={onOpenSettings} onDismiss={() => setSetupDismissed(true)} />
      )}
      {loading ? (
        <WatchlistSkeleton />
      ) : error ? (
        <ErrorCard title="Can’t Load Prices" message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
        <Unavailable
          title="No Assets"
          message="Add an asset to start watching it."
          action={
            <button type="button" className="btn btn-tinted" onClick={() => setForm({ initial: null, reopenDetail: false })}>
              Add Asset
            </button>
          }
        />
      ) : (
        <>
          <div className="wlist">
            {items.map((item) => (
              <AssetRow
                key={item.id}
                item={item}
                usdInr={usdInr}
                selected={regular && item.ticker === selectedAsset}
                onOpen={() => {
                  setSelectedAsset(item.ticker)
                  if (!regular) setDetailOpen(true)
                }}
              />
            ))}
          </div>
          <p className="list-note t-foot c-2">
            Dip alerts run 9:15 AM to 3:30 PM IST, Monday to Friday. Daily moves are checked around the clock.
          </p>
        </>
      )}
    </Screen>
  )

  return (
    <>
      {regular ? (
        <div className="split">
          <div className="split-list">{list}</div>
          <div className="split-detail">
            {selectedItem ? (
              <div className="screen" data-scroller>
                <AssetDetail
                  item={selectedItem}
                  usdInr={usdInr}
                  inline
                  onEdit={openEdit}
                />
              </div>
            ) : (
              !loading && <Unavailable title="No Asset Selected" message="Choose an asset from the list." />
            )}
          </div>
        </div>
      ) : (
        list
      )}

      {!regular && (
        <Sheet open={detailOpen && Boolean(selectedItem)} onClose={() => setDetailOpen(false)} label={selectedItem ? shortName(selectedItem.display_name) : 'Asset'}>
          {selectedItem && (
            <AssetDetail
              item={selectedItem}
              usdInr={usdInr}
              onClose={() => setDetailOpen(false)}
              onEdit={openEdit}
            />
          )}
        </Sheet>
      )}

      <Sheet open={Boolean(form)} onClose={requestCloseForm} label={form?.initial ? 'Edit alert' : 'Add asset'} variant="form">
        {form && <AssetForm key={form.initial?.id ?? 'new'} initial={form.initial} onClose={requestCloseForm} onSave={saveForm} onDirtyChange={onFormDirty} />}
      </Sheet>
    </>
  )
}

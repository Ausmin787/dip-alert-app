import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteAsset, updateAsset } from './api.js'
import { useAssets } from './useAssets.js'
import { useToast } from './Toast.jsx'
import { useConfirm } from './ConfirmDialog.jsx'
import { useScrollState, useTick } from './hooks.js'
import { RollingText } from './ui.jsx'
import Icon from './Icon.jsx'
import Menu from './Menu.jsx'
import PriceChart from './PriceChart.jsx'
import AlertRow from './AlertRow.jsx'
import { DipLadder, MoveGauge } from './AlertInstrument.jsx'
import {
  RANGES,
  fmtLevel,
  fmtMarketDate,
  fmtPrice,
  fmtRupees,
  fmtSigned,
  isMarketOpenIST,
  isMetal,
  nextAlertPrice,
  priceParts,
  safeBrokerUrl,
  shortName,
  tickerMeta,
  unitWords,
} from './lib.js'

const apiError = (err, fallback) => err.response?.data?.detail ?? fallback

const brokerName = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').split('.')[0]
    return host.charAt(0).toUpperCase() + host.slice(1)
  } catch {
    return 'Broker'
  }
}

/* Price readout and chart live together: scrubbing re-renders only this subtree, so
   the number under the finger never waits on the rest of the screen. */
function ChartSection({ item, usdInr }) {
  const { historyFor, ensureHistory } = useAssets()
  const [rangeId, setRangeId] = useState('1M')
  const [scrub, setScrub] = useState(null)
  const days = RANGES.find((r) => r.id === rangeId).days

  useEffect(() => {
    ensureHistory(item.ticker, days)
    const interval = setInterval(() => ensureHistory(item.ticker, days), 5 * 60_000)
    return () => clearInterval(interval)
  }, [item.ticker, days, ensureHistory])

  const loaded = historyFor(item.ticker, days)
  // Hold the last line on screen while the next one loads, so it can morph across.
  const [shown, setShown] = useState(null)
  if (loaded && loaded !== shown) setShown(loaded)
  const history = loaded ?? shown

  const isDip = item.alert_mode === 'dip'
  const rules = useMemo(() => {
    if (!isDip) return []
    const next = nextAlertPrice(item)
    return [
      ...(item.ath_price != null ? [{ id: 'high', value: item.ath_price, label: 'High', kind: 'high' }] : []),
      ...(next != null ? [{ id: 'next', value: next, label: `−${fmtLevel(item.next_alert_level)}%`, kind: 'level' }] : []),
    ]
  }, [isDip, item])

  const first = history?.[0]?.close
  const last = history?.[history.length - 1]?.close
  const rising = first == null || last >= first
  const colour = rising ? 'var(--up)' : 'var(--down)'

  // Past closes stay in the quote currency: converting them at today's rate would
  // invent a rupee figure that was never true.
  const quote = priceParts(item.ticker, 1, null)
  const metal = isMetal(item.ticker)
  const fmtQuote = useCallback(
    (v) => `${quote.prefix}${fmtPrice(v)}${metal ? '/oz' : quote.unit ? ` ${quote.unit}` : ''}`,
    [quote.prefix, quote.unit, metal],
  )

  const live = priceParts(item.ticker, item.current_price, usdInr)
  const change = isDip ? (item.drop_pct != null ? -item.drop_pct : null) : item.daily_change_pct

  const summary = history?.length >= 2
    ? `Closed at ${fmtQuote(first)} on ${fmtMarketDate(history[0].date)} and ${fmtQuote(last)} on ${fmtMarketDate(history[history.length - 1].date)}`
    : 'No price history available'

  const scrubChange = scrub && first ? ((scrub.close - first) / first) * 100 : null

  return (
    <>
      <div className="d-price" aria-live="off">
        {scrub ? (
          <>
            <div className="d-price-row">
              <span className="t-title3 num" style={{ fontWeight: 700 }}>{fmtQuote(scrub.close)}</span>
              <span className={`t-sub num w-600 ${scrubChange >= 0 ? 'c-up' : 'c-down'}`}>{fmtSigned(scrubChange)}</span>
            </div>
            <p className="t-sub c-2 num">
              {fmtMarketDate(scrub.date, { year: true })} close, since {fmtMarketDate(history[0].date)}
            </p>
          </>
        ) : (
          <>
            <div className="d-price-row">
              <span style={{ fontWeight: 700 }}>
                <RollingText text={`${live.prefix}${fmtPrice(live.value)}`} className="t-title3 num d-hero" />
              </span>
              {live.unit && <span className="t-sub c-2">{unitWords(live.unit)}</span>}
              {change != null && (
                <span className={`t-sub num w-600 ${change > 0 ? 'c-up' : change < 0 ? 'c-down' : 'c-2'}`}>{fmtSigned(change)}</span>
              )}
            </div>
            <p className="t-sub c-2 num">
              {isDip
                ? item.ath_price != null
                  ? `Below the ${quote.prefix}${fmtPrice(item.ath_price)} high${item.ath_date ? ` of ${fmtMarketDate(item.ath_date)}` : ''}`
                  : 'All-time high still loading'
                : 'Today, against yesterday’s close'}
            </p>
          </>
        )}
      </div>

      {/* Indian-context metal pricing. Never let this read as the jeweller or MCX
          rate: Indian physical metal adds ~6% import duty and 3% GST on top. */}
      {metal && live.prefix === '₹' && usdInr != null && (
        <>
          <div className="hr" />
          <p className="d-fx num">
            ${fmtPrice(item.current_price)}/oz at ₹{usdInr.toFixed(2)} to the dollar. International equivalent, excludes duty and GST.
          </p>
        </>
      )}

      <div className="hr" />
      <div className="ranges" role="group" aria-label="Chart period">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className="rng"
            aria-pressed={r.id === rangeId}
            onClick={() => {
              setScrub(null)
              setRangeId(r.id)
            }}
          >
            {r.id}
          </button>
        ))}
      </div>

      <PriceChart
        history={history}
        rules={rules}
        color={colour}
        loading={!loaded}
        label={`${shortName(item.display_name)} closing price, ${rangeId}`}
        summary={summary}
        formatValue={fmtQuote}
        onScrub={setScrub}
      />
    </>
  )
}

function Stats({ item }) {
  const { prefix } = priceParts(item.ticker, item.current_price, null)
  const stats = item.alert_mode === 'dip'
    ? [
        ['High', item.ath_price != null ? `${prefix}${fmtPrice(item.ath_price)}` : '—'],
        ['Each Level', fmtRupees(item.invest_amount)],
        ['Deployed', fmtRupees((item.last_alerted_level || 0) * (item.invest_amount || 0))],
      ]
    : [
        ['Alert At', `±${fmtLevel(item.threshold_pct)}%`],
        ['Compared To', 'Last close'],
        ['At Most', 'Once a day, each way'],
      ]
  return (
    <div className="stats3">
      {stats.map(([label, value]) => (
        <div key={label}>
          <div className="t-foot c-2">{label}</div>
          <div className="stat-v">{value}</div>
        </div>
      ))}
    </div>
  )
}

/* Detail for one asset, shared by the phone's sheet and the wide screen's pane. Modelled
   on the HIG charts-stocks screenshot: symbol and name on one baseline, hairlines
   instead of cards, trailing y-axis, three-column stats, market state at the foot. */
export default function AssetDetail({ item, usdInr, onClose = null, onEdit, inline = false }) {
  const { refresh, alerts } = useAssets()
  const toast = useToast()
  const { confirm } = useConfirm()
  const barRef = useRef(null)
  const titleRef = useRef(null)
  const scroll = useScrollState(barRef, titleRef)
  useTick(30_000)

  const name = shortName(item.display_name)
  const { exchange, type } = tickerMeta(item.ticker)
  const isDip = item.alert_mode === 'dip'
  const marketOpen = isMarketOpenIST()

  const togglePause = async () => {
    try {
      await updateAsset(item.id, { ...item, active: !item.active })
      await refresh()
      toast.ok(item.active ? `${name} paused` : `${name} resumed`)
    } catch (err) {
      toast.err(apiError(err, 'Couldn’t update this asset.'))
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Stop tracking ${name}?`,
      body: 'Alert history is kept, and you can add it back any time.',
      confirmLabel: 'Stop Tracking',
    })
    if (!ok) return
    try {
      await deleteAsset(item.id)
      onClose?.()
      await refresh()
      toast.ok(`Stopped tracking ${name}`)
    } catch (err) {
      toast.err(apiError(err, 'Couldn’t remove this asset.'))
    }
  }

  const brokerHref = safeBrokerUrl(item.broker_url)
  const menu = [
    { label: 'Edit Alert', icon: 'pencil', onSelect: onEdit },
    { label: item.active ? 'Pause Monitoring' : 'Resume Monitoring', icon: item.active ? 'pause' : 'play', onSelect: togglePause },
    ...(brokerHref ? [{ label: `Open ${brokerName(brokerHref)}`, icon: 'link', href: brokerHref }] : []),
    { separator: true },
    { label: 'Stop Tracking', icon: 'trash', danger: true, onSelect: remove },
  ]

  const assetAlerts = (alerts ?? []).filter((a) => a.ticker === item.ticker).slice(0, 5)

  return (
    <>
      <div className="detail-toolbar" ref={barRef} data-scroll={scroll} data-inline={inline}>
        <div className="scroll-edge" aria-hidden="true" />
        <div className="nav-inline-title t-head clip" aria-hidden="true">{name}</div>
        {inline ? (
          <div className="toolbar-spacer" />
        ) : (
          <button type="button" className="gbtn glass" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        )}
        <Menu label={`More for ${name}`} items={menu} />
      </div>

      <div className="detail">
        <div className="d-title">
          <h1 className="t-title1" ref={titleRef}>{name}</h1>
          <span className="t-sub c-2">{exchange} · {type}</span>
        </div>
        <div className="hr" />

        <ChartSection item={item} usdInr={usdInr} />

        <Stats item={item} />
        <div className="hr" style={{ marginBottom: 8 }} />

        {isDip ? <DipLadder item={item} /> : <MoveGauge item={item} />}

        {assetAlerts.length > 0 && (
          <section aria-label="Recent alerts">
            <div className="instrument-head" style={{ paddingTop: 20, paddingBottom: 8 }}>
              <h2 className="t-title3">Recent Alerts</h2>
            </div>
            <div className="group">
              {assetAlerts.map((a) => <AlertRow key={a.id} alert={a} name={item.display_name} withDate />)}
            </div>
          </section>
        )}

        <p className="market-foot t-foot c-2">
          {!item.active ? 'Paused' : isDip ? (marketOpen ? 'Market Open' : 'Market Closed') : 'Checked around the clock'}
        </p>
      </div>
    </>
  )
}

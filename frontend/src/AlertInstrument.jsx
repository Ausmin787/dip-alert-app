import Icon from './Icon.jsx'
import { dipLadder, fmtLevel, fmtPrice, fmtRupees, fmtSigned, nextAlertPrice, priceParts, shortName } from './lib.js'

const RUNG_LABEL = { next: 'Next', alerted: 'Alerted', passed: 'Passed' }

/* The app's instrument: every alert level is a price and an amount, with today's
   price sitting between the rungs, so "where am I and what happens next" is one
   glance. Headline first, because HIG Charts asks for the main message in words. */
export function DipLadder({ item }) {
  const { ahead, behind } = dipLadder(item)
  const next = nextAlertPrice(item)
  const distance = next != null && item.current_price != null ? item.current_price - next : null
  const { prefix } = priceParts(item.ticker, item.current_price, null)
  const money = (n) => `${prefix}${fmtPrice(n)}`

  let headline
  let sub
  if (!item.active) {
    headline = 'Monitoring Paused'
    sub = 'No alerts go out for this asset until you resume it.'
  } else if (distance != null && distance > 0) {
    headline = `${money(distance)} to next alert`
    sub = `WhatsApp goes out when ${shortName(item.display_name)} reaches ${money(next)}, which is −${fmtLevel(item.next_alert_level)}%.`
  } else if (next != null) {
    headline = 'Alert due at the next check'
    sub = `${shortName(item.display_name)} is at or past ${money(next)}, which is −${fmtLevel(item.next_alert_level)}%.`
  } else {
    headline = 'Waiting for the all-time high'
    sub = 'Alert levels appear once the high has loaded.'
  }

  return (
    <section aria-label="Alert levels">
      <div className="instrument-head">
        <h2 className="t-title3 num">{headline}</h2>
        <p className="t-sub c-2" style={{ marginTop: 2 }}>{sub}</p>
      </div>
      {ahead.length > 0 && (
        <div className="group">
          {ahead.map((rung) => <Rung key={rung.index} rung={rung} money={money} amount={item.invest_amount} />)}
          <div className="rung-now">
            <Icon name="now" weight={2.4} />
            <span>Now {money(item.current_price)}</span>
          </div>
          {behind.map((rung) => <Rung key={rung.index} rung={rung} money={money} amount={item.invest_amount} />)}
        </div>
      )}
    </section>
  )
}

function Rung({ rung, money, amount }) {
  const muted = rung.state === 'passed' || rung.state === 'alerted'
  return (
    <div className="rung" data-state={rung.state}>
      <div className="rung-dot" aria-hidden="true" />
      <div className={`t-head num ${muted ? 'c-2' : ''}`}>−{fmtLevel(rung.pct)}%</div>
      <div className={`t-body num clip ${muted ? 'c-2' : ''}`}>{money(rung.price)}</div>
      <div className={`t-sub ${rung.state === 'next' ? 'c-level w-600' : 'c-2'}`}>
        {RUNG_LABEL[rung.state] ?? fmtRupees(amount)}
      </div>
    </div>
  )
}

/* A centre-zero gauge from minus to plus the alert size, with the alert points
   marked. HIG Gauges: label the value and both ends, here in text and aria alike. */
export function MoveGauge({ item }) {
  const change = item.daily_change_pct
  const threshold = item.threshold_pct
  const reach = Math.max(threshold * 1.5, Math.abs(change ?? 0) * 1.15)
  const at = (v) => 50 + (v / reach) * 50
  const past = change != null && Math.abs(change) >= threshold
  const up = change > 0

  let headline
  let sub
  if (!item.active) {
    headline = 'Monitoring Paused'
    sub = 'No alerts go out for this asset until you resume it.'
  } else if (change == null) {
    headline = 'Waiting for today’s price'
    sub = `Alerts go out when the daily move passes ±${fmtLevel(threshold)}%.`
  } else {
    headline = change === 0 ? 'Unchanged today' : `${up ? 'Up' : 'Down'} ${Math.abs(change).toFixed(2)}% today`
    sub = past
      ? `Past your ±${fmtLevel(threshold)}% alert. It goes out once a day in each direction.`
      : `Inside your ±${fmtLevel(threshold)}% alert.`
  }

  const left = change == null ? 50 : Math.min(at(change), 50)
  const right = change == null ? 50 : Math.max(at(change), 50)
  const colour = up ? 'var(--up)' : 'var(--down)'

  return (
    <section aria-label="Today’s move">
      <div className="instrument-head">
        <h2 className="t-title3 num">{headline}</h2>
        <p className="t-sub c-2" style={{ marginTop: 2 }}>{sub}</p>
      </div>
      <div
        className="group gauge"
        role="meter"
        aria-label="Today’s move against the alert size"
        aria-valuemin={-reach}
        aria-valuemax={reach}
        aria-valuenow={change ?? 0}
        aria-valuetext={`${fmtSigned(change)} today. Alert at plus or minus ${fmtLevel(threshold)} percent.`}
      >
        <div className="gauge-track">
          <div className="gauge-fill" style={{ left: `${left}%`, width: `${right - left}%`, background: colour }} />
          <div className="gauge-zero" />
          <div className="gauge-limit" style={{ left: `${at(-threshold)}%` }} />
          <div className="gauge-limit" style={{ left: `${at(threshold)}%` }} />
          {change != null && <div className="gauge-dot" style={{ left: `${at(change)}%`, background: colour }} />}
        </div>
        <div className="gauge-labels" aria-hidden="true">
          <span style={{ left: `${at(-threshold)}%` }}>−{fmtLevel(threshold)}%</span>
          <span style={{ left: '50%' }}>0</span>
          <span style={{ left: `${at(threshold)}%` }}>+{fmtLevel(threshold)}%</span>
        </div>
      </div>
    </section>
  )
}

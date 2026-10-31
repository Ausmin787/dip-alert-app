import Icon from './Icon.jsx'
import { fmtDayIST, fmtLevel, fmtPrice, fmtRupees, fmtSigned, fmtTimeIST, isTodayIST, priceParts, shortName } from './lib.js'

/* One delivered alert. usdInr is deliberately not passed to priceParts: this is the
   price at the moment the alert fired, and converting a past dollar figure at
   today's rate would invent a rupee number that was never true. Historical rows
   keep the asset's own quote currency. */
export default function AlertRow({ alert, name, entering = false, withDate = false }) {
  const isMove = alert.alert_direction != null
  const up = alert.alert_direction === 'up'
  const p = priceParts(alert.ticker, alert.current_price, null)
  const displayName = shortName(name ?? alert.ticker)
  const price = `${p.prefix}${fmtPrice(p.value)}${p.unit ? ` ${p.unit}` : ''}`

  const title = isMove
    ? `${displayName} ${up ? 'up' : 'down'} ${fmtSigned(alert.drop_pct).replace(/^[+−]/, '')}`
    : `${displayName} reached −${fmtLevel(alert.level_pct ?? alert.alert_level)}%`
  const detail = isMove
    ? `${price} · daily move`
    : alert.invest_amount == null
      ? `${price} · amount not recorded`
      : `${price} · buy ${fmtRupees(alert.invest_amount)}`

  return (
    <div className={`ai ${entering ? 'entering' : ''}`}>
      <div className={`ai-glyph ${isMove ? (up ? 'up' : 'down') : 'level'}`} aria-hidden="true">
        <Icon name={isMove ? (up ? 'upRight' : 'downRight') : 'down'} weight={2.6} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="t-body w-600 clip">{title}</div>
        <div className="t-foot c-2 clip num">{detail}</div>
      </div>
      {/* Stacked, so a date never squeezes the title into truncation. */}
      <div className="ai-time t-foot c-2 num">
        {withDate && !isTodayIST(alert.alerted_at) && <div>{fmtDayIST(alert.alerted_at)}</div>}
        <div>{fmtTimeIST(alert.alerted_at)}</div>
        {!alert.whatsapp_sent && <div className="c-down">Not sent</div>}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAssets } from '../useAssets.js'
import { Screen, Segmented } from '../ui.jsx'
import AlertRow from '../AlertRow.jsx'
import ErrorCard, { Unavailable } from '../ErrorCard.jsx'
import { ListSkeleton } from '../Skeleton.jsx'
import { fmtRupees, groupAlerts, isTodayIST, monthLabelIST } from '../lib.js'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'dip', label: 'Dips' },
  { id: 'move', label: 'Moves' },
]

const EMPTY = {
  all: ['No Alerts Yet', 'Alerts appear here once a level is crossed and the WhatsApp message goes out.'],
  dip: ['No Dip Alerts', 'They appear here as the price crosses each level below its high.'],
  move: ['No Daily Moves', 'They appear here when a day’s move passes its alert size.'],
}

/* What was deployed this month, from the same list the feed below it shows. One
   dataset, so one tab (the old Alerts and History tabs showed it twice). */
function MonthSummary({ dipAlerts }) {
  const thisMonth = monthLabelIST(new Date().toISOString())
  const monthAlerts = dipAlerts.filter((a) => monthLabelIST(a.alerted_at) === thisMonth)
  const deployed = monthAlerts.reduce((sum, a) => sum + (a.invest_amount ?? 0), 0)
  const deepest = dipAlerts
    .filter((a) => isTodayIST(a.alerted_at))
    .reduce((max, a) => Math.max(max, a.drop_pct), 0)
  return (
    <div className="group summary" style={{ marginBottom: 4 }}>
      <div className="t-sub c-2">Deployed in {thisMonth.split(' ')[0]}</div>
      <div className="t-title1 num">{fmtRupees(deployed)}</div>
      <div className="summary-stats">
        <div>
          <div className="t-foot c-2">Dip Alerts</div>
          <div className="stat-v">{monthAlerts.length} this month</div>
        </div>
        <div>
          <div className="t-foot c-2">Deepest Today</div>
          <div className="stat-v">{deepest > 0 ? `−${deepest.toFixed(2)}%` : 'None'}</div>
        </div>
      </div>
    </div>
  )
}

export default function AlertsTab({ active }) {
  const { items, alerts, alertsError, markAlertsSeen, refresh } = useAssets()
  const [filter, setFilter] = useState('all')

  // Reading the tab clears its badge, and keeps clearing it while it stays open.
  useEffect(() => {
    if (active && alerts) markAlertsSeen()
  }, [active, alerts, markAlertsSeen])

  const names = useMemo(() => Object.fromEntries(items.map((i) => [i.ticker, i.display_name])), [items])
  const dipAlerts = useMemo(() => (alerts ?? []).filter((a) => a.alert_direction == null), [alerts])
  const shown = useMemo(() => {
    if (filter === 'dip') return dipAlerts
    if (filter === 'move') return (alerts ?? []).filter((a) => a.alert_direction != null)
    return alerts ?? []
  }, [alerts, dipAlerts, filter])
  const groups = useMemo(() => groupAlerts(shown), [shown])

  /* A new arrival while the tab is open settles in from above. Only then: this must
     not run on load or on the 60-second poll when nothing changed. */
  const topId = alerts?.[0]?.id
  const prevTopId = useRef(topId)
  const [enteringId, setEnteringId] = useState(null)
  useEffect(() => {
    if (prevTopId.current != null && topId != null && topId !== prevTopId.current) setEnteringId(topId)
    prevTopId.current = topId
  }, [topId])

  let content
  if (alertsError && alerts === null) {
    content = <ErrorCard title="Can’t Load Alerts" message={alertsError} onRetry={refresh} />
  } else if (alerts === null) {
    content = <ListSkeleton rows={5} label="Loading alerts" />
  } else if (alerts.length === 0) {
    content = <Unavailable icon="bell" title={EMPTY.all[0]} message={EMPTY.all[1]} />
  } else {
    content = (
      <>
        <div className="filter">
          <Segmented label="Filter alerts" options={FILTERS} value={filter} onChange={setFilter} />
        </div>
        {filter !== 'move' && <MonthSummary dipAlerts={dipAlerts} />}
        {groups.length === 0 ? (
          <Unavailable icon="bell" title={EMPTY[filter][0]} message={EMPTY[filter][1]} />
        ) : (
          groups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <div className="group-title-row">
                <h2 className="t-title3">{group.title}</h2>
                {group.deployed > 0 && <span className="t-foot c-2 num">{fmtRupees(group.deployed)} deployed</span>}
              </div>
              <div className="group">
                {group.rows.map((a) => (
                  <AlertRow
                    key={a.id}
                    alert={a}
                    name={names[a.ticker]}
                    entering={a.id === enteringId}
                    withDate={group.title !== 'Today' && group.title !== 'Yesterday'}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </>
    )
  }

  return (
    <Screen title="Alerts">
      {content}
    </Screen>
  )
}

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  dipLadder,
  fmtMarketDate,
  fmtSigned,
  groupAlerts,
  isMetal,
  metalUnit,
  nextAlertPrice,
  niceTicks,
  priceParts,
  safeBrokerUrl,
  severity,
  shortName,
  timeAgo,
  toIndianMetalPrice,
} from './lib.js'
import { createVelocityTracker, project, rubberband, stepSpring } from './spring.js'

assert.equal(severity(0.5).bar, '#2FE6A3')
assert.equal(severity(1.5).bar, '#F6C65B')
assert.equal(severity(4).bar, '#FF5E6C')

// timeAgo: freshness of the last successful status poll (client epoch)
const T0 = 1_700_000_000_000
assert.equal(timeAgo(null, T0), '—')
assert.equal(timeAgo(T0, T0), 'just now')
assert.equal(timeAgo(T0 - 44_000, T0), 'just now')
assert.equal(timeAgo(T0 - 60_000, T0), '1 min ago')
assert.equal(timeAgo(T0 - 5 * 60_000, T0), '5 min ago')
assert.equal(timeAgo(T0 - 90 * 60_000, T0), '1 hr ago')
assert.equal(timeAgo(T0 - 30 * 60 * 60_000, T0), '1d ago')
// Clock skew must not render a negative duration.
assert.equal(timeAgo(T0 + 10_000, T0), 'just now')

// --- Indian-context metal pricing -----------------------------------------
assert.equal(isMetal('GC=F'), true)
assert.equal(isMetal('SI=F'), true)
assert.equal(isMetal('^NDX'), false)
assert.equal(isMetal('^NSEI'), false)

// Gold quotes per 10g, silver per kg — the Indian convention, not troy ounces.
assert.equal(metalUnit('GC=F').grams, 10)
assert.equal(metalUnit('SI=F').grams, 1000)

// 1 troy oz = 31.1034768 g. Gold at $4,440.30/oz and ₹94.92/$ -> ₹/10g.
const gold = toIndianMetalPrice(4440.3, 'GC=F', 94.92)
assert.ok(Math.abs(gold - 135506.8) < 1, `gold ₹/10g was ${gold}`)
const silver = toIndianMetalPrice(66.345, 'SI=F', 94.92)
assert.ok(Math.abs(silver - 202471) < 50, `silver ₹/kg was ${silver}`)

// A missing or nonsensical rate must yield null, never NaN/0 — the UI drops the
// rupee line rather than rendering an invented number.
assert.equal(toIndianMetalPrice(4440.3, 'GC=F', null), null)
assert.equal(toIndianMetalPrice(null, 'GC=F', 94.92), null)
assert.equal(toIndianMetalPrice(4440.3, 'GC=F', 0), null)

// priceParts: one rule for every price cell in the app.
const goldParts = priceParts('GC=F', 4440.3, 94.92)
assert.equal(goldParts.prefix, '₹')
assert.equal(goldParts.unit, '/10g')
// No FX -> fall back to the native dollar quote, not a rupee guess.
assert.deepEqual(priceParts('GC=F', 4440.3, null), { prefix: '$', value: 4440.3, unit: null })
// Index levels are points: unit shown, and never a currency symbol.
assert.deepEqual(priceParts('^NDX', 29448.1, 94.92), { prefix: '', value: 29448.1, unit: 'pts' })
assert.deepEqual(priceParts('^GSPC', 6000, 94.92), { prefix: '', value: 6000, unit: 'pts' })
// Indian assets are already in rupees and gain no suffix.
assert.deepEqual(priceParts('^NSEI', 24042.3, 94.92), { prefix: '₹', value: 24042.3, unit: null })

// --- Display helpers ------------------------------------------------------
assert.equal(shortName('Gold (COMEX)'), 'Gold')
assert.equal(shortName('Nifty 50 Index'), 'Nifty 50')
assert.equal(shortName('S&P 500'), 'S&P 500')
assert.equal(fmtSigned(-3.29), '−3.29%')
assert.equal(fmtSigned(1.5), '+1.50%')
assert.equal(fmtSigned(0), '0.00%')
assert.equal(fmtSigned(null), '—')
// A market date must not shift with the viewer's timezone.
assert.match(fmtMarketDate('2026-01-02'), /^2 Jan/)

// --- Broker links: https only, whatever the database holds ----------------
assert.equal(safeBrokerUrl('https://groww.in/etfs/sbietf-nifty'), 'https://groww.in/etfs/sbietf-nifty')
for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'http://groww.in', 'https://u:p@groww.in', '', null, undefined, 'not a url']) {
  assert.equal(safeBrokerUrl(bad), null, `${bad} must not render as a link`)
}

// --- The alert ladder -----------------------------------------------------
const nifty = {
  ath_price: 26328.55,
  threshold_pct: 1,
  next_alert_level: 13,
  last_alerted_level: 11,
  current_price: 23053.1,
}
assert.ok(Math.abs(nextAlertPrice(nifty) - 22905.84) < 0.01)
const ladder = dipLadder(nifty)
assert.deepEqual(ladder.ahead.map((r) => [r.pct, r.state]), [[14, 'ahead'], [13, 'next']])
// Level 12 was crossed with no alert recorded: it must not claim one went out.
assert.deepEqual(ladder.behind.map((r) => [r.pct, r.state]), [[12, 'passed'], [11, 'alerted']])
// Near the high there is nothing behind the first rung, and no level zero or below.
const nearHigh = dipLadder({ ...nifty, next_alert_level: 1, last_alerted_level: 0 })
assert.deepEqual(nearHigh.behind, [])
// A half-percent step keeps levels in percent, not in rung index.
const half = dipLadder({ ...nifty, threshold_pct: 0.5, next_alert_level: 2, last_alerted_level: 0 })
assert.deepEqual(half.ahead.map((r) => r.pct), [2.5, 2])
assert.deepEqual(dipLadder({ threshold_pct: 1, next_alert_level: null }), { ahead: [], behind: [] })

// --- Chart ticks land on a familiar sequence ------------------------------
assert.deepEqual(niceTicks(22311, 23368), [22500, 23000])
assert.deepEqual(niceTicks(0, 100), [0, 25, 50, 75, 100])
assert.deepEqual(niceTicks(5, 5), [5])

// --- Alert sections: Today, Yesterday, then IST months --------------------
const NOW = new Date('2026-10-31T06:00:00Z') // 11:30 AM IST
const grouped = groupAlerts([
  { id: 1, alerted_at: '2026-10-31T05:00:00', alert_direction: null, invest_amount: 100000 },
  { id: 2, alerted_at: '2026-10-31T04:00:00', alert_direction: 'up', invest_amount: 0 },
  { id: 3, alerted_at: '2026-10-30T05:00:00', alert_direction: null, invest_amount: 100000 },
  { id: 4, alerted_at: '2026-09-12T05:00:00', alert_direction: null, invest_amount: null },
  { id: 5, alerted_at: '2026-09-11T05:00:00', alert_direction: null, invest_amount: 50000 },
], NOW)
assert.deepEqual(grouped.map((g) => g.title), ['Today', 'Yesterday', 'September 2026'])
assert.equal(grouped[0].deployed, 100000) // A daily move deploys nothing.
assert.equal(grouped[2].deployed, 50000) // A legacy row with no amount counts as zero.
// 20:00 UTC is already tomorrow in IST: the day boundary is India's, not UTC's.
const lateUtc = groupAlerts([{ id: 6, alerted_at: '2026-10-30T20:00:00', alert_direction: null }], NOW)
assert.equal(lateUtc[0].title, 'Today')

// --- Spring physics -------------------------------------------------------
const settle = (params, velocity = 0) => {
  const s = { x: 0, v: velocity }
  let peak = 0
  for (let t = 0; t < 4; t += 1 / 240) {
    stepSpring(s, 100, params, 1 / 240)
    peak = Math.max(peak, s.x)
  }
  return { final: s.x, peak }
}
// Critically damped reaches the target and never passes it.
const critical = settle({ damping: 1, response: 0.4 })
assert.ok(Math.abs(critical.final - 100) < 0.01)
assert.ok(critical.peak <= 100.01, `damping 1 overshot to ${critical.peak}`)
// Under-damped overshoots, which is the whole reason to reach for 0.8 on a flick.
assert.ok(settle({ damping: 0.8, response: 0.4 }).peak > 100.5)
// Lower response is snappier.
const after = (response) => {
  const s = { x: 0, v: 0 }
  for (let t = 0; t < 0.2; t += 1 / 240) stepSpring(s, 100, { damping: 1, response }, 1 / 240)
  return s.x
}
assert.ok(after(0.2) > after(0.6))

// Projection and resistance use Apple's published forms.
assert.ok(Math.abs(project(1000, 0.998) - 499) < 0.01)
assert.equal(project(0), 0)
assert.ok(rubberband(100, 800) < 100 && rubberband(100, 800) > 0)
assert.ok(rubberband(-100, 800) < 0)
assert.ok(rubberband(800, 800) < 800 * 0.55) // Never reaches its asymptote.

// Velocity comes from recent samples, so an old pause doesn't dilute a flick.
const tracker = createVelocityTracker()
tracker.push(0, 0)
tracker.push(0, 500)
tracker.push(100, 550)
tracker.push(200, 600)
assert.ok(Math.abs(tracker.velocity() - 2000) < 1, `velocity was ${tracker.velocity()}`)

// --- Structural rules that are easy to regress ----------------------------
const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const sheetSource = readFileSync(new URL('./Sheet.jsx', import.meta.url), 'utf8')

// All panels stay mounted, so tabs keep scroll position and never flash on switching.
assert.doesNotMatch(appSource, /\{tab === '\w+' && </)
assert.match(cssSource, /\.panel\s*\{[^}]*visibility:\s*hidden/s)
// Glass stays out of the content layer: list rows and groups must not blur.
for (const selector of ['.wrow', '.group', '.chart']) {
  const rule = cssSource.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*\\}`))
  assert.ok(rule, `${selector} rule exists`)
  assert.doesNotMatch(rule[0], /backdrop-filter/, `${selector} must stay solid`)
}
// A sheet's content must be able to hand a pull-down to the sheet itself.
assert.match(sheetSource, /passive: false/)
// Accessibility preferences stay wired up.
assert.match(cssSource, /prefers-reduced-motion/)
assert.match(cssSource, /prefers-reduced-transparency/)
assert.match(cssSource, /prefers-contrast: more/)

console.log('frontend regression tests passed')

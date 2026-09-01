import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isMetal, metalUnit, priceParts, severity, timeAgo, toIndianMetalPrice } from './lib.js'

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

const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const cssSource = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

assert.match(appSource, /<WatchTab\s+active=\{tab === 'watch'\}/)
assert.match(appSource, /activeKey=\{tabMotionKey\}/)
assert.doesNotMatch(appSource, /\{tab === 'watch' && <WatchTab/)
assert.match(cssSource, /\.panel\.active\s*\{[^}]*opacity:\s*1/s)
assert.doesNotMatch(cssSource, /\.panel\s*\{[^}]*animation:/s)
assert.match(cssSource, /\.panel\.active\.animating\s*\{[^}]*animation:\s*panel-enter/s)
assert.match(cssSource, /\.panel\.active\.animating\s+>\s+\.dash-card\s*\{[^}]*animation:\s*card-enter/s)
assert.match(cssSource, /@keyframes card-enter\s*\{[^}]*opacity:\s*0/s)

console.log('frontend regression tests passed')

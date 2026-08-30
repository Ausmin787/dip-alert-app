import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { severity, timeAgo } from './lib.js'

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

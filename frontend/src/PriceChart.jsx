import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createSpring, prefersReducedMotion } from './spring.js'
import { fmtMarketDate, niceTicks } from './lib.js'

const HEIGHT = 216
const AXIS_W = 54
const X_AXIS_H = 22
const MORPH_POINTS = 160
const SCRUB_LOCK = 6 // px of movement before a touch is judged a scrub or a scroll.

const fmtAxis = (v) => (v >= 1000 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(v >= 100 ? 0 : 2))

/* Dates on the axis: weeks over a month, months beyond that (HIG Charts: keep to
   familiar sequences, and don't crowd). */
function xLabels(history) {
  const labels = []
  if (history.length <= 30) {
    for (let i = 3; i < history.length - 1; i += 5) labels.push({ i, text: fmtMarketDate(history[i].date) })
    return labels
  }
  let lastMonth = history[0].date.slice(0, 7)
  history.forEach((p, i) => {
    const month = p.date.slice(0, 7)
    if (month !== lastMonth) {
      labels.push({
        i,
        text: new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short' }),
      })
      lastMonth = month
    }
  })
  return labels.length > 6 ? labels.filter((_, k) => k % 2 === 0) : labels
}

function layout(history, rules, width) {
  const values = history.map((p) => p.close)
  let min = Math.min(...values)
  let max = Math.max(...values)
  const span = max - min || max * 0.01 || 1
  // A rule stretches the axis only if it's close. A far-off high would otherwise
  // flatten the line into a sliver; it simply isn't drawn until a range reaches it.
  const visible = rules.filter((r) => r.value > min - span * 0.6 && r.value < max + span * 0.6)
  for (const r of visible) {
    min = Math.min(min, r.value)
    max = Math.max(max, r.value)
  }
  const pad = (max - min) * 0.08 || 1
  min -= pad
  max += pad
  const plotW = Math.max(40, width - AXIS_W)
  const plotH = HEIGHT - X_AXIS_H
  const x = (i) => (values.length > 1 ? (i / (values.length - 1)) * plotW : 0)
  const y = (v) => plotH - ((v - min) / (max - min)) * plotH
  const points = values.map((v, i) => [x(i), y(v)])
  return { values, min, max, plotW, plotH, x, y, points, visible }
}

const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')

function resample(pts, n) {
  if (pts.length === 0) return []
  const out = []
  for (let k = 0; k < n; k += 1) {
    const at = (k / (n - 1)) * (pts.length - 1)
    const a = Math.floor(at)
    const b = Math.min(pts.length - 1, a + 1)
    const t = at - a
    out.push([pts[a][0] + (pts[b][0] - pts[a][0]) * t, pts[a][1] + (pts[b][1] - pts[a][1]) * t])
  }
  return out
}

/* Stocks' interaction, per HIG Charts: the whole plot is the hit target, a drag
   reveals the value at that moment, and nothing critical needs the interaction.
   Scrub writes to the DOM directly for the indicator so it stays glued to the
   finger; only the readout above goes through React. */
function PriceChart({ history, rules, color, loading, label, summary, formatValue, onScrub }) {
  const wrapRef = useRef(null)
  const lineRef = useRef(null)
  const areaRef = useRef(null)
  const indicatorRef = useRef(null)
  const dotRef = useRef(null)
  const morphRef = useRef(null)
  const shownPts = useRef(null)
  const gestureRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [activeIndex, setActiveIndex] = useState(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const hasData = history?.length >= 2
  const geo = useMemo(
    () => (hasData && width > 0 ? layout(history, rules, width) : null),
    [history, rules, width, hasData],
  )

  /* Period and asset changes morph the line rather than swapping it, so the change
     is noticed (HIG Charts) and the eye keeps its place. Interrupting a morph starts
     from what is on screen right now. */
  useLayoutEffect(() => {
    if (!geo || !lineRef.current) return undefined
    const paint = (pts) => {
      const d = toPath(pts)
      lineRef.current?.setAttribute('d', d)
      areaRef.current?.setAttribute('d', `${d}L${geo.plotW} ${geo.plotH}L0 ${geo.plotH}Z`)
    }
    const target = geo.points
    const from = shownPts.current
    if (!from || prefersReducedMotion()) {
      paint(target)
      shownPts.current = target
      return undefined
    }
    const a = resample(from, MORPH_POINTS)
    const b = resample(target, MORPH_POINTS)
    morphRef.current?.stop()
    const spring = createSpring(0, (t) => {
      const mixed = a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t])
      shownPts.current = mixed
      paint(mixed)
    }, 0.001)
    morphRef.current = spring
    spring.to(1, {
      damping: 1,
      response: 0.42,
      done: () => {
        shownPts.current = target
        paint(target)
      },
    })
    return () => spring.stop()
  }, [geo])

  const paintIndicator = (i) => {
    if (!geo) return
    const x = geo.x(i)
    const y = geo.y(geo.values[i])
    indicatorRef.current?.setAttribute('x1', x)
    indicatorRef.current?.setAttribute('x2', x)
    dotRef.current?.setAttribute('cx', x)
    dotRef.current?.setAttribute('cy', y)
  }

  const select = (i) => {
    paintIndicator(i)
    setActiveIndex(i)
    onScrub(history[i])
  }

  const clear = () => {
    setActiveIndex(null)
    onScrub(null)
  }

  const indexAt = (clientX) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / geo.plotW))
    return Math.round(ratio * (geo.values.length - 1))
  }

  /* All gestures run in parallel from the first move and the losers are dropped: a
     touch that goes sideways first scrubs, one that goes vertically belongs to the
     scroller or the sheet. A mouse has nothing to disambiguate and scrubs on hover. */
  const onPointerDown = (event) => {
    if (!geo) return
    if (event.pointerType === 'touch') {
      gestureRef.current = { x: event.clientX, y: event.clientY, scrubbing: false, id: event.pointerId }
    } else {
      gestureRef.current = { scrubbing: true, id: event.pointerId }
      event.currentTarget.setPointerCapture(event.pointerId)
      select(indexAt(event.clientX))
    }
  }

  const onPointerMove = (event) => {
    if (!geo) return
    const gesture = gestureRef.current
    if (event.pointerType !== 'touch') {
      select(indexAt(event.clientX))
      return
    }
    if (!gesture || gesture.ignored) return
    if (!gesture.scrubbing) {
      const dx = Math.abs(event.clientX - gesture.x)
      const dy = Math.abs(event.clientY - gesture.y)
      if (dx < SCRUB_LOCK && dy < SCRUB_LOCK) return
      if (dy > dx) {
        gesture.ignored = true
        return
      }
      gesture.scrubbing = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    select(indexAt(event.clientX))
  }

  const onPointerEnd = (event) => {
    const wasScrubbing = gestureRef.current?.scrubbing
    gestureRef.current = null
    if (wasScrubbing && event.pointerType === 'touch') clear()
  }

  const onKeyDown = (event) => {
    if (!geo) return
    const lastIndex = geo.values.length - 1
    const current = activeIndex ?? lastIndex
    const moves = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(lastIndex, current + 1),
      Home: 0,
      End: lastIndex,
    }
    if (event.key in moves) {
      event.preventDefault()
      select(moves[event.key])
    } else if (event.key === 'Escape' && activeIndex != null) {
      event.stopPropagation()
      clear()
    }
  }

  if (!hasData && !loading) {
    return (
      <div className="chart-empty" ref={wrapRef}>
        Price history isn’t available yet.
      </div>
    )
  }

  const gradientId = `chart-fade-${label.replace(/\W/g, '')}`
  const scrubbing = activeIndex != null && geo && activeIndex < geo.values.length
  const ticks = geo ? niceTicks(geo.min, geo.max, 4).filter((t) => t > geo.min && t < geo.max) : []
  const tagFor = (r) => geo.y(r.value)
  const clearOfTags = (t) => geo.visible.every((r) => Math.abs(geo.y(t) - tagFor(r)) > 21)

  return (
    <div
      ref={wrapRef}
      className="chart"
      data-loading={loading}
      role="slider"
      tabIndex={0}
      aria-label={`${label}. ${summary}. Use the arrow keys to read closing prices.`}
      aria-valuemin={geo ? 0 : undefined}
      aria-valuemax={geo ? geo.values.length - 1 : undefined}
      aria-valuenow={geo ? (activeIndex ?? geo.values.length - 1) : undefined}
      aria-valuetext={
        scrubbing ? `${fmtMarketDate(history[activeIndex].date)}: ${formatValue(history[activeIndex].close)}` : summary
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') clear()
      }}
      onBlur={() => {
        if (activeIndex != null) clear()
      }}
      onKeyDown={onKeyDown}
    >
      {geo && (
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.28" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1="0" x2={geo.plotW} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--sep)" strokeWidth="0.5" />
              {clearOfTags(t) && <text x={geo.plotW + 8} y={geo.y(t) + 4.5}>{fmtAxis(t)}</text>}
            </g>
          ))}

          {xLabels(history).map(({ i, text }) => (
            <g key={`${i}-${text}`}>
              <line x1={geo.x(i)} x2={geo.x(i)} y1="0" y2={geo.plotH} stroke="var(--sep)" strokeWidth="0.5" />
              <text x={geo.x(i)} y={HEIGHT - 4} textAnchor="middle">{text}</text>
            </g>
          ))}

          <line x1="0" x2={geo.plotW} y1={geo.plotH} y2={geo.plotH} stroke="var(--sep)" strokeWidth="0.5" />

          <path ref={areaRef} className="chart-area" fill={`url(#${gradientId})`} />
          <path
            ref={lineRef}
            className="chart-line"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {geo.visible.map((r) => (
            <g key={r.id} className={`rule-tag ${r.kind}`}>
              <line
                x1="0"
                x2={geo.plotW}
                y1={geo.y(r.value)}
                y2={geo.y(r.value)}
                stroke={r.kind === 'high' ? 'var(--label-2)' : 'var(--level)'}
                strokeWidth="1.25"
                strokeDasharray="4 4"
              />
              <rect
                x={geo.plotW + 3}
                y={geo.y(r.value) - 10}
                width={AXIS_W - 3}
                height="20"
                rx="6"
                fill={r.kind === 'high' ? 'var(--fill-1)' : 'var(--level)'}
              />
              <text x={geo.plotW + 3 + (AXIS_W - 3) / 2} y={geo.y(r.value) + 4.5} textAnchor="middle">{r.label}</text>
            </g>
          ))}

          <g style={{ visibility: scrubbing ? 'visible' : 'hidden' }}>
            <line ref={indicatorRef} y1="0" y2={geo.plotH} stroke="var(--label)" strokeWidth="1" />
            <circle ref={dotRef} r="5" fill={color} stroke="var(--sheet)" strokeWidth="2" />
          </g>
        </svg>
      )}
    </div>
  )
}

export default memo(PriceChart)

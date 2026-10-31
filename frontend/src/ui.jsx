import { useMemo, useRef, useState } from 'react'
import { useScrollState } from './hooks.js'

/* A top-level screen: large title that hands off to a small inline one, with the
   scroll edge effect replacing a hard divider (WWDC25). Owns its own scroll, so a
   tab keeps its place when you switch away and back. */
export function Screen({ title, subtitle = null, actions = null, children }) {
  const barRef = useRef(null)
  const titleRef = useRef(null)
  const scroll = useScrollState(barRef, titleRef)
  return (
    <div className="screen" data-scroller>
      <div className="navbar" ref={barRef} data-scroll={scroll}>
        <div className="scroll-edge" aria-hidden="true" />
        <div className="nav-inline-title t-head clip" aria-hidden="true">{title}</div>
        {actions}
      </div>
      <div className="screen-body">
        <div className="large-title">
          <h1 className="t-large" ref={titleRef}>{title}</h1>
          {subtitle && <p className="t-foot c-2">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Segmented({ label, options, value, onChange }) {
  const index = Math.max(0, options.findIndex((o) => o.id === value))
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      <div
        className="seg-thumb"
        aria-hidden="true"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="seg-item"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* Characters that changed since the last render roll in, like SwiftUI's numericText
   transition. Only on a real value change; first paint and scrubbing stay still. */
export function RollingText({ text, still = false, className }) {
  const [track, setTrack] = useState({ current: text, before: null })
  if (track.current !== text) setTrack({ current: text, before: track.current })
  const before = track.before
  const chars = String(text).split('')
  const offset = before == null ? 0 : before.length - chars.length
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {chars.map((ch, i) => {
        const changed = !still && before != null && before[i + offset] !== ch
        return (
          <span key={`${i}-${changed ? ch : ''}`} className={changed ? 'roll' : undefined} aria-hidden="true">
            {ch}
          </span>
        )
      })}
    </span>
  )
}

/* The list's glanceable chart (HIG Charts: a small chart previews the big one, and
   keeps the same colour and shape so the two read as one dataset). */
export function Sparkline({ history, up, width = 64, height = 32 }) {
  const paths = useMemo(() => {
    if (!history || history.length < 2) return null
    const values = history.map((p) => p.close)
    const min = Math.min(...values)
    const range = Math.max(...values) - min || 1
    const y = (v) => height - 3 - ((v - min) / range) * (height - 6)
    const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)} ${y(v).toFixed(1)}`)
    return {
      line: `M${pts.join('L')}`,
      baseline: y(values[0]),
    }
  }, [history, width, height])

  return (
    <svg className="spark" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {paths && (
        <>
          <line x1="0" x2={width} y1={paths.baseline} y2={paths.baseline} stroke="var(--label-3)" strokeWidth="1" strokeDasharray="1.5 3" vectorEffect="non-scaling-stroke" />
          <path d={paths.line} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  )
}

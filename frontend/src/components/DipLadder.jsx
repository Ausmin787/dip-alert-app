import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from './useReducedMotion.js'
import { fmtLevel } from '../lib.js'

/* The signature element: a segmented track of dip levels below ATH.
   Filled segments = levels crossed this cycle (✓ = alert delivered);
   the next trigger pulses; future levels stay faint. */
export default function DipLadder({ thresholdPct, dropPct, lastAlertedLevel }) {
  const crossed = dropPct != null ? Math.floor(dropPct / thresholdPct) : 0
  const count = Math.max(6, crossed + 2)
  const levels = Array.from({ length: count }, (_, i) => i + 1)
  const trackRef = useRef(null)
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    if (reduced || !trackRef.current) return undefined
    const ctx = gsap.context(() => {
      gsap.from('[data-seg]', {
        scaleX: 0.6,
        opacity: 0,
        transformOrigin: 'left center',
        duration: 0.4,
        ease: 'power2.out',
        stagger: 0.05,
      })
    }, trackRef)
    return () => ctx.revert()
  }, [reduced, count])

  const fillFor = (pct) => {
    if (pct < 1) return 'bg-mint text-canvas'
    if (pct < 3) return 'bg-orange text-canvas'
    return 'bg-coral text-canvas'
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="tag">Dip levels</span>
        <span className="tag text-violet">next −{fmtLevel((crossed + 1) * thresholdPct)}%</span>
      </div>
      <div ref={trackRef} className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
        {levels.map((level) => {
          const pct = level * thresholdPct
          const isCrossed = level <= crossed
          const isNext = level === crossed + 1
          const wasAlerted = level <= lastAlertedLevel
          return (
            <div
              key={level}
              data-seg
              title={wasAlerted ? 'alert delivered' : isNext ? 'next trigger' : undefined}
              className={`num flex h-9 min-w-[3.4rem] flex-1 shrink-0 items-center justify-center gap-1 rounded-lg text-[0.7rem] font-semibold ${
                isCrossed
                  ? fillFor(pct)
                  : isNext
                    ? 'pulse-next border border-dashed text-ink'
                    : 'border border-hairline text-ink-muted/60'
              }`}
            >
              −{fmtLevel(pct)}%{wasAlerted && <span className="text-[0.6rem]">✓</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

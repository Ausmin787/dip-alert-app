import { motion } from 'motion/react'
import { fmtLevel } from '../lib.js'

/* The signature element: a segmented track of dip levels below ATH.
   Filled segments = levels crossed this cycle (✓ = alert delivered);
   the next trigger pulses; future levels stay faint. */
export default function DipLadder({ thresholdPct, dropPct, lastAlertedLevel }) {
  const crossed = dropPct != null ? Math.floor(dropPct / thresholdPct) : 0
  const count = Math.max(6, crossed + 2)
  const levels = Array.from({ length: count }, (_, i) => i + 1)

  const fillFor = (pct) => {
    if (pct < 1) return 'bg-mint text-abyss'
    if (pct < 3) return 'bg-gold text-abyss'
    return 'bg-blush text-abyss'
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="tag">Dip levels</span>
        <span className="tag text-pulse">next −{fmtLevel((crossed + 1) * thresholdPct)}%</span>
      </div>
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
        {levels.map((level, i) => {
          const pct = level * thresholdPct
          const isCrossed = level <= crossed
          const isNext = level === crossed + 1
          const wasAlerted = level <= lastAlertedLevel
          return (
            <motion.div
              key={level}
              initial={{ opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.25 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              title={wasAlerted ? 'alert delivered' : isNext ? 'next trigger' : undefined}
              className={`num flex h-9 min-w-[3.4rem] flex-1 shrink-0 items-center justify-center gap-1 rounded-lg text-[0.7rem] font-semibold ${
                isCrossed
                  ? fillFor(pct)
                  : isNext
                    ? 'pulse-next border border-dashed text-frost'
                    : 'border border-white/8 text-mist/50'
              }`}
            >
              −{fmtLevel(pct)}%{wasAlerted && <span className="text-[0.6rem]">✓</span>}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

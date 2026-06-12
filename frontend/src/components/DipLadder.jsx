// The signature element: a ladder of -1%, -2%, ... levels below ATH.
// Filled rungs = levels the price has crossed this dip cycle; the next
// rung to trigger is outlined and pulsing.
export default function DipLadder({ thresholdPct, dropPct, lastAlertedLevel }) {
  const crossed = dropPct != null ? Math.floor(dropPct / thresholdPct) : 0
  const count = Math.max(6, crossed + 2)
  const rungs = Array.from({ length: count }, (_, i) => i + 1)

  const fillFor = (level) => {
    const pct = level * thresholdPct
    if (pct < 1) return 'bg-moss/85 text-ink'
    if (pct < 3) return 'bg-amber-soft/85 text-ink'
    return 'bg-ember/85 text-ink'
  }

  return (
    <div
      className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 py-1.5"
      style={{ scrollbarWidth: 'none' }}
    >
      {rungs.map((level) => {
        const isCrossed = level <= crossed
        const isNext = level === crossed + 1
        const wasAlerted = level <= lastAlertedLevel
        return (
          <div
            key={level}
            title={wasAlerted ? 'alert sent' : isNext ? 'next alert' : undefined}
            className={`num flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors ${
              isCrossed
                ? fillFor(level)
                : isNext
                  ? 'border border-dashed border-fog/45 text-fog'
                  : 'border border-white/12 text-fog-dim/60'
            }`}
          >
            −{(level * thresholdPct) % 1 === 0 ? level * thresholdPct : (level * thresholdPct).toFixed(1)}%
            {wasAlerted && <span className="ml-1 text-[0.6rem]">✓</span>}
          </div>
        )
      })}
    </div>
  )
}

/* Cold-start placeholders. These mirror the real card shapes so the layout
   arrives before the data does — a bare "Loading…" string left the first paint
   of the app almost empty. The sweep is pure CSS, so the global
   prefers-reduced-motion block in index.css freezes it automatically and the
   skeleton degrades to static blocks. */

const Line = ({ w = '100%', h = 12 }) => (
  <div className="skel-line" style={{ width: w, height: h }} />
)

export function WatchSkeleton() {
  return (
    <>
      <div className="g glass hero skel" aria-hidden="true">
        <Line w="52%" h={11} />
        <div style={{ height: 14 }} />
        <Line w="68%" h={34} />
        <div style={{ height: 12 }} />
        <Line w="44%" h={12} />
        <div className="hero-divider" />
        <Line w="58%" h={11} />
      </div>

      <div className="g skel" style={{ padding: '16px 18px' }} aria-hidden="true">
        <Line w="38%" h={11} />
        <div style={{ height: 14 }} />
        <div className="skel-line" style={{ height: 84 }} />
      </div>

      <div className="g skel" style={{ padding: '16px 18px' }} aria-hidden="true">
        <Line w="30%" h={11} />
        <div style={{ height: 14 }} />
        <div className="skel-row">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skel-line" style={{ height: 44, flex: 1 }} />
          ))}
        </div>
      </div>

      <span className="sr-only">Loading market data…</span>
    </>
  )
}

export function ListSkeleton({ rows = 4, label = 'Loading…' }) {
  return (
    <div className="g skel" style={{ padding: '16px 16px 14px' }} aria-hidden="true">
      <Line w="34%" h={11} />
      <div style={{ height: 14 }} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-ai">
          <div className="skel-line" style={{ width: 40, height: 40, borderRadius: 12, flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <Line w="46%" h={13} />
            <div style={{ height: 6 }} />
            <Line w="66%" h={10} />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

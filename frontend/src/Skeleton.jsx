/* Cold-start placeholders shaped like the real rows, so the layout arrives before
   the data does (HIG Loading: "show something as soon as possible"). Deliberately
   still: a shimmer across a list that loads in a second reads as anxiety. */

export function WatchlistSkeleton({ rows = 5 }) {
  return (
    <div className="wlist" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="wrow" key={i}>
          <div>
            <div className="skel" style={{ width: '62%', height: 17 }} />
            <div className="skel" style={{ width: '44%', height: 13, marginTop: 7 }} />
          </div>
          <div className="skel spark" style={{ height: 30 }} />
          <div className="wrow-right">
            <div className="skel" style={{ width: '86%', height: 17, marginLeft: 'auto' }} />
            <div className="skel" style={{ width: '60%', height: 20, marginLeft: 'auto', marginTop: 5, borderRadius: 7 }} />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading prices</span>
    </div>
  )
}

export function ListSkeleton({ rows = 4, label = 'Loading' }) {
  return (
    <div className="group" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ai">
          <div className="skel" style={{ width: 30, height: 30, borderRadius: '50%' }} />
          <div>
            <div className="skel" style={{ width: '58%', height: 16 }} />
            <div className="skel" style={{ width: '40%', height: 12, marginTop: 6 }} />
          </div>
          <div className="skel" style={{ width: 52, height: 13 }} />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

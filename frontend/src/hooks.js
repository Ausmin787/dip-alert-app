import { useEffect, useState, useSyncExternalStore } from 'react'

// Re-render on an interval so relative timestamps stay honest between polls.
export function useTick(ms) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

/* Apple's size classes, read as width (HIG Layout: "determine layout based on size
   classes, not device type or orientation"). Regular is where a list and its detail
   fit side by side. */
const REGULAR = '(min-width: 1000px)'
const subscribeSize = (callback) => {
  const query = window.matchMedia(REGULAR)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
export const useSizeClass = () =>
  useSyncExternalStore(subscribeSize, () => (window.matchMedia(REGULAR).matches ? 'regular' : 'compact'))

/* Scroll position as the navigation bar needs it: 'rest' at the top (no edge effect,
   HIG: never where nothing overlaps), 'edge' once content runs under the bar, 'title'
   once the large title has gone and the small one should take over. */
export function useScrollState(anchorRef, titleRef) {
  const [state, setState] = useState('rest')
  useEffect(() => {
    const scroller = anchorRef.current?.closest('[data-scroller]')
    if (!scroller) return undefined
    const read = () => {
      const top = scroller.scrollTop
      if (top <= 2) {
        setState('rest')
        return
      }
      const title = titleRef.current
      const gone = title && title.getBoundingClientRect().bottom < scroller.getBoundingClientRect().top + 34
      setState(gone ? 'title' : 'edge')
    }
    read()
    scroller.addEventListener('scroll', read, { passive: true })
    return () => scroller.removeEventListener('scroll', read)
  }, [anchorRef, titleRef])
  return state
}

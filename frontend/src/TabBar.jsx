import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createSpring, createVelocityTracker, prefersReducedMotion, project, rubberband } from './spring.js'
import Icon from './Icon.jsx'

const HYSTERESIS = 10
const BAR_INSET = 4 // The lens is concentric with the bar: inset 4, radius 31 - 4.

/* The floating tab bar. Two independent springs drive the selected capsule: x for
   where it is, scale for the slight swell while it's held. It can be pressed and
   dragged across the bar, and released mid-flight it projects to the tab the flick
   was heading for, like the real one.

   Tapping switches content immediately and never waits for the lens: tabs are the
   most frequent action in the app, so nothing about them may cost time. */
export default function TabBar({ tabs, active, onSelect }) {
  const barRef = useRef(null)
  const lensRef = useRef(null)
  const xSpring = useRef(null)
  const scaleSpring = useRef(null)
  const drag = useRef(null)
  const [preview, setPreview] = useState(null)

  const tabWidth = () => barRef.current?.querySelector('.tab')?.offsetWidth ?? 0
  const xFor = (index) => BAR_INSET + index * tabWidth()
  const activeIndex = tabs.findIndex((t) => t.id === active)

  useLayoutEffect(() => {
    const lens = lensRef.current
    const paint = () => {
      lens.style.transform = `translate3d(${xSpring.current.value}px, 0, 0) scale(${scaleSpring.current.value})`
    }
    xSpring.current = createSpring(xFor(activeIndex), paint)
    scaleSpring.current = createSpring(1, paint, 0.001)
    lens.style.width = `${tabWidth()}px`
    paint()
    const onResize = () => {
      lens.style.width = `${tabWidth()}px`
      xSpring.current.set(xFor(tabs.findIndex((t) => t.id === barRef.current?.dataset.active)))
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      xSpring.current.stop()
      scaleSpring.current.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (drag.current?.dragging) return
    const target = xFor(activeIndex)
    if (prefersReducedMotion()) xSpring.current.set(target)
    else xSpring.current.to(target, { damping: 1, response: 0.34 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  const indexFromX = (x) => {
    const clamped = Math.max(0, Math.min(tabs.length - 1, Math.round((x - BAR_INSET) / tabWidth())))
    return clamped
  }

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    const rect = barRef.current.getBoundingClientRect()
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      barLeft: rect.left,
      dragging: false,
      tracker: createVelocityTracker(),
    }
    if (!prefersReducedMotion()) scaleSpring.current.to(1.05, { damping: 1, response: 0.22 })
  }

  const onPointerMove = (event) => {
    const d = drag.current
    if (!d) return
    if (!d.dragging) {
      if (Math.abs(event.clientX - d.startX) < HYSTERESIS) return
      d.dragging = true
      barRef.current.setPointerCapture(d.id)
    }
    const min = xFor(0)
    const max = xFor(tabs.length - 1)
    const raw = event.clientX - d.barLeft - tabWidth() / 2
    let next = raw
    if (raw < min) next = min + rubberband(raw - min, tabWidth())
    else if (raw > max) next = max + rubberband(raw - max, tabWidth())
    xSpring.current.to(next, { damping: 1, response: 0.1 })
    d.tracker.push(raw, performance.now())
    const hovered = indexFromX(next)
    setPreview((current) => (current === hovered ? current : hovered))
  }

  const finish = () => {
    const d = drag.current
    drag.current = null
    scaleSpring.current.to(1, { damping: 1, response: 0.3 })
    if (!d?.dragging) return
    setPreview(null)
    const velocity = d.tracker.velocity()
    const landing = indexFromX(xSpring.current.value + project(velocity, 0.99))
    xSpring.current.to(xFor(landing), {
      damping: Math.abs(velocity) > 300 ? 0.8 : 1,
      response: 0.34,
      velocity,
    })
    onSelect(tabs[landing].id)
  }

  const shownIndex = preview ?? activeIndex

  return (
    <nav
      ref={barRef}
      className="tabbar glass"
      aria-label="Main"
      data-active={active}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <div className="tab-lens" ref={lensRef} aria-hidden="true" />
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          data-on={index === shownIndex}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          <Icon name={tab.icon} filled />
          <span>{tab.label}</span>
          {tab.badge > 0 && (
            <span className="tab-badge" aria-label={`${tab.badge} new`}>{tab.badge > 99 ? '99+' : tab.badge}</span>
          )}
        </button>
      ))}
    </nav>
  )
}

/* The same three destinations on a wide screen. HIG: keep functionality the same as
   size classes change, and take the extra room by moving from tab bar to sidebar. */
export function Sidebar({ tabs, active, onSelect }) {
  return (
    <nav className="sidebar glass" aria-label="Main">
      <div className="sidebar-title t-title2">Dip Alert</div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="side-item"
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          <Icon name={tab.icon} filled />
          <span>{tab.label}</span>
          {tab.badge > 0 && (
            <span className="side-badge" aria-label={`${tab.badge} new`}>{tab.badge > 99 ? '99+' : tab.badge}</span>
          )}
        </button>
      ))}
    </nav>
  )
}

import { useEffect, useLayoutEffect, useRef } from 'react'
import { createSpring, createVelocityTracker, prefersReducedMotion, project, rubberband } from './spring.js'
import Icon from './Icon.jsx'

const HYSTERESIS = 10
const BAR_INSET = 4 // The lens is concentric with the bar: inset 4, radius 31 - 4.
const BAR_MID = 31
const LENS_MID = 27
const MAX_SHIFT = 14 // From scripts/glass-maps.mjs: a map value of 0 or 255 means this many px.
const DISPERSION = 0.07 // How much further red bends than blue: the fringe at the rim.
const LIFT = { x: 0.12, y: 0.34, magnify: 0.08 } // Lens at full lift, from WWDC25 219.

/* Bending live page content takes backdrop-filter: url(), which only Chromium renders
   (WebKit bug 245510). Elsewhere everything else here still runs: lens, light and gel. */
const refracts = () => Boolean(/** @type {any} */ (navigator).userAgentData?.brands?.some((b) => b.brand === 'Chromium'))

/* The bar is on screen all the time, so it takes one displacement pass. Only the
   lens, which exists for moments, spends three on a colour fringe. */
function LensFilter({ id, map, fringe = false }) {
  const scale = MAX_SHIFT * 2
  const channel = (result, values, channelScale) => (
    <>
      <feDisplacementMap in="SourceGraphic" in2="map" scale={channelScale} xChannelSelector="R" yChannelSelector="G" result={`${result}-moved`} />
      <feColorMatrix in={`${result}-moved`} type="matrix" values={values} result={result} />
    </>
  )
  return (
    <filter id={id} x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feImage href={map} x="0" y="0" preserveAspectRatio="none" result="map" />
      {fringe ? (
        <>
          {channel('r', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', scale * (1 + DISPERSION))}
          {channel('g', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', scale)}
          {channel('b', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', scale * (1 - DISPERSION))}
          <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
          <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" />
        </>
      ) : (
        <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
      )}
    </filter>
  )
}

function Faces({ tabs, className, faceRef }) {
  return (
    <div ref={faceRef} className={className} aria-hidden="true">
      {tabs.map((tab) => (
        <span key={tab.id} className="tab-face">
          <Icon name={tab.icon} filled />
          <span>{tab.label}</span>
          {tab.badge > 0 && <span className="tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>}
        </span>
      ))}
    </div>
  )
}

/* The floating tab bar, in Liquid Glass. Built from what Apple shows in WWDC25 219:
   at rest the selection is a quiet fill; touched, it lifts into a clear lens that
   stands proud of the bar, flexes with its speed, and lets the tabs be seen through
   it, while light spreads from the fingertip and travels round the rim.

   Separate springs: x for where the lens is, lift for how far it has become glass,
   glow for the light. It can be pressed and dragged across the bar, and released
   mid-flight it projects to the tab the flick was heading for.

   Tapping switches content immediately and never waits for the lens: tabs are the
   most frequent action in the app, so nothing about them may cost time. */
export default function TabBar({ tabs, active, onSelect }) {
  const barRef = useRef(null)
  const lensRef = useRef(null)
  const baseRef = useRef(null)
  const mirrorRef = useRef(null)
  const xSpring = useRef(null)
  const liftSpring = useRef(null)
  const glowSpring = useRef(null)
  const rimSpring = useRef(null)
  const drag = useRef(null)
  const size = useRef({ tab: 0, bar: 0 })

  const xFor = (index) => BAR_INSET + index * size.current.tab
  const activeIndex = tabs.findIndex((t) => t.id === active)

  useLayoutEffect(() => {
    const bar = barRef.current
    const lens = lensRef.current
    const base = baseRef.current
    const mirror = mirrorRef.current
    bar.dataset.refract = refracts()

    const paint = () => {
      if (!xSpring.current || !liftSpring.current || !glowSpring.current || !rimSpring.current) return
      const { tab, bar: barWidth } = size.current
      const x = xSpring.current.value
      const lift = liftSpring.current.value
      const glow = glowSpring.current.value
      const calm = prefersReducedMotion() // WWDC25: reduced motion disables the elastic properties.
      const shape = calm ? 0 : lift
      const speed = calm ? 0 : Math.min(Math.abs(xSpring.current.velocity) / 3000, 0.2)
      const sx = (1 + LIFT.x * shape) * (1 + speed)
      const sy = (1 + LIFT.y * shape) * (1 - speed * 0.55)
      lens.style.transform = `translate3d(${x}px, 0, 0) scale(${sx}, ${sy})`
      lens.style.setProperty('--lift', Math.max(0, Math.min(1, lift)))

      /* Keep the mirrored faces registered with the real ones, however the lens is
         scaled: a point p on the bar shows at centre + magnify * (p - centre). */
      const centre = x + tab / 2
      const magnify = 1 + LIFT.magnify * shape
      const tx = magnify / sx
      const ty = magnify / sy
      mirror.style.transform = `translate(${tab / 2 - tx * centre}px, ${LENS_MID - ty * BAR_MID}px) scale(${tx}, ${ty})`

      /* Cut the lens out of the real faces, or they'd show through it doubled. */
      const halfW = (tab / 2) * sx
      const halfH = LENS_MID * sy
      const rx = LENS_MID * sx
      const ry = LENS_MID * sy
      const l = centre - halfW
      const r = centre + halfW
      const t = BAR_MID - halfH
      const b = BAR_MID + halfH
      base.style.clipPath = `path(evenodd, "M0 -20H${barWidth}V82H0Z M${l + rx} ${t}H${r - rx}A${rx} ${ry} 0 0 1 ${r - rx} ${b}H${l + rx}A${rx} ${ry} 0 0 1 ${l + rx} ${t}Z")`

      /* The bar gives a little when the lens is pushed past either end. */
      const min = xFor(0)
      const max = xFor(tabs.length - 1)
      const lean = calm ? 0 : (x - Math.max(min, Math.min(max, x))) * 0.35
      bar.style.transform = `translateX(calc(-50% + ${lean}px)) scale(${1 + 0.012 * shape})`
      bar.style.setProperty('--glow', Math.max(0, glow))
      bar.style.setProperty('--glow-r', 40 + 180 * Math.max(0, glow))
      bar.style.setProperty('--rim', `${rimSpring.current.value}deg`)
      bar.dataset.lifted = lift > 0.02
    }

    const measure = () => {
      size.current = { tab: bar.querySelector('.tab')?.offsetWidth ?? 0, bar: bar.offsetWidth }
      const setMap = (id, width, height) => {
        const image = bar.querySelector(`#${id} feImage`)
        image?.setAttribute('width', width)
        image?.setAttribute('height', height)
      }
      setMap('lg-bar', size.current.bar, 62)
      setMap('lg-lens', size.current.tab, 54)
    }
    measure()
    xSpring.current = createSpring(xFor(activeIndex), paint)
    liftSpring.current = createSpring(0, paint, 0.001)
    glowSpring.current = createSpring(0, paint, 0.001)
    rimSpring.current = createSpring(-50, paint, 0.05)
    paint()

    const onResize = () => {
      measure()
      xSpring.current.set(xFor(tabs.findIndex((t) => t.id === bar.dataset.active)))
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      for (const spring of [xSpring, liftSpring, glowSpring, rimSpring]) spring.current.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (drag.current?.dragging) return
    const target = xFor(activeIndex)
    if (prefersReducedMotion()) {
      xSpring.current.set(target)
      return
    }
    if (xSpring.current.value === target) return
    xSpring.current.to(target, { damping: 0.8, response: 0.36 })
    // Crossing the bar, the selection travels as glass and settles back into a fill.
    if (!drag.current) {
      liftSpring.current.to(0.85, {
        damping: 1,
        response: 0.14,
        done: () => liftSpring.current.to(0, { damping: 0.72, response: 0.42 }),
      })
    }
  }, [activeIndex])

  const indexFromX = (x) => Math.max(0, Math.min(tabs.length - 1, Math.round((x - BAR_INSET) / size.current.tab)))

  const moveLight = (event, rect) => {
    const bar = barRef.current
    const x = event.clientX - rect.left
    bar.style.setProperty('--glow-x', x)
    bar.style.setProperty('--glow-y', event.clientY - rect.top)
    if (prefersReducedMotion()) return
    rimSpring.current.to(((x / rect.width) - 0.5) * 150, { damping: 1, response: 0.3 })
  }

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    const rect = barRef.current.getBoundingClientRect()
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      rect,
      dragging: false,
      tracker: createVelocityTracker(),
    }
    moveLight(event, rect)
    // WWDC25: glass responds "by instantly flexing and energizing with light".
    glowSpring.current.to(1, { damping: 1, response: 0.14 })
    if (prefersReducedMotion()) liftSpring.current.set(1)
    else liftSpring.current.to(1, { damping: 0.8, response: 0.18 })
  }

  const onPointerMove = (event) => {
    const d = drag.current
    if (!d) return
    moveLight(event, d.rect)
    if (!d.dragging) {
      if (Math.abs(event.clientX - d.startX) < HYSTERESIS) return
      d.dragging = true
      barRef.current.setPointerCapture(d.id)
    }
    const min = xFor(0)
    const max = xFor(tabs.length - 1)
    const raw = event.clientX - d.rect.left - size.current.tab / 2
    let next = raw
    if (raw < min) next = min + rubberband(raw - min, size.current.tab)
    else if (raw > max) next = max + rubberband(raw - max, size.current.tab)
    xSpring.current.to(next, { damping: 1, response: 0.1 })
    d.tracker.push(raw, performance.now())
  }

  const finish = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    glowSpring.current.to(0, { damping: 1, response: 0.6 })
    rimSpring.current.to(-50, { damping: 1, response: 0.7 })
    if (prefersReducedMotion()) liftSpring.current.set(0)
    else liftSpring.current.to(0, { damping: 0.72, response: 0.42 })
    if (!d.dragging) return
    const velocity = d.tracker.velocity()
    const landing = indexFromX(xSpring.current.value + project(velocity, 0.99))
    xSpring.current.to(xFor(landing), {
      damping: Math.abs(velocity) > 300 ? 0.8 : 1,
      response: 0.34,
      velocity,
    })
    onSelect(tabs[landing].id)
  }

  return (
    <nav
      ref={barRef}
      className="tabbar"
      aria-label="Main"
      data-active={active}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <LensFilter id="lg-bar" map="/glass-bar.png" />
        <LensFilter id="lg-lens" map="/glass-lens.png" fringe />
      </svg>
      <div className="tab-glass" />
      <Faces tabs={tabs} className="tab-faces" faceRef={baseRef} />
      <div className="tab-lens" ref={lensRef}>
        <Faces tabs={tabs} className="tab-faces tab-mirror" faceRef={mirrorRef} />
      </div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          aria-label={tab.badge > 0 ? `${tab.label}, ${tab.badge} new` : tab.label}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        />
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

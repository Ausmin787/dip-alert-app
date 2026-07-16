import { memo, useId, useRef, useState } from 'react'
import { glassSpringEase, gsap, prefersReducedMotion, useGSAP } from './gsap.js'

function createLensMap(width, height) {
  const mapWidth = 256
  const mapHeight = Math.max(1, Math.round((mapWidth * height) / width))
  const canvas = document.createElement('canvas')
  canvas.width = mapWidth
  canvas.height = mapHeight
  const context = canvas.getContext('2d')
  if (!context) return ''

  const image = context.createImageData(mapWidth, mapHeight)
  const pixels = image.data
  const halfWidth = mapWidth / 2
  const halfHeight = mapHeight / 2
  const radius = Math.max(1, halfHeight - 2)
  const edgeDepth = Math.max(6, Math.min(halfWidth, halfHeight) * 0.34)

  const smoothstep = (start, end, value) => {
    const amount = Math.max(0, Math.min(1, (value - start) / (end - start)))
    return amount * amount * (3 - 2 * amount)
  }

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const px = x + 0.5 - halfWidth
      const py = y + 0.5 - halfHeight
      const qx = Math.abs(px) - halfWidth + radius
      const qy = Math.abs(py) - halfHeight + radius
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
      const edge = distance <= 0 ? smoothstep(-edgeDepth, 0, distance) : 0
      const nx = Math.max(-1, Math.min(1, px / halfWidth))
      const ny = Math.max(-1, Math.min(1, py / halfHeight))
      const specular = Math.max(0, (nx + ny + 1.2) / 2.2) * edge
      const index = (y * mapWidth + x) * 4

      pixels[index] = Math.round((0.5 - 0.46 * nx * edge) * 255)
      pixels[index + 1] = Math.round((0.5 - 0.46 * ny * edge) * 255)
      pixels[index + 2] = Math.round((0.5 + 0.48 * specular) * 255)
      pixels[index + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

const LensFilter = memo(function LensFilter({
  filter,
  filterRef,
  mapRef,
  redShiftRef,
  greenShiftRef,
  blueShiftRef,
  specularAlphaRef,
}) {
  if (!filter.mapUrl) return null

  return (
    <svg className="nav-filter-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter
          ref={filterRef}
          id={filter.id}
          x={filter.x}
          y="0"
          width={filter.lensWidth}
          height={filter.lensHeight}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodColor="rgb(128, 128, 128)" result="neutral" />
          <feImage
            ref={mapRef}
            href={filter.mapUrl}
            x={filter.x}
            y="0"
            width={filter.lensWidth}
            height={filter.lensHeight}
            preserveAspectRatio="none"
            result="rawMap"
          />
          <feComposite in="rawMap" in2="neutral" operator="over" result="map" />

          <feDisplacementMap ref={redShiftRef} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="redShift" />
          <feColorMatrix in="redShift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
          <feDisplacementMap ref={greenShiftRef} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="greenShift" />
          <feColorMatrix in="greenShift" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
          <feDisplacementMap ref={blueShiftRef} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="blueShift" />
          <feColorMatrix in="blueShift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
          <feComposite in="red" in2="green" operator="arithmetic" k2="1" k3="1" result="redGreen" />
          <feComposite in="redGreen" in2="blue" operator="arithmetic" k2="1" k3="1" result="refracted" />

          <feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 2.4 0 -1.35" result="specular" />
          <feComponentTransfer in="specular" result="specularFade">
            <feFuncA ref={specularAlphaRef} type="linear" slope="0" />
          </feComponentTransfer>
          <feBlend in="refracted" in2="specularFade" mode="screen" />
        </filter>
      </defs>
    </svg>
  )
})

export default function GlassNav({ tabs, activeTab, onSelect }) {
  const reactId = useId().replace(/:/g, '')
  const navRef = useRef(null)
  const targetRef = useRef(null)
  const indicatorRef = useRef(null)
  const buttonRefs = useRef({})
  const filterRef = useRef(null)
  const mapRef = useRef(null)
  const redShiftRef = useRef(null)
  const greenShiftRef = useRef(null)
  const blueShiftRef = useRef(null)
  const specularAlphaRef = useRef(null)
  const geometryRef = useRef({ lensWidth: 0, lensHeight: 0 })
  const positionRef = useRef({ x: 0 })
  const refractionRef = useRef(0)
  const motionFrameRef = useRef({ x: 0, time: 0 })
  const setIndicatorXRef = useRef(null)
  const moveToRef = useRef(null)
  const destinationRef = useRef('')
  const hasSettledRef = useRef(false)
  const filterVersionRef = useRef(0)
  const filterSizeRef = useRef('')
  const navSizeRef = useRef('')
  const [filter, setFilter] = useState({
    id: `nav-glass-${reactId}-0`,
    mapUrl: '',
    x: 0,
    lensWidth: 0,
    lensHeight: 0,
  })

  const getTabX = (tabId) => {
    const button = buttonRefs.current[tabId]
    const firstButton = buttonRefs.current[tabs[0]?.id]
    if (!button || !firstButton) return 0
    return button.getBoundingClientRect().left - firstButton.getBoundingClientRect().left
  }

  const paintLens = (x) => {
    const { lensWidth, lensHeight } = geometryRef.current
    if (!lensWidth || !lensHeight) return

    positionRef.current.x = x
    setIndicatorXRef.current?.(x)
    filterRef.current?.setAttribute('x', String(x))
    filterRef.current?.setAttribute('width', String(lensWidth))
    mapRef.current?.setAttribute('x', String(x))
  }

  const paintRefraction = (amount) => {
    const strength = Math.max(0, Math.min(1, amount))
    refractionRef.current = strength
    redShiftRef.current?.setAttribute('scale', String(36 * strength))
    greenShiftRef.current?.setAttribute('scale', String(28 * strength))
    blueShiftRef.current?.setAttribute('scale', String(20 * strength))
    specularAlphaRef.current?.setAttribute('slope', String(strength))
  }

  const measure = () => {
    const indicator = indicatorRef.current
    const firstButton = buttonRefs.current[tabs[0]?.id]
    if (!indicator || !firstButton) return

    const buttonRect = firstButton.getBoundingClientRect()
    const navRect = navRef.current?.getBoundingClientRect()
    const lensWidth = buttonRect.width
    const lensHeight = buttonRect.height
    const destination = destinationRef.current || activeTab
    const x = getTabX(destination)
    const sizeKey = `${Math.round(lensWidth * 10)}x${Math.round(lensHeight * 10)}`

    geometryRef.current = { lensWidth, lensHeight }
    if (navRect) navSizeRef.current = `${Math.round(navRect.width * 10)}x${Math.round(navRect.height * 10)}`
    gsap.set(indicator, { width: lensWidth, height: lensHeight })

    if (filterSizeRef.current !== sizeKey) {
      filterSizeRef.current = sizeKey
      filterVersionRef.current += 1
      setFilter({
        id: `nav-glass-${reactId}-${filterVersionRef.current}`,
        mapUrl: createLensMap(lensWidth, lensHeight),
        x,
        lensWidth,
        lensHeight,
      })
    }

    positionRef.current.x = x
    setIndicatorXRef.current?.(x)
    paintLens(x)
    paintRefraction(0)
    targetRef.current?.classList.remove('moving')
    indicator.classList.remove('moving')
    indicator.classList.add('ready')
  }

  useGSAP((context, contextSafe) => {
    if (!indicatorRef.current || !navRef.current) return undefined

    setIndicatorXRef.current = gsap.quickSetter(indicatorRef.current, 'x', 'px')
    measure()

    moveToRef.current = contextSafe((tabId, animate = true) => {
      const destination = getTabX(tabId)
      destinationRef.current = tabId
      gsap.killTweensOf(positionRef.current)
      const distance = Math.abs(destination - positionRef.current.x)

      if (distance < 0.5) {
        positionRef.current.x = destination
        paintLens(destination)
        paintRefraction(0)
        targetRef.current?.classList.remove('moving')
        indicatorRef.current?.classList.remove('moving')
        return
      }

      if (!animate || prefersReducedMotion()) {
        positionRef.current.x = destination
        paintLens(destination)
        paintRefraction(0)
        targetRef.current?.classList.remove('moving')
        indicatorRef.current?.classList.remove('moving')
        return
      }

      const startingRefraction = refractionRef.current
      motionFrameRef.current = { x: positionRef.current.x, time: performance.now() }
      targetRef.current?.classList.add('moving')
      indicatorRef.current?.classList.add('moving')
      const tween = gsap.to(positionRef.current, {
        x: destination,
        duration: 0.52,
        ease: glassSpringEase,
        overwrite: true,
        onUpdate: () => {
          const progress = tween.progress()
          const envelope = progress < 0.35
            ? startingRefraction + (1 - startingRefraction) * (progress / 0.35)
            : 1 - ((progress - 0.35) / 0.65)
          const now = performance.now()
          const elapsed = Math.max(1, now - motionFrameRef.current.time)
          const velocity = Math.abs(positionRef.current.x - motionFrameRef.current.x) / elapsed
          const refraction = envelope * Math.min(1, velocity / 0.16)
          motionFrameRef.current = { x: positionRef.current.x, time: now }
          paintLens(positionRef.current.x)
          paintRefraction(refraction)
        },
        onComplete: () => {
          paintRefraction(0)
          targetRef.current?.classList.remove('moving')
          indicatorRef.current?.classList.remove('moving')
        },
      })
    })

    const observer = new ResizeObserver(() => {
      const navRect = navRef.current?.getBoundingClientRect()
      const navSize = navRect ? `${Math.round(navRect.width * 10)}x${Math.round(navRect.height * 10)}` : ''
      if (!navSize || navSize === navSizeRef.current) return
      gsap.killTweensOf(positionRef.current)
      measure()
    })
    observer.observe(navRef.current)

    return () => {
      observer.disconnect()
      gsap.killTweensOf(positionRef.current)
      setIndicatorXRef.current = null
      moveToRef.current = null
      paintRefraction(0)
      targetRef.current?.classList.remove('moving')
    }
  }, { scope: navRef })

  useGSAP(() => {
    if (!geometryRef.current.lensWidth) return undefined

    if (!hasSettledRef.current) {
      hasSettledRef.current = true
      moveToRef.current?.(activeTab, false)
      return undefined
    }

    if (destinationRef.current !== activeTab) moveToRef.current?.(activeTab, true)
    return undefined
  }, { dependencies: [activeTab], scope: navRef })

  return (
    <nav className="nav" ref={navRef} aria-label="Primary">
      {/* Container refraction deliberately omitted: the indicator's own
          backdrop-filter would double-process a static bent layer beneath it
          (measured as a neon pill washing out the active icon). The nav keeps
          its frosted glass + the animated indicator lens. */}
      <LensFilter
        filter={filter}
        filterRef={filterRef}
        mapRef={mapRef}
        redShiftRef={redShiftRef}
        greenShiftRef={greenShiftRef}
        blueShiftRef={blueShiftRef}
        specularAlphaRef={specularAlphaRef}
      />

      <div
        className={`nav-highlight-target${filter.mapUrl ? ' ready' : ''}`}
        ref={targetRef}
        aria-hidden="true"
        style={{ filter: `url(#${filter.id})` }}
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <span className="nav-highlight-item" key={id}>
            <Icon />
            <span>{label}</span>
          </span>
        ))}
      </div>

      <div className="nav-indicator" ref={indicatorRef} aria-hidden="true" />

      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          ref={(element) => { buttonRefs.current[id] = element }}
          className={activeTab === id ? 'active' : ''}
          type="button"
          aria-current={activeTab === id ? 'page' : undefined}
          onClick={() => {
            moveToRef.current?.(id, true)
            onSelect(id)
          }}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

import { memo, useId, useRef, useState } from 'react'
import { glassSpringEase, gsap, prefersReducedMotion, useGSAP } from './gsap.js'
import { supportsRefraction } from './liquidGlass.js'

const MAP_LONG_SIDE = 420

const smoothstep = (start, end, value) => {
  const amount = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return amount * amount * (3 - 2 * amount)
}

const roundedRectSdf = (x, y, halfWidth, halfHeight, radius) => {
  const qx = Math.abs(x) - halfWidth + radius
  const qy = Math.abs(y) - halfHeight + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

/* The selector is a rounded rectangle, so its displacement field must follow
   the nearest rounded edge rather than a rectangular X/Y gradient. Neutral
   128/128 keeps the centre calm; the SDF normal bends only the optical rim. */
function createSelectorMap(width, height, radius) {
  const rasterScale = Math.min(1, MAP_LONG_SIDE / Math.max(width, height))
  const mapWidth = Math.max(2, Math.round(width * rasterScale))
  const mapHeight = Math.max(2, Math.round(height * rasterScale))
  const canvas = document.createElement('canvas')
  canvas.width = mapWidth
  canvas.height = mapHeight

  const context = canvas.getContext('2d')
  if (!context) return ''

  const image = context.createImageData(mapWidth, mapHeight)
  const pixels = image.data
  const halfWidth = width / 2
  const halfHeight = height / 2
  const shapeRadius = Math.min(radius, halfHeight)
  const edgeDepth = Math.min(18, Math.max(11, height * 0.22))
  const stepX = width / mapWidth
  const stepY = height / mapHeight

  for (let row = 0; row < mapHeight; row += 1) {
    const y = (row + 0.5) * stepY - halfHeight

    for (let column = 0; column < mapWidth; column += 1) {
      const x = (column + 0.5) * stepX - halfWidth
      const distance = roundedRectSdf(x, y, halfWidth, halfHeight, shapeRadius)
      const index = (row * mapWidth + column) * 4

      if (distance >= 0) {
        pixels[index] = 128
        pixels[index + 1] = 128
        pixels[index + 2] = 128
        pixels[index + 3] = 255
        continue
      }

      const edge = smoothstep(-edgeDepth, 0, distance)
      const sample = 0.75
      const dx = roundedRectSdf(x + sample, y, halfWidth, halfHeight, shapeRadius)
        - roundedRectSdf(x - sample, y, halfWidth, halfHeight, shapeRadius)
      const dy = roundedRectSdf(x, y + sample, halfWidth, halfHeight, shapeRadius)
        - roundedRectSdf(x, y - sample, halfWidth, halfHeight, shapeRadius)
      const magnitude = Math.hypot(dx, dy) || 1
      const normalX = dx / magnitude
      const normalY = dy / magnitude
      const strength = edge * edge

      pixels[index] = Math.round(128 + normalX * strength * 127)
      pixels[index + 1] = Math.round(128 + normalY * strength * 127)
      pixels[index + 2] = Math.round(128 + Math.max(0, normalX + normalY) * edge * 44)
      pixels[index + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

const SelectorFilter = memo(function SelectorFilter({
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
          <feImage
            ref={mapRef}
            href={filter.mapUrl}
            x={filter.x}
            y="0"
            width={filter.lensWidth}
            height={filter.lensHeight}
            preserveAspectRatio="none"
            result="selectorMap"
          />

          <feDisplacementMap ref={redShiftRef} in="SourceGraphic" in2="selectorMap" scale="0" xChannelSelector="R" yChannelSelector="G" result="redShift" />
          <feColorMatrix in="redShift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
          <feDisplacementMap ref={greenShiftRef} in="SourceGraphic" in2="selectorMap" scale="0" xChannelSelector="R" yChannelSelector="G" result="greenShift" />
          <feColorMatrix in="greenShift" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
          <feDisplacementMap ref={blueShiftRef} in="SourceGraphic" in2="selectorMap" scale="0" xChannelSelector="R" yChannelSelector="G" result="blueShift" />
          <feColorMatrix in="blueShift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
          <feBlend in="red" in2="green" mode="screen" result="redGreen" />
          <feBlend in="redGreen" in2="blue" mode="screen" result="refracted" />

          <feColorMatrix in="selectorMap" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 2.4 0 -1.35" result="specular" />
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
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
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
  const destinationRef = useRef(activeTab)
  const filterVersionRef = useRef(0)
  const filterSizeRef = useRef('')
  const navSizeRef = useRef('')
  const [filter, setFilter] = useState({
    id: `nav-selector-${reactId}-0`,
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
    // Strong lensing with tight channel spacing keeps the small glyphs crisp.
    redShiftRef.current?.setAttribute('scale', String(-32 * strength))
    greenShiftRef.current?.setAttribute('scale', String(-29 * strength))
    blueShiftRef.current?.setAttribute('scale', String(-26 * strength))
    specularAlphaRef.current?.setAttribute('slope', String(0.72 * strength))
  }

  const settleIndicator = () => {
    const indicator = indicatorRef.current
    if (!indicator) return
    paintRefraction(0)
    targetRef.current?.classList.remove('moving')
    gsap.to(indicator, {
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      duration: 0.18,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => indicator.classList.remove('moving'),
    })
  }

  const measure = () => {
    const nav = navRef.current
    const indicator = indicatorRef.current
    const firstButton = buttonRefs.current[tabs[0]?.id]
    if (!nav || !indicator || !firstButton) return

    const buttonRect = firstButton.getBoundingClientRect()
    const navRect = nav.getBoundingClientRect()
    const lensWidth = buttonRect.width
    const lensHeight = buttonRect.height
    const x = getTabX(destinationRef.current || activeTab)
    const filterSize = `${Math.round(lensWidth * 10)}x${Math.round(lensHeight * 10)}`

    geometryRef.current = { lensWidth, lensHeight }
    navSizeRef.current = `${Math.round(navRect.width * 10)}x${Math.round(navRect.height * 10)}`
    gsap.set(indicator, { width: lensWidth, height: lensHeight, scaleX: 1, scaleY: 1, rotation: 0 })

    if (filterSize !== filterSizeRef.current) {
      filterSizeRef.current = filterSize
      filterVersionRef.current += 1
      const radius = parseFloat(getComputedStyle(indicator).borderRadius) || lensHeight / 2
      setFilter({
        id: `nav-selector-${reactId}-${filterVersionRef.current}`,
        mapUrl: supportsRefraction() ? createSelectorMap(lensWidth, lensHeight, radius) : '',
        x,
        lensWidth,
        lensHeight,
      })
    }

    positionRef.current.x = x
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
      const indicator = indicatorRef.current
      if (!indicator) return

      const destination = getTabX(tabId)
      destinationRef.current = tabId
      gsap.killTweensOf(positionRef.current)
      gsap.killTweensOf(indicator)
      const distance = Math.abs(destination - positionRef.current.x)

      if (!animate || prefersReducedMotion() || distance < 0.5) {
        positionRef.current.x = destination
        paintLens(destination)
        gsap.set(indicator, { scaleX: 1, scaleY: 1, rotation: 0 })
        paintRefraction(0)
        targetRef.current?.classList.remove('moving')
        indicator.classList.remove('moving')
        return
      }

      const startingRefraction = refractionRef.current
      const direction = Math.sign(destination - positionRef.current.x) || 1
      motionFrameRef.current = { x: positionRef.current.x, time: performance.now() }
      targetRef.current?.classList.add('moving')
      indicator.classList.add('moving')

      const tween = gsap.to(positionRef.current, {
        x: destination,
        duration: 0.52,
        ease: glassSpringEase,
        overwrite: true,
        onUpdate: () => {
          const progress = tween.progress()
          const envelope = progress < 0.32
            ? startingRefraction + (1 - startingRefraction) * (progress / 0.32)
            : 1 - ((progress - 0.32) / 0.68)
          const now = performance.now()
          const elapsed = Math.max(1, now - motionFrameRef.current.time)
          const velocity = Math.abs(positionRef.current.x - motionFrameRef.current.x) / elapsed
          const velocityAmount = Math.min(1, velocity / 0.16)
          const stretch = Math.min(0.1, velocity * 0.19)

          motionFrameRef.current = { x: positionRef.current.x, time: now }
          paintLens(positionRef.current.x)
          paintRefraction(envelope * velocityAmount)
          gsap.set(indicator, {
            scaleX: 1 + stretch,
            scaleY: 1 - stretch * 0.3,
            rotation: direction * stretch * 1.25,
          })
        },
        onComplete: settleIndicator,
      })

      return tween
    })

    const observer = new ResizeObserver(() => {
      const navRect = navRef.current?.getBoundingClientRect()
      const navSize = navRect ? `${Math.round(navRect.width * 10)}x${Math.round(navRect.height * 10)}` : ''
      if (!navSize || navSize === navSizeRef.current) return
      gsap.killTweensOf(positionRef.current)
      gsap.killTweensOf(indicatorRef.current)
      measure()
    })
    observer.observe(navRef.current)

    return () => {
      observer.disconnect()
      gsap.killTweensOf(positionRef.current)
      if (indicatorRef.current) gsap.killTweensOf(indicatorRef.current)
      setIndicatorXRef.current = null
      moveToRef.current = null
      paintRefraction(0)
      targetRef.current?.classList.remove('moving')
    }
  }, { scope: navRef })

  useGSAP(() => {
    if (!geometryRef.current.lensWidth) return undefined
    if (destinationRef.current !== activeTab) moveToRef.current?.(activeTab, true)
    return undefined
  }, { dependencies: [activeTab], scope: navRef })

  return (
    <nav className="nav" ref={navRef} aria-label="Primary">
      <SelectorFilter
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
        style={filter.mapUrl ? { filter: `url(#${filter.id})` } : undefined}
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

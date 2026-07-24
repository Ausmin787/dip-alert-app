import { memo, useEffect, useId, useRef, useState } from 'react'
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
  const visualRef = useRef({ scaleX: 1, scaleY: 1, strength: 0 })
  const dragRef = useRef(null)
  const refractionRef = useRef(0)
  const motionFrameRef = useRef({ x: 0, time: 0 })
  const setIndicatorXRef = useRef(null)
  const moveToRef = useRef(null)
  const startDragRef = useRef(null)
  const moveDragRef = useRef(null)
  const endDragRef = useRef(null)
  const suppressClickUntilRef = useRef(0)
  const onSelectRef = useRef(onSelect)
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

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  const getTabX = (tabId) => {
    const button = buttonRefs.current[tabId]
    const firstButton = buttonRefs.current[tabs[0]?.id]
    if (!button || !firstButton) return 0
    return button.getBoundingClientRect().left - firstButton.getBoundingClientRect().left
  }

  const getNearestTab = (x) => {
    const { lensWidth, tabPositions = [] } = geometryRef.current
    const centre = x + lensWidth / 2
    let nearest = tabPositions[0]
    let nearestDistance = Number.POSITIVE_INFINITY

    tabPositions.forEach((position) => {
      const distance = Math.abs(centre - (position.x + lensWidth / 2))
      if (distance < nearestDistance) {
        nearest = position
        nearestDistance = distance
      }
    })

    return nearest?.id
  }

  const paintLens = (x, scaleX = 1, scaleY = 1) => {
    const { lensWidth, lensHeight } = geometryRef.current
    if (!lensWidth || !lensHeight) return

    const renderedWidth = lensWidth * scaleX
    const renderedHeight = lensHeight * scaleY
    const filterX = x + (lensWidth - renderedWidth) / 2
    const filterY = (lensHeight - renderedHeight) / 2

    positionRef.current.x = x
    setIndicatorXRef.current?.(x)
    filterRef.current?.setAttribute('x', String(filterX))
    filterRef.current?.setAttribute('y', String(filterY))
    filterRef.current?.setAttribute('width', String(renderedWidth))
    filterRef.current?.setAttribute('height', String(renderedHeight))
    mapRef.current?.setAttribute('x', String(filterX))
    mapRef.current?.setAttribute('y', String(filterY))
    mapRef.current?.setAttribute('width', String(renderedWidth))
    mapRef.current?.setAttribute('height', String(renderedHeight))
  }

  const paintRefraction = (amount) => {
    const strength = Math.max(0, Math.min(1.35, amount))
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
    visualRef.current = { scaleX: 1, scaleY: 1, strength: 0 }
    paintLens(positionRef.current.x, 1, 1)
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

    const tabPositions = tabs.map(({ id }) => ({ id, x: getTabX(id) }))
    geometryRef.current = {
      lensWidth,
      lensHeight,
      tabPositions,
      minX: tabPositions[0]?.x || 0,
      maxX: tabPositions[tabPositions.length - 1]?.x || 0,
    }
    navSizeRef.current = `${Math.round(navRect.width * 10)}x${Math.round(navRect.height * 10)}`
    gsap.set(indicator, { width: lensWidth, height: lensHeight, scaleX: 1, scaleY: 1, rotation: 0 })
    visualRef.current = { scaleX: 1, scaleY: 1, strength: 0 }

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

    startDragRef.current = contextSafe((event, tabId) => {
      const nav = navRef.current
      const indicator = indicatorRef.current
      if (
        !nav ||
        !indicator ||
        prefersReducedMotion() ||
        event.isPrimary === false ||
        (event.pointerType === 'mouse' && event.button !== 0)
      ) return

      event.preventDefault()
      gsap.killTweensOf(positionRef.current)
      gsap.killTweensOf(visualRef.current)
      gsap.killTweensOf(indicator)

      const navRect = nav.getBoundingClientRect()
      const now = performance.now()
      dragRef.current = {
        pointerId: event.pointerId,
        captureElement: event.currentTarget,
        originTab: tabId,
        candidateTab: tabId,
        startClientX: event.clientX,
        startPositionX: positionRef.current.x,
        lastClientX: event.clientX,
        lastTime: now,
        lastClientY: event.clientY,
        navTop: navRect.top,
        navBottom: navRect.bottom,
        moved: false,
        renderScaleX: 1,
        renderScaleY: 1,
      }

      event.currentTarget.setPointerCapture?.(event.pointerId)
      destinationRef.current = tabId
      nav.classList.add('dragging')
      nav.dataset.dragTarget = tabId
      targetRef.current?.classList.add('moving')
      indicator.classList.add('moving', 'dragging')

      gsap.to(visualRef.current, {
        scaleX: 1.38,
        scaleY: 1.28,
        strength: 1.18,
        duration: 0.16,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => {
          const { scaleX, scaleY, strength } = visualRef.current
          const activeDrag = dragRef.current
          if (activeDrag) {
            activeDrag.renderScaleX = scaleX
            activeDrag.renderScaleY = scaleY
          }
          paintLens(positionRef.current.x, scaleX, scaleY)
          paintRefraction(strength)
          gsap.set(indicator, { scaleX, scaleY, rotation: 0 })
        },
      })
    })

    moveDragRef.current = contextSafe((event) => {
      const drag = dragRef.current
      const indicator = indicatorRef.current
      const nav = navRef.current
      if (!drag || !indicator || !nav || event.pointerId !== drag.pointerId) return

      event.preventDefault()
      const { minX = 0, maxX = 0 } = geometryRef.current
      const delta = event.clientX - drag.startClientX
      const nextX = Math.max(minX, Math.min(maxX, drag.startPositionX + delta))
      const now = performance.now()
      const elapsed = Math.max(1, now - drag.lastTime)
      const velocity = Math.abs(event.clientX - drag.lastClientX) / elapsed
      const direction = Math.sign(event.clientX - drag.lastClientX)
      const stretch = Math.min(0.07, velocity * 0.12)
      const scaleX = Math.max(1.38, visualRef.current.scaleX) + stretch
      const scaleY = Math.max(1.28, visualRef.current.scaleY) - stretch * 0.22
      const strength = 1.14 + Math.min(0.18, velocity * 0.22)
      const rotation = direction * Math.min(1.8, velocity * 1.4)
      const candidateTab = getNearestTab(nextX) || drag.originTab

      if (!drag.moved && Math.abs(delta) > 3) {
        gsap.killTweensOf(visualRef.current)
        visualRef.current.scaleX = 1.38
        visualRef.current.scaleY = 1.28
      }

      drag.moved ||= Math.abs(delta) > 3
      drag.candidateTab = candidateTab
      drag.lastClientX = event.clientX
      drag.lastClientY = event.clientY
      drag.lastTime = now
      drag.renderScaleX = scaleX
      drag.renderScaleY = scaleY
      positionRef.current.x = nextX
      visualRef.current.strength = strength
      nav.dataset.dragTarget = candidateTab

      paintLens(nextX, scaleX, scaleY)
      paintRefraction(strength)
      gsap.set(indicator, { x: nextX, scaleX, scaleY, rotation })
    })

    endDragRef.current = contextSafe((event, cancelled = false) => {
      const drag = dragRef.current
      const indicator = indicatorRef.current
      const nav = navRef.current
      if (!drag || !indicator || !nav || event.pointerId !== drag.pointerId) return

      event.preventDefault()
      const capture = drag.captureElement
      if (capture?.hasPointerCapture?.(drag.pointerId)) capture.releasePointerCapture(drag.pointerId)
      suppressClickUntilRef.current = performance.now() + 450

      const releaseY = Number.isFinite(event.clientY) ? event.clientY : drag.lastClientY
      const insideReleaseBand = releaseY >= drag.navTop - 42 && releaseY <= drag.navBottom + 42
      const nextTab = cancelled || !insideReleaseBand ? drag.originTab : drag.candidateTab
      const destination = getTabX(nextTab)
      const releaseState = {
        x: positionRef.current.x,
        scaleX: drag.renderScaleX || visualRef.current.scaleX,
        scaleY: drag.renderScaleY || visualRef.current.scaleY,
        strength: refractionRef.current,
        rotation: Number(gsap.getProperty(indicator, 'rotation')) || 0,
      }

      dragRef.current = null
      destinationRef.current = nextTab
      gsap.killTweensOf(visualRef.current)
      gsap.killTweensOf(positionRef.current)
      gsap.killTweensOf(indicator)

      gsap.to(releaseState, {
        x: destination,
        scaleX: 1,
        scaleY: 1,
        strength: 0,
        rotation: 0,
        duration: cancelled ? 0.24 : 0.3,
        ease: glassSpringEase,
        overwrite: true,
        onUpdate: () => {
          positionRef.current.x = releaseState.x
          visualRef.current = {
            scaleX: releaseState.scaleX,
            scaleY: releaseState.scaleY,
            strength: releaseState.strength,
          }
          paintLens(releaseState.x, releaseState.scaleX, releaseState.scaleY)
          paintRefraction(releaseState.strength)
          gsap.set(indicator, {
            x: releaseState.x,
            scaleX: releaseState.scaleX,
            scaleY: releaseState.scaleY,
            rotation: releaseState.rotation,
          })
        },
        onComplete: () => {
          positionRef.current.x = destination
          visualRef.current = { scaleX: 1, scaleY: 1, strength: 0 }
          paintLens(destination, 1, 1)
          paintRefraction(0)
          gsap.set(indicator, { x: destination, scaleX: 1, scaleY: 1, rotation: 0 })
          targetRef.current?.classList.remove('moving')
          indicator.classList.remove('moving', 'dragging')
          nav.classList.remove('dragging')
          delete nav.dataset.dragTarget
          if (!cancelled && nextTab !== drag.originTab) onSelectRef.current(nextTab)
        },
      })
    })

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
      gsap.killTweensOf(visualRef.current)
      if (indicatorRef.current) gsap.killTweensOf(indicatorRef.current)
      setIndicatorXRef.current = null
      moveToRef.current = null
      startDragRef.current = null
      moveDragRef.current = null
      endDragRef.current = null
      dragRef.current = null
      paintRefraction(0)
      targetRef.current?.classList.remove('moving')
      navRef.current?.classList.remove('dragging')
      if (navRef.current) delete navRef.current.dataset.dragTarget
    }
  }, { scope: navRef })

  useGSAP(() => {
    if (!geometryRef.current.lensWidth) return undefined
    if (destinationRef.current !== activeTab) moveToRef.current?.(activeTab, true)
    return undefined
  }, { dependencies: [activeTab], scope: navRef })

  return (
    <nav
      className="nav"
      ref={navRef}
      aria-label="Primary"
      onPointerMove={(event) => moveDragRef.current?.(event)}
      onPointerUp={(event) => endDragRef.current?.(event, false)}
      onPointerCancel={(event) => endDragRef.current?.(event, true)}
    >
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
          onPointerDown={(event) => {
            if (activeTab === id) startDragRef.current?.(event, id)
          }}
          onClick={() => {
            if (performance.now() < suppressClickUntilRef.current) return
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

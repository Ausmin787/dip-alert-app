import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createGlassMap, DISPERSION_SPREAD, PRESETS, supportsRefraction } from './liquidGlass.js'
import { getWallpaperBitmap, WALLPAPER_MARGIN } from './wallpaperImage.js'

/* Refraction rides on a STATIC pre-blurred wallpaper image under filter: url(),
   not on backdrop-filter: url(). A live backdrop chain forces Chromium to
   re-rasterize every displacement pass whenever anything on screen changes
   (blink dots, entrance animations, scroll) — measured 25fps with 250ms
   hitches vs a 60fps baseline. The baked image (wallpaperImage.js) is decoded
   once per shell size and shared by every surface through feImage, so filter
   re-runs (e.g. re-showing a hidden tab) only execute card-sized displacement
   passes on a cached bitmap. The surface's CSS backdrop-filter blur stays
   untouched and keeps frosting live content behind it. */

const findScroller = (element) => element.closest('.panel') || null

/* The filtered window extends this far beyond the visible surface so blur/
   displacement edge falloff never reaches the rim; the wallpaper image is
   drawn with its own margin (WALLPAPER_MARGIN) so the window is always fully
   covered, even for surfaces touching the shell edge. */
const BLEED = 40

export function useLiquidGlass(ref, variant = 'card') {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const versionRef = useRef(0)
  const geoRef = useRef('')
  const wallpaperRef = useRef(null)
  const positionRef = useRef({ offsetX: 0, offsetY: 0 })
  const [surface, setSurface] = useState(null)

  useEffect(() => {
    if (!supportsRefraction()) return undefined
    const element = ref.current
    const shell = document.getElementById('phone-shell')
    if (!element || !shell) return undefined
    const preset = PRESETS[variant] || PRESETS.card
    geoRef.current = ''
    let resizeTimer = 0
    let scrollFrame = 0
    let disposed = false

    const measure = () => {
      const rect = element.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      if (width < 2 || height < 2) return
      // Layout-chain offset (transform-free): entrance animations translate the
      // element mid-flight, so getBoundingClientRect would misalign the clone.
      let offsetX = 0
      let offsetY = 0
      for (let node = element; node && node !== shell; node = node.offsetParent) {
        offsetX += node.offsetLeft
        offsetY += node.offsetTop
      }
      for (let node = element.parentElement; node && node !== shell; node = node.parentElement) {
        offsetX -= node.scrollLeft
        offsetY -= node.scrollTop
      }
      positionRef.current = { offsetX, offsetY }

      // Scrolling only changes which part of the already-decoded wallpaper is
      // sampled. Mutate that input in place so Blink keeps the same filter
      // graph and never flashes an undecoded replacement frame.
      if (wallpaperRef.current) {
        wallpaperRef.current.setAttribute('x', String(BLEED - offsetX - WALLPAPER_MARGIN))
        wallpaperRef.current.setAttribute('y', String(BLEED - offsetY - WALLPAPER_MARGIN))
      }

      const radius = Math.round(parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0)
      const shellRect = shell.getBoundingClientRect()
      const shellW = Math.round(shellRect.width)
      const shellH = Math.round(shellRect.height)
      // Position deliberately stays out of this key. Rebuilding the complete
      // SVG graph after every scroll caused a one-frame dark/light color swap.
      const geoKey = `${width}x${height}x${radius}/${shellW}x${shellH}`
      if (geoRef.current === geoKey) return
      geoRef.current = geoKey
      const { url } = createGlassMap(width, height, radius, {
        edgeDepth: preset.edgeDepth,
        domeStrength: preset.domeStrength,
      })
      if (!url) return
      // The shared bitmap resolves once per shell size; surfaces created while
      // it rasterizes simply pick up refraction a beat later.
      getWallpaperBitmap(shellW, shellH).then((wallpaperUrl) => {
        if (disposed || geoRef.current !== geoKey) return
        const latestPosition = positionRef.current
        // Fresh filter id per geometry/map change (GlassNav's filter-caching rule).
        versionRef.current += 1
        setSurface({
          id: `glass-${reactId}-v${versionRef.current}`,
          url,
          wallpaperUrl,
          width,
          height,
          offsetX: latestPosition.offsetX,
          offsetY: latestPosition.offsetY,
          shellW,
          shellH,
          preset,
        })
      }).catch(() => {})
    }

    const scheduleResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(measure, 90)
    }

    const scheduleScroll = () => {
      if (scrollFrame) return
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0
        measure()
      })
    }

    measure()
    const observer = new ResizeObserver(scheduleResize)
    observer.observe(element)
    observer.observe(shell)
    // Keep the persistent filter aligned continuously with its moving card.
    const scroller = findScroller(element)
    if (scroller) scroller.addEventListener('scroll', scheduleScroll, { passive: true })

    return () => {
      disposed = true
      window.clearTimeout(resizeTimer)
      window.cancelAnimationFrame(scrollFrame)
      observer.disconnect()
      if (scroller) scroller.removeEventListener('scroll', scheduleScroll)
    }
  }, [ref, variant, reactId])

  /* Filter defs: the pre-blurred wallpaper enters through feImage (SourceGraphic
     is unused), gets the surface's saturate/tone grade, and is bent by the
     displacement map. Same hard-won details as GlassNav's lens: sRGB
     interpolation, userSpaceOnUse, feImage sized to the measured px, neutral
     grey backing under the map so nothing shifts while the data URI decodes.
     Memoized on the surface state (not a local component — fast-refresh rule). */
  const defs = useMemo(() => {
    if (!surface) return null
    const { id, url, wallpaperUrl, width, height, offsetX, offsetY, shellW, shellH, preset } = surface
    // Cap the displacement so small surfaces never smear the backdrop image.
    const scale = Math.min(preset.scale, Math.min(width, height) * 0.15)
    const toned = preset.contrast !== 1 || preset.brightness !== 1
    const slope = preset.contrast * preset.brightness
    const intercept = (preset.brightness * (1 - preset.contrast)) / 2
    const source = toned ? 'toned' : 'graded'
    const m = WALLPAPER_MARGIN

    return (
      <svg className="glass-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter
            id={id}
            x="0"
            y="0"
            width={width + BLEED * 2}
            height={height + BLEED * 2}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              ref={wallpaperRef}
              href={wallpaperUrl}
              x={BLEED - offsetX - m}
              y={BLEED - offsetY - m}
              width={shellW + m * 2}
              height={shellH + m * 2}
              preserveAspectRatio="none"
              result="wp"
            />
            <feColorMatrix in="wp" type="saturate" values={String(preset.saturate)} result="graded" />
            {toned && (
              <feComponentTransfer in="graded" result="toned">
                <feFuncR type="linear" slope={slope} intercept={intercept} />
                <feFuncG type="linear" slope={slope} intercept={intercept} />
                <feFuncB type="linear" slope={slope} intercept={intercept} />
              </feComponentTransfer>
            )}
            <feFlood floodColor="rgb(128, 128, 128)" result="neutral" />
            <feImage href={url} x={BLEED} y={BLEED} width={width} height={height} preserveAspectRatio="none" result="rawMap" />
            <feComposite in="rawMap" in2="neutral" operator="over" result="map" />

            <feDisplacementMap in={source} in2="map" scale={scale * (1 + DISPERSION_SPREAD)} xChannelSelector="R" yChannelSelector="G" result="redShift" />
            <feColorMatrix in="redShift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
            <feDisplacementMap in={source} in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="greenShift" />
            <feColorMatrix in="greenShift" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
            <feDisplacementMap in={source} in2="map" scale={scale * (1 - DISPERSION_SPREAD)} xChannelSelector="R" yChannelSelector="G" result="blueShift" />
            <feColorMatrix in="blueShift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
            <feComposite in="red" in2="green" operator="arithmetic" k2="1" k3="1" result="redGreen" />
            <feComposite in="redGreen" in2="blue" operator="arithmetic" k2="1" k3="1" result="refracted" />

            <feColorMatrix in="map" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 2.4 0 -1.35" result="specular" />
            <feComponentTransfer in="specular" result="specularFade">
              {/* Static surfaces keep the sheen well below the nav lens's
                  full-motion flash so it never competes with card content. */}
              <feFuncA type="linear" slope="0.6" />
            </feComponentTransfer>
            <feBlend in="refracted" in2="specularFade" mode="screen" />
          </filter>
        </defs>
      </svg>
    )
  }, [surface])

  /* The bent-wallpaper layer: clipped to the surface, scrim copy painted above
     it by .glass-refract::after (background: inherit ladder) so text contrast
     stays identical to the plain CSS recipe. The window div is empty — the
     filter chain sources everything from feImage. */
  const layer = useMemo(() => {
    if (!surface) return null
    return (
      <div className="glass-refract" aria-hidden="true">
        <div className="glass-refract-window" style={{ filter: `url(#${surface.id})` }} />
      </div>
    )
  }, [surface])

  return { defs, layer }
}

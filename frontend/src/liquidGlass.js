/**
 * Shared liquid-glass displacement machinery for every refractive surface
 * (glass cards, the Manage sheet, the nav container).
 *
 * Map math adapted from samasante/liquid-glass (MIT,
 * https://github.com/samasante/liquid-glass): erf-smoothed rounded-rect SDF
 * edge feather (erf(x) ≈ tanh(√π·x)), spherical-cap dome profile normalized by
 * the closed-form dome-gradient mean, quadrant mirroring. Channel encoding and
 * the specular formula follow this repo's own GlassNav lens map:
 *   R — X displacement (0.5 = neutral)
 *   G — Y displacement (0.5 = neutral)
 *   B — specular highlight mask (0.5 = none)
 */

const REFRACTION_ENABLED = true

/* The red displacement pass runs DISPERSION_SPREAD stronger than green, blue
   the same amount weaker — the staggered scales make the chromatic fringe. */
export const DISPERSION_SPREAD = 0.22

/* blur/saturate/contrast/brightness reproduce each surface's CSS backdrop
   recipe inside the filter chain; scale = max displacement px; edgeDepth = rim
   band reach in px; domeStrength = spherical-cap height as a fraction of the
   half-extent (kept low so card interiors stay essentially undistorted). */
export const PRESETS = {
  card: { blur: 28, saturate: 1.8, contrast: 1.05, brightness: 1, scale: 16, edgeDepth: 22, domeStrength: 0.35 },
  /* The sheet runs a deliberately stronger lens than the hero: it is modal, it
     appears one at a time over dimmed content, so a heavier displacement costs
     nothing at 60fps and is the one place Apple explicitly sanctions the
     material ("Modal views like sheets and action sheets adopt Liquid Glass").
     Stepped up from scale 18 / edgeDepth 26 / dome 0.3, following the much
     harder displacement in the reference lens study. */
  sheet: { blur: 28, saturate: 1.8, contrast: 1, brightness: 1, scale: 34, edgeDepth: 36, domeStrength: 0.42 },
}

const MAP_LONG_SIDE = 320
const CACHE_LIMIT = 24
const mapCache = new Map()

// erf(x) ≈ tanh(√π·x): cheap, smooth, monotone — plenty for an edge feather.
const ERF_K = Math.sqrt(Math.PI)
const erf = (x) => Math.tanh(ERF_K * x)

// Mean of the dome gradient x/√(R²−x²) over [0, halfExtent] has the closed
// form (R − √(R²−H²)) / H — normalizes the spherical-cap profile to mean 0.5.
const domeGradientMean = (radius, halfExtent) =>
  halfExtent > 0 ? (radius - Math.sqrt(radius * radius - halfExtent * halfExtent)) / halfExtent : 0

const computeDomeConstants = (capDepth, halfW, halfH) => {
  // Spherical-cap radius from chord half-width a and cap height h: R = (a²+h²)/2h.
  const cap = Math.max(0.01, Math.min(capDepth, Math.min(halfW, halfH) - 1))
  const rx = (halfW * halfW + cap * cap) / (2 * cap)
  const ry = (halfH * halfH + cap * cap) / (2 * cap)
  const meanX = domeGradientMean(rx, halfW)
  const meanY = domeGradientMean(ry, halfH)
  return {
    rx,
    ry,
    scaleX: meanX > 0 ? 0.5 / meanX : 1,
    scaleY: meanY > 0 ? 0.5 / meanY : 1,
  }
}

const domeGradient = (distance, radius, scale) => {
  // Hold the sample just inside the radius so the √ stays real at the rim.
  const inside = Math.min(distance, radius * (1 - 1e-3))
  return (inside / Math.sqrt(radius * radius - inside * inside)) * scale
}

const roundedRectSdf = (qx, qy, radius) =>
  Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius

const clampSigned = (value) => Math.max(-0.5, Math.min(0.5, value))

// Pooled toward the bottom-right exactly like GlassNav's lens — deliberately
// kept OFF the top-left corner where section labels sit (contrast rule).
const specularAt = (nx, ny, edge) => Math.min(1, Math.max(0, (nx + ny + 1.2) / 2.2)) * edge

export function createGlassMap(width, height, radius, { edgeDepth = 20, domeStrength = 0.3 } = {}) {
  const w = Math.max(2, Math.round(width))
  const h = Math.max(2, Math.round(height))
  const r = Math.max(0, Math.round(radius))
  const key = `${w}x${h}x${r}x${edgeDepth}x${domeStrength}`
  const cached = mapCache.get(key)
  if (cached) return cached

  // Raster capped like GlassNav's lens map; even dimensions so quadrant
  // mirroring tiles exactly (an odd size would leave the centre line unwritten).
  const rasterScale = Math.min(1, MAP_LONG_SIDE / Math.max(w, h))
  const mapW = Math.max(2, 2 * Math.round((w * rasterScale) / 2))
  const mapH = Math.max(2, 2 * Math.round((h * rasterScale) / 2))

  const canvas = document.createElement('canvas')
  canvas.width = mapW
  canvas.height = mapH
  const context = canvas.getContext('2d')
  if (!context) return { url: '', mapW, mapH }

  const image = context.createImageData(mapW, mapH)
  const pixels = image.data
  const halfW = w / 2
  const halfH = h / 2
  const minHalf = Math.min(halfW, halfH)
  const shapeRadius = Math.min(r, minHalf)
  const depthPx = Math.max(2, Math.min(edgeDepth, minHalf - 1))
  const innerHalfW = Math.max(0, halfW - depthPx)
  const innerHalfH = Math.max(0, halfH - depthPx)
  const innerRadius = Math.max(0, Math.min(shapeRadius, Math.min(innerHalfW, innerHalfH)))
  // The erf feather spans ~depthPx; 1/√2 absorbs the erf scale.
  const falloff = Math.SQRT1_2 / depthPx
  const dome = domeStrength > 0 ? computeDomeConstants(domeStrength * minHalf, halfW, halfH) : null
  const stepX = w / mapW
  const stepY = h / mapH

  // Only the top-left quadrant is computed; the other three are written by
  // reflecting the displacement signs (and the specular's quadrant normals).
  for (let row = 0; row < mapH / 2; row += 1) {
    const mirrorRow = mapH - 1 - row
    const py = halfH - (row + 0.5) * stepY
    const edgeY = py - halfH + shapeRadius
    const innerEdgeY = py - innerHalfH + innerRadius
    const uy = Math.min(1, py / halfH)
    const domeDy = dome ? domeGradient(py, dome.ry, dome.scaleY) * domeStrength : 0
    for (let col = 0; col < mapW / 2; col += 1) {
      const mirrorCol = mapW - 1 - col
      const px = halfW - (col + 0.5) * stepX
      const edgeX = px - halfW + shapeRadius
      const i00 = (row * mapW + col) * 4
      const i01 = (row * mapW + mirrorCol) * 4
      const i10 = (mirrorRow * mapW + col) * 4
      const i11 = (mirrorRow * mapW + mirrorCol) * 4

      if (roundedRectSdf(edgeX, edgeY, shapeRadius) >= 0) {
        for (const index of [i00, i01, i10, i11]) {
          pixels[index] = 128
          pixels[index + 1] = 128
          pixels[index + 2] = 128
          pixels[index + 3] = 255
        }
        continue
      }

      const innerEdgeX = px - innerHalfW + innerRadius
      const edge = 0.5 * (1 + erf(roundedRectSdf(innerEdgeX, innerEdgeY, innerRadius) * falloff))
      const ux = Math.min(1, px / halfW)
      const domeDx = dome ? domeGradient(px, dome.rx, dome.scaleX) * domeStrength : 0
      const dx = clampSigned(0.46 * ux * edge + domeDx)
      const dy = clampSigned(0.46 * uy * edge + domeDy)

      const rPos = Math.round((0.5 + dx) * 255)
      const rNeg = Math.round((0.5 - dx) * 255)
      const gPos = Math.round((0.5 + dy) * 255)
      const gNeg = Math.round((0.5 - dy) * 255)
      const specTL = Math.round((0.5 + 0.48 * specularAt(-ux, -uy, edge)) * 255)
      const specTR = Math.round((0.5 + 0.48 * specularAt(ux, -uy, edge)) * 255)
      const specBL = Math.round((0.5 + 0.48 * specularAt(-ux, uy, edge)) * 255)
      const specBR = Math.round((0.5 + 0.48 * specularAt(ux, uy, edge)) * 255)

      pixels[i00] = rPos
      pixels[i00 + 1] = gPos
      pixels[i00 + 2] = specTL
      pixels[i00 + 3] = 255
      pixels[i01] = rNeg
      pixels[i01 + 1] = gPos
      pixels[i01 + 2] = specTR
      pixels[i01 + 3] = 255
      pixels[i10] = rPos
      pixels[i10 + 1] = gNeg
      pixels[i10 + 2] = specBL
      pixels[i10 + 3] = 255
      pixels[i11] = rNeg
      pixels[i11 + 1] = gNeg
      pixels[i11 + 2] = specBR
      pixels[i11 + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  const result = { url: canvas.toDataURL('image/png'), mapW, mapH }
  if (mapCache.size >= CACHE_LIMIT) mapCache.delete(mapCache.keys().next().value)
  mapCache.set(key, result)
  return result
}

let supportMemo = null

/* `backdrop-filter: url()` parses in Safari/Firefox but only renders in Blink,
   so a CSS.supports() pass alone is not enough — callers must keep today's
   stock CSS anywhere this returns false. */
export function supportsRefraction() {
  if (supportMemo !== null) return supportMemo
  if (
    !REFRACTION_ENABLED ||
    typeof document === 'undefined' ||
    typeof CSS === 'undefined' ||
    document.documentElement.dataset.refract === 'off' ||
    new URLSearchParams(window.location.search).get('refract') === 'off'
  ) {
    supportMemo = false
    return supportMemo
  }
  const parses =
    CSS.supports('backdrop-filter', 'url(#x)') || CSS.supports('-webkit-backdrop-filter', 'url(#x)')
  const brands = navigator.userAgentData?.brands
  const isBlink = brands
    ? brands.some((brand) => /Chromium/i.test(brand.brand))
    : /Chrom(e|ium)\//.test(navigator.userAgent)
  supportMemo = parses && isBlink
  return supportMemo
}

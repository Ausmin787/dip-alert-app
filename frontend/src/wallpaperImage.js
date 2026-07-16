/**
 * Baked wallpaper bitmap for the refraction filters (useLiquidGlass.jsx).
 *
 * The LIVE wallpaper DOM (.wallpaper/.ribbons/.glow inside #phone-shell) and
 * the actual CSS rules that style it are serialized into an SVG foreignObject
 * (the html-to-image technique), rasterized ONCE per shell size into a
 * pre-blurred half-resolution PNG, and shared by every refractive surface via
 * feImage. This keeps the refraction pixel-true to the real design with no
 * hand-maintained replica, and makes filter re-runs (e.g. re-showing a hidden
 * tab) cheap card-sized passes over a cached bitmap — live DOM clones per
 * surface cost ~100ms per tab entrance, and vector feImage sources are
 * re-rasterized by Blink on every filter application (~550ms once).
 *
 * Chromium-only, like the refraction itself (supportsRefraction() gates all
 * callers): foreignObject-in-<img> and ctx.filter are both fine there.
 * Grain is omitted — noise is invisible after blur + displacement.
 */

/* The wallpaper is drawn MARGIN px beyond the shell on every side so the baked
   blur's transparent-edge falloff stays outside any surface that touches the
   shell edge. */
export const WALLPAPER_MARGIN = 40

const BAKED_BLUR_PX = 14 // Gaussian σ ≈ the card recipe's blur(28px)

/* Rasterized at half resolution — after the baked blur and the surface scrims
   above it the upscale is invisible, and it keeps the PNG cheap to decode. */
const RASTER_SCALE = 0.5

const cache = new Map()

const wallpaperCssText = () => {
  let css = ''
  for (const sheet of document.styleSheets) {
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      continue // cross-origin sheet — none of ours
    }
    for (const rule of rules) {
      if (rule.selectorText && /\.(wallpaper|ribbons|glow)\b/.test(rule.selectorText)) {
        css += rule.cssText + '\n'
      }
    }
  }
  return css
}

export function getWallpaperBitmap(shellW, shellH) {
  const key = `${shellW}x${shellH}`
  const hit = cache.get(key)
  if (hit) return hit

  const promise = new Promise((resolve, reject) => {
    const shell = document.getElementById('phone-shell')
    const wallpaper = shell?.querySelector('.wallpaper')
    const ribbons = shell?.querySelector('.ribbons')
    const glow = shell?.querySelector('.glow')
    if (!wallpaper || !ribbons || !glow) {
      reject(new Error('wallpaper layers not mounted'))
      return
    }
    const m = WALLPAPER_MARGIN
    const w = shellW + m * 2
    const h = shellH + m * 2
    // The inner div recreates the shell's containing block so the layers'
    // inset/percentage geometry resolves exactly as in the live DOM; z-index:0
    // contains their negative z-indexes.
    const html =
      `<div xmlns="http://www.w3.org/1999/xhtml" style="position:fixed;inset:0;background:#03176f">` +
      `<style>${wallpaperCssText()}</style>` +
      `<div style="position:absolute;left:${m}px;top:${m}px;width:${shellW}px;height:${shellH}px;z-index:0">` +
      wallpaper.outerHTML + ribbons.outerHTML + glow.outerHTML +
      `</div></div>`
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<foreignObject width="100%" height="100%">${html}</foreignObject></svg>`

    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(2, Math.round(w * RASTER_SCALE))
        canvas.height = Math.max(2, Math.round(h * RASTER_SCALE))
        const context = canvas.getContext('2d')
        context.filter = `blur(${BAKED_BLUR_PX * RASTER_SCALE}px)`
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => reject(new Error('wallpaper snapshot failed to load'))
    image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`
  })
  promise.catch(() => cache.delete(key)) // don't cache failures
  if (cache.size >= 4) cache.delete(cache.keys().next().value)
  cache.set(key, promise)
  return promise
}

// Writes the displacement maps behind the tab bar's refraction, as the two PNGs in
// public/. They are files rather than data: URIs because the CSP's img-src is 'self'.
// Run with `npm run glass-maps`; print-out is the MAX_SHIFT that TabBar.jsx needs.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const IOR = 1.5
const SCALE = 2
const MAX_SHIFT = 14 // CSS px. Past this the rim stops reading as glass and starts reading as a glitch.

const surface = (x) => (1 - (1 - x) ** 4) ** 0.25

function sdf(px, py, w, h, r) {
  const qx = Math.abs(px - w / 2) - w / 2 + r
  const qy = Math.abs(py - h / 2) - h / 2 + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/* Each pixel stores where its view ray lands, from the rim's slope and Snell's law.
   128 is "no shift"; the rim reads from further inside the shape. */
function buildMap({ w, h, r, bezel, thick }) {
  const W = w * SCALE, H = h * SCALE
  const rows = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1)
    for (let x = 0; x < W; x++) {
      const px = (x + 0.5) / SCALE, py = (y + 0.5) / SCALE
      const d = -sdf(px, py, w, h, r)
      let dx = 0, dy = 0
      if (d > 0 && d < bezel) {
        const gx = sdf(px + 0.5, py, w, h, r) - sdf(px - 0.5, py, w, h, r)
        const gy = sdf(px, py + 0.5, w, h, r) - sdf(px, py - 0.5, w, h, r)
        const len = Math.hypot(gx, gy) || 1
        const t = Math.max(0.03, d / bezel)
        const slope = ((surface(Math.min(1, t + 0.01)) - surface(t)) / 0.01) * (thick / bezel)
        const theta = Math.atan(slope)
        const shift = Math.min(MAX_SHIFT, surface(t) * thick * Math.tan(theta - Math.asin(Math.sin(theta) / IOR)))
        dx = (-gx / len) * shift
        dy = (-gy / len) * shift
      }
      const i = row + 1 + x * 3
      rows[i] = Math.round(127.5 + (dx / MAX_SHIFT) * 127.5)
      rows[i + 1] = Math.round(127.5 + (dy / MAX_SHIFT) * 127.5)
      rows[i + 2] = 128
    }
  }
  return encodePng(W, H, rows)
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

function encodePng(w, h, rows) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const root = new URL('../public/', import.meta.url)
writeFileSync(new URL('glass-bar.png', root), buildMap({ w: 320, h: 62, r: 31, bezel: 13, thick: 26 }))
writeFileSync(new URL('glass-lens.png', root), buildMap({ w: 104, h: 54, r: 27, bezel: 8, thick: 15 }))
console.log(`MAX_SHIFT ${MAX_SHIFT}`)

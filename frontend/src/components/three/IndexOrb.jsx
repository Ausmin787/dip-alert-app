import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'

const COUNT = 2600

/* Even point distribution on a unit sphere (fibonacci lattice). */
function fibonacciSphere(n) {
  const pos = new Float32Array(n * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    pos[i * 3] = Math.cos(theta) * r
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = Math.sin(theta) * r
  }
  return pos
}

const hexFor = (dropPct) =>
  dropPct == null || dropPct < 1 ? '#2FE6A3' : dropPct < 3 ? '#F6C65B' : '#FF5E6C'

/* Soft round sprite so points read as glowing dots, not squares. */
function makeSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Cloud({ dropPct, level }) {
  const pointsRef = useRef(null)
  const geoRef = useRef(null)
  const base = useMemo(() => fibonacciSphere(COUNT), [])
  const positions = useMemo(() => base.slice(), [base])
  const sprite = useMemo(() => makeSprite(), [])
  const wave = useRef({ front: -2, amp: 0 })
  const prevLevel = useRef(level)
  const { pointer } = useThree()

  const target = useMemo(() => new THREE.Color(hexFor(dropPct)), [dropPct])

  // A new dip level crossing sends a ripple traveling down the sphere.
  useEffect(() => {
    if (level > prevLevel.current) {
      gsap.killTweensOf(wave.current)
      wave.current.front = 1.25
      wave.current.amp = 0.42
      gsap.to(wave.current, { front: -1.25, duration: 1.3, ease: 'power2.out' })
      gsap.to(wave.current, { amp: 0, duration: 1.5, ease: 'power2.in' })
    }
    prevLevel.current = level
  }, [level])

  useFrame((_, dt) => {
    const p = pointsRef.current
    const geo = geoRef.current
    if (!p || !geo) return

    p.rotation.y += dt * 0.1
    p.rotation.x += (pointer.y * 0.3 - p.rotation.x) * 0.04
    p.position.x += (pointer.x * 0.12 - p.position.x) * 0.04

    const arr = geo.attributes.position.array
    const { front, amp } = wave.current
    const rippling = amp > 0.001
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const by = base[ix + 1]
      let s = 1
      if (rippling) {
        const d = by - front
        s = 1 + amp * Math.exp(-(d * d) / 0.015)
      }
      arr[ix] = base[ix] * s
      arr[ix + 1] = by * s
      arr[ix + 2] = base[ix + 2] * s
    }
    geo.attributes.position.needsUpdate = true

    p.material.color.lerp(target, 0.05)
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        map={sprite}
        alphaMap={sprite}
        color={hexFor(dropPct)}
        transparent
        opacity={0.92}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

/* Rotating point-cloud "index orb" — recolors mint→amber→coral with the live
   drawdown and ripples a shockwave each time a deeper dip level is crossed.
   Reduced motion → renders a single static frame (frameloop="never"). */
export default function IndexOrb({ dropPct, level = 0, reduced = false, className }) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 3], fov: 45 }}
        frameloop={reduced ? 'never' : 'always'}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Cloud dropPct={dropPct} level={level} />
      </Canvas>
    </div>
  )
}

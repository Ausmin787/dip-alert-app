import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from './useReducedMotion.js'

gsap.registerPlugin(ScrollTrigger)

/* Scroll-driven entrance: fades + lifts a block into view once.
   Reduced motion → renders in its natural state, no tween. */
export function Reveal({ children, className, y = 24, delay = 0 }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    if (reduced || !ref.current) return undefined
    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        opacity: 0,
        y,
        duration: 0.7,
        delay,
        ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 90%', once: true },
      })
    }, ref)
    return () => ctx.revert()
  }, [reduced, y, delay])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

/* Count-up numeral: rolls from the previous value to the new one. */
export function CountUp({ value, format = (v) => v, className }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (value == null || reduced) {
      prev.current = value
      return undefined
    }
    const obj = { v: prev.current ?? value }
    prev.current = value
    const tween = gsap.to(obj, {
      v: value,
      duration: 0.9,
      ease: 'power3.out',
      onUpdate: () => setDisplay(obj.v),
    })
    return () => tween.kill()
  }, [value, reduced])

  if (value == null) return <span className={className}>—</span>
  const shown = reduced ? value : (display ?? value)
  return <span className={className}>{format(shown)}</span>
}

/* Headline reveal: words rise out of a clipped baseline, staggered. */
export function SplitReveal({ text, className, delay = 0 }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const words = String(text).split(' ')

  useLayoutEffect(() => {
    if (reduced || !ref.current) return undefined
    const targets = ref.current.querySelectorAll('[data-word]')
    const ctx = gsap.context(() => {
      gsap.from(targets, {
        yPercent: 115,
        duration: 0.85,
        delay,
        ease: 'power4.out',
        stagger: 0.07,
      })
    }, ref)
    return () => ctx.revert()
  }, [reduced, text, delay])

  return (
    <span ref={ref} className={className}>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}
        >
          <span data-word style={{ display: 'inline-block' }}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </span>
  )
}

/* Magnetic wrapper: pulls its child toward the cursor on hover. */
export function Magnetic({ children, strength = 0.35, className }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  const onMove = (e) => {
    if (reduced || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    gsap.to(ref.current, {
      x: (e.clientX - (r.left + r.width / 2)) * strength,
      y: (e.clientY - (r.top + r.height / 2)) * strength,
      duration: 0.4,
      ease: 'power3.out',
    })
  }
  const onLeave = () => {
    if (ref.current) gsap.to(ref.current, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ display: 'inline-flex' }}
    >
      {children}
    </div>
  )
}

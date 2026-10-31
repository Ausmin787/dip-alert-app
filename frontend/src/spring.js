/* Apple's two-parameter spring (WWDC18, Designing Fluid Interfaces): damping
   ratio controls overshoot, response is how quickly the value reaches its target
   in seconds. Damping 1.0 is the house default; use ~0.8 only when the gesture
   itself carried momentum (a flick), never on something that just faded in.

   A spring has no duration, so it can always be retargeted: `to()` keeps the live
   value and velocity, which is what makes every animation here interruptible and
   free of the visible jump a CSS transition or tween makes when redirected. */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const SUBSTEP = 1 / 240 // Fixed step keeps the integrator stable on slow frames.

export function stepSpring(state, target, { damping, response }, dt) {
  const omega = (2 * Math.PI) / response
  const accel = -omega * omega * (state.x - target) - 2 * damping * omega * state.v
  state.v += accel * dt
  state.x += state.v * dt
}

/* `precision` is the resting tolerance in the value's own units: 0.1 suits pixels,
   0.001 suits a 0..1 progress. */
export function createSpring(initial, onUpdate, precision = 0.1) {
  const state = { x: initial, v: 0 }
  let target = initial
  let params = { damping: 1, response: 0.4 }
  let raf = 0
  let last = 0
  let onRest = null

  const tick = (now) => {
    let remaining = Math.min((now - last) / 1000, 1 / 20)
    last = now
    while (remaining > 0) {
      const dt = Math.min(remaining, SUBSTEP)
      stepSpring(state, target, params, dt)
      remaining -= dt
    }
    if (Math.abs(state.v) < precision * 10 && Math.abs(state.x - target) < precision) {
      state.x = target
      state.v = 0
      raf = 0
      onUpdate(state.x)
      const done = onRest
      onRest = null
      done?.()
      return
    }
    onUpdate(state.x)
    raf = requestAnimationFrame(tick)
  }

  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    onRest = null
  }

  return {
    get value() { return state.x },
    get velocity() { return state.v },
    // 1:1 tracking: the value follows the pointer and nothing is animating.
    set(value) {
      stop()
      state.x = value
      state.v = 0
      target = value
      onUpdate(value)
    },
    /** @param {number} nextTarget @param {{ damping?: number, response?: number, velocity?: number, done?: () => void }} [options] */
    to(nextTarget, { damping = 1, response = 0.4, velocity, done } = {}) {
      target = nextTarget
      params = { damping, response }
      if (velocity !== undefined) state.v = velocity
      onRest = done ?? null
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    },
    stop,
  }
}

/* Where a flick would come to rest. Apple's exponential-decay form from the
   Designing Fluid Interfaces sample code, not the textbook v²/2a. */
export const project = (velocity, decelerationRate = 0.998) =>
  ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)

// Progressive resistance past a boundary: real things slow before they stop.
export const rubberband = (overshoot, dimension, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))

/* Release velocity from the last ~100 ms of a drag, in units per second. The
   current point alone can't give it, and a single stale sample overstates it. */
export function createVelocityTracker() {
  const samples = []
  return {
    push(value, time) {
      samples.push({ value, time })
      while (samples.length > 2 && time - samples[0].time > 100) samples.shift()
    },
    velocity() {
      if (samples.length < 2) return 0
      const first = samples[0]
      const latest = samples[samples.length - 1]
      const dt = (latest.time - first.time) / 1000
      return dt > 0 ? (latest.value - first.value) / dt : 0
    },
  }
}

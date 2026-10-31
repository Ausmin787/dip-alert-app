import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createSpring, createVelocityTracker, prefersReducedMotion, project, rubberband } from './spring.js'

const HYSTERESIS = 10 // px before a touch commits to dragging the sheet.

/* A sheet you can hold. Everything runs off one spring on the sheet's y offset, so
   it can be grabbed mid-flight and reversed, and a release carries the finger's
   velocity into the animation with no seam.

   Dragging starts from the grabber, or from the content when it is scrolled to the
   top and the finger moves down. That handoff is why touch events are used here
   instead of pointer events, which the browser cancels as soon as it starts a pan.
   A horizontal first move belongs to the chart inside and is left alone. */
function SheetBody({ open, onClose, onExited, label, variant, children }) {
  const sheetRef = useRef(null)
  const dimRef = useRef(null)
  const grabRef = useRef(null)
  const scrollRef = useRef(null)
  const springRef = useRef(null)
  const heightRef = useRef(0)
  const wasOpenRef = useRef(false)
  const releaseVelocity = useRef(null)
  const onCloseRef = useRef(onClose)
  const openRef = useRef(open)
  useEffect(() => {
    onCloseRef.current = onClose
    openRef.current = open
  }, [onClose, open])

  useLayoutEffect(() => {
    const sheet = sheetRef.current
    const dim = dimRef.current
    const stage = document.getElementById('stage')
    const scroller = scrollRef.current
    const grab = grabRef.current
    const pushesStage = () => stage && variant === 'page' && window.innerWidth < 600

    /* The parent stage recedes with progress, but only behind a full-width page sheet.
       Behind a centred form sheet it stays put and only the dim changes. Progress is
       direct, so the background tracks the finger 1:1 through a drag as well. */
    const paint = (y) => {
      sheet.style.transform = `translate3d(0, ${y}px, 0)`
      const progress = Math.min(1, Math.max(0, 1 - y / (heightRef.current || 1)))
      dim.style.opacity = progress
      if (pushesStage()) {
        stage.style.transform = `scale(${1 - progress * 0.06})`
        stage.style.borderRadius = `${progress * 26}px`
      }
    }

    const measure = () => {
      const top = sheet.getBoundingClientRect().top - new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42
      heightRef.current = window.innerHeight - top
    }
    measure()
    // Half a pixel of rest tolerance: a critically damped spring creeps for a long time
    // over its last fraction of a pixel, and the app behind stays inert until it ends.
    const spring = createSpring(heightRef.current, paint, 0.5)
    springRef.current = spring
    paint(heightRef.current)

    let drag = null

    const beginDrag = (x, y, fromGrabber) => {
      drag = {
        startX: x,
        startY: y,
        fromGrabber,
        active: false,
        rejected: false,
        originY: 0,
        base: 0,
        tracker: createVelocityTracker(),
      }
    }

    const engage = (y) => {
      drag.active = true
      drag.originY = y
      drag.base = spring.value
      spring.stop()
    }

    const trackDrag = (y) => {
      const raw = drag.base + (y - drag.originY)
      const next = raw < 0 ? rubberband(raw, heightRef.current) : raw
      spring.set(next)
      drag.tracker.push(next, performance.now())
    }

    const endDrag = () => {
      const ended = drag
      drag = null
      if (!ended?.active) return
      const velocity = ended.tracker.velocity()
      /* Decide from where the flick would land, not where the finger let go, so a
         fast short swipe dismisses and a slow long one can still settle back. */
      const landing = spring.value + project(velocity)
      if (landing > heightRef.current * 0.4 && velocity >= -50) {
        releaseVelocity.current = velocity
        onCloseRef.current()
        // The owner may decline, to confirm unsaved edits first (HIG Sheets). A sheet
        // that was let go must not stay stranded halfway down the screen behind that.
        setTimeout(() => {
          if (openRef.current) {
            releaseVelocity.current = null
            spring.to(0, { damping: 1, response: 0.36 })
          }
        }, 0)
      } else {
        spring.to(0, { damping: Math.abs(velocity) > 400 ? 0.8 : 1, response: 0.36, velocity })
      }
    }

    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      beginDrag(touch.clientX, touch.clientY, grab.contains(event.target))
    }

    const onTouchMove = (event) => {
      if (!drag || drag.rejected) return
      const touch = event.touches[0]
      if (!drag.active) {
        const dx = touch.clientX - drag.startX
        const dy = touch.clientY - drag.startY
        if (Math.hypot(dx, dy) < HYSTERESIS) return
        const atTop = scroller.scrollTop <= 0
        const claimable = drag.fromGrabber || (atTop && dy > 0)
        if (Math.abs(dx) > Math.abs(dy) || !claimable || !event.cancelable) {
          drag.rejected = true
          return
        }
        engage(touch.clientY)
      }
      event.preventDefault()
      trackDrag(touch.clientY)
    }

    // Mouse and pen get the same physics through the grabber.
    const onGrabDown = (event) => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      grab.setPointerCapture(event.pointerId)
      beginDrag(event.clientX, event.clientY, true)
      engage(event.clientY)
    }
    const onGrabMove = (event) => {
      if (event.pointerType !== 'touch' && drag?.active) trackDrag(event.clientY)
    }
    const onGrabUp = (event) => {
      if (event.pointerType !== 'touch') endDrag()
    }

    // Attached by hand: React registers touchmove as passive, so it can't preventDefault.
    sheet.addEventListener('touchstart', onTouchStart, { passive: true })
    sheet.addEventListener('touchmove', onTouchMove, { passive: false })
    sheet.addEventListener('touchend', endDrag)
    sheet.addEventListener('touchcancel', endDrag)
    grab.addEventListener('pointerdown', onGrabDown)
    grab.addEventListener('pointermove', onGrabMove)
    grab.addEventListener('pointerup', onGrabUp)
    grab.addEventListener('pointercancel', onGrabUp)
    window.addEventListener('resize', measure)

    return () => {
      spring.stop()
      sheet.removeEventListener('touchstart', onTouchStart)
      sheet.removeEventListener('touchmove', onTouchMove)
      sheet.removeEventListener('touchend', endDrag)
      sheet.removeEventListener('touchcancel', endDrag)
      grab.removeEventListener('pointerdown', onGrabDown)
      grab.removeEventListener('pointermove', onGrabMove)
      grab.removeEventListener('pointerup', onGrabUp)
      grab.removeEventListener('pointercancel', onGrabUp)
      window.removeEventListener('resize', measure)
      if (stage && variant === 'page') {
        stage.style.transform = ''
        stage.style.borderRadius = ''
      }
    }
  }, [variant])

  useEffect(() => {
    const spring = springRef.current
    const sheet = sheetRef.current
    if (open) {
      wasOpenRef.current = true
      if (prefersReducedMotion()) {
        spring.set(0)
        sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' })
      } else {
        spring.to(0, { damping: 1, response: 0.42 })
      }
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      if (prefersReducedMotion()) {
        sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease' }).onfinish = onExited
      } else {
        spring.to(heightRef.current, {
          damping: 1,
          response: 0.36,
          velocity: releaseVelocity.current ?? undefined,
          done: onExited,
        })
        releaseVelocity.current = null
      }
    }
  }, [open, onExited])

  // Focus moves in on open, returns on close, and everything behind goes inert.
  useEffect(() => {
    const previous = /** @type {HTMLElement | null} */ (document.activeElement)
    const root = document.getElementById('root')
    // A field inside may already hold focus (the desktop form's first input).
    if (!sheetRef.current.contains(document.activeElement)) sheetRef.current.focus({ preventScroll: true })
    root?.setAttribute('inert', '')
    return () => {
      root?.removeAttribute('inert')
      previous?.focus?.({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className="sheet-root">
      <div className="sheet-dim" ref={dimRef} onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        ref={sheetRef}
        data-variant={variant}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className="sheet-grab" ref={grabRef}>
          <i />
        </div>
        <div className="sheet-scroll" ref={scrollRef} data-scroller>
          {children}
        </div>
      </div>
    </div>
  )
}

/* Stays mounted through the exit so the spring can finish, and through a re-open
   mid-exit so it can reverse from wherever it is on screen. */
export default function Sheet({ open, onClose, label, variant = 'page', children }) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const onExited = useCallback(() => setMounted(false), [])
  if (!mounted) return null
  return createPortal(
    <SheetBody open={open} onClose={onClose} onExited={onExited} label={label} variant={variant}>
      {children}
    </SheetBody>,
    document.body,
  )
}

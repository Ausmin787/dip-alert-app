import { useEffect, useRef, useState } from 'react'
import { animate, motion } from 'motion/react'

/* Route-level transition wrapper */
export function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/* Staggered entrance for panels/cards */
export function Reveal({ delay = 0, className, children }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/* Count-up numeral: rolls from the previous value to the new one */
export function AnimatedNumber({ value, format = (v) => v, className }) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(null)

  useEffect(() => {
    if (value == null) return undefined
    const from = prev.current ?? value * 0.992
    prev.current = value
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [value])

  if (value == null) return <span className={className}>—</span>
  return <span className={className}>{format(display ?? value)}</span>
}

import { motion } from 'motion/react'

/* Route-level transition wrapper. Content entrances + micro-interactions live in
   anim.jsx (GSAP); this only handles the page swap via AnimatePresence in App.jsx. */
export function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

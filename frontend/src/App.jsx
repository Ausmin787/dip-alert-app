import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import Dashboard from './pages/Dashboard.jsx'
import Watchlist from './pages/Watchlist.jsx'
import Alerts from './pages/Alerts.jsx'
import Settings from './pages/Settings.jsx'
import { Page } from './components/motion.jsx'
import { IconBell, IconChevronDown, IconDip, IconGear, IconGrid, IconLayers } from './components/icons.jsx'
import { isMarketOpenIST, istClock } from './lib.js'

const navItems = [
  { to: '/', label: 'Overview', icon: IconGrid },
  { to: '/watchlist', label: 'Watchlist', icon: IconLayers },
  { to: '/alerts', label: 'Alerts', icon: IconBell },
  { to: '/settings', label: 'Settings', icon: IconGear },
]

const isActivePath = (to, path) => (to === '/' ? path === '/' : path.startsWith(to))

function MarketChip() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const open = isMarketOpenIST(now)
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.62rem] font-semibold tracking-[0.1em] whitespace-nowrap uppercase ${
          open
            ? 'bg-mint/10 text-mint ring-1 ring-mint/25'
            : 'bg-surface-2 text-ink-muted ring-1 ring-hairline'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${open ? 'live-dot bg-mint' : 'bg-ink-muted/60'}`} />
        {open ? 'NSE live' : 'NSE closed'}
      </span>
      <span className="num hidden whitespace-nowrap text-xs text-ink-muted sm:inline">
        {istClock(now)} IST
      </span>
    </div>
  )
}

function BrandGlyph() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet to-magenta text-ink shadow-[0_8px_24px_-8px_rgba(45,125,255,0.8)]">
      <IconDip className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} />
    </span>
  )
}

/* Horizontal pill links with a sliding active indicator (full-bar mode). */
function InlineLinks() {
  return (
    <div className="flex items-center gap-1">
      {navItems.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === '/'}>
          {({ isActive }) => (
            <span
              className={`relative flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="island-active"
                  className="absolute inset-0 rounded-full border border-hairline bg-surface-2"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative">{label}</span>
            </span>
          )}
        </NavLink>
      ))}
    </div>
  )
}

/* The Dynamic Island: a full bar that springs into a compact floating pill on
   scroll (or on narrow screens). The compact pill opens a popover menu. */
function IslandNav() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const update = () => {
      const s = window.scrollY > 24
      const n = window.innerWidth < 1024
      setScrolled(s)
      setNarrow(n)
      if (!s && !n) setOpen(false) // expanded back to the full bar — drop the menu
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const compact = scrolled || narrow
  const active = navItems.find((n) => isActivePath(n.to, location.pathname)) ?? navItems[0]
  const ActiveIcon = active.icon

  return (
    <nav className="fixed top-4 left-1/2 z-50 -translate-x-1/2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        className="flex items-center gap-3 rounded-full border border-hairline bg-surface-1/75 px-3 py-2 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
      >
        {!compact ? (
          <motion.div
            key="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-5 pr-1 pl-1"
          >
            <div className="flex items-center gap-2.5">
              <BrandGlyph />
              <span className="display text-base leading-none font-bold tracking-tight whitespace-nowrap text-ink">
                Dip Alert
              </span>
            </div>
            <InlineLinks />
            <MarketChip />
          </motion.div>
        ) : (
          <motion.button
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-full pr-2 pl-1"
            aria-label="Toggle navigation menu"
            aria-expanded={open}
          >
            <BrandGlyph />
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ActiveIcon className="h-4 w-4 text-violet" />
              {active.label}
            </span>
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
              <IconChevronDown className="h-4 w-4 text-ink-muted" />
            </motion.span>
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence>
        {compact && open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute top-[calc(100%+0.6rem)] left-1/2 w-64 -translate-x-1/2 rounded-2xl border border-hairline bg-surface-1/95 p-2 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.95)] backdrop-blur-xl"
          >
            {navItems.map(({ to, label, icon: Icon }, i) => {
              const isActive = isActivePath(to, location.pathname)
              return (
                <motion.div
                  key={to}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-surface-2 text-ink ring-1 ring-hairline'
                        : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    <Icon className={`h-[1.1rem] w-[1.1rem] ${isActive ? 'text-violet' : ''}`} />
                    {label}
                  </NavLink>
                </motion.div>
              )
            })}
            <div className="mt-1 flex justify-center border-t border-hairline px-3 pt-3 pb-1">
              <MarketChip />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <MotionConfig reducedMotion="user">
      <div className="backdrop-grid" />
      <div className="backdrop-glow" />

      <IslandNav />

      <main className="mx-auto max-w-6xl px-5 pt-28 pb-20 sm:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Page><Dashboard /></Page>} />
            <Route path="/watchlist" element={<Page><Watchlist /></Page>} />
            <Route path="/alerts" element={<Page><Alerts /></Page>} />
            <Route path="/settings" element={<Page><Settings /></Page>} />
          </Routes>
        </AnimatePresence>
      </main>
    </MotionConfig>
  )
}

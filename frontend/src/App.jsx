import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import Dashboard from './pages/Dashboard.jsx'
import Watchlist from './pages/Watchlist.jsx'
import Alerts from './pages/Alerts.jsx'
import Settings from './pages/Settings.jsx'
import { Page } from './components/motion.jsx'
import { IconBell, IconDip, IconGear, IconGrid, IconLayers } from './components/icons.jsx'
import { isMarketOpenIST, istClock } from './lib.js'

const navItems = [
  { to: '/', label: 'Overview', icon: IconGrid },
  { to: '/watchlist', label: 'Watchlist', icon: IconLayers },
  { to: '/alerts', label: 'Alerts', icon: IconBell },
  { to: '/settings', label: 'Settings', icon: IconGear },
]

function MarketChip() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const open = isMarketOpenIST(now)
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.14em] uppercase ring-1 ${
          open ? 'bg-mint/10 text-mint ring-mint/25' : 'bg-white/4 text-mist ring-white/10'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${open ? 'live-dot bg-mint' : 'bg-mist/60'}`} />
        {open ? 'NSE live' : 'NSE closed'}
      </span>
      <span className="num hidden text-xs text-mist sm:inline">{istClock(now)} IST</span>
    </div>
  )
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pulse to-flux text-abyss shadow-[0_6px_20px_-6px_rgba(110,107,255,0.8)]">
        <IconDip className="h-5 w-5" strokeWidth={2} />
      </span>
      {!compact && (
        <span className="font-display text-lg leading-none font-semibold tracking-tight text-frost">
          Dip Alert
          <span className="tag mt-1 block text-[0.55rem] tracking-[0.28em] text-mist">
            ATH terminal
          </span>
        </span>
      )}
    </div>
  )
}

function SideNav() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/6 bg-abyss/70 backdrop-blur-xl lg:flex">
      <div className="px-6 pt-7 pb-8">
        <Brand />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <span
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive ? 'text-frost' : 'text-mist hover:bg-white/4 hover:text-frost'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="side-active"
                    className="absolute inset-0 rounded-xl border border-pulse/30 bg-pulse/10 shadow-[0_0_24px_-8px_rgba(110,107,255,0.6)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <Icon className={`relative h-[1.1rem] w-[1.1rem] ${isActive ? 'text-pulse' : ''}`} />
                <span className="relative">{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-6 pb-7">
        <p className="tag text-[0.55rem] leading-relaxed">
          single-user terminal
          <br />
          buy the dip · ₹1L per −1%
        </p>
      </div>
    </aside>
  )
}

function TabBar() {
  return (
    <nav
      className="fixed left-1/2 z-50 -translate-x-1/2 lg:hidden"
      style={{ bottom: 'calc(0.9rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-1 rounded-2xl border border-white/8 bg-pane-2/85 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} aria-label={label}>
            {({ isActive }) => (
              <span
                className={`relative flex h-11 w-14 items-center justify-center rounded-xl transition-colors duration-200 ${
                  isActive ? 'text-abyss' : 'text-mist'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-pulse to-flux shadow-[0_6px_18px_-4px_rgba(110,107,255,0.7)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative h-[1.2rem] w-[1.2rem]" strokeWidth={isActive ? 2 : 1.6} />
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <MotionConfig reducedMotion="user">
      <div className="backdrop-grid" />
      <div className="backdrop-glow" />

      <SideNav />

      <div className="lg:pl-60">
        <header
          className="sticky top-0 z-30 bg-abyss/70 backdrop-blur-xl"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
            <div className="lg:hidden">
              <Brand />
            </div>
            <p className="tag hidden lg:block">NSE · Nifty drawdown monitor</p>
            <MarketChip />
          </div>
          <div className="horizon" />
        </header>

        <main className="mx-auto max-w-6xl px-5 pt-8 pb-32 sm:px-8 lg:pb-16">
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Page><Dashboard /></Page>} />
              <Route path="/watchlist" element={<Page><Watchlist /></Page>} />
              <Route path="/alerts" element={<Page><Alerts /></Page>} />
              <Route path="/settings" element={<Page><Settings /></Page>} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>

      <TabBar />
    </MotionConfig>
  )
}

import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import Dashboard from './pages/Dashboard.jsx'
import Watchlist from './pages/Watchlist.jsx'
import Alerts from './pages/Alerts.jsx'
import Settings from './pages/Settings.jsx'
import { Page } from './components/motion.jsx'
import { IconBell, IconChevronDown, IconDip, IconGear, IconGrid, IconLayers } from './components/icons.jsx'
import { isMarketOpenIST, istClock, fmtPrice, fmtLevel, severity } from './lib.js'
import { AssetProvider, useAssets } from './AssetContext.jsx'
import Sparkline from './components/Sparkline.jsx'

const navItems = [
  { to: '/', label: 'Overview', icon: IconGrid },
  { to: '/watchlist', label: 'Watchlist', icon: IconLayers },
  { to: '/alerts', label: 'Alerts', icon: IconBell },
  { to: '/settings', label: 'Settings', icon: IconGear },
]

const isActivePath = (to, path) => (to === '/' ? path === '/' : path.startsWith(to))

function BrandGlyph() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet to-magenta text-ink shadow-[0_8px_24px_-8px_rgba(45,125,255,0.8)]">
      <IconDip className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} />
    </span>
  )
}

function SidebarMarketChip({ expanded }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const open = isMarketOpenIST(now)

  if (!expanded) {
    return (
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 border border-hairline cursor-help"
        title={open ? 'NSE Live Market Open' : 'NSE Market Closed'}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${open ? 'live-dot bg-mint' : 'bg-ink-muted/50'}`} />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-2 w-full px-1"
    >
      <div
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.62rem] font-semibold tracking-[0.1em] uppercase ${
          open
            ? 'bg-mint/10 text-mint ring-1 ring-mint/25'
            : 'bg-surface-2 text-ink-muted ring-1 ring-hairline'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${open ? 'live-dot bg-mint' : 'bg-ink-muted/60'}`} />
        <span className="whitespace-nowrap text-xs">{open ? 'NSE live' : 'NSE closed'}</span>
      </div>
      <span className="num text-center text-xs text-ink-muted whitespace-nowrap">
        {istClock(now)} IST
      </span>
    </motion.div>
  )
}

function SidebarDock() {
  const location = useLocation()
  const [hovered, setHovered] = useState(false)
  const expanded = hovered

  return (
    <motion.aside
      className="sidebar-dock hidden sm:flex flex-col justify-between py-6 px-3"
      animate={{ width: expanded ? 200 : 64 }}
      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top Section: Brand Logo */}
      <div className="flex flex-col gap-8 w-full">
        <div className="flex items-center gap-3 px-1">
          <BrandGlyph />
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="display text-base font-bold tracking-tight text-ink whitespace-nowrap"
            >
              Dip Alert
            </motion.span>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col gap-1.5 w-full">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = isActivePath(to, location.pathname)
            return (
              <NavLink key={to} to={to} end={to === '/'} className="relative block">
                {({ isActive }) => (
                  <span
                    className={`flex items-center gap-3.5 rounded-xl py-3 px-3.5 text-sm font-medium transition-colors w-full cursor-pointer relative ${
                      isActive ? 'text-ink font-semibold' : 'text-ink-muted hover:text-ink hover:bg-surface-2/40'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl bg-surface-2 border border-hairline"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <span className="relative z-10 shrink-0">
                      <Icon className={`h-[1.1rem] w-[1.1rem] ${isActive ? 'text-violet' : ''}`} />
                    </span>
                    {expanded && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative z-10 whitespace-nowrap"
                      >
                        {label}
                      </motion.span>
                    )}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      </div>

      {/* Bottom Section: Market Ticker */}
      <div className="w-full border-t border-hairline/60 pt-4 flex flex-col items-center">
        <SidebarMarketChip expanded={expanded} />
      </div>
    </motion.aside>
  )
}

function BottomNav() {
  const location = useLocation()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const open = isMarketOpenIST(now)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-hairline bg-surface-1/90 px-4 pb-safe-bottom backdrop-blur-lg sm:hidden justify-around items-center">
      {navItems.map(({ to, label, icon: Icon }) => {
        const isActive = isActivePath(to, location.pathname)
        return (
          <NavLink key={to} to={to} className="flex flex-col items-center justify-center gap-1.5 px-3 py-1" end={to === '/'}>
            <span className={`relative flex items-center justify-center text-ink-muted ${isActive ? 'text-violet' : ''}`}>
              <Icon className="h-[1.2rem] w-[1.2rem]" />
            </span>
            <span className={`text-[0.62rem] font-semibold tracking-wide ${isActive ? 'text-ink' : 'text-ink-muted'}`}>
              {label}
            </span>
          </NavLink>
        )
      })}
      
      {/* Compact status marker on mobile bottom nav */}
      <div className="flex flex-col items-center justify-center px-3">
        <span className={`h-2.5 w-2.5 rounded-full ${open ? 'live-dot bg-mint' : 'bg-ink-muted/50'}`} />
        <span className="text-[0.55rem] font-semibold text-ink-muted mt-1 uppercase tracking-wider">Live</span>
      </div>
    </nav>
  )
}

function FeedHeader() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const open = isMarketOpenIST(now)

  return (
    <div className="mb-4 flex flex-col gap-2 border-b border-hairline/60 pb-3">
      <div className="flex items-center justify-between">
        <span className="display text-lg font-bold tracking-tight text-ink">Watchlist</span>
        <div className="flex items-center gap-1.5 rounded-full bg-surface-2/60 px-2.5 py-0.5 border border-hairline/50 text-[0.62rem] font-semibold text-ink-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${open ? 'live-dot bg-mint' : 'bg-ink-muted/50'}`} />
          <span>{open ? 'NSE Live' : 'NSE Closed'}</span>
        </div>
      </div>
      <div className="flex justify-between items-center text-[0.65rem] text-ink-muted">
        <span className="num">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <span className="num">{istClock(now)} IST</span>
      </div>
    </div>
  )
}

function AppContent() {
  const location = useLocation()
  const { items, selectedAsset, setSelectedAsset, histories, loading, error } = useAssets()

  return (
    <MotionConfig reducedMotion="user">
      <div className="backdrop-grid" />
      <div className="backdrop-glow" />

      <div className="app-container">
        {/* Left Side Dock */}
        <SidebarDock />

        {/* Middle Feed Column */}
        <div className="middle-feed-pane border-r border-hairline p-5 hidden md:flex flex-col h-full overflow-hidden">
          <FeedHeader />
          
          <div className="flex-grow overflow-y-auto pr-1 space-y-2.5 scrollbar-none pb-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-xs text-ink-muted">
                Loading watchlist...
              </div>
            ) : error ? (
              <div className="text-xs text-coral border border-coral/30 rounded-xl bg-coral/5 p-3 leading-relaxed">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-xs text-ink-muted text-center leading-relaxed">
                No assets in watchlist.<br />Add one in Watchlist tab.
              </div>
            ) : (
              items.map((item) => {
                const isSelected = selectedAsset === item.ticker
                const sev = severity(item.drop_pct)
                const closes = (histories[item.ticker] || []).map((d) => d.close)

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedAsset(item.ticker)}
                    className={`w-full text-left rounded-xl border p-3.5 transition-all outline-none cursor-pointer flex flex-col gap-3.5 ${
                      isSelected
                        ? 'bg-surface-2 border-accent/60 shadow-[0_4px_20px_-8px_rgba(45,125,255,0.3)]'
                        : 'bg-surface-2/20 border-hairline hover:bg-surface-2/50 hover:border-hairline/80'
                    }`}
                  >
                    {/* Top row: Ticker & Status Badge */}
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="min-w-0">
                        <span className={`num font-semibold text-xs transition-colors ${isSelected ? 'text-accent' : 'text-ink-muted'}`}>
                          {item.ticker}
                        </span>
                        <h3 className="text-[0.85rem] font-bold text-ink mt-0.5 line-clamp-1">
                          {item.display_name}
                        </h3>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.55rem] font-semibold tracking-[0.05em] uppercase ${sev.chip}`}>
                        {item.active ? (item.drop_pct < 1 ? 'Calm' : sev.label) : 'Paused'}
                      </span>
                    </div>

                    {/* Middle row: Closes Sparkline */}
                    <div className="h-10 w-full flex items-center justify-center overflow-hidden">
                      {closes.length > 1 ? (
                        <Sparkline data={closes} stroke={item.active ? sev.bar : '#8A97A6'} width={240} height={40} />
                      ) : (
                        <span className="text-[0.62rem] text-ink-muted">No historical data</span>
                      )}
                    </div>

                    {/* Bottom row: Prices and drawdowns */}
                    <div className="flex items-end justify-between w-full border-t border-hairline/30 pt-2 text-xs">
                      <div>
                        <span className="text-[0.6rem] uppercase tracking-wider text-ink-muted">Price</span>
                        <p className="num text-[0.85rem] font-bold text-ink mt-0.5">
                          {fmtPrice(item.current_price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[0.6rem] uppercase tracking-wider text-ink-muted">Drawdown</span>
                        <p className={`num text-[0.85rem] font-bold mt-0.5 ${sev.text}`}>
                          {item.drop_pct != null ? `−${item.drop_pct.toFixed(2)}%` : '—'}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Main Workspace Frame */}
        <main className="workspace-pane pb-16 sm:pb-0">
          <div className="flex-grow p-5 md:p-8 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Page><Dashboard /></Page>} />
                <Route path="/watchlist" element={<Page><Watchlist /></Page>} />
                <Route path="/alerts" element={<Page><Alerts /></Page>} />
                <Route path="/settings" element={<Page><Settings /></Page>} />
              </Routes>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Bottom Nav Bar on Mobile */}
      <BottomNav />
    </MotionConfig>
  )
}

export default function App() {
  return (
    <AssetProvider>
      <AppContent />
    </AssetProvider>
  )
}

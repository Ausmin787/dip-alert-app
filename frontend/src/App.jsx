import { NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Watchlist from './pages/Watchlist.jsx'
import Alerts from './pages/Alerts.jsx'
import Settings from './pages/Settings.jsx'
import { IconBell, IconGauge, IconGear, IconList } from './components/icons.jsx'

const navItems = [
  { to: '/', label: 'Home', icon: IconGauge },
  { to: '/watchlist', label: 'Watchlist', icon: IconList },
  { to: '/alerts', label: 'Alerts', icon: IconBell },
  { to: '/settings', label: 'Settings', icon: IconGear },
]

export default function App() {
  return (
    <div className="min-h-dvh">
      <div className="aurora">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
      </div>
      <div className="grain" />

      <header
        className="mx-auto flex max-w-5xl items-center justify-between px-5 sm:px-6"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
      >
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[1.4rem] font-light italic tracking-tight text-fog">
            Dip Alert
          </span>
          <span className="hidden text-[0.65rem] font-light tracking-[0.2em] text-fog-dim uppercase sm:inline">
            Nifty ATH tracker
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-6 pb-36 sm:px-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* Floating glass dock, iOS-style */}
      <nav
        className="fixed left-1/2 z-50 -translate-x-1/2"
        style={{ bottom: 'calc(1.1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="glass-strong flex items-center gap-1.5 rounded-full p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label}
              className={({ isActive }) =>
                `pressable flex h-12 items-center justify-center gap-2 rounded-full transition-all duration-300 sm:px-5 ${
                  isActive
                    ? 'w-12 bg-moss text-ink shadow-[0_0_24px_-4px_rgba(163,233,116,0.7)] sm:w-auto'
                    : 'w-12 text-fog-dim hover:bg-white/10 hover:text-fog sm:w-auto'
                }`
              }
            >
              <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
              <span className="hidden text-sm font-medium sm:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

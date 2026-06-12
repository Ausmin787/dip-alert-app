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
    <div className="min-h-screen">
      <div className="ambient" />
      <div className="grain" />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-light italic tracking-tight text-fog">
            Dip Alert
          </span>
          <span className="hidden text-xs font-light tracking-widest text-fog-dim uppercase sm:inline">
            Nifty ATH tracker
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-8 pb-32">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* Floating pill nav, Huxe-style */}
      <nav className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
        <div className="glass-deep flex items-center gap-1 rounded-full p-1.5 shadow-2xl shadow-black/60">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-all duration-300 ${
                  isActive
                    ? 'bg-moss/90 font-medium text-ink'
                    : 'text-fog-dim hover:bg-white/8 hover:text-fog'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

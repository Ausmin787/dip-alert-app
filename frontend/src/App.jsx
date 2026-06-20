import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AssetProvider } from './AssetContext.jsx'
import { isMarketOpenIST } from './lib.js'
import WatchTab from './tabs/WatchTab.jsx'
import AlertsTab from './tabs/AlertsTab.jsx'
import HistoryTab from './tabs/HistoryTab.jsx'
import ManageTab from './tabs/ManageTab.jsx'

const TABS = [
  { id: 'watch', label: 'Watch', icon: IconWatch },
  { id: 'alerts', label: 'Alerts', icon: IconBell },
  { id: 'history', label: 'History', icon: IconHistory },
  { id: 'manage', label: 'Manage', icon: IconSliders },
]

function IconWatch(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
function IconBell(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
function IconHistory(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  )
}
function IconSliders(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}

function StatusBar() {
  const [clock, setClock] = useState(() => fmtClock())
  useEffect(() => {
    const id = setInterval(() => setClock(fmtClock()), 10000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="sbar">
      <span>{clock}</span>
      <div className="sbar-r">
        <div className="sig"><i /><i /><i /><i /></div>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 2.5c1.9 0 3.6.8 4.8 2.1l1.4-1.4A8.5 8.5 0 0 0 8 .5 8.5 8.5 0 0 0 1.8 3.2l1.4 1.4A6 6 0 0 1 8 2.5z" fill="rgba(255,255,255,.68)" />
          <path d="M8 5.5c1.1 0 2.1.5 2.8 1.2l1.4-1.4A5 5 0 0 0 8 3.5a5 5 0 0 0-4.2 1.8l1.4 1.4A3 3 0 0 1 8 5.5z" fill="rgba(255,255,255,.68)" />
          <circle cx="8" cy="10" r="1.5" fill="rgba(255,255,255,.68)" />
        </svg>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.62)' }}>97%</span>
      </div>
    </div>
  )
}

function fmtClock() {
  const d = new Date()
  let h = d.getHours()
  const m = d.getMinutes()
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}

function AppHeader() {
  const [open, setOpen] = useState(() => isMarketOpenIST())
  useEffect(() => {
    const id = setInterval(() => setOpen(isMarketOpenIST()), 30000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="aheader">
      <div className="aname">Dip Alert</div>
      <div className={`live-chip ${open ? '' : 'closed'}`}>
        <div className="live-dot" />
        {open ? 'Live' : 'Closed'}
      </div>
    </div>
  )
}

// Decorative sky wallpaper behind the glass cards (Liquid Glass design).
function Wallpaper() {
  return (
    <>
      <div className="wallpaper" />
      <svg className="ribbons" viewBox="0 0 820 980" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="ribbonA" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#edf8ff" />
            <stop offset=".28" stopColor="#7fc7e8" />
            <stop offset=".62" stopColor="#095fe0" />
            <stop offset="1" stopColor="#04166f" />
          </linearGradient>
          <linearGradient id="ribbonB" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#f7f4d6" stopOpacity=".9" />
            <stop offset=".52" stopColor="#2f9cdc" stopOpacity=".88" />
            <stop offset="1" stopColor="#0630b8" stopOpacity=".82" />
          </linearGradient>
          <filter id="softGlass" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.8" />
          </filter>
        </defs>
        <path d="M-76 398C104 250 202 183 346 244c118 50 169 163 298 150 94-10 145-84 227-172v162c-112 101-225 149-352 85-141-72-198-128-328-52C91 476 9 563-76 626Z" fill="url(#ribbonA)" opacity=".92" />
        <path d="M-104 538C76 426 208 376 370 431c138 47 208 148 338 109 80-24 120-86 188-157v224c-99 70-210 115-336 65-174-69-251-104-381-25C74 711-3 778-104 817Z" fill="url(#ribbonB)" opacity=".88" filter="url(#softGlass)" />
        <path d="M-48 354C150 244 291 185 437 196c142 11 210 78 338 6" fill="none" stroke="#f8fbef" strokeOpacity=".65" strokeWidth="5" />
        <path d="M-54 708C96 601 217 538 363 551c128 12 222 96 393 12" fill="none" stroke="#eaf8ff" strokeOpacity=".34" strokeWidth="4" />
        <path d="M196 94c110 52 178 132 181 244 3 105-62 180-162 219" fill="none" stroke="#0444bd" strokeOpacity=".44" strokeWidth="18" />
      </svg>
      <div className="grain" />
      <div className="glow" />
    </>
  )
}

// Edge-concentrated lens displacement map for the nav's Liquid Glass refraction.
// Generated once into a canvas data-URL; the SVG filter it feeds isn't wired to
// any element's `filter` yet — same dormant state as the Liquid Glass source.
function NavLensFilter() {
  useEffect(() => {
    const W = 128
    const H = 32
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    const imageData = ctx.createImageData(W, H)
    const d = imageData.data
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        const nx = (x / (W - 1)) * 2 - 1
        const ny = (y / (H - 1)) * 2 - 1
        const sx = (nx < 0 ? -1 : 1) * Math.abs(nx) ** 3
        const sy = (ny < 0 ? -1 : 1) * Math.abs(ny) ** 3
        d[i] = Math.round(((sx + 1) / 2) * 255)
        d[i + 1] = Math.round(((sy + 1) / 2) * 255)
        d[i + 2] = 0
        d[i + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
    document.getElementById('nav-dmap')?.setAttribute('href', canvas.toDataURL())
  }, [])

  return (
    <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <defs>
        <filter id="nav-lq" x="-6%" y="-28%" width="112%" height="156%" colorInterpolationFilters="sRGBLinear">
          <feImage id="nav-dmap" preserveAspectRatio="none" result="dmap" />
          <feDisplacementMap in="SourceGraphic" in2="dmap" scale="32" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}

function BottomNav({ tab, setTab }) {
  const navRef = useRef(null)
  const btnRefs = useRef({})
  const [indicator, setIndicator] = useState(null)

  useLayoutEffect(() => {
    const measure = () => {
      const nav = navRef.current
      const btn = btnRefs.current[tab]
      if (!nav || !btn) return
      const navRect = nav.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      setIndicator({ width: btnRect.width, x: btnRect.left - navRect.left - 8 })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [tab])

  return (
    <nav className="nav" ref={navRef} aria-label="Primary">
      <div
        className={`nav-indicator ${indicator ? 'ready' : ''}`}
        style={indicator ? { width: indicator.width, transform: `translateX(${indicator.x}px)` } : undefined}
        aria-hidden="true"
      />
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          ref={(el) => { btnRefs.current[id] = el }}
          className={tab === id ? 'active' : ''}
          type="button"
          onClick={() => setTab(id)}
        >
          <Icon />
          {label}
        </button>
      ))}
    </nav>
  )
}

function AppShell() {
  const [tab, setTab] = useState('watch')
  return (
    <div className="wrap" id="phone-shell">
      <Wallpaper />
      <div className="app">
        <StatusBar />
        <AppHeader />
        <div className="panels">
          {tab === 'watch' && <WatchTab />}
          {tab === 'alerts' && <AlertsTab onManage={() => setTab('manage')} />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'manage' && <ManageTab />}
        </div>
        <div className="nav-scrim" aria-hidden="true" />
        <BottomNav tab={tab} setTab={setTab} />
      </div>
      <NavLensFilter />
    </div>
  )
}

export default function App() {
  return (
    <AssetProvider>
      <AppShell />
    </AssetProvider>
  )
}

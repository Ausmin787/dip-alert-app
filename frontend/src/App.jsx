import { useEffect, useState } from 'react'
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

function AppShell() {
  const [tab, setTab] = useState('watch')
  return (
    <div className="wrap" id="phone-shell">
      <div className="atmo" />
      <div className="app">
        <StatusBar />
        <AppHeader />
        <div className="panels">
          {tab === 'watch' && <WatchTab />}
          {tab === 'alerts' && <AlertsTab onManage={() => setTab('manage')} />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'manage' && <ManageTab />}
        </div>
        <nav className="bnav">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`bni ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      </div>
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

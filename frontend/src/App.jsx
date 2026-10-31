import { useState } from 'react'
import { AssetProvider } from './AssetContext.jsx'
import { ToastProvider, ToastViewport } from './Toast.jsx'
import { ConfirmProvider, ConfirmViewport } from './ConfirmDialog.jsx'
import TabBar, { Sidebar } from './TabBar.jsx'
import WatchlistTab from './tabs/WatchlistTab.jsx'
import AlertsTab from './tabs/AlertsTab.jsx'
import SettingsTab from './tabs/SettingsTab.jsx'
import { useAssets } from './useAssets.js'
import { useSizeClass } from './hooks.js'

function AppShell() {
  const [tab, setTab] = useState('watchlist')
  const { unseenAlerts } = useAssets()
  const size = useSizeClass()
  const regular = size === 'regular'
  const tabs = [
    { id: 'watchlist', label: 'Watchlist', icon: 'chart' },
    { id: 'alerts', label: 'Alerts', icon: 'bell', badge: tab === 'alerts' ? 0 : unseenAlerts },
    { id: 'settings', label: 'Settings', icon: 'gear' },
  ]

  /* All panels stay mounted and hidden tabs go inert: each keeps its scroll position
     and data, and switching is instant, with no remount flash (HIG Tab bars: preserve
     the navigation state within each section). */
  const panel = (id, content) => (
    <section className={`panel ${tab === id ? 'active' : ''}`} inert={tab !== id}>
      {content}
    </section>
  )

  return (
    <div className="app" data-size={size}>
      {regular && <Sidebar tabs={tabs} active={tab} onSelect={setTab} />}
      {/* The stage is what recedes behind a page sheet. The tab bar lives inside it, so
          a sheet covers the bar, and the bar is never left floating over a modal. */}
      <main className="stage" id="stage">
        {panel('watchlist', (
          <WatchlistTab active={tab === 'watchlist'} regular={regular} onOpenSettings={() => setTab('settings')} />
        ))}
        {panel('alerts', <AlertsTab active={tab === 'alerts'} />)}
        {panel('settings', <SettingsTab active={tab === 'settings'} />)}
        {!regular && (
          <>
            <div className="tab-edge" aria-hidden="true" />
            <TabBar tabs={tabs} active={tab} onSelect={setTab} />
          </>
        )}
      </main>
      <ToastViewport />
      <ConfirmViewport />
    </div>
  )
}

export default function App() {
  return (
    <AssetProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppShell />
        </ConfirmProvider>
      </ToastProvider>
    </AssetProvider>
  )
}

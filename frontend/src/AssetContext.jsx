import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAlerts, getHistory, getStatus } from './api'
import { AssetContext } from './useAssets.js'
import { SPARK_DAYS } from './lib.js'

const HISTORY_TTL_MS = 5 * 60_000
const SPARK_TTL_MS = 15 * 60_000
const SEEN_KEY = 'alerts_seen_at'

/* Global asset state: polls /api/status and /api/alerts every 60 s. Price history
   is fetched on demand and cached per ticker and period; sparklines refresh on a
   slow 15-minute cadence, because polling history on every status tick is the Yahoo
   traffic this module exists to avoid. */
export function AssetProvider({ children }) {
  const [items, setItems] = useState([])
  const [selectedAsset, setSelectedAssetState] = useState(
    () => localStorage.getItem('selected_asset') || '',
  )
  const [histories, setHistories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Client-side: /api/status carries no server timestamp (prices are fetched
  // live per request), so freshness is measured from the successful response.
  const [lastUpdated, setLastUpdated] = useState(null)
  // Display-only USD->INR spot from /api/status; null when Yahoo didn't return
  // one, in which case the rupee lines are omitted rather than guessed.
  const [usdInr, setUsdInr] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [alertsError, setAlertsError] = useState(null)
  const [seenAt, setSeenAt] = useState(() => {
    const stored = localStorage.getItem(SEEN_KEY)
    if (stored) return stored
    const now = new Date().toISOString()
    localStorage.setItem(SEEN_KEY, now)
    return now
  })

  const selectedRef = useRef(selectedAsset)
  const statusInFlight = useRef(false)
  const historyMeta = useRef({}) // key -> { at, inFlight }

  const setSelectedAsset = useCallback((ticker) => {
    selectedRef.current = ticker
    setSelectedAssetState(ticker)
    localStorage.setItem('selected_asset', ticker)
  }, [])

  const loadData = useCallback(async () => {
    if (statusInFlight.current) return
    statusInFlight.current = true
    try {
      const data = await getStatus()
      const fetched = data?.items || []
      setItems(fetched)
      setUsdInr(data?.usd_inr ?? null)
      setError(null)
      setLastUpdated(Date.now())

      // Auto-select the first asset only when nothing valid is selected. Reads
      // selectedRef (not a stale closure), so a poll never snaps the user's own
      // selection back to the first asset.
      const current = selectedRef.current
      if (!current || !fetched.some((i) => i.ticker === current)) {
        const firstActive = fetched.find((i) => i.active) ?? fetched[0]
        if (firstActive) setSelectedAsset(firstActive.ticker)
      }
    } catch (err) {
      console.error('Failed to load asset status', err)
      setError('The price server isn’t responding. Check that it’s running, then try again.')
    } finally {
      statusInFlight.current = false
      setLoading(false)
    }
  }, [setSelectedAsset])

  const loadAlerts = useCallback(
    () => getAlerts(1, 100)
      .then((d) => {
        setAlerts(d.alerts)
        setAlertsError(null)
      })
      .catch((err) => {
        console.error('Failed to load alerts', err)
        setAlertsError('Alert history isn’t available right now. The server may be down.')
      }),
    [],
  )

  /* A loaded key is simply reused until `ttl` passes, so a chart and a sparkline
     asking for the same period share one request. */
  const ensureHistory = useCallback((ticker, days, ttl = HISTORY_TTL_MS) => {
    const key = `${ticker}|${days}`
    const meta = historyMeta.current[key]
    if (meta?.inFlight || (meta?.at && Date.now() - meta.at < ttl)) return
    historyMeta.current[key] = { ...meta, inFlight: true }
    getHistory(ticker, days)
      .then((data) => {
        historyMeta.current[key] = { at: Date.now(), inFlight: false }
        setHistories((prev) => ({ ...prev, [key]: data }))
      })
      .catch((err) => {
        historyMeta.current[key] = { ...historyMeta.current[key], inFlight: false }
        console.error(`Failed to fetch history for ${ticker}`, err)
      })
  }, [])

  const historyFor = useCallback((ticker, days) => histories[`${ticker}|${days}`], [histories])

  /* Public refresh (retry buttons, post-mutation reloads): marks cached history
     stale, so recovering from an outage doesn't leave charts empty for minutes. */
  const refresh = useCallback(async () => {
    historyMeta.current = {}
    await Promise.all([loadData(), loadAlerts()])
  }, [loadData, loadAlerts])

  useEffect(() => {
    // Fetch on mount + 60s poll. Both only setState after their awaits (async
    // continuations, never a synchronous cascade), so this is safe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
    loadAlerts()
    const interval = setInterval(() => {
      loadData()
      loadAlerts()
    }, 60_000)
    return () => clearInterval(interval)
  }, [loadData, loadAlerts])

  const tickerKey = items.map((i) => i.ticker).join(',')
  useEffect(() => {
    if (!tickerKey) return undefined
    const tickers = tickerKey.split(',')
    const loadSparks = () => tickers.forEach((t) => ensureHistory(t, SPARK_DAYS, SPARK_TTL_MS))
    loadSparks()
    const interval = setInterval(loadSparks, SPARK_TTL_MS)
    return () => clearInterval(interval)
  }, [tickerKey, ensureHistory])

  const markAlertsSeen = useCallback(() => {
    const now = new Date().toISOString()
    localStorage.setItem(SEEN_KEY, now)
    setSeenAt(now)
  }, [])

  /* Badge only what arrived since the Alerts tab was last open (HIG Tab bars:
     reserve badges for critical information). A first run starts its baseline at
     now, so it can't greet someone with "100". */
  const unseenAlerts = useMemo(() => {
    if (!alerts) return 0
    const seen = Date.parse(seenAt)
    return alerts.filter((a) => Date.parse(`${a.alerted_at}${a.alerted_at.endsWith('Z') ? '' : 'Z'}`) > seen).length
  }, [alerts, seenAt])

  const selectedItem = items.find((i) => i.ticker === selectedAsset)

  return (
    <AssetContext.Provider
      value={{
        items,
        selectedAsset,
        setSelectedAsset,
        selectedItem,
        historyFor,
        ensureHistory,
        loading,
        error,
        lastUpdated,
        usdInr,
        alerts,
        alertsError,
        unseenAlerts,
        markAlertsSeen,
        refresh,
      }}
    >
      {children}
    </AssetContext.Provider>
  )
}

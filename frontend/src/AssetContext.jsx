import { useCallback, useEffect, useRef, useState } from 'react'
import { getStatus, getHistory } from './api'
import { AssetContext } from './useAssets.js'

/* Global asset state: fetches /api/status + 30-day histories for every
   watchlist asset, persists the selected ticker in localStorage, and exposes a
   refresh() the Watchlist CRUD calls to update the feed instantly. */
export function AssetProvider({ children }) {
  const [items, setItems] = useState([])
  const [selectedAsset, setSelectedAssetState] = useState(
    () => localStorage.getItem('selected_asset') || '',
  )
  const [histories, setHistories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Live mirrors of state so the 60s poll reads the current values, not a stale
  // closure captured when the effect was created.
  const selectedRef = useRef(selectedAsset)
  const historiesRef = useRef(histories)
  useEffect(() => {
    historiesRef.current = histories
  }, [histories])

  const setSelectedAsset = useCallback((ticker) => {
    selectedRef.current = ticker
    setSelectedAssetState(ticker)
    localStorage.setItem('selected_asset', ticker)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const data = await getStatus()
      const fetched = data?.items || []
      setItems(fetched)
      setError(null)

      // Auto-select the first asset only when nothing valid is selected. Reads
      // selectedRef (not a stale closure), so a poll never snaps the user's own
      // selection back to the first asset.
      const current = selectedRef.current
      if (!current || !fetched.some((i) => i.ticker === current)) {
        const firstActive = fetched.find((i) => i.active) ?? fetched[0]
        if (firstActive) setSelectedAsset(firstActive.ticker)
      }

      const results = await Promise.all(
        fetched.map(async (item) => {
          try {
            return { ticker: item.ticker, data: await getHistory(item.ticker, 30) }
          } catch (err) {
            console.error(`Failed to fetch history for ${item.ticker}`, err)
            return { ticker: item.ticker, data: [] }
          }
        }),
      )
      setHistories(Object.fromEntries(results.map((r) => [r.ticker, r.data])))
    } catch (err) {
      console.error('Failed to load asset status', err)
      setError('Backend unreachable — is the API server running?')
    } finally {
      setLoading(false)
    }
  }, [setSelectedAsset])

  useEffect(() => {
    // Fetch on mount + 60s poll. loadData only setStates after its awaits
    // (async continuations, never a synchronous cascade), so this is safe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
    const interval = setInterval(loadData, 60_000)
    return () => clearInterval(interval)
  }, [loadData])

  // Backfill history for the selected asset if a poll hasn't covered it yet.
  useEffect(() => {
    if (selectedAsset && !historiesRef.current[selectedAsset]) {
      getHistory(selectedAsset, 30)
        .then((data) => setHistories((prev) => ({ ...prev, [selectedAsset]: data })))
        .catch(() => {})
    }
  }, [selectedAsset])

  const selectedItem = items.find((i) => i.ticker === selectedAsset)
  const selectedHistory = histories[selectedAsset] || []

  return (
    <AssetContext.Provider
      value={{
        items,
        selectedAsset,
        setSelectedAsset,
        selectedItem,
        history: selectedHistory,
        histories,
        loading,
        error,
        refresh: loadData,
      }}
    >
      {children}
    </AssetContext.Provider>
  )
}

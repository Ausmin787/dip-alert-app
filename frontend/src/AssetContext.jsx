import { useCallback, useEffect, useRef, useState } from 'react'
import { getStatus, getHistory } from './api'
import { AssetContext } from './useAssets.js'

/* Global asset state: polls /api/status every 60 s and fetches 30-day history
   only for the selected asset, with a separate five-minute refresh cadence. */
export function AssetProvider({ children }) {
  const [items, setItems] = useState([])
  const [selectedAsset, setSelectedAssetState] = useState(
    () => localStorage.getItem('selected_asset') || '',
  )
  const [histories, setHistories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const selectedRef = useRef(selectedAsset)
  const statusInFlight = useRef(false)

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
      setError(null)

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
      setError('Backend unreachable — is the API server running?')
    } finally {
      statusInFlight.current = false
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

  // Market history is displayed only for the selected asset. Fetching every
  // watchlist history on every status poll multiplied Yahoo traffic without
  // changing anything visible in the UI.
  useEffect(() => {
    if (!selectedAsset) return undefined
    let cancelled = false
    const loadHistory = () => getHistory(selectedAsset, 30)
      .then((data) => {
        if (!cancelled) setHistories((prev) => ({ ...prev, [selectedAsset]: data }))
      })
      .catch((err) => console.error(`Failed to fetch history for ${selectedAsset}`, err))
    loadHistory()
    const interval = setInterval(loadHistory, 5 * 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
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

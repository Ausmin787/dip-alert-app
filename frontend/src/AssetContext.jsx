import React, { createContext, useContext, useState, useEffect } from 'react'
import { getStatus, getHistory } from './api'

const AssetContext = createContext()

export function AssetProvider({ children }) {
  const [items, setItems] = useState([])
  const [selectedAsset, setSelectedAssetState] = useState(() => localStorage.getItem('selected_asset') || '')
  const [histories, setHistories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const setSelectedAsset = (ticker) => {
    setSelectedAssetState(ticker)
    localStorage.setItem('selected_asset', ticker)
    // Dispatch custom event to notify other components (like Dashboard)
    window.dispatchEvent(new Event('selected_asset_changed'))
  }

  const loadData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true)
      const data = await getStatus()
      const fetchedItems = data?.items || []
      setItems(fetchedItems)
      setError(null)

      // Auto-select first asset if none is selected or selected one doesn't exist
      let currentSelection = selectedAsset
      if (!currentSelection || !fetchedItems.some(i => i.ticker === currentSelection)) {
        const firstActive = fetchedItems.find(i => i.active) ?? fetchedItems[0]
        if (firstActive) {
          currentSelection = firstActive.ticker
          setSelectedAsset(currentSelection)
        }
      }

      // Fetch histories for all loaded items in parallel
      const historyPromises = fetchedItems.map(async (item) => {
        try {
          const hist = await getHistory(item.ticker, 30)
          return { ticker: item.ticker, data: hist }
        } catch (err) {
          console.error(`Failed to fetch history for ${item.ticker}`, err)
          return { ticker: item.ticker, data: [] }
        }
      })
      const results = await Promise.all(historyPromises)
      const newHistories = {}
      results.forEach(res => {
        newHistories[res.ticker] = res.data
      })
      setHistories(newHistories)
    } catch (err) {
      console.error('Failed to load asset status', err)
      setError('Backend unreachable — is the API server running?')
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  useEffect(() => {
    loadData(true)
    const interval = setInterval(() => loadData(false), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Refetch history for selected asset if it is missing
  useEffect(() => {
    if (selectedAsset && !histories[selectedAsset]) {
      getHistory(selectedAsset, 30)
        .then(data => {
          setHistories(prev => ({ ...prev, [selectedAsset]: data }))
        })
        .catch(() => {})
    }
  }, [selectedAsset])

  const selectedItem = items.find(i => i.ticker === selectedAsset)
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
        refresh: () => loadData(false)
      }}
    >
      {children}
    </AssetContext.Provider>
  )
}

export function useAssets() {
  const context = useContext(AssetContext)
  if (!context) {
    throw new Error('useAssets must be used within an AssetProvider')
  }
  return context
}

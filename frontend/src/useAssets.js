import { createContext, useContext } from 'react'

/* Shared in its own module so AssetContext.jsx can export only a component
   (keeps react-refresh/only-export-components happy). */
export const AssetContext = createContext(null)

export function useAssets() {
  const context = useContext(AssetContext)
  if (!context) {
    throw new Error('useAssets must be used within an AssetProvider')
  }
  return context
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fallback only. Apple devices resolve -apple-system first and never download it.
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

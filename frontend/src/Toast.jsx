import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)

const DISMISS_MS = 3200

/* App-wide action feedback. The {kind, msg} shape matches the inline
   `status-msg` state WhatsAppCard already uses, so call sites migrate as-is.
   Success is gold (--accent), not green: green means "price up" in this app and
   reusing it for "saved" would collide with the financial colours. */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  const seqRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const show = useCallback((next) => {
    clearTimer()
    seqRef.current += 1
    setToast({ ...next, id: seqRef.current })
    timerRef.current = setTimeout(() => setToast(null), DISMISS_MS)
  }, [])

  // Convenience wrappers so call sites read as prose.
  const ok = useCallback((msg) => show({ kind: 'ok', msg }), [show])
  const err = useCallback((msg) => show({ kind: 'err', msg }), [show])

  useEffect(() => clearTimer, [])

  return (
    <ToastContext.Provider value={{ toast, show, ok, err, dismiss: () => { clearTimer(); setToast(null) } }}>
      {children}
    </ToastContext.Provider>
  )
}

/* Rendered inside AppShell, not beside the provider: #phone-shell does not
   exist on the provider's first render, so a portal mounted there would find
   null. Sits at z-index 40 — above the nav, below an open sheet. */
export function ToastViewport() {
  const { toast, dismiss } = useToast()
  const host = document.getElementById('phone-shell')
  if (!host || !toast) return null

  return createPortal(
    <div className="toast-layer" aria-live="polite" aria-atomic="true">
      <button
        type="button"
        key={toast.id}
        className={`toast ${toast.kind === 'err' ? 'toast-err' : 'toast-ok'}`}
        onClick={dismiss}
      >
        <span className="toast-icon" aria-hidden="true">{toast.kind === 'err' ? '!' : '✓'}</span>
        <span className="toast-msg">{toast.msg}</span>
      </button>
    </div>,
    host,
  )
}

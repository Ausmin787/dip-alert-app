import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

const ToastContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)

const DISMISS_MS = 3200

/* App-wide action feedback, as a capsule under the top edge. The glyph carries the
   meaning as well as the colour (HIG Inclusive color: never colour alone). */
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

export function ToastViewport() {
  const { toast, dismiss } = useToast()
  if (!toast) return null

  return createPortal(
    <div className="toast-layer" aria-live="polite" aria-atomic="true">
      <button
        type="button"
        key={toast.id}
        className={`toast glass ${toast.kind === 'err' ? 'toast-err' : 'toast-ok'}`}
        onClick={dismiss}
      >
        <Icon name={toast.kind === 'err' ? 'warn' : 'check'} filled />
        <span>{toast.msg}</span>
      </button>
    </div>,
    document.body,
  )
}

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ConfirmContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => useContext(ConfirmContext)

/* A real alert, per HIG Alerts: reserved for consequences worth interrupting for,
   a title that states the situation, the cancel always titled "Cancel" on the
   leading side and never the default. The confirm button is not painted red: the
   person already chose the destructive action deliberately, so "the button performs
   the person's original intent" and red would only slow them down. */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null) // { opts, resolve } | null
  const resolveRef = useRef(null)

  const settle = useCallback((answer) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setRequest(null)
    if (resolve) resolve(answer)
  }, [])

  const confirm = useCallback((opts) => new Promise((resolve) => {
    // A second call while one is open cancels the first rather than orphaning it.
    if (resolveRef.current) resolveRef.current(false)
    resolveRef.current = resolve
    setRequest({ opts })
  }), [])

  // Never leave a caller awaiting a promise that can no longer settle.
  useEffect(() => () => {
    if (resolveRef.current) resolveRef.current(false)
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm, request, settle }}>
      {children}
    </ConfirmContext.Provider>
  )
}

export function ConfirmViewport() {
  const { request, settle } = useConfirm()

  useEffect(() => {
    if (!request) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        settle(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [request, settle])

  if (!request) return null

  const { title, body, confirmLabel = 'Confirm' } = request.opts ?? {}

  return createPortal(
    <div className="alert-root" onClick={() => settle(false)} role="presentation">
      <div
        className="alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={body ? 'confirm-body' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="t-head" id="confirm-title">{title}</h2>
        {body && <p className="t-sub c-2" id="confirm-body" style={{ marginTop: 4 }}>{body}</p>}
        <div className="alert-actions">
          <button type="button" className="btn btn-fill" onClick={() => settle(false)}>Cancel</button>
          <button type="button" className="btn btn-tinted" onClick={() => settle(true)} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

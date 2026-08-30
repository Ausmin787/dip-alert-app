import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import GlassSurface from './GlassSurface.jsx'

const ConfirmContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => useContext(ConfirmContext)

/* Replaces window.confirm, which rendered Chrome's own OS-level modal in the
   middle of the glass phone shell.

   Form follows docs/design-refs/confirm-destructive-sheet-wise.png: bottom
   sheet, question as title, one-line consequence, filled destructive button,
   outlined escape beneath it. A bottom sheet rather than a centred alert
   because AssetSheet already established that language here.

   The copy carries reassurance where the action is recoverable — the principle
   from confirm-destructive-wise.png, where Wise picks its pattern by
   reversibility rather than by house style. */
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

/* Rendered inside AppShell, not beside the provider: #phone-shell does not
   exist on the provider's first render. z-index 60 puts it above an open
   AssetSheet (50) and the toast layer (40). */
export function ConfirmViewport() {
  const { request, settle } = useConfirm()
  const host = document.getElementById('phone-shell')

  useEffect(() => {
    if (!request) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') settle(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [request, settle])

  if (!host || !request) return null

  const {
    title,
    body,
    confirmLabel = 'Confirm',
    cancelLabel = 'Go back',
    destructive = true,
  } = request.opts ?? {}

  return createPortal(
    <div className="sheet-overlay sheet-overlay-confirm" onClick={() => settle(false)} role="presentation">
      {/* GlassSurface variant="sheet" so the confirm carries the same
          refraction as AssetSheet — the tiering rule puts refraction on cards
          and sheets, and a flat confirm beside a refracted one reads as a bug. */}
      <GlassSurface
        variant="sheet"
        className="sheet sheet-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={body ? 'confirm-body' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-title" id="confirm-title">{title}</div>
        {body && <div className="confirm-body" id="confirm-body">{body}</div>}
        <div className="confirm-actions">
          <button
            type="button"
            className={`btn ${destructive ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={() => settle(true)}
            autoFocus
          >
            {confirmLabel}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => settle(false)}>
            {cancelLabel}
          </button>
        </div>
      </GlassSurface>
    </div>,
    host,
  )
}

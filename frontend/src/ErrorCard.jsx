import { useState } from 'react'

/* Error states used to be dead ends: the message rendered as bare text with no
   way forward. This gives every failure a retry.

   The busy flag matters — AssetContext.refresh() has an in-flight guard that
   makes a concurrent call resolve immediately as a no-op, so without a visible
   busy state the button can look broken when a poll happens to be running. */
export default function ErrorCard({ message, onRetry, retryLabel = 'Retry' }) {
  const [busy, setBusy] = useState(false)

  const retry = async () => {
    if (!onRetry || busy) return
    setBusy(true)
    try {
      await onRetry()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="g err-card" role="alert">
      <div className="err-title">Couldn't load</div>
      <div className="err-msg">{message}</div>
      {onRetry && (
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={retry} disabled={busy}>
            {busy ? 'Retrying…' : retryLabel}
          </button>
        </div>
      )}
    </div>
  )
}

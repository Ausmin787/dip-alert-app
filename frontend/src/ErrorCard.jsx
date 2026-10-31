import { useState } from 'react'
import Icon from './Icon.jsx'

/* HIG's "unavailable content" pattern: glyph, plain title, one sentence, and a way
   forward. Used for empty states and failures alike, so neither is a dead end. */
export function Unavailable({ icon = 'chart', title, message, action = null }) {
  return (
    <div className="unavailable">
      <div className="unavailable-glyph"><Icon name={icon} filled /></div>
      <h2 className="t-title3">{title}</h2>
      <p className="t-sub c-2">{message}</p>
      {action}
    </div>
  )
}

/* The busy flag matters: AssetContext.refresh() has an in-flight guard that makes a
   concurrent call resolve immediately as a no-op, so without a visible busy state
   the button can look broken when a poll happens to be running. */
export default function ErrorCard({ message, onRetry, title = 'Can’t Load' }) {
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
    <div role="alert">
      <Unavailable
        icon="warn"
        title={title}
        message={message}
        action={onRetry && (
          <button type="button" className="btn btn-fill" onClick={retry} disabled={busy}>
            {busy ? 'Trying…' : 'Try Again'}
          </button>
        )}
      />
    </div>
  )
}

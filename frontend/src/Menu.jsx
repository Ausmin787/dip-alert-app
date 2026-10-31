import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

const MENU_W = 250
const GAP = 8

/* A pull-down menu that springs out of the button that opened it (WWDC25: surfaces
   stay connected to their source). Items take either `onSelect` or `href`. */
export default function Menu({ label, items }) {
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return
    const b = buttonRef.current.getBoundingClientRect()
    const h = menuRef.current.offsetHeight
    const below = b.bottom + GAP + h < window.innerHeight
    setPos({
      left: Math.max(8, Math.min(b.right - MENU_W, window.innerWidth - MENU_W - 8)),
      top: below ? b.bottom + GAP : Math.max(8, b.top - GAP - h),
      origin: below ? 'top right' : 'bottom right',
    })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    menuRef.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true })
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        buttonRef.current?.focus()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      const entries = [...menuRef.current.querySelectorAll('[role="menuitem"]')]
      const at = entries.indexOf(document.activeElement)
      const step = event.key === 'ArrowDown' ? 1 : -1
      entries[(at + step + entries.length) % entries.length]?.focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  const choose = (item) => {
    setOpen(false)
    item.onSelect?.()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="gbtn glass"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="dots" filled />
      </button>
      {open && createPortal(
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={menuRef}
            className="menu"
            role="menu"
            aria-label={label}
            style={/** @type {import('react').CSSProperties} */ ({
              left: pos?.left ?? -9999,
              top: pos?.top ?? 0,
              '--menu-origin': pos?.origin,
            })}
          >
            {items.map((item, i) => {
              if (item.separator) return <div key={`sep-${i}`} className="menu-sep" role="separator" />
              const content = (
                <>
                  <span>{item.label}</span>
                  <Icon name={item.icon} />
                </>
              )
              const cls = `menu-item ${item.danger ? 'danger' : ''}`
              return item.href ? (
                <a key={item.label} className={cls} role="menuitem" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                  {content}
                </a>
              ) : (
                <button key={item.label} type="button" className={cls} role="menuitem" onClick={() => choose(item)}>
                  {content}
                </button>
              )
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

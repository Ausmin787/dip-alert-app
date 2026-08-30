import { useRef } from 'react'
import { useLiquidGlass } from './useLiquidGlass.jsx'

// className/style carry explicit defaults so checkJS treats them as optional —
// without them every call site that omits `style` reports TS2741.
export default function GlassSurface({ as = 'div', variant = 'card', className = undefined, style = undefined, children, ...props }) {
  const ref = useRef(null)
  const { defs, layer } = useLiquidGlass(ref, variant)
  const Tag = as

  return (
    <Tag ref={ref} className={className} style={style} {...props}>
      {defs}
      {layer}
      {children}
    </Tag>
  )
}

import { useRef } from 'react'
import { useLiquidGlass } from './useLiquidGlass.jsx'

export default function GlassSurface({ as = 'div', variant = 'card', className, style, children, ...props }) {
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

import { useRef, useState, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react'
import { getEntryEdge, type EdgeDirection } from '../../physics/usePointer'
import './Reveal.css'

export interface RevealProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Base layer, always visible. */
  children: ReactNode
  /** Layer wiped into view on hover. */
  overlay: ReactNode
  /** Fixed wipe direction. Defaults to 'auto', which reads the edge the cursor entered from. */
  direction?: EdgeDirection | 'auto'
  /** Wipe transition duration, in ms. */
  duration?: number
}

/**
 * Wipes `overlay` into view from whichever edge the cursor actually crossed
 * to reach the element (via clip-path inset), instead of always sliding in
 * from one fixed side — so a left-approach and a right-approach read as
 * physically distinct gestures. It wipes back out through that same edge
 * on exit, keeping entry and exit visually reversible.
 */
export function Reveal({
  children,
  overlay,
  direction = 'auto',
  duration = 450,
  style,
  className,
  onPointerEnter,
  ...rest
}: RevealProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState<EdgeDirection>('bottom')
  const [hovered, setHovered] = useState(false)

  function handlePointerEnter(event: PointerEvent<HTMLDivElement>) {
    onPointerEnter?.(event)
    if (direction === 'auto') {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setEdge(getEntryEdge(rect, event.clientX, event.clientY))
    } else {
      setEdge(direction)
    }
    setHovered(true)
  }

  return (
    <div
      ref={containerRef}
      className={className ? `ax-reveal ${className}` : 'ax-reveal'}
      data-edge={edge}
      data-hovered={hovered}
      style={{ '--reveal-duration': `${duration}ms`, ...style } as React.CSSProperties}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={() => setHovered(false)}
      {...rest}
    >
      <div className="ax-reveal__base">{children}</div>
      <div className="ax-reveal__overlay">{overlay}</div>
    </div>
  )
}

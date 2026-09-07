import { useCallback, useEffect, useRef, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react'
import './Glow.css'

export interface GlowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** CSS color for the glow, e.g. 'rgba(120,170,255,0.5)'. */
  color?: string
  /** Diameter of the glow, in px. */
  size?: number
  /** Shows the glow programmatically (e.g. a scripted demo loop), centered by default, instead of requiring real pointer hover. */
  active?: boolean
}

/**
 * A radial highlight tracks the cursor across the element. Pointer moves are
 * coalesced into at most one style write per animation frame (a ref holds
 * the latest coordinates; a single rAF flushes them), so a high-frequency
 * pointermove stream can't force more style recalculations than the
 * display can actually show.
 */
export function Glow({
  children,
  color = 'rgba(255, 255, 255, 0.35)',
  size = 220,
  active,
  style,
  className,
  onPointerMove,
  ...rest
}: GlowProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const pending = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef<number | null>(null)

  const flush = useCallback(() => {
    frame.current = null
    const el = elementRef.current
    const next = pending.current
    if (el && next) {
      el.style.setProperty('--glow-x', `${next.x}px`)
      el.style.setProperty('--glow-y', `${next.y}px`)
    }
  }, [])

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event)
      const rect = elementRef.current?.getBoundingClientRect()
      if (!rect) return

      pending.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      if (frame.current === null) {
        frame.current = requestAnimationFrame(flush)
      }
    },
    [onPointerMove, flush],
  )

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  return (
    <div
      ref={elementRef}
      className={className ? `ax-glow ${className}` : 'ax-glow'}
      data-active={active}
      style={{ '--glow-color': color, '--glow-size': `${size}px`, ...style } as React.CSSProperties}
      onPointerMove={handlePointerMove}
      {...rest}
    >
      <div className="ax-glow__layer" aria-hidden="true" />
      <div className="ax-glow__content">{children}</div>
    </div>
  )
}

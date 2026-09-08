import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
} from 'react'
import './Ripple.css'

export interface RippleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** Where each ripple starts from: the real click point, or always the element's center. */
  origin?: 'cursor' | 'center'
  /** CSS color for the ripple, e.g. 'rgba(124,159,255,.5)'. */
  color?: string
  /** How long a single ripple takes to fully expand and fade, in ms. */
  duration?: number
  /** Spawns a ripple programmatically (e.g. a scripted demo loop) on each rising edge, instead of requiring a real click. Always center-origin, since there's no real cursor position to key off of. */
  active?: boolean
}

let nextRippleId = 0

/**
 * Spawns an expanding, fading circle from the click point on every press.
 * Each ripple is its own element rather than one reused/reset element, so
 * overlapping quick clicks each get their own independent wave instead of
 * one restarting and cutting the last one off.
 */
export function Ripple({
  children,
  origin = 'cursor',
  color = 'rgba(255, 255, 255, 0.5)',
  duration = 600,
  active,
  style,
  className,
  onPointerDown,
  ...rest
}: RippleProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([])
  const prevActive = useRef(active)

  const spawn = useCallback(
    (clientX?: number, clientY?: number) => {
      const el = elementRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Diagonal * 2 so the wave's edge clears every corner of the element
      // by the time it finishes expanding, even starting from a corner.
      const size = Math.hypot(rect.width, rect.height) * 2
      const x = origin === 'cursor' && clientX !== undefined ? clientX - rect.left : rect.width / 2
      const y = origin === 'cursor' && clientY !== undefined ? clientY - rect.top : rect.height / 2
      setRipples((prev) => [...prev, { id: nextRippleId++, x, y, size }])
    },
    [origin],
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event)
      spawn(event.clientX, event.clientY)
    },
    [onPointerDown, spawn],
  )

  useEffect(() => {
    if (active && !prevActive.current) spawn()
    prevActive.current = active
  }, [active, spawn])

  const remove = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return (
    <div
      ref={elementRef}
      className={className ? `ax-ripple ${className}` : 'ax-ripple'}
      style={{ '--ripple-color': color, '--ripple-duration': `${duration}ms`, ...style } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      {...rest}
    >
      <span className="ax-ripple__layer" aria-hidden="true">
        {ripples.map((r) => (
          <span
            key={r.id}
            className="ax-ripple__wave"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
            onAnimationEnd={() => remove(r.id)}
          />
        ))}
      </span>
      <span className="ax-ripple__content">{children}</span>
    </div>
  )
}

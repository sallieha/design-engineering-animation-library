import { useCallback, useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './Depress.css'

export interface DepressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** Scale applied while pressed, as a multiplier of the resting scale (1). */
  scale?: number
  /** Spring parameters driving the compress and the spring-back on release. */
  spring?: SpringConfig
  /** Drives the pressed state programmatically (e.g. a scripted demo loop) instead of real pointer events. */
  active?: boolean
}

// Lower stiffness + damping near critical (damping ratio ≈0.85) reads as a
// smooth ease in both directions rather than a snap — the original
// {480, 24} pairing settled in well under 200ms, abrupt enough that going
// back to resting size looked like a hard cut rather than a release.
const DEFAULT_SPRING: SpringConfig = { stiffness: 200, damping: 24, mass: 1 }

/**
 * Compresses toward `scale` for as long as the element is pressed, then
 * springs back to rest on release — a real mass-spring simulation rather
 * than a fixed-duration CSS transition, so a quick re-press inherits
 * whatever velocity the release was still carrying instead of restarting
 * from a dead stop.
 */
export function Depress({
  children,
  scale = 0.94,
  spring = DEFAULT_SPRING,
  active,
  style,
  className,
  ...rest
}: DepressProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  const applyScale = useCallback((value: { x: number }) => {
    const el = elementRef.current
    if (el) el.style.setProperty('--depress-scale', value.x.toFixed(4))
  }, [])

  const { setTarget } = useSpring(spring, applyScale, { x: 1, y: 0 })

  useEffect(() => {
    if (active === undefined) return
    setTarget(active ? { x: scale, y: 0 } : { x: 1, y: 0 })
  }, [active, scale, setTarget])

  return (
    <div
      ref={elementRef}
      className={className ? `ax-depress ${className}` : 'ax-depress'}
      style={{ '--depress-scale': 1, ...style } as React.CSSProperties}
      onPointerDown={() => setTarget({ x: scale, y: 0 })}
      onPointerUp={() => setTarget({ x: 1, y: 0 })}
      onPointerLeave={() => setTarget({ x: 1, y: 0 })}
      {...rest}
    >
      {children}
    </div>
  )
}

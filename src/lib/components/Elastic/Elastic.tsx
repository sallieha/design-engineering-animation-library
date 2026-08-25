import { useCallback, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './Elastic.css'

export interface ElasticProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** Scale applied while hovered/pressed, as a multiplier of the resting scale (1). */
  scale?: number
  /** Extra squeeze on press, applied as a scale multiplier on top of `scale`. */
  pressScale?: number
  /** Spring parameters driving the overshoot/settle. */
  spring?: SpringConfig
}

const DEFAULT_SPRING: SpringConfig = { stiffness: 320, damping: 12, mass: 1 }

/**
 * Wraps children in an element that overshoots past its target scale and
 * settles back, driven by a real mass-spring simulation rather than a
 * fixed-duration CSS transition — so quick re-hovers inherit velocity
 * instead of restarting the animation from zero.
 */
export function Elastic({
  children,
  scale = 1.12,
  pressScale = 0.94,
  spring = DEFAULT_SPRING,
  style,
  className,
  ...rest
}: ElasticProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  const applyScale = useCallback((value: { x: number }) => {
    const el = elementRef.current
    if (el) el.style.setProperty('--elastic-scale', value.x.toFixed(4))
  }, [])

  const { setTarget } = useSpring(spring, applyScale, { x: 1, y: 0 })

  return (
    <div
      ref={elementRef}
      className={className ? `ax-elastic ${className}` : 'ax-elastic'}
      style={{ '--elastic-scale': 1, ...style } as React.CSSProperties}
      onPointerEnter={() => setTarget({ x: scale, y: 0 })}
      onPointerLeave={() => setTarget({ x: 1, y: 0 })}
      onPointerDown={() => setTarget({ x: scale * pressScale, y: 0 })}
      onPointerUp={() => setTarget({ x: scale, y: 0 })}
      {...rest}
    >
      {children}
    </div>
  )
}

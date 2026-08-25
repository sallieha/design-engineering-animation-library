import { useCallback, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './Liquid.css'

export interface LiquidProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** How far each corner's radius swings from the resting value, in percentage points. */
  amplitude?: number
  /** Spring parameters driving the morph. Low damping reads as a liquid wobble/overshoot. */
  spring?: SpringConfig
}

const DEFAULT_SPRING: SpringConfig = { stiffness: 140, damping: 9, mass: 1.4 }

// Fixed per-corner phase offsets so the eight border-radius control points
// don't move in lockstep — each settles at a different point along the
// spring's overshoot, which is what reads as "liquid" rather than "rounded
// rectangle scaling uniformly."
const CORNER_PHASES = [0, 0.6, 1.3, 2.1, 2.8, 3.4, 4.2, 5.1]

export function Liquid({
  children,
  amplitude = 22,
  spring = DEFAULT_SPRING,
  style,
  className,
  ...rest
}: LiquidProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  const applyMorph = useCallback(
    (value: { x: number }) => {
      const el = elementRef.current
      if (!el) return

      const t = value.x
      const corners = CORNER_PHASES.map((phase) => {
        const base = 16
        const swing = amplitude * t * (0.5 + 0.5 * Math.sin(phase + t * 2))
        return Math.max(4, base + swing)
      })

      const [tlH, trH, brH, blH, tlV, trV, brV, blV] = corners
      el.style.setProperty('--liquid-radius', `${tlH}% ${trH}% ${brH}% ${blH}% / ${tlV}% ${trV}% ${brV}% ${blV}%`)
      el.style.setProperty('--liquid-scale', (1 + 0.03 * Math.sin(t * Math.PI)).toFixed(4))
    },
    [amplitude],
  )

  const { setTarget } = useSpring(spring, applyMorph)

  return (
    <div
      ref={elementRef}
      className={className ? `ax-liquid ${className}` : 'ax-liquid'}
      style={{ '--liquid-radius': '16px', '--liquid-scale': 1, ...style } as React.CSSProperties}
      onPointerEnter={() => setTarget({ x: 1, y: 0 })}
      onPointerLeave={() => setTarget({ x: 0, y: 0 })}
      {...rest}
    >
      {children}
    </div>
  )
}

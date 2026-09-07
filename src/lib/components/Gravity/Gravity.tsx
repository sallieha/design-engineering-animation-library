import { useCallback, useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './Gravity.css'

export interface GravityProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** Radius (px) of the gravity well, measured from the element's center. */
  radius?: number
  /** Max distance (px) the element is pulled toward the cursor at the well's center. */
  pull?: number
  /** Spring parameters driving the pull and the return-to-rest. */
  spring?: SpringConfig
  /**
   * Drives the pull programmatically (e.g. a scripted demo loop) instead of
   * tracking the real pointer — pulls toward a fixed direction when `true`.
   */
  active?: boolean
}

const DEFAULT_SPRING: SpringConfig = { stiffness: 180, damping: 16, mass: 1.2 }

/**
 * Unlike Push, the pointer never has to be over the element: a document-level
 * listener treats the element's center as a gravity well and pulls it toward
 * the cursor once the cursor enters `radius`, with pull strength growing
 * smoothly (smoothstep) as the cursor nears the center — magnetic-button
 * behavior rather than a plain hover effect.
 */
export function Gravity({
  children,
  radius = 120,
  pull = 14,
  spring = DEFAULT_SPRING,
  active,
  style,
  className,
  ...rest
}: GravityProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  const applyOffset = useCallback((value: { x: number; y: number }) => {
    const el = elementRef.current
    if (el) {
      el.style.setProperty('--gravity-x', `${value.x.toFixed(2)}px`)
      el.style.setProperty('--gravity-y', `${value.y.toFixed(2)}px`)
    }
  }, [])

  const { setTarget } = useSpring(spring, applyOffset)

  useEffect(() => {
    if (active !== undefined) {
      // Controlled mode: ignore the real pointer, pull toward a fixed
      // direction so the effect reads clearly without needing a cursor.
      const angle = Math.PI / 4
      setTarget(active ? { x: pull * Math.cos(angle), y: pull * Math.sin(angle) } : { x: 0, y: 0 })
      return
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = elementRef.current?.getBoundingClientRect()
      if (!rect) return

      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = event.clientX - centerX
      const dy = event.clientY - centerY
      const distance = Math.hypot(dx, dy)

      if (distance >= radius) {
        setTarget({ x: 0, y: 0 })
        return
      }

      const t = 1 - distance / radius
      const smoothed = t * t * (3 - 2 * t)
      const magnitude = pull * smoothed
      const safeDistance = distance || 1

      setTarget({
        x: (dx / safeDistance) * magnitude,
        y: (dy / safeDistance) * magnitude,
      })
    }

    document.addEventListener('pointermove', handlePointerMove)
    return () => document.removeEventListener('pointermove', handlePointerMove)
  }, [active, radius, pull, setTarget])

  return (
    <div
      ref={elementRef}
      className={className ? `ax-gravity ${className}` : 'ax-gravity'}
      style={{ '--gravity-x': '0px', '--gravity-y': '0px', ...style } as React.CSSProperties}
      {...rest}
    >
      {children}
    </div>
  )
}

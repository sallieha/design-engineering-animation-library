import { useCallback, useRef, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './Push.css'

export interface PushProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** Max distance (px) the content is displaced away from the cursor. */
  strength?: number
  /** Radius (px) from center within which the cursor exerts force; beyond it, force is zero. */
  radius?: number
  /** Spring parameters driving the displacement and the return-to-rest. */
  spring?: SpringConfig
}

const DEFAULT_SPRING: SpringConfig = { stiffness: 260, damping: 18, mass: 1 }

/**
 * Content physically recoils away from the cursor as it approaches, with
 * force falling off linearly across `radius` and a spring pulling it back
 * to rest on exit — a repulsion field rather than a static hover offset.
 */
export function Push({
  children,
  strength = 18,
  radius = 90,
  spring = DEFAULT_SPRING,
  style,
  className,
  onPointerMove,
  onPointerLeave,
  ...rest
}: PushProps) {
  const elementRef = useRef<HTMLDivElement>(null)

  const applyOffset = useCallback((value: { x: number; y: number }) => {
    const el = elementRef.current
    if (el) {
      el.style.setProperty('--push-x', `${value.x.toFixed(2)}px`)
      el.style.setProperty('--push-y', `${value.y.toFixed(2)}px`)
    }
  }, [])

  const { setTarget } = useSpring(spring, applyOffset)

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event)
      const rect = elementRef.current?.getBoundingClientRect()
      if (!rect) return

      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = centerX - event.clientX
      const dy = centerY - event.clientY
      const distance = Math.hypot(dx, dy) || 1

      const falloff = Math.max(0, 1 - distance / radius)
      const magnitude = strength * falloff

      setTarget({
        x: (dx / distance) * magnitude,
        y: (dy / distance) * magnitude,
      })
    },
    [onPointerMove, radius, strength, setTarget],
  )

  const handlePointerLeave = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event)
      setTarget({ x: 0, y: 0 })
    },
    [onPointerLeave, setTarget],
  )

  return (
    <div
      ref={elementRef}
      className={className ? `ax-push ${className}` : 'ax-push'}
      style={{ '--push-x': '0px', '--push-y': '0px', ...style } as React.CSSProperties}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...rest}
    >
      {children}
    </div>
  )
}

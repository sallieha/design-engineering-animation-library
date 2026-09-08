import { useCallback, useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './Snap.css'

export interface SnapProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** Scale applied while pressed, as a multiplier of the resting scale (1). */
  scale?: number
  /** How far past resting scale (1) the release bounces before settling, as a fraction — e.g. 0.08 overshoots to 1.08 before pulling back. */
  overshoot?: number
  /** Spring parameters driving the press and the settle after the bounce. */
  spring?: SpringConfig
  /** Drives the pressed state programmatically (e.g. a scripted demo loop) instead of real pointer events. */
  active?: boolean
}

// Stiff and well-damped so the press itself reads as an immediate, sharp
// state change rather than a smooth glide — the opposite feel from
// Elastic/Depress, which are tuned to be felt settling in.
const DEFAULT_SPRING: SpringConfig = { stiffness: 480, damping: 30, mass: 1 }

// How long the overshoot leg is held before pulling back to rest — matched
// to DEFAULT_SPRING's own settle time by feel, not derived analytically.
const BOUNCE_HOLD_MS = 90

/**
 * A sharp, immediate compress on press (no visible overshoot), followed by
 * a manufactured two-stage release: the target jumps past resting scale by
 * `overshoot` first, then pulls back to rest a beat later. A single spring
 * target can't produce a bounce on its own once it's already sitting still
 * at the press target, so this gives it a real (if short-lived)
 * intermediate target instead of relying on underdamped oscillation, which
 * would also soften the press itself.
 */
export function Snap({
  children,
  scale = 0.92,
  overshoot = 0.08,
  spring = DEFAULT_SPRING,
  active,
  style,
  className,
  ...rest
}: SnapProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const bounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPressed = useRef(false)

  const applyScale = useCallback((value: { x: number }) => {
    const el = elementRef.current
    if (el) el.style.setProperty('--snap-scale', value.x.toFixed(4))
  }, [])

  const { setTarget } = useSpring(spring, applyScale, { x: 1, y: 0 })

  const press = useCallback(() => {
    if (bounceTimer.current !== null) {
      clearTimeout(bounceTimer.current)
      bounceTimer.current = null
    }
    isPressed.current = true
    setTarget({ x: scale, y: 0 })
  }, [scale, setTarget])

  const release = useCallback(() => {
    if (!isPressed.current) return
    isPressed.current = false
    setTarget({ x: 1 + overshoot, y: 0 })
    bounceTimer.current = setTimeout(() => {
      setTarget({ x: 1, y: 0 })
      bounceTimer.current = null
    }, BOUNCE_HOLD_MS)
  }, [overshoot, setTarget])

  useEffect(() => {
    if (active === undefined) return
    if (active) press()
    else release()
  }, [active, press, release])

  useEffect(() => {
    return () => {
      if (bounceTimer.current !== null) clearTimeout(bounceTimer.current)
    }
  }, [])

  return (
    <div
      ref={elementRef}
      className={className ? `ax-snap ${className}` : 'ax-snap'}
      style={{ '--snap-scale': 1, ...style } as React.CSSProperties}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      {...rest}
    >
      {children}
    </div>
  )
}

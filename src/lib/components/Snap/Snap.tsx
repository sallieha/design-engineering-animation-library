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

// Softer than the original {480, 30} pairing — that settled in well under
// 200ms in both directions, which read as an abrupt cut rather than a
// state change with any give to it. Damping ratio here (~0.68) still keeps
// enough snap for the press to read as immediate-ish, while easing both
// legs instead of hard-stopping.
const DEFAULT_SPRING: SpringConfig = { stiffness: 260, damping: 22, mass: 1 }

// How long the overshoot leg is held before retargeting to rest. Timed to
// land close to DEFAULT_SPRING's own peak-overshoot point (where velocity
// is near zero) rather than mid-swing, so the retarget doesn't introduce a
// visible kink in the motion — an earlier value here caught the spring
// while it still had real velocity, which is what made the pull-back to
// rest look like a hard cut.
const BOUNCE_HOLD_MS = 250

/**
 * An eased compress on press, followed by a manufactured two-stage
 * release: the target jumps past resting scale by `overshoot` first, then
 * pulls back to rest a beat later. A single spring target can't produce a
 * bounce on its own once it's already sitting still at the press target,
 * so this gives it a real (if short-lived) intermediate target instead.
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

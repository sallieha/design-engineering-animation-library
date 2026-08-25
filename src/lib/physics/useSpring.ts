import { useCallback, useEffect, useRef } from 'react'

export interface SpringConfig {
  /** Restoring force per unit displacement. Higher = snappier. */
  stiffness?: number
  /** Velocity-proportional resistance. Higher = less overshoot. */
  damping?: number
  /** Inertia. Higher = slower to accelerate. */
  mass?: number
  /** Simulation stops once |velocity| and |displacement from target| both fall below this. */
  restThreshold?: number
}

export type SpringVector = { x: number; y: number }

const DEFAULT_CONFIG: Required<SpringConfig> = {
  stiffness: 210,
  damping: 20,
  mass: 1,
  restThreshold: 0.01,
}

/**
 * Drives a 2D value toward a target with critically-damped-spring dynamics
 * (semi-implicit Euler integration) instead of a canned easing curve, so
 * the motion carries real velocity and overshoot/settle depends on the
 * physical parameters rather than a fixed keyframe timeline.
 */
export function useSpring(
  config: SpringConfig = {},
  onFrame?: (value: SpringVector) => void,
  initial: SpringVector = { x: 0, y: 0 },
) {
  const { stiffness, damping, mass, restThreshold } = { ...DEFAULT_CONFIG, ...config }

  const position = useRef<SpringVector>(initial)
  const velocity = useRef<SpringVector>({ x: 0, y: 0 })
  const target = useRef<SpringVector>(initial)
  const frame = useRef<number | null>(null)
  const lastTime = useRef<number | null>(null)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  const stop = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    lastTime.current = null
  }, [])

  const tick = useCallback(
    (time: number) => {
      const last = lastTime.current ?? time
      // Clamp so a background/inactive tab can't feed a huge dt into the integrator.
      const dt = Math.min((time - last) / 1000, 1 / 30)
      lastTime.current = time

      let atRest = true

      for (const axis of ['x', 'y'] as const) {
        const displacement = position.current[axis] - target.current[axis]
        const springForce = -stiffness * displacement
        const dampingForce = -damping * velocity.current[axis]
        const acceleration = (springForce + dampingForce) / mass

        velocity.current[axis] += acceleration * dt
        position.current[axis] += velocity.current[axis] * dt

        if (Math.abs(velocity.current[axis]) > restThreshold || Math.abs(displacement) > restThreshold) {
          atRest = false
        }
      }

      onFrameRef.current?.(position.current)

      if (atRest) {
        position.current = { ...target.current }
        velocity.current = { x: 0, y: 0 }
        onFrameRef.current?.(position.current)
        stop()
        return
      }

      frame.current = requestAnimationFrame(tick)
    },
    [stiffness, damping, mass, restThreshold, stop],
  )

  const setTarget = useCallback(
    (next: SpringVector) => {
      target.current = next
      if (frame.current === null) {
        lastTime.current = null
        frame.current = requestAnimationFrame(tick)
      }
    },
    [tick],
  )

  useEffect(() => stop, [stop])

  return { setTarget, stop }
}

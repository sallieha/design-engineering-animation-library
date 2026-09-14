import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './MorphPath.css'

export interface MorphPathProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Label shown next to the morphing glyph. */
  children: ReactNode
  /** Spring parameters driving the point interpolation. */
  spring?: SpringConfig
  /** Drives the morphed state programmatically instead of a real click. */
  active?: boolean
}

type Point = [number, number]

// Two 4-point path "shapes" — a plus (two perpendicular strokes) and an X
// (two diagonal strokes) — built from the exact same structure (two
// disconnected 2-point subpaths) so every point in PLUS has a direct,
// positionally-matched counterpart in X. That's what makes literal `d`
// interpolation possible: there's no shape-fitting or point-resampling
// involved, just a per-point lerp.
const PLUS: [Point, Point, Point, Point] = [
  [4, 12],
  [20, 12],
  [12, 4],
  [12, 20],
]
const CROSS: [Point, Point, Point, Point] = [
  [5.5, 5.5],
  [18.5, 18.5],
  [5.5, 18.5],
  [18.5, 5.5],
]

const DEFAULT_SPRING: SpringConfig = { stiffness: 260, damping: 18, mass: 1 }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function buildD(from: readonly Point[], to: readonly Point[], t: number) {
  const [[ax0, ay0], [ax1, ay1], [ax2, ay2], [ax3, ay3]] = from
  const [[bx0, by0], [bx1, by1], [bx2, by2], [bx3, by3]] = to
  const x0 = lerp(ax0, bx0, t).toFixed(2)
  const y0 = lerp(ay0, by0, t).toFixed(2)
  const x1 = lerp(ax1, bx1, t).toFixed(2)
  const y1 = lerp(ay1, by1, t).toFixed(2)
  const x2 = lerp(ax2, bx2, t).toFixed(2)
  const y2 = lerp(ay2, by2, t).toFixed(2)
  const x3 = lerp(ax3, bx3, t).toFixed(2)
  const y3 = lerp(ay3, by3, t).toFixed(2)
  return `M${x0} ${y0}L${x1} ${y1}M${x2} ${y2}L${x3} ${y3}`
}

/**
 * Path/SVG morph: the glyph's own `d` attribute interpolates point-by-point
 * between two matched-structure shapes every frame, rather than crossfading
 * two separate icons or relying on a canned CSS transition. A moderately
 * underdamped spring (rather than a critically-damped one) lets each arm
 * swing slightly past its target before settling — the "slight easing
 * variation" that keeps this reading as hand-drawn rather than mechanical.
 */
export function MorphPath({ children, spring = DEFAULT_SPRING, active, className, style, onClick, ...rest }: MorphPathProps) {
  const pathRef = useRef<SVGPathElement>(null)
  // Local "is it showing the X" state only matters in uncontrolled mode
  // (no `active` prop) — set from the click handler itself, never from the
  // `active`-prop effect below, so that effect only ever calls setTarget
  // (a ref-driven spring update, not a React state update) like every
  // other component's active-prop effect in this library.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const uncontrolledOpenRef = useRef(false)

  const applyT = useCallback((value: { x: number }) => {
    pathRef.current?.setAttribute('d', buildD(PLUS, CROSS, Math.min(1, Math.max(0, value.x))))
  }, [])

  const { setTarget } = useSpring(spring, applyT, { x: 0, y: 0 })

  useEffect(() => {
    if (active === undefined) return
    setTarget({ x: active ? 1 : 0, y: 0 })
  }, [active, setTarget])

  const isOpen = active === undefined ? uncontrolledOpen : active

  return (
    <div
      className={className ? `ax-morph-path ${className}` : 'ax-morph-path'}
      style={style}
      onClick={(e) => {
        onClick?.(e)
        if (active !== undefined) return
        const next = !uncontrolledOpenRef.current
        uncontrolledOpenRef.current = next
        setUncontrolledOpen(next)
        setTarget({ x: next ? 1 : 0, y: 0 })
      }}
      aria-pressed={isOpen}
      {...rest}
    >
      <svg className="ax-morph-path__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path ref={pathRef} d={buildD(PLUS, CROSS, 0)} stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="ax-morph-path__label">{children}</span>
    </div>
  )
}

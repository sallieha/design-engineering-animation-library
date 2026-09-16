import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './MorphPath.css'

export interface MorphPathProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Label shown next to the resting glyph — hidden once morphed into the circle. */
  children: ReactNode
  /** Spring parameters driving the point interpolation and the shape morph. */
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

// The label fades and unmounts over this leading fraction of the morph, so
// it's already invisible by the time it leaves flex flow — removing it
// outright (rather than just fading opacity) is what lets the icon recenter
// into a true circle instead of sitting off-center in a leftover gap.
const LABEL_HIDE_THRESHOLD = 0.25

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

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
 *
 * The button itself morphs alongside the glyph: width and border-radius
 * interpolate (via the same spring value, driven directly on this element —
 * no separate overlay is needed since, unlike MorphContainer, this never
 * leaves its own footprint) from the resting pill down to a circle whose
 * diameter equals the pill's own height, so it lands on a perfect circle
 * with no extra sizing to configure. Height never changes.
 */
export function MorphPath({ children, spring = DEFAULT_SPRING, active, className, style, onClick, ...rest }: MorphPathProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const restRectRef = useRef<{ width: number; height: number } | null>(null)
  const labelHiddenRef = useRef(false)

  // Local "is it showing the X" state only matters in uncontrolled mode
  // (no `active` prop) — set from the click handler itself, never from the
  // `active`-prop effect below, so that effect only ever calls setTarget
  // (a ref-driven spring update, not a React state update) like every
  // other component's active-prop effect in this library.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const uncontrolledOpenRef = useRef(false)
  const [labelVisible, setLabelVisible] = useState(true)

  const applyT = useCallback((value: { x: number }) => {
    const t = clamp01(value.x)
    pathRef.current?.setAttribute('d', buildD(PLUS, CROSS, t))

    const el = containerRef.current
    const rest = restRectRef.current
    if (el && rest) {
      const circleDiameter = rest.height
      el.style.width = `${lerp(rest.width, circleDiameter, t)}px`
      el.style.borderRadius = `${lerp(40, circleDiameter / 2, t)}px`
    }

    // Fades to 0 opacity right as it crosses the hide threshold, so by the
    // time it unmounts (removing it from flex flow so the icon can recenter
    // into a true circle) it's already invisible — no pop.
    if (labelRef.current) labelRef.current.style.opacity = String(clamp01(1 - t / LABEL_HIDE_THRESHOLD))

    const shouldHide = t >= LABEL_HIDE_THRESHOLD
    if (shouldHide !== labelHiddenRef.current) {
      labelHiddenRef.current = shouldHide
      setLabelVisible(!shouldHide)
    }
  }, [])

  const { setTarget } = useSpring(spring, applyT, { x: 0, y: 0 })

  // Re-measured on every toggle (not just once on mount) so a resize
  // between plays — e.g. rotating a device, crossing the mobile breakpoint
  // — still morphs from the pill's actual current size.
  const measureRestRect = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // Reading the rect mid-morph would capture an already-shrunk width —
    // only trust a measurement taken while at rest.
    if (!labelHiddenRef.current) restRectRef.current = { width: rect.width, height: rect.height }
  }, [])

  useEffect(() => {
    if (active === undefined) return
    if (active) measureRestRect()
    setTarget({ x: active ? 1 : 0, y: 0 })
  }, [active, measureRestRect, setTarget])

  const isOpen = active === undefined ? uncontrolledOpen : active

  return (
    <div
      ref={containerRef}
      className={className ? `ax-morph-path ${className}` : 'ax-morph-path'}
      style={style}
      onClick={(e) => {
        onClick?.(e)
        if (active !== undefined) return
        const next = !uncontrolledOpenRef.current
        uncontrolledOpenRef.current = next
        if (next) measureRestRect()
        setUncontrolledOpen(next)
        setTarget({ x: next ? 1 : 0, y: 0 })
      }}
      aria-pressed={isOpen}
      {...rest}
    >
      <svg className="ax-morph-path__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path ref={pathRef} d={buildD(PLUS, CROSS, 0)} stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {labelVisible && (
        <span ref={labelRef} className="ax-morph-path__label">
          {children}
        </span>
      )}
    </div>
  )
}

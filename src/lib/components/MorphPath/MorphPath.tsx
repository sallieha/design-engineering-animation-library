import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './MorphPath.css'

export interface MorphPathProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Label shown next to the resting glyph — hidden once morphed into the circle. */
  children: ReactNode
  /** Spring parameters driving the glyph's point interpolation. */
  spring?: SpringConfig
  /** Spring parameters driving the button's own shape morph (width/radius). */
  shapeSpring?: SpringConfig
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

// Moderately underdamped so each arm swings slightly past its target before
// settling — the "hand-drawn" quality, not a mechanical snap. At this small
// (2px-scale) coordinate range that overshoot reads as character.
const DEFAULT_SPRING: SpringConfig = { stiffness: 260, damping: 18, mass: 1 }

// Same stiffness, but damping raised close to critical (2*sqrt(260*1)≈32.25
// is the critical value) so the button's own width/radius settle with
// essentially no overshoot. The glyph's overshoot is subtle at a 2px scale;
// the exact same overshoot applied to an ~88px width delta reads as a
// visible twitch right as it finishes expanding or collapsing — this and
// the icon spring used to be the same spring, which is what caused that.
const DEFAULT_SHAPE_SPRING: SpringConfig = { stiffness: 260, damping: 34, mass: 1 }

// The label fades AND shrinks to zero width over this leading fraction of
// the morph, so both hit zero at the same instant — see applyShapeT.
const LABEL_HIDE_THRESHOLD = 0.25

// Safely larger than the label could ever naturally need, so it's
// effectively "unconstrained" at rest (shrink=0) — just a ceiling for the
// max-width tween, not a real cap.
const LABEL_MAX_WIDTH = 300

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
 * two separate icons or relying on a canned CSS transition.
 *
 * The button itself morphs alongside the glyph — width and border-radius
 * interpolate directly on this element (no separate overlay is needed since,
 * unlike MorphContainer, this never leaves its own footprint) from the
 * resting pill down to a circle whose diameter equals the pill's own height.
 * Height never changes.
 *
 * The label stays mounted the whole time — its opacity, max-width, and
 * margin all tween to 0 together (not a discrete unmount) so it leaves flex
 * flow gradually. An earlier version unmounted it outright once t crossed
 * the hide threshold, which did get the icon to recenter, but the unmount
 * itself was a one-frame layout change React doesn't animate — the icon
 * visibly snapped ~15% of the button's own width sideways at that instant,
 * on both the way in and the way out. Continuous shrink removes the jump
 * entirely: by the time the label is fully faded it also has zero footprint.
 *
 * The glyph and the shape are driven by two independent springs, not one —
 * see DEFAULT_SHAPE_SPRING for why sharing a single spring between them
 * doesn't work.
 */
export function MorphPath({
  children,
  spring = DEFAULT_SPRING,
  shapeSpring = DEFAULT_SHAPE_SPRING,
  active,
  className,
  style,
  onClick,
  ...rest
}: MorphPathProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const restRectRef = useRef<{ width: number; height: number } | null>(null)
  const morphedRef = useRef(false)

  // Local "is it showing the X" state only matters in uncontrolled mode
  // (no `active` prop) — set from the click handler itself, never from the
  // `active`-prop effect below, so that effect only ever calls setTarget
  // (a ref-driven spring update, not a React state update) like every
  // other component's active-prop effect in this library.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const uncontrolledOpenRef = useRef(false)

  const applyIconT = useCallback((value: { x: number }) => {
    pathRef.current?.setAttribute('d', buildD(PLUS, CROSS, clamp01(value.x)))
  }, [])

  const applyShapeT = useCallback((value: { x: number }) => {
    const t = clamp01(value.x)

    const el = containerRef.current
    const restRect = restRectRef.current
    if (el && restRect) {
      const circleDiameter = restRect.height
      el.style.width = `${lerp(restRect.width, circleDiameter, t)}px`
      el.style.borderRadius = `${lerp(40, circleDiameter / 2, t)}px`
    }

    // Opacity, max-width, and margin all reach 0 at the same instant — the
    // label has zero visual presence and zero layout footprint together,
    // so the icon eases into center rather than snapping there.
    const shrink = clamp01(t / LABEL_HIDE_THRESHOLD)
    if (labelRef.current) {
      labelRef.current.style.opacity = String(1 - shrink)
      labelRef.current.style.maxWidth = `${(1 - shrink) * LABEL_MAX_WIDTH}px`
      labelRef.current.style.marginLeft = `${(1 - shrink) * 6}px`
    }
    morphedRef.current = shrink >= 1
  }, [])

  const { setTarget: setIconTarget } = useSpring(spring, applyIconT, { x: 0, y: 0 })
  const { setTarget: setShapeTarget } = useSpring(shapeSpring, applyShapeT, { x: 0, y: 0 })

  const setBothTargets = useCallback(
    (x: number) => {
      setIconTarget({ x, y: 0 })
      setShapeTarget({ x, y: 0 })
    },
    [setIconTarget, setShapeTarget],
  )

  // Re-measured on every toggle (not just once on mount) so a resize
  // between plays — e.g. rotating a device, crossing the mobile breakpoint
  // — still morphs from the pill's actual current size.
  const measureRestRect = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // Reading the rect mid-morph would capture an already-shrunk width —
    // only trust a measurement taken while at rest.
    if (!morphedRef.current) restRectRef.current = { width: rect.width, height: rect.height }
  }, [])

  useEffect(() => {
    if (active === undefined) return
    if (active) measureRestRect()
    setBothTargets(active ? 1 : 0)
  }, [active, measureRestRect, setBothTargets])

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
        setBothTargets(next ? 1 : 0)
      }}
      aria-pressed={isOpen}
      {...rest}
    >
      <svg className="ax-morph-path__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path ref={pathRef} d={buildD(PLUS, CROSS, 0)} stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span ref={labelRef} className="ax-morph-path__label">
        {children}
      </span>
    </div>
  )
}

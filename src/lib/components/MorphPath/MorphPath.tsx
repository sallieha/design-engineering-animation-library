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

// Icon's own fixed footprint, in px — used to compute how much of the
// button's current width is actually left over for the label.
const ICON_WIDTH = 20

// A ceiling for the label's own "shrink toward 0 by t=1" curve — safely
// larger than the label could ever naturally need, so at t=0 it isn't the
// binding constraint (the real available-space cap below is).
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
 * margin all tween to 0 together across the *same* full t range the shape
 * itself uses (not a discrete unmount, and not some faster leading fraction
 * of t). Two earlier versions each fixed one problem and left another: an
 * outright unmount at a threshold did get the icon to recenter, but the
 * unmount itself was a one-frame layout change React doesn't animate — the
 * icon visibly snapped sideways. Switching that to a continuous tween but
 * still compressed into an early fraction of t fixed the snap but not the
 * pacing — the label finished fading well before the button finished
 * resizing, which read as a rushed, disconnected sub-animation. Tying it to
 * the same t range the shape uses removes both: the label recedes/returns
 * in step with the resize, and max-width is additionally capped at the
 * button's own actual remaining space every frame, so it's never wider
 * than what's really left even for a single frame.
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
    let currentWidth = restRect?.width ?? 0
    if (el && restRect) {
      const circleDiameter = restRect.height
      currentWidth = lerp(restRect.width, circleDiameter, t)
      el.style.width = `${currentWidth}px`
      el.style.borderRadius = `${lerp(40, circleDiameter / 2, t)}px`
    }

    // Opacity and margin fade across the *entire* t range (not some early
    // fraction of it), so the label recedes/returns at the same pace as
    // the button's own resize instead of rushing through its own faster
    // sub-animation — that pacing mismatch (the label used to fade+collapse
    // over just the first quarter of t) was what read as a sudden jump on
    // both ends. max-width is the smaller of that same full-range curve and
    // the button's own actual remaining space (currentWidth minus the
    // icon and this margin) — the space-based cap guarantees the label can
    // never be wider than what's really left, so it can't ever peek past
    // the button's own edge for a frame; the curve-based cap guarantees it
    // still reaches exactly 0 at t=1 even though real remaining space
    // doesn't (a 71px circle still has ~51px "left" after the icon).
    if (labelRef.current) {
      const marginLeft = lerp(6, 0, t)
      const shrinkCurve = (1 - t) * LABEL_MAX_WIDTH
      const available = Math.max(0, currentWidth - ICON_WIDTH - marginLeft)
      labelRef.current.style.opacity = String(1 - t)
      labelRef.current.style.marginLeft = `${marginLeft}px`
      labelRef.current.style.maxWidth = `${Math.min(shrinkCurve, available)}px`
    }
    morphedRef.current = t >= 0.999
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

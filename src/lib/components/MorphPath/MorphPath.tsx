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

// Deliberately slower than DEFAULT_SHAPE_SPRING (lower stiffness, damping
// kept close to its own critical value of 2*sqrt(90*1)≈19 for the same
// no-overshoot reasoning) — only used for the label's reveal on open, not
// its hide on close. The label used to just ride the shape spring's own t
// while opening, which was smooth but read as too fast; giving it its own
// slower spring lets it keep gently filling back in for a while after the
// button itself has already finished settling into the pill.
const LABEL_REVEAL_SPRING: SpringConfig = { stiffness: 90, damping: 19, mass: 1 }

// Icon's own fixed footprint, in px — used to compute how much of the
// button's current width is actually left over for the label.
const ICON_WIDTH = 20

// A ceiling for the label's own "shrink toward 0" curve — safely larger
// than the label could ever naturally need, so at rest it isn't the
// binding constraint (the real available-space cap below is).
const LABEL_MAX_WIDTH = 300

// While closing, the label hides fast by riding the shape spring's own t —
// linearly over just this leading fraction of it, then staying hidden
// through the rest of the shrink. (Opening doesn't use this at all — see
// LABEL_REVEAL_SPRING, which drives its own separate, slower spring
// instead.) Earlier versions tried tying the label 1:1 to the shape
// spring's t in both directions — smooth, but read as a sudden appearance
// on open; and a shared single fast curve for both — fast, but read as
// abrupt on close (the label finished well before the button did, leaving
// it to keep shrinking around an already-empty gap). Separating "how fast"
// (this fraction) from "what curve" (linear here, spring-driven for
// opening) let each direction land on its own right feel independently.
const CLOSE_LABEL_HIDE_FRACTION = 0.25

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
 * margin all tween to 0 together (not a discrete unmount, which read as the
 * icon visibly snapping sideways the instant React removed it from flex
 * flow). Hiding it (closing) and revealing it (opening) are driven by two
 * different springs with deliberately different timing — see
 * CLOSE_LABEL_HIDE_FRACTION and LABEL_REVEAL_SPRING for why. max-width is
 * additionally capped at the button's own actual remaining space every
 * frame, so the label can never be wider than what's really left even for
 * a single frame.
 *
 * Three springs drive this in total: the glyph, the shape (width/
 * border-radius), and the label's reveal — see DEFAULT_SHAPE_SPRING for
 * why the glyph and shape can't share one, and LABEL_REVEAL_SPRING for why
 * the label needs its own on top of that.
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
  const directionRef = useRef<'opening' | 'closing'>('closing')
  // Updated every shape-spring frame, read by the label-reveal spring's own
  // frame (a separate rAF loop — see LABEL_REVEAL_SPRING) so its
  // available-space cap always reflects the button's real current width
  // even though the two springs aren't ticking in lockstep.
  const currentWidthRef = useRef(0)

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

  // Shared by both the shape spring (closing) and the label-reveal spring
  // (opening) — `shrink` is 1 = fully hidden, 0 = fully shown. max-width is
  // the smaller of the shrink curve and the button's own actual remaining
  // space (currentWidth minus the icon and this margin): the space-based
  // cap guarantees the label can never be wider than what's really left, so
  // it can't ever peek past the button's own edge for a frame; the
  // curve-based cap guarantees it still reaches exactly 0 once fully hidden
  // even though real remaining space doesn't (a 71px circle still has
  // ~51px "left" after the icon).
  const applyLabelShrink = useCallback((shrink: number, currentWidth: number) => {
    const label = labelRef.current
    if (!label) return
    const marginLeft = lerp(6, 0, shrink)
    const shrinkCurve = (1 - shrink) * LABEL_MAX_WIDTH
    const available = Math.max(0, currentWidth - ICON_WIDTH - marginLeft)
    label.style.opacity = String(1 - shrink)
    label.style.marginLeft = `${marginLeft}px`
    label.style.maxWidth = `${Math.min(shrinkCurve, available)}px`
  }, [])

  const applyShapeT = useCallback(
    (value: { x: number }) => {
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
      currentWidthRef.current = currentWidth

      // Closing hides the label fast, riding this same spring's t — see
      // CLOSE_LABEL_HIDE_FRACTION. Opening is handled entirely by the
      // separate, slower label-reveal spring below instead (so this skips
      // writing label styles then, leaving it exclusively in charge).
      if (directionRef.current === 'closing') {
        applyLabelShrink(clamp01(t / CLOSE_LABEL_HIDE_FRACTION), currentWidth)
      }
      morphedRef.current = t >= 0.999
    },
    [applyLabelShrink],
  )

  // `value.x`: 1 = hidden, 0 = fully revealed — same convention `shrink`
  // uses elsewhere, so this can feed straight into applyLabelShrink.
  const applyLabelRevealT = useCallback(
    (value: { x: number }) => {
      if (directionRef.current !== 'opening') return
      applyLabelShrink(clamp01(value.x), currentWidthRef.current)
    },
    [applyLabelShrink],
  )

  const { setTarget: setIconTarget } = useSpring(spring, applyIconT, { x: 0, y: 0 })
  const { setTarget: setShapeTarget } = useSpring(shapeSpring, applyShapeT, { x: 0, y: 0 })
  const { setTarget: setLabelRevealTarget, jumpTo: jumpLabelReveal } = useSpring(LABEL_REVEAL_SPRING, applyLabelRevealT, {
    x: 1,
    y: 0,
  })

  const setBothTargets = useCallback(
    (x: number) => {
      directionRef.current = x === 1 ? 'closing' : 'opening'
      setIconTarget({ x, y: 0 })
      setShapeTarget({ x, y: 0 })
      if (x === 1) {
        // Closing doesn't animate this spring at all (the shape spring's
        // own fast hide above owns the label then) — just parks it back at
        // "hidden" so the next open starts from a clean, consistent 1.
        jumpLabelReveal({ x: 1, y: 0 })
      } else {
        setLabelRevealTarget({ x: 0, y: 0 })
      }
    },
    [setIconTarget, setShapeTarget, setLabelRevealTarget, jumpLabelReveal],
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

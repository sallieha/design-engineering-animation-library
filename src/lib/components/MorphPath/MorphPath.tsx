import { useCallback, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './MorphPath.css'

export interface MorphPathProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Label shown next to the resting glyph — hidden once morphed into the circle. */
  children: ReactNode
  /** Spring parameters driving the glyph's point interpolation while closing (plus -> X). */
  spring?: SpringConfig
  /** Spring parameters driving the glyph's point interpolation while opening (X -> plus). */
  openSpring?: SpringConfig
  /** Spring parameters driving the button's own shape morph (width/radius) — same in both directions. */
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
// (2px-scale) coordinate range that overshoot reads as character. Used
// while closing (forming the X).
const DEFAULT_SPRING: SpringConfig = { stiffness: 260, damping: 18, mass: 1 }

// Slower than DEFAULT_SPRING (same ~0.56 damping ratio at lower stiffness,
// so it keeps the same wobble character, just paced out) — used while
// opening (reforming the plus). The glyph doesn't need to move fast in
// both directions the way the shape does; forming the X reads fine quick,
// but the plus reappearing wants more time to read as deliberate rather
// than instant.
const DEFAULT_OPEN_SPRING: SpringConfig = { stiffness: 70, damping: 9, mass: 1 }

// Same in both directions — the button's own width/border-radius morph
// reads right as-is either way, unlike the glyph and the label.
const DEFAULT_SHAPE_SPRING: SpringConfig = { stiffness: 260, damping: 34, mass: 1 }

// Fast, near-critically-damped (2*sqrt(500*1)≈45 is critical) — the label
// hides quickly while closing.
const LABEL_CLOSE_SPRING: SpringConfig = { stiffness: 500, damping: 45, mass: 1 }

// Slow, near-critically-damped (2*sqrt(60*1)≈15.5 is critical) — the label
// takes noticeably longer to fill back in while opening than it took to
// disappear while closing.
const LABEL_OPEN_SPRING: SpringConfig = { stiffness: 60, damping: 15, mass: 1 }

// Icon's own fixed footprint, in px — used to compute how much of the
// button's current width is actually left over for the label.
const ICON_WIDTH = 20

// Gap between the label and the glyph at rest, in px — shared by the
// content-centering math in measureRestRect and the per-frame tween in
// applyLabelT, so both agree on the same value.
const LABEL_GAP = 6

// A ceiling for the label's own "shrink toward 0" curve — safely larger
// than the label could ever naturally need, so at rest it isn't the
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
 * The label sits *before* the glyph, not after — "Morph Path" reads left to
 * right into the icon, plus/X sign-off style — and the glyph's own screen
 * position never moves at all, in either direction: the visible pill is
 * absolutely positioned inside a fixed-size layout slot, anchored to that
 * slot's right edge (`right: 0`), with its own content right-aligned
 * (`justify-content: flex-end`). Shrinking the pill's width therefore only
 * ever moves its *left* edge — the right edge, and the glyph sitting right
 * up against it, stay exactly where they are throughout. This is what
 * finally eliminated the residual glitch a center-anchored glyph had: its
 * position used to be computed from the label's current width every frame
 * (offset = half of the row's remaining content width), which even after
 * fixing the underlying width curve still left a small measured swing
 * whenever the label and shape springs didn't settle at exactly the same
 * rate. Anchoring the glyph removes that computation completely instead of
 * further tuning it — its position is no longer a function of the label's
 * state at all.
 *
 * The label stays mounted the whole time — its opacity, max-width, and
 * margin all tween to 0 together (not a discrete unmount, which read as the
 * icon visibly snapping sideways the instant React removed it from flex
 * flow).
 *
 * The glyph and the label each want different pacing per direction (fast
 * closing, slower opening), but the shape doesn't. Earlier versions gave
 * the label two *separate* springs for that — one driving it while closing,
 * a different instance while opening — which meant interrupting mid-motion
 * (clicking again before it settled) could visibly snap the label straight
 * to whatever the newly-active spring's own starting value was, instead of
 * continuing from wherever it actually currently was. Each animated value
 * here is one continuous spring instead, and only its *config* — not a
 * second instance — swaps by direction (see useSpring's own `configRef`,
 * which exists specifically so a config swap takes effect on the very next
 * frame even for a tick loop already in flight). One spring's position
 * carries across a direction change with no jump possible, by construction
 * — the same reason the shape spring (which never swaps config at all) was
 * never a source of this problem.
 */
export function MorphPath({
  children,
  spring = DEFAULT_SPRING,
  openSpring = DEFAULT_OPEN_SPRING,
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
  // The label's own natural (unconstrained) content width, measured
  // whenever restRectRef is — see applyLabelT for why an accurate value
  // here matters a lot more than it looks like it should.
  const labelNaturalWidthRef = useRef(LABEL_MAX_WIDTH)
  // The right inset applied to center the glyph in the final circle (see
  // measureRestRect) — applyLabelT's available-space math needs to know
  // about it too, since it's real space the label can't use.
  const iconPaddingRef = useRef(0)
  const morphedRef = useRef(false)
  // Only tracked as state in uncontrolled mode, set directly from the click
  // handler — never from the `active`-prop effect below, so that effect
  // only ever calls setBothTargets (which itself only drives the springs,
  // no state) rather than a state setter. In controlled mode `direction`
  // is derived from `active` directly instead (see below), since it's
  // already the exact same information.
  const [uncontrolledDirection, setUncontrolledDirection] = useState<'opening' | 'closing'>('closing')
  // Updated every shape-spring frame, read by the label spring's own frame
  // (a separate rAF loop) so its available-space cap always reflects the
  // button's real current width even though the two springs aren't ticking
  // in lockstep.
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

  // shrink: 0 = fully shown, 1 = fully hidden. max-width is the smaller of
  // this curve and the button's own actual remaining space (currentWidth
  // minus the icon and this margin) — the space-based cap guarantees the
  // label can never be wider than what's really left, so it can't ever
  // peek past the button's own edge for a frame; the curve-based cap
  // guarantees it still reaches exactly 0 once fully hidden even though
  // real remaining space doesn't (a 71px circle still has ~51px "left"
  // after the icon).
  //
  // The curve is scaled to the label's own *measured* natural width, not
  // a generic constant — this turned out to matter a lot even after the
  // glyph stopped depending on it for its own position (see the component
  // doc comment): with a looser constant (300px, comfortably above the
  // ~128px "Morph Path" actually needs), the curve stays well above the
  // label's natural content size for roughly the first half of the
  // shrink, during which CSS max-width isn't the binding constraint at
  // all — only opacity is visibly changing, while the *layout* width sits
  // frozen at its natural size. Once the curve finally drops below that
  // natural size, the layout width collapses all at once, well behind
  // where the curve "should" have already taken it — a real measured
  // plateau-then-catch-up in the label's own shrink, distinct from (and
  // originally the cause of) the glyph-position bug the anchoring above
  // now fixes on its own. Scaling the curve to the actual natural width
  // makes it the binding constraint from the very first frame, so layout
  // width shrinks smoothly in step with opacity throughout.
  const applyLabelT = useCallback((value: { x: number }) => {
    const label = labelRef.current
    if (!label) return
    const shrink = clamp01(value.x)
    // Gap lives on the label's *right* edge now — the label comes first,
    // the anchored, never-moving glyph comes last (see the component doc
    // comment), so the space between them sits after the label, not before.
    const marginRight = lerp(LABEL_GAP, 0, shrink)
    const shrinkCurve = (1 - shrink) * labelNaturalWidthRef.current
    const available = Math.max(0, currentWidthRef.current - iconPaddingRef.current - ICON_WIDTH - marginRight)
    label.style.opacity = String(1 - shrink)
    label.style.marginRight = `${marginRight}px`
    label.style.maxWidth = `${Math.min(shrinkCurve, available)}px`
  }, [])

  const applyShapeT = useCallback((value: { x: number }) => {
    const t = clamp01(value.x)
    const el = containerRef.current
    const restRect = restRectRef.current
    if (el && restRect) {
      const circleDiameter = restRect.height
      currentWidthRef.current = lerp(restRect.width, circleDiameter, t)
      el.style.width = `${currentWidthRef.current}px`
      el.style.borderRadius = `${lerp(40, circleDiameter / 2, t)}px`
    }
    morphedRef.current = t >= 0.999
  }, [])

  // Derived from `active` directly when controlled — it's the exact same
  // information, so there's no need to also track it as separate state
  // (which would mean setting it from the active-prop effect below).
  const direction = active !== undefined ? (active ? 'closing' : 'opening') : uncontrolledDirection
  const iconSpringConfig = direction === 'closing' ? spring : openSpring
  const labelSpringConfig = direction === 'closing' ? LABEL_CLOSE_SPRING : LABEL_OPEN_SPRING

  const { setTarget: setIconTarget } = useSpring(iconSpringConfig, applyIconT, { x: 0, y: 0 })
  const { setTarget: setShapeTarget } = useSpring(shapeSpring, applyShapeT, { x: 0, y: 0 })
  const { setTarget: setLabelTarget } = useSpring(labelSpringConfig, applyLabelT, { x: 0, y: 0 })

  const setBothTargets = useCallback(
    (x: number) => {
      setIconTarget({ x, y: 0 })
      setShapeTarget({ x, y: 0 })
      setLabelTarget({ x, y: 0 })
    },
    [setIconTarget, setShapeTarget, setLabelTarget],
  )

  // Re-measured on every toggle (not just once on mount) so a resize
  // between plays — e.g. rotating a device, crossing the mobile breakpoint
  // — still morphs from the pill's actual current size.
  const measureRestRect = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // Reading either mid-morph would capture an already-shrunk value —
    // only trust a measurement taken while genuinely at rest, with
    // max-width not yet constraining the label at all.
    if (!morphedRef.current) {
      restRectRef.current = { width: rect.width, height: rect.height }
      const labelWidth = labelRef.current?.getBoundingClientRect().width ?? 0
      labelNaturalWidthRef.current = labelWidth || LABEL_MAX_WIDTH

      // One fixed padding can't perfectly center the glyph in both the
      // resting pill *and* the final circle at once — the two states want
      // different values (see below) — so this splits the difference
      // rather than picking one exactly at the other's expense.
      //
      // Centering the label+gap+glyph group within the pill's resting
      // width wants padding of (restWidth - labelWidth - LABEL_GAP -
      // ICON_WIDTH) / 2 (equivalent to `justify-content: center`,
      // reproduced with `flex-end` + padding so the glyph's own position
      // is a fixed offset instead of something recomputed each frame —
      // see the component doc comment for why that matters). Centering
      // the glyph in the final circle instead wants (restHeight -
      // ICON_WIDTH) / 2. These differ whenever the pill's resting width
      // isn't exactly labelWidth + LABEL_GAP + ICON_WIDTH (it rarely is —
      // this button is deliberately wider than its content for roomier
      // padding, see .ax-morph-path.morph-button's own width).
      //
      // A circle's symmetry makes even a couple px of glyph offset read
      // as visibly lopsided, while the same few px inside the much wider
      // resting pill is easy to miss — so an even split (rather than
      // fully favoring the pill) keeps neither state's error worse than
      // the other's, instead of leaving the more noticeable one at the
      // full deviation.
      const contentWidth = labelNaturalWidthRef.current + LABEL_GAP + ICON_WIDTH
      const restCenterPadding = Math.max(0, rect.width - contentWidth) / 2
      const circleCenterPadding = (rect.height - ICON_WIDTH) / 2
      iconPaddingRef.current = (restCenterPadding + circleCenterPadding) / 2
      el.style.paddingRight = `${iconPaddingRef.current}px`
    }
  }, [])

  // Without this, the very first paint has no paddingRight at all (it's
  // otherwise only ever set from inside a real open) — with
  // `justify-content: flex-end` already active, that first render would
  // show the label+glyph flush against the right edge until the first
  // click measures and sets it. useLayoutEffect (not useEffect) so this
  // runs and paints synchronously before the browser shows the first
  // frame, rather than flashing flush-right for a frame first.
  useLayoutEffect(() => {
    measureRestRect()
  }, [measureRestRect])

  useEffect(() => {
    if (active === undefined) return
    if (active) measureRestRect()
    setBothTargets(active ? 1 : 0)
  }, [active, measureRestRect, setBothTargets])

  const isOpen = active === undefined ? uncontrolledOpen : active

  return (
    <div className="ax-morph-path-slot">
      <div
        ref={containerRef}
        className={className ? `ax-morph-path ${className}` : 'ax-morph-path'}
        // position/justifyContent set inline, not via the .ax-morph-path CSS
        // class, because the consumer's own className is reused here for
        // visual parity with the pill (same reasoning as the width rule in
        // MorphPath.css) and .morph-button carries its own `position` and
        // `justify-content` at equal selector specificity — an inline style
        // always wins over any class-based rule regardless of stylesheet
        // order, the same fix this component family needed for
        // MorphContainer's overlay.
        style={{ position: 'absolute', justifyContent: 'flex-end', ...style }}
        onClick={(e) => {
          onClick?.(e)
          if (active !== undefined) return
          const next = !uncontrolledOpenRef.current
          uncontrolledOpenRef.current = next
          if (next) measureRestRect()
          setUncontrolledOpen(next)
          setUncontrolledDirection(next ? 'closing' : 'opening')
          setBothTargets(next ? 1 : 0)
        }}
        aria-pressed={isOpen}
        {...rest}
      >
        <span ref={labelRef} className="ax-morph-path__label">
          {children}
        </span>
        <svg className="ax-morph-path__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path ref={pathRef} d={buildD(PLUS, CROSS, 0)} stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

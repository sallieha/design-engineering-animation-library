import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './MorphContainer.css'

export interface MorphContainerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Content shown in the pill's resting state. */
  children: ReactNode
  /** Content shown once the panel has expanded. */
  panelContent?: ReactNode
  /** Expanded panel width, in px (clamped to fit the viewport). */
  panelWidth?: number
  /** Expanded panel height, in px (clamped to fit the viewport). */
  panelHeight?: number
  /** Gap between the panel's bottom edge and the trigger's own bottom edge, in px — 0 keeps them exactly flush, reading as one continuous shape. */
  gap?: number
  /** Corner radius at rest, in px — should match the pill's own CSS radius. */
  radius?: number
  /** Corner radius once fully expanded, in px. */
  panelRadius?: number
  /** Spring parameters driving the expand/collapse. */
  spring?: SpringConfig
  /** Drives the expanded state programmatically instead of a real click. */
  active?: boolean
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

// restThreshold looser than useSpring's own default (0.01) — this spring
// drives every dimension (top/left/width/height/border-radius) from a
// single 0-1 value, and near the very end of its decay the *rate* of
// change drops so low that it spends a disproportionate stretch of real
// time (measured: ~150ms, a quarter of the whole close) crawling through
// well under a pixel of actual movement before finally crossing the
// default threshold and snapping to the exact target. That reads as the
// shape "hanging" right as it finishes, not as a position jump. A looser
// threshold calls it done sooner — the residual left at snap time is
// still sub-pixel, just no longer preceded by a long, visually flat tail.
const DEFAULT_SPRING: SpringConfig = { stiffness: 210, damping: 26, mass: 1, restThreshold: 0.025 }

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

/**
 * Container morph / shared-element transition: one element's bounding box,
 * corner radius, and position animate together from a small pill into a
 * large panel, rather than crossfading between two independently-styled
 * elements. The illusion is built from two DOM nodes — the pill stays in
 * normal document flow, and a `position: fixed` overlay does the actual
 * traveling — but the swap between them only ever happens at the instant
 * the overlay's rect exactly equals the pill's own rect (freshly measured
 * on every open), so there's no visible seam: what the eye tracks as "one
 * object" really is continuous the whole time it's moving.
 *
 * Unlike classic FLIP (which inverts with a CSS `transform` and lets the
 * browser scale the box back to identity), this interpolates top/left/
 * width/height/border-radius directly every frame. A transform-based scale
 * would stretch this element's own text content non-uniformly whenever the
 * pill and panel don't share an aspect ratio — direct box interpolation
 * keeps content undistorted at the cost of triggering layout each frame,
 * which is a non-issue for a single small overlay like this.
 *
 * The panel's bottom edge and horizontal center are set to exactly match
 * the trigger's own — not "nearby", identical — so the shape only ever
 * grows upward and outward from the same base, the way the reference this
 * was built from does it, rather than flying off to some unrelated spot
 * on screen. This falls out of the linear interpolation for free: lerping
 * `top` and `height` independently between two rects whose `top + height`
 * (bottom) already match by construction means that sum stays exactly
 * constant at every frame in between too, not just at the two ends — the
 * same reasoning MorphPath's own icon anchor relies on elsewhere in this
 * library, applied here to a whole edge instead of a single point. There's
 * deliberately no dimming backdrop: closing on an outside click/tap is
 * handled the same way SiteMenu's own dropdown does it (a document
 * `pointerdown` listener while open), not by an invisible full-screen
 * click target.
 */
export function MorphContainer({
  children,
  panelContent,
  panelWidth = 340,
  panelHeight = 220,
  gap = 0,
  radius = 40,
  panelRadius = 24,
  spring = DEFAULT_SPRING,
  active,
  className,
  style,
  onClick,
  ...rest
}: MorphContainerProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const pillLabelRef = useRef<HTMLDivElement>(null)
  const panelLabelRef = useRef<HTMLDivElement>(null)

  const [mounted, setMounted] = useState(false)
  const [firstRect, setFirstRect] = useState<Rect | null>(null)
  const [lastRect, setLastRect] = useState<Rect | null>(null)
  // Whether the box has *fully, discretely* finished opening — not "far
  // enough along that t crossed some fraction". Earlier attempts tied the
  // panel content's own reveal to a fraction of the spring's own `t`
  // (first "not clipped", then "not clipped and the box is mostly still"),
  // and each one still left *some* residual overlap between the box
  // visibly finishing its resize and the content becoming visible, which
  // read as everything jumping together even when each half measured
  // smooth on its own. This flips true only once, on the exact frame the
  // box reaches its true final size (see applyT), fully decoupling the
  // content's own reveal (a real CSS transition, see its own className)
  // from the box's still-in-progress motion — there's no fraction of `t`
  // left to mistune.
  const [boxSettled, setBoxSettled] = useState(false)

  const firstRectRef = useRef<Rect | null>(null)
  const lastRectRef = useRef<Rect | null>(null)
  const directionRef = useRef<'opening' | 'closing'>('opening')

  useEffect(() => {
    firstRectRef.current = firstRect
    lastRectRef.current = lastRect
  }, [firstRect, lastRect])

  const applyT = useCallback(
    (value: { x: number }) => {
      const t = clamp01(value.x)
      const overlay = overlayRef.current
      const first = firstRectRef.current
      const last = lastRectRef.current

      if (overlay && first && last) {
        overlay.style.top = `${first.top + (last.top - first.top) * t}px`
        overlay.style.left = `${first.left + (last.left - first.left) * t}px`
        overlay.style.width = `${first.width + (last.width - first.width) * t}px`
        overlay.style.height = `${first.height + (last.height - first.height) * t}px`
        overlay.style.borderRadius = `${radius + (panelRadius - radius) * t}px`
      }

      // Crossfades the pill's own label out — the container itself never
      // pops between two looks, only this inner content does, same as the
      // underlying material design "container transform" pattern this
      // technique is named for. The panel's own content doesn't crossfade
      // against `t` at all (see boxSettled above and its own CSS
      // transition on panelLabelRef) — every attempt at tuning *when*
      // within the box's motion it was safe to start still left some
      // overlap between "box visibly moving" and "content becoming
      // visible" that read as a jump, so it waits for the motion to be
      // fully, discretely over instead.
      if (pillLabelRef.current) pillLabelRef.current.style.opacity = String(clamp01(1 - t / 0.25))
      if (t >= 1 && directionRef.current === 'opening') setBoxSettled(true)

      // Settling back at the pill's own rect means the overlay is now
      // pixel-identical to the trigger underneath — safe to unmount it and
      // reveal the real button with no visible seam. Forces the *exact*
      // first rect here rather than trusting this frame's own `t` to have
      // already interpolated all the way there — `t` only ever approaches
      // 0 asymptotically (this threshold is deliberately loose, so it
      // doesn't spend a long stretch of real time crawling through an
      // imperceptible remaining distance first), and a sub-pixel gap left
      // between the overlay's actual last position and the trigger's own
      // exact position reads as a small downward pop at the handoff —
      // this removes that gap outright instead of just shrinking it.
      if (t <= 0.02 && directionRef.current === 'closing') {
        if (overlay && first) {
          overlay.style.top = `${first.top}px`
          overlay.style.left = `${first.left}px`
          overlay.style.width = `${first.width}px`
          overlay.style.height = `${first.height}px`
          overlay.style.borderRadius = `${radius}px`
        }
        setMounted(false)
      }
    },
    [radius, panelRadius],
  )

  const { setTarget } = useSpring(spring, applyT, { x: 0, y: 0 })

  const open = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = Math.min(panelWidth, window.innerWidth - 32)
    const height = Math.min(panelHeight, window.innerHeight - 32)

    // Bottom edge (top + height) matches the trigger's own bottom exactly
    // (see the component doc comment for why that keeps it constant for
    // every frame in between, not just the two ends) and horizontal center
    // matches too, so the panel only ever grows upward and outward from
    // the trigger's own footprint. Clamped into the viewport (16px margin)
    // as a fallback for a trigger near the screen's top/side, where either
    // would otherwise push the panel off-screen — a clamp firing there
    // does mean the bottom/center can shift after all, but there's no
    // "connected" position left to keep once the ideal one doesn't fit.
    const idealLeft = rect.left + rect.width / 2 - width / 2
    const idealTop = rect.top + rect.height - gap - height

    setFirstRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    setLastRect({
      top: Math.max(16, idealTop),
      left: Math.min(Math.max(16, idealLeft), window.innerWidth - 16 - width),
      width,
      height,
    })
    directionRef.current = 'opening'
    setMounted(true)
    setBoxSettled(false)
    // One frame's delay so the overlay paints at the pill's own rect (t=0)
    // before the spring starts pulling it toward the panel — otherwise the
    // very first frame could be scheduled before firstRect/lastRect commit.
    requestAnimationFrame(() => setTarget({ x: 1, y: 0 }))
  }, [panelWidth, panelHeight, gap, setTarget])

  const close = useCallback(() => {
    directionRef.current = 'closing'
    // Content starts fading back out the instant closing begins, not
    // tied to the spring's own `t` — same reasoning as the opening side,
    // just simpler here since "closing has started" is already a clean,
    // discrete event with no fraction of `t` to pick.
    setBoxSettled(false)
    setTarget({ x: 0, y: 0 })
  }, [setTarget])

  useEffect(() => {
    if (active === undefined) return
    if (active) open()
    else close()
  }, [active, open, close])

  useEffect(() => {
    if (!mounted) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mounted, close])

  // No dimming backdrop behind the panel, so there's no full-screen click
  // target to close it — closes on any pointerdown outside the panel
  // itself instead, the same way SiteMenu's own dropdown does.
  useEffect(() => {
    if (!mounted) return
    function handlePointerDown(e: PointerEvent) {
      if (overlayRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [mounted, close])

  return (
    <>
      <div
        ref={triggerRef}
        className={className ? `ax-morph-container ${className}` : 'ax-morph-container'}
        data-hidden={mounted}
        style={style}
        onClick={(e) => {
          onClick?.(e)
          open()
        }}
        {...rest}
      >
        {children}
      </div>

      {mounted &&
        firstRect &&
        lastRect &&
        createPortal(
          // Portaled straight to <body> rather than left where React's tree
          // would otherwise put it (as a child of whatever the consumer
          // wraps this in). `position: fixed` resolves against the nearest
          // ancestor with its own `transform` instead of the true viewport
          // — this page's own `.playground__stack` has one — so without the
          // portal, top/left computed from window.innerWidth/innerHeight
          // would land in the wrong box entirely.
          <div
            ref={overlayRef}
            className={`ax-morph-overlay glass${className ? ` ${className}` : ''}`}
            style={{
              // Set inline (not left to the .ax-morph-overlay CSS rule)
              // because the consumer's own className is reused here for
              // visual parity with the pill (see the className prop
              // above) — that className carries its own `position`
              // declaration (e.g. `.morph-button { position: relative }`)
              // at equal specificity, and source order isn't something
              // this component controls. An inline style always wins
              // over any class-based rule, so this can't be clobbered.
              position: 'fixed',
              top: firstRect.top,
              left: firstRect.left,
              width: firstRect.width,
              height: firstRect.height,
              borderRadius: radius,
            }}
            onClick={close}
            role="button"
            aria-label="Collapse"
          >
            <div
              ref={pillLabelRef}
              className="ax-morph-overlay__pill-label"
              // Fixed to the pill's own resting height (not `inset: 0`,
              // which would stretch to the overlay's own current,
              // still-animating height) — see the component doc comment
              // for why that matters: without this, the vertically
              // centered label visibly slides down as the box shrinks
              // toward the pill (its bottom is fixed, so a shorter box
              // has a lower center), right as it's fading in from
              // opacity 0, reading as the label glitching downward
              // rather than the button settling.
              style={{ height: firstRect.height }}
            >
              {children}
            </div>
            <div
              ref={panelLabelRef}
              className="ax-morph-overlay__panel-content"
              // Fixed to the panel's own final height (not `inset: 0`,
              // which would stretch to the overlay's own current,
              // still-settling height) — same reasoning as pillLabelRef's
              // own fixed height above: without this, the panel's content
              // visibly slides as the box's height keeps creeping toward
              // its target while the content is already fading in, not
              // just during the brief opacity ramp itself. Measured this
              // as a real ~10px shift over ~170ms, not a sub-pixel one.
              //
              // Opacity is driven by boxSettled (a real CSS transition,
              // see .ax-morph-overlay__panel-content), not by `t` — see
              // boxSettled's own doc comment for why any t-fraction-based
              // reveal still left visible overlap with the box's motion.
              style={{
                height: lastRect.height,
                opacity: boxSettled ? 1 : 0,
                pointerEvents: boxSettled ? 'auto' : 'none',
              }}
            >
              {panelContent ?? (
                <>
                  <p className="ax-morph-overlay__panel-title">Expanded panel</p>
                  <p className="ax-morph-overlay__panel-subtitle">Same element, new bounds</p>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

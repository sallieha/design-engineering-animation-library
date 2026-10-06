import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import { LitGooFilter } from './LitGooFilter'
import './GooeySurface.css'

export interface GooeySurfaceProps {
  open: boolean
  /** Which way the panel grows out of (and then floats away from) the trigger. */
  direction?: 'up' | 'down'
  /** `start` keeps the panel's left edge on the trigger's; `center` grows it symmetrically about the trigger. */
  align?: 'start' | 'center'
  /** Diameter of the circular trigger, in px. */
  triggerSize: number
  /** Resting gap between the panel and the trigger once they've split, in px. */
  gap?: number
  /** Panel corner radius once fully open, in px. */
  panelRadius?: number
  /** Spring parameters driving the open/close. */
  spring?: SpringConfig
  /** The trigger button itself — rendered on top of the shape, so it should have no background of its own. */
  trigger: ReactNode
  /** Class for the panel's content wrapper (padding/layout). Its natural size becomes the panel's size. */
  contentClassName?: string
  contentStyle?: CSSProperties
  contentProps?: HTMLAttributes<HTMLDivElement>
  children: ReactNode
}

// Near-critically damped (zeta ~0.9): any real overshoot reads as the
// finished panel growing a few px *after* it appeared to land, then easing
// back — a second pop at the very end rather than a liquid wobble.
const DEFAULT_SPRING: SpringConfig = { stiffness: 60, damping: 14, mass: 1 }
// How long after opening starts the content begins fading in, in ms.
const CONTENT_DELAY_MS = 350
// Extra room around the shapes' bounding box for the blur and overshoot.
const BLEED = 80
// Blur radius feeding the goo threshold — also how close two shapes get
// before they start to fuse, so the resting `gap` must stay wider than ~2x
// this or the panel never visibly separates from the circle.
const GOO_BLUR = 5

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

// Eased 0-1 progress of `t` through [from, to]; continues linearly past 1
// so the spring's overshoot still reads as the blob wobbling past its
// target instead of clamping dead.
function phase(t: number, from: number, to: number) {
  const k = (t - from) / (to - from)
  if (k <= 0) return 0
  if (k >= 1) return 1 + Math.max(0, t - 1)
  return k * k * (3 - 2 * k)
}

/**
 * The gooey morph itself, independent of what's inside: a circular trigger
 * that morphs into a rounded panel, then splits from it. At rest it's just
 * the circle; on open that one shape swells out into the full panel (still
 * containing the circle), then the panel's near edge lifts away and the
 * circle pinches off, leaving two separate elements.
 *
 * Built the classic way: a circle and a rounded rect are drawn as plain
 * opaque SVG shapes inside a filter that blurs them, then thresholds the
 * blurred alpha back to a hard edge — anything still faintly overlapping
 * after the blur reads as one connected shape, and the pinch's smooth
 * outline falls out of that for free. The filter then re-lights the result
 * (translucent white fill, a specular rim highlight, an outer-only drop
 * shadow) so it reads as this library's glass.
 *
 * Trade-off: that filter is why this isn't `.glass` — `backdrop-filter`
 * silently fails to render under an SVG filter (the same reason MorphMerge
 * dropped goo), so the glass look is imitated with lighting instead.
 *
 * The panel's size is its content's natural size (measured), so any
 * content works. The content layer stays at that final fixed size,
 * anchored to the panel's *far* edge — the edge that reaches its final
 * position early — so it never reflows while the panel grows around it and
 * doesn't ride the near edge's last stretch of lift. It fades in on a
 * fixed delay (one discrete flip with a real CSS transition), not a ramp
 * tied to the spring, and hides immediately on close.
 */
export function GooeySurface({
  open,
  direction = 'up',
  align = 'start',
  triggerSize,
  gap = 14,
  panelRadius = 18,
  spring = DEFAULT_SPRING,
  trigger,
  contentClassName,
  contentStyle,
  contentProps,
  children,
}: GooeySurfaceProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<SVGRectElement>(null)
  const circleRef = useRef<SVGCircleElement>(null)
  const filterId = useId().replace(/:/g, '')

  const [dims, setDims] = useState({ w: triggerSize, h: triggerSize })
  const dimsRef = useRef(dims)
  dimsRef.current = dims

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const measure = () => setDims({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const wide = Math.max(dims.w, triggerSize)
  const x0 = (align === 'center' ? (triggerSize - wide) / 2 : 0) - BLEED
  const y0 = direction === 'up' ? -(dims.h + gap) - BLEED : -BLEED
  const boxWidth = wide + BLEED * 2
  const boxHeight = dims.h + gap + triggerSize + BLEED * 2

  const applyT = useCallback(
    (value: { x: number }) => {
      const panel = panelRef.current
      const rect = rectRef.current
      const circle = circleRef.current
      if (!panel || !rect || !circle) return
      const t = value.x
      const tc = clamp01(t)
      const r = triggerSize / 2
      const { w: W, h: H } = dimsRef.current
      const bx0 = (align === 'center' ? (triggerSize - Math.max(W, triggerSize)) / 2 : 0) - BLEED
      const by0 = direction === 'up' ? -(H + gap) - BLEED : -BLEED

      // Two overlapping phases off the one spring value: the circle first
      // swells out into the full panel shape (its far edge travels, its
      // near edge stays flush with the circle's own, so the circle is
      // still entirely inside the blob), then the near edge lifts away,
      // pinching the circle off as the blur can no longer bridge the gap.
      const grow = phase(t, 0, 0.68)
      const split = phase(t, 0.42, 1)
      const panelW = Math.max(1, triggerSize + (W - triggerSize) * grow)
      const left = align === 'center' ? (triggerSize - panelW) / 2 : 0
      let top: number
      let bottom: number
      if (direction === 'up') {
        top = -(H + gap) * grow
        bottom = triggerSize - (triggerSize + gap) * split
      } else {
        bottom = triggerSize + (gap + H) * grow
        top = (triggerSize + gap) * split
      }
      const panelH = Math.max(1, bottom - top)
      const panelR = Math.max(0, Math.min(r + (panelRadius - r) * clamp01(grow), panelW / 2, panelH / 2))

      panel.style.left = `${left}px`
      panel.style.top = `${top}px`
      panel.style.width = `${panelW}px`
      panel.style.height = `${panelH}px`
      panel.style.borderRadius = `${panelR}px`
      panel.style.pointerEvents = tc > 0.9 ? 'auto' : 'none'

      circle.setAttribute('cx', String(r - bx0))
      circle.setAttribute('cy', String(r - by0))
      rect.setAttribute('x', String(left - bx0))
      rect.setAttribute('y', String(top - by0))
      rect.setAttribute('width', String(panelW))
      rect.setAttribute('height', String(panelH))
      rect.setAttribute('rx', String(panelR))
    },
    [triggerSize, gap, panelRadius, align, direction],
  )

  const { setTarget } = useSpring(spring, applyT)

  // Re-runs on a size change too: setTarget to the same target redraws the
  // resting shape at the new measured size (or retargets it mid-flight).
  useEffect(() => {
    setTarget(open ? { x: 1, y: 0 } : { x: 0, y: 0 })
  }, [open, dims, setTarget])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    if (!open) {
      content.style.transition = 'opacity 90ms ease-out'
      content.style.opacity = '0'
      return
    }
    const id = window.setTimeout(() => {
      content.style.transition = 'opacity 150ms ease-out'
      content.style.opacity = '1'
    }, CONTENT_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [open])

  return (
    <div className="ax-gooey-surface" style={{ width: triggerSize, height: triggerSize }}>
      <svg
        className="ax-gooey-surface__shapes"
        style={{ left: x0, top: y0, width: boxWidth, height: boxHeight }}
        aria-hidden="true"
      >
        <defs>
          <LitGooFilter id={filterId} width={boxWidth} height={boxHeight} blur={GOO_BLUR} />
        </defs>
        <g filter={`url(#${filterId})`}>
          <circle ref={circleRef} cx={triggerSize / 2 - x0} cy={triggerSize / 2 - y0} r={triggerSize / 2} fill="#000" />
          <rect
            ref={rectRef}
            x={-x0}
            y={-y0}
            width={triggerSize}
            height={triggerSize}
            rx={triggerSize / 2}
            fill="#000"
          />
        </g>
      </svg>

      <div
        ref={panelRef}
        className="ax-gooey-surface__panel"
        style={{ left: 0, top: 0, width: triggerSize, height: triggerSize, pointerEvents: 'none' }}
      >
        <div
          ref={contentRef}
          className={contentClassName ? `ax-gooey-surface__content ${contentClassName}` : 'ax-gooey-surface__content'}
          data-direction={direction}
          data-align={align}
          style={{ opacity: 0, ...contentStyle }}
          {...contentProps}
        >
          {children}
        </div>
      </div>

      <div className="ax-gooey-surface__trigger">{trigger}</div>
    </div>
  )
}

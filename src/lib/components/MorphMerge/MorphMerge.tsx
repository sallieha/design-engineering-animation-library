import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './MorphMerge.css'

export interface MorphMergeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Left pill's label at rest, before the first merge. */
  leftLabel?: ReactNode
  /** Right pill's label at rest, before the first merge. */
  rightLabel?: ReactNode
  /** Left pill's content once split back apart (defaults to a right-facing arrow). */
  leftResult?: ReactNode
  /** Right pill's content once split back apart (defaults to a left-facing arrow). */
  rightResult?: ReactNode
  /** Shows the result content (icons) first instead of the labels — the
   * first click then merges/splits back to the labels, rather than to
   * the results. */
  startRevealed?: boolean
  /** Gap between the two resting pills, in px — defaults to the CSS
   * value (8px desktop, 6px mobile) when omitted, since an inline style
   * would otherwise permanently override the mobile breakpoint's own
   * narrower gap. */
  gap?: number
  /** How long the two pills take to merge into one, in ms. */
  mergeDuration?: number
  /** How long the fully-merged shape holds before splitting, in ms. */
  holdDuration?: number
  /** How long the merged shape takes to split back apart, in ms. */
  splitDuration?: number
  /** Plays one merge/split cycle programmatically instead of a real click. */
  active?: boolean
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

type Phase = 'apart' | 'merging' | 'held' | 'splitting'

function RightArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LeftArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 12H4M4 12L10 6M4 12L10 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const EASE_MERGE = 'cubic-bezier(0.4, 0, 0.2, 1)'
// A touch of overshoot on the way apart so the two new pills read as
// resolving into place rather than just decelerating to a stop — "split
// slightly slower... so the two new elements resolve clearly".
const EASE_SPLIT = 'cubic-bezier(0.34, 1.4, 0.64, 1)'

/**
 * Organic merge/split: two separate pills slide together, fuse into one
 * continuous shape, hold briefly, then split back into two pills showing
 * new content — a boolean-union read (one shape changing, not two
 * elements crossfading), not a crossfade between independently-styled
 * elements.
 *
 * The two shapes' geometry converges to the *exact same rect* (the
 * bounding box spanning both original pills) at full merge — not just
 * "close enough to look joined" — so the hold reads as a genuinely solid
 * pill rather than two shapes that happen to be touching. An earlier
 * version tried to sell the "organic" part with the classic SVG goo
 * filter (blur two shapes together, then push the alpha channel's
 * contrast back up so anything still faintly connected reads as one
 * solid edge — see MorphBlob, which uses it successfully for its own
 * two-circle join) applied to these same shapes, but `backdrop-filter`
 * (this library's shared `.glass` material depends on it) silently fails
 * to render at all once an ancestor has its own SVG `filter` applied —
 * the shapes went fully invisible while merging/held, with no error. Full
 * glass material won out over the blob effect once that conflict was
 * clear — the shapes just slide together and overlap rather than
 * fusing with soft edges.
 *
 * Labels/icons are rendered in a separate layer positioned identically to
 * the shapes underneath, so they can crossfade independently of the
 * shape's own opacity. Outgoing content fades/scales out early in the
 * merge (before the shapes have moved far), ghosts faintly back in
 * partway through the hold (so the split reads as anticipated rather
 * than sudden), then fully fades/scales in once splitting is underway —
 * not a linear crossfade against shape position.
 *
 * Timing is plain CSS transitions on explicit per-phase durations, not
 * this library's usual spring physics — the brief, exact hold this
 * technique depends on (a fixed pause at *exactly* full merge) doesn't
 * have a natural spring equivalent, so this component intentionally
 * reaches for the other technique instead of forcing a spring into a
 * shape it doesn't fit.
 */
export function MorphMerge({
  leftLabel = 'Organic',
  rightLabel = 'Merge',
  leftResult = <RightArrow />,
  rightResult = <LeftArrow />,
  startRevealed = false,
  gap,
  mergeDuration = 360,
  holdDuration = 150,
  splitDuration = 460,
  active,
  className,
  style,
  onClick,
  ...rest
}: MorphMergeProps) {
  const leftTriggerRef = useRef<HTMLDivElement>(null)
  const rightTriggerRef = useRef<HTMLDivElement>(null)

  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState<Phase>('apart')
  const [revealed, setRevealed] = useState(startRevealed)
  const [rects, setRects] = useState<{ left: Rect; right: Rect; merged: Rect } | null>(null)
  // The pills the *split* lands on — text pills and result circles are
  // different sizes, so the split can't just reverse the same rects the
  // merge started from (measured before `revealed` flipped, while the
  // pills were still whichever shape they *used* to be). Measured fresh
  // once React has actually painted the post-flip pills, not computed
  // analytically, so it stays correct regardless of breakpoint, custom
  // result content, or a consumer's own className changing pill size.
  const [afterRects, setAfterRects] = useState<{ left: Rect; right: Rect } | null>(null)
  const playingRef = useRef(false)
  const timeoutsRef = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutsRef.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const play = useCallback(() => {
    if (playingRef.current) return
    const leftEl = leftTriggerRef.current
    const rightEl = rightTriggerRef.current
    if (!leftEl || !rightEl) return

    const leftBox = leftEl.getBoundingClientRect()
    const rightBox = rightEl.getBoundingClientRect()
    const left: Rect = { top: leftBox.top, left: leftBox.left, width: leftBox.width, height: leftBox.height }
    const right: Rect = { top: rightBox.top, left: rightBox.left, width: rightBox.width, height: rightBox.height }
    // The union both shapes converge to exactly — spans left's own left
    // edge to right's own right edge, tall enough for the taller of the
    // two (they're the same height in practice, but this holds even if a
    // consumer's className gives them different heights).
    const merged: Rect = {
      top: Math.min(left.top, right.top),
      left: left.left,
      width: right.left + right.width - left.left,
      height: Math.max(left.height, right.height),
    }

    playingRef.current = true
    clearTimers()
    setRects({ left, right, merged })
    setAfterRects(null)
    setPhase('apart')
    setMounted(true)
    // One frame's delay so the overlay paints pixel-identical to the two
    // resting pills (phase 'apart') before the transition to 'merging'
    // starts — otherwise the very first frame could already be mid-merge.
    requestAnimationFrame(() => setPhase('merging'))

    const t1 = window.setTimeout(() => {
      setPhase('held')
      // Content is fully faded out by now (see the opacity transition
      // durations below) — safe to swap what it shows with nothing visible.
      setRevealed((r) => !r)
      // One frame's delay so this reads the pills *after* React has
      // actually painted them in their new (post-flip) shape — reading
      // synchronously here would still see the old, pre-flip layout.
      requestAnimationFrame(() => {
        const leftEl = leftTriggerRef.current
        const rightEl = rightTriggerRef.current
        if (!leftEl || !rightEl) return
        const lb = leftEl.getBoundingClientRect()
        const rb = rightEl.getBoundingClientRect()
        setAfterRects({
          left: { top: lb.top, left: lb.left, width: lb.width, height: lb.height },
          right: { top: rb.top, left: rb.left, width: rb.width, height: rb.height },
        })
      })
    }, mergeDuration)

    const t2 = window.setTimeout(() => {
      setPhase('splitting')
    }, mergeDuration + holdDuration)

    const t3 = window.setTimeout(() => {
      playingRef.current = false
      setPhase('apart')
      setMounted(false)
    }, mergeDuration + holdDuration + splitDuration)

    timeoutsRef.current = [t1, t2, t3]
  }, [mergeDuration, holdDuration, splitDuration, clearTimers])

  useEffect(() => {
    if (active === undefined) return
    if (active) play()
  }, [active, play])

  const merging = phase === 'merging' || phase === 'held'

  // Both shapes target the same `merged` rect once merging starts. Once
  // splitting starts they peel apart to `afterRects` — the freshly
  // measured *post-flip* pills (see the `play` callback) — rather than
  // back to the original `rects.left`/`right` they merged from, since
  // those were measured before `revealed` flipped and are the wrong
  // shape whenever text pills and result circles differ in size.
  const leftGeometry = !rects
    ? null
    : merging
      ? rects.merged
      : phase === 'splitting'
        ? (afterRects?.left ?? rects.left)
        : rects.left
  const rightGeometry = !rects
    ? null
    : merging
      ? rects.merged
      : phase === 'splitting'
        ? (afterRects?.right ?? rects.right)
        : rects.right
  const geometryDuration = phase === 'merging' ? mergeDuration : phase === 'splitting' ? splitDuration : 0
  const geometryEasing = phase === 'splitting' ? EASE_SPLIT : EASE_MERGE

  // A faint mid-hold ghost of the *incoming* content (revealed already
  // flips the instant 'held' starts) — "the icons already ghosted in
  // faintly so the split feels anticipated rather than sudden" — sitting
  // between fully invisible (merging/just-merged) and fully shown
  // (mid-split), rather than popping straight from 0 to 1.
  const GHOST_OPACITY = 0.22
  const GHOST_SCALE = 0.8

  // Outgoing content (merging) fades+shrinks out fast and early, well
  // before the shapes have traveled far — "just before/during contact",
  // not a linear crossfade against shape position. Incoming content
  // (held → splitting) fades+grows the rest of the way in once the split
  // is underway, so it "reads cleaner at the smaller post-split size"
  // rather than trying to survive being squeezed through the union.
  const contentOpacity =
    phase === 'apart' ? 1 : phase === 'merging' ? 0 : phase === 'held' ? GHOST_OPACITY : 1
  const contentScale = phase === 'apart' ? 1 : phase === 'merging' ? GHOST_SCALE : phase === 'held' ? GHOST_SCALE : 1

  const contentRevealTransition =
    phase === 'merging'
      ? `${Math.min(140, mergeDuration)}ms ${EASE_MERGE}`
      : phase === 'held'
        ? `${holdDuration}ms ease-out`
        : phase === 'splitting'
          ? `${Math.max(180, splitDuration - 180)}ms ${EASE_MERGE} ${Math.min(150, splitDuration / 3)}ms`
          : 'none'
  const contentOpacityTransition = contentRevealTransition === 'none' ? 'none' : `opacity ${contentRevealTransition}`
  const contentTransformTransition = contentRevealTransition === 'none' ? 'none' : `transform ${contentRevealTransition}`

  const shapeTransition = geometryDuration ? `all ${geometryDuration}ms ${geometryEasing}` : 'none'
  const labelTransition = [shapeTransition, contentOpacityTransition, contentTransformTransition].join(', ')
  // A gentle breathing pulse while fully merged — "a single solid pill...
  // maybe with a subtle pulse" — applied to both shapes so they keep
  // pulsing in perfect unison (still pixel-identical to each other, just
  // both scaling from the same center together).
  const pulseAnimation = phase === 'held' ? `ax-morph-merge-pulse ${holdDuration}ms ease-in-out` : 'none'

  // Text labels read as pills (wide, generous side padding); the result
  // icons read as circle buttons instead — a visibly different "kind" of
  // control for a visibly different kind of content, rather than the
  // same wide pill shape stretched around a single small icon.
  const pillClassName = [
    'ax-morph-merge__pill',
    revealed && 'ax-morph-merge__pill--circle',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="ax-morph-merge" style={gap !== undefined ? { gap, ...style } : style} {...rest}>
      <div
        ref={leftTriggerRef}
        className={pillClassName}
        data-hidden={mounted}
        onClick={(e) => {
          onClick?.(e)
          play()
        }}
        role="button"
        aria-label={revealed ? 'Split' : 'Merge'}
      >
        {revealed ? leftResult : leftLabel}
      </div>
      <div
        ref={rightTriggerRef}
        className={pillClassName}
        data-hidden={mounted}
        onClick={(e) => {
          onClick?.(e)
          play()
        }}
        role="button"
        aria-label={revealed ? 'Split' : 'Merge'}
      >
        {revealed ? rightResult : rightLabel}
      </div>

      {mounted &&
        rects &&
        createPortal(
          // Portaled to <body> for the same reason as MorphContainer's and
          // MorphBlob's own overlays: `position: fixed` resolves against
          // the nearest transformed ancestor, not the true viewport.
          <>
            <div className="ax-morph-merge-overlay__shapes" aria-hidden="true">
              <div
                className={`ax-morph-merge-overlay__shape glass${className ? ` ${className}` : ''}`}
                style={{
                  position: 'fixed',
                  top: leftGeometry!.top,
                  left: leftGeometry!.left,
                  width: leftGeometry!.width,
                  height: leftGeometry!.height,
                  borderRadius: leftGeometry!.height / 2,
                  transition: shapeTransition,
                  animation: pulseAnimation,
                }}
              />
              <div
                className={`ax-morph-merge-overlay__shape glass${className ? ` ${className}` : ''}`}
                style={{
                  position: 'fixed',
                  top: rightGeometry!.top,
                  left: rightGeometry!.left,
                  width: rightGeometry!.width,
                  height: rightGeometry!.height,
                  borderRadius: rightGeometry!.height / 2,
                  transition: shapeTransition,
                  animation: pulseAnimation,
                }}
              />
            </div>

            <div className="ax-morph-merge-overlay__content" aria-hidden="true">
              <div
                className="ax-morph-merge-overlay__label"
                style={{
                  top: leftGeometry!.top,
                  left: leftGeometry!.left,
                  width: leftGeometry!.width,
                  height: leftGeometry!.height,
                  opacity: contentOpacity,
                  transform: `scale(${contentScale})`,
                  transition: labelTransition,
                }}
              >
                {revealed ? leftResult : leftLabel}
              </div>
              <div
                className="ax-morph-merge-overlay__label"
                style={{
                  top: rightGeometry!.top,
                  left: rightGeometry!.left,
                  width: rightGeometry!.width,
                  height: rightGeometry!.height,
                  opacity: contentOpacity,
                  transform: `scale(${contentScale})`,
                  transition: labelTransition,
                }}
              >
                {revealed ? rightResult : rightLabel}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}

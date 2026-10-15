import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import { LitGooFilter } from '../GooeySurface'
import './CardExpand.css'

export interface CardExpandItem {
  id: string
  title: string
  subtitle: string
  icon: ReactNode
}

export interface CardExpandProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  cards: CardExpandItem[]
  /** Collapsed card size, in px. */
  cardWidth?: number
  cardHeight?: number
  /** Gap between cards, in px. */
  gap?: number
  /** Height of the expanded card, in px. */
  expandedHeight?: number
  /** Height of the three cards that tuck into a row below it, in px. */
  tuckedHeight?: number
  /** Spring parameters driving every card's move between layouts. */
  spring?: SpringConfig
  /** Label for the expanded card's top-right action. */
  primaryAction?: string
  /** Label for the expanded card's bottom-right action. */
  secondaryAction?: string
  onPrimaryAction?: (id: string) => void
  onSecondaryAction?: (id: string) => void
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const DEFAULT_SPRING: SpringConfig = { stiffness: 600, damping: 46, mass: 1 }
// A card counts as landed once it's within this many px of its target on
// every edge/dimension — it's then placed exactly there and its action
// controls are revealed. A spring's tail is exponential: the last pixel or
// two takes a couple hundred ms and ends in a hard snap, so waiting for it
// to finish on its own reads as a slow creep followed by a jump.
const LAND_WITHIN_PX = 0.3
// Its action controls start fading in a little before that, once the card
// is within this many px of done. They're anchored to the card's own
// corners, so from here they just ride the last few px of an already
// decelerating move rather than sitting on a box that's still travelling.
const REVEAL_WITHIN_PX = 6
const ACTIONS_FADE_MS = 110
// If a card somehow never reports landing (e.g. its target equals where it
// already is), its controls still appear after this long, in ms.
const ACTIONS_FALLBACK_MS = 900
// Room around the stage for the glass shadow's blur and offset.
const BLEED = 48
const RADIUS = 24

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6.500 17.500 17 7M8.500 6.500H17.500v9" stroke="white" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 9V6.500A2.500 2.500 0 0 0 12.500 4h-6A2.500 2.500 0 0 0 4 6.500v6A2.500 2.500 0 0 0 6.500 15H9" />
    </g>
  </svg>
)

interface CardProps {
  item: CardExpandItem
  rect: Rect
  expanded: boolean
  dimmed: boolean
  zIndex: number
  spring: SpringConfig
  /** The glass shape this card drives, drawn in the stage's shared SVG. */
  getShape: () => SVGRectElement | null
  primaryAction: string
  secondaryAction: string
  onExpand: () => void
  onCollapse: () => void
  onPrimary: () => void
  onSecondary: () => void
}

function Card({
  item,
  rect,
  expanded,
  dimmed,
  zIndex,
  spring,
  getShape,
  primaryAction,
  secondaryAction,
  onExpand,
  onCollapse,
  onPrimary,
  onSecondary,
}: CardProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const from = useRef<Rect>(rect)
  const to = useRef<Rect>(rect)
  const current = useRef<Rect>(rect)
  const mounted = useRef(false)
  // Spring progress at which this card's biggest move is within
  // LAND_WITHIN_PX of done, and whether it's been placed exactly yet.
  const landFrac = useRef(1)
  const revealFrac = useRef(1)
  const landed = useRef(true)
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  const revealPending = useRef(false)
  const jumpRef = useRef<(v: { x: number; y: number }) => void>(() => {})
  // First-paint geometry only: React must never rewrite left/top/width/height
  // on later renders, or each re-render would snap the card to its new
  // target for a frame before the spring's own frame overwrote it.
  const initial = useRef(rect).current

  const revealActions = useCallback(() => {
    const actions = actionsRef.current
    if (!actions) return
    revealPending.current = false
    actions.style.transition = `opacity ${ACTIONS_FADE_MS}ms ease-out`
    actions.style.opacity = '1'
  }, [])

  const apply = useCallback(
    (value: { x: number }) => {
      const el = elRef.current
      if (!el) return
      let t = value.x
      if (revealPending.current && expandedRef.current && t >= revealFrac.current) revealActions()
      if (!landed.current && t >= landFrac.current) {
        // Visually done: place it exactly and stop the spring's crawl, then
        // let anything waiting on the box to hold still go ahead.
        landed.current = true
        t = 1
        jumpRef.current({ x: 1, y: 0 })
        if (revealPending.current && expandedRef.current) revealActions()
      }
      const a = from.current
      const b = to.current
      const r = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        w: a.w + (b.w - a.w) * t,
        h: a.h + (b.h - a.h) * t,
      }
      current.current = r
      el.style.left = `${r.x}px`
      el.style.top = `${r.y}px`
      el.style.width = `${r.w}px`
      el.style.height = `${r.h}px`
      const shape = getShape()
      if (shape) {
        shape.setAttribute('x', String(r.x + BLEED))
        shape.setAttribute('y', String(r.y + BLEED))
        shape.setAttribute('width', String(r.w))
        shape.setAttribute('height', String(r.h))
      }
    },
    [getShape, revealActions],
  )

  const { setTarget, jumpTo } = useSpring(spring, apply)
  jumpRef.current = jumpTo

  // Re-targets from wherever the card currently is — including mid-flight —
  // so interrupting one layout change with another never jumps.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      from.current = rect
      to.current = rect
      apply({ x: 1 })
      return
    }
    from.current = current.current
    to.current = rect
    const a = from.current
    const b = to.current
    const biggest = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.w - a.w), Math.abs(b.h - a.h))
    landFrac.current = biggest > LAND_WITHIN_PX ? 1 - LAND_WITHIN_PX / biggest : 0
    revealFrac.current = biggest > REVEAL_WITHIN_PX ? 1 - REVEAL_WITHIN_PX / biggest : 0
    landed.current = false
    jumpTo({ x: 0, y: 0 })
    setTarget({ x: 1, y: 0 })
  }, [rect.x, rect.y, rect.w, rect.h]) // eslint-disable-line react-hooks/exhaustive-deps

  // Controls hide at once on collapse; on expand they wait for the card to
  // report landed (see apply), with a fallback so they can never be stuck.
  useEffect(() => {
    const actions = actionsRef.current
    if (!actions) return
    if (!expanded) {
      revealPending.current = false
      actions.style.transition = 'opacity 90ms ease-out'
      actions.style.opacity = '0'
      return
    }
    revealPending.current = true
    if (landed.current) revealActions()
    const id = window.setTimeout(() => {
      if (revealPending.current) revealActions()
    }, ACTIONS_FALLBACK_MS)
    return () => window.clearTimeout(id)
  }, [expanded, revealActions])

  const style: CSSProperties = {
    left: initial.x,
    top: initial.y,
    width: initial.w,
    height: initial.h,
    zIndex,
  }

  return (
    <div
      ref={elRef}
      className="ax-card"
      style={style}
      data-expanded={expanded}
      data-dimmed={dimmed}
      onClick={() => (expanded ? onCollapse() : onExpand())}
    >
      <div className="ax-card__icon">{item.icon}</div>

      <button
        type="button"
        className="ax-card__more"
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.title}`}
        aria-expanded={expanded}
        onClick={(e) => {
          e.stopPropagation()
          if (expanded) onCollapse()
          else onExpand()
        }}
      >
        <ArrowIcon />
      </button>

      <div ref={actionsRef} className="ax-card__actions" aria-hidden={!expanded}>
        <button
          type="button"
          className="ax-card__primary"
          tabIndex={expanded ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation()
            onPrimary()
          }}
        >
          {primaryAction}
          <CopyIcon />
        </button>
        <button
          type="button"
          className="ax-card__secondary"
          tabIndex={expanded ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation()
            onSecondary()
          }}
        >
          {secondaryAction}
        </button>
      </div>

      <div className="ax-card__text">
        <div className="ax-card__title">{item.title}</div>
        <div className="ax-card__subtitle">{item.subtitle}</div>
      </div>
    </div>
  )
}

/**
 * Card expand/collapse: a 2x2 grid of glass cards where one can open to the grid's
 * full width on top while the other three tuck into a row beneath it —
 * every card moving between the two layouts on its own spring.
 *
 * All cards are absolutely positioned inside a fixed-size stage, and each
 * animates its own left/top/width/height between its rect in the previous
 * layout and its rect in the new one (rather than a CSS grid change the
 * browser can only snap), so any card can be re-targeted mid-flight. The
 * glass itself is the library's lit-glass material (see LitGooFilter): each
 * card's shape lives in one shared SVG behind the cards, in its own filtered
 * group so overlapping cards stack with their own shadow and rim instead of
 * fusing, and each card's spring drives its shape directly. Text
 * and icons are anchored to fixed corners of their card at a constant
 * size, so nothing reflows or rescales while a card is resizing; the
 * action controls an expanded card shows fade in on a short fixed delay
 * once it's mostly open. Moving the pointer off the group collapses it back
 * to the grid.
 */
export function CardExpand({
  cards,
  cardWidth = 160,
  cardHeight = 125,
  gap = 16,
  expandedHeight = 180,
  tuckedHeight = 100,
  spring = DEFAULT_SPRING,
  primaryAction = 'Copy Link',
  secondaryAction = 'Customize',
  onPrimaryAction,
  onSecondaryAction,
  className,
  style,
  ...rest
}: CardExpandProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const filterId = useId().replace(/:/g, '')
  const shapes = useRef<Record<string, SVGRectElement | null>>({})
  // Each glass shape's first-paint geometry, kept constant across renders:
  // React must not rewrite x/y/width/height on later renders, or a layout
  // change would snap every shape to its target before its spring runs.
  const firstRects = useRef<Record<string, Rect>>({})

  useEffect(() => {
    if (expandedId === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpandedId(null)
    }
    // Touch has no hover, so there's no "pointer left" to wait for — an
    // outside tap collapses instead.
    function onPointerDown(e: PointerEvent) {
      if (e.pointerType !== 'touch') return
      if (stageRef.current?.contains(e.target as Node)) return
      setExpandedId(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [expandedId])

  const cols = 2
  const stageW = cols * cardWidth + (cols - 1) * gap
  const rows = Math.ceil(cards.length / cols)
  const gridH = rows * cardHeight + (rows - 1) * gap
  const expandedLayoutH = expandedHeight + gap + tuckedHeight
  const stageH = Math.max(gridH, expandedLayoutH)

  function rectFor(index: number): Rect {
    if (expandedId === null) {
      return {
        x: (index % cols) * (cardWidth + gap),
        y: Math.floor(index / cols) * (cardHeight + gap) + (stageH - gridH) / 2,
        w: cardWidth,
        h: cardHeight,
      }
    }
    const expandedIndex = cards.findIndex((c) => c.id === expandedId)
    const top = (stageH - expandedLayoutH) / 2
    if (index === expandedIndex) return { x: 0, y: top, w: stageW, h: expandedHeight }
    const others = cards.length - 1
    const tuckedW = (stageW - (others - 1) * gap) / others
    const order = index < expandedIndex ? index : index - 1
    return { x: order * (tuckedW + gap), y: top + expandedHeight + gap, w: tuckedW, h: tuckedHeight }
  }

  const boxW = stageW + BLEED * 2
  const boxH = stageH + BLEED * 2
  // The expanded card's glass is drawn last so it sits over the others
  // while they're still tucking away.
  const shapeOrder = cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => Number(a.c.id === expandedId) - Number(b.c.id === expandedId))

  return (
    <div
      ref={stageRef}
      className={className ? `ax-card-expand ${className}` : 'ax-card-expand'}
      style={{ width: stageW, height: stageH, ...style }}
      // The stage is exactly the cards' bounding box in both layouts, so
      // the gaps between cards count as "inside" — moving across one doesn't
      // collapse it, only leaving the whole group does. Mouse/pen only: a
      // touch "leave" fires the instant the finger lifts.
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch') setExpandedId(null)
      }}
      {...rest}
    >
      <svg
        className="ax-card-expand__glass"
        style={{ left: -BLEED, top: -BLEED, width: boxW, height: boxH }}
        aria-hidden="true"
      >
        <defs>
          <LitGooFilter id={filterId} width={boxW} height={boxH} blur={1.2} bodyOpacity={0.1} shadowOffset={8} />
        </defs>
        {shapeOrder.map(({ c, i }) => {
          firstRects.current[c.id] ??= rectFor(i)
          const r = firstRects.current[c.id]
          return (
            <g key={c.id} filter={`url(#${filterId})`}>
              <rect
                ref={(el) => {
                  shapes.current[c.id] = el
                }}
                x={r.x + BLEED}
                y={r.y + BLEED}
                width={r.w}
                height={r.h}
                rx={RADIUS}
                fill="#000"
              />
            </g>
          )
        })}
      </svg>

      {cards.map((item, i) => (
        <Card
          key={item.id}
          item={item}
          rect={rectFor(i)}
          getShape={() => shapes.current[item.id] ?? null}
          expanded={expandedId === item.id}
          dimmed={expandedId !== null && expandedId !== item.id}
          zIndex={expandedId === item.id ? 2 : 1}
          spring={spring}
          primaryAction={primaryAction}
          secondaryAction={secondaryAction}
          onExpand={() => setExpandedId(item.id)}
          onCollapse={() => setExpandedId(null)}
          onPrimary={() => onPrimaryAction?.(item.id)}
          onSecondary={() => onSecondaryAction?.(item.id)}
        />
      ))}
    </div>
  )
}

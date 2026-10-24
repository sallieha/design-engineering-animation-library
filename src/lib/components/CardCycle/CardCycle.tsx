import { useEffect, useId, useRef, useState, type HTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react'
import { LitGooFilter } from '../GooeySurface'
import './CardCycle.css'

export interface CardCycleItem {
  id: string
  /** The card's photo. */
  src: string
  /** Describes the photo for assistive tech. */
  alt: string
  /** Where in the photo the card is cropped to, and how far it's zoomed in
   * (x/y are percentages of the image, zoom 1 shows it as-is). Lets one image
   * serve several cards by showing a different part of it. */
  focus?: { x: number; y: number; zoom?: number }
}

export interface CardCycleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  cards: CardCycleItem[]
  /** Cycles the stack on its own, pausing while a pointer is on it. Off by default: a stack that reshuffles itself on a timer keeps moving while you're trying to read the page. */
  auto?: boolean
  /** Seconds between automatic cycles, when `auto` is on. */
  every?: number
}

// The block the stack lives in, one card's size, and how far each step back
// moves a card (right, up, and away from the viewer).
const W = 360
const H = 440
const CW = 196
const CH = 308
const STEP_X = 34
const STEP_Y = 26
const STEP_Z = 70
const SKEW = 6
const PERSPECTIVE = 900
// Room around each card for its glass shadow's blur and offset.
const BLEED = 48
const RADIUS = 22
// The photo sits this far inside the card's glass edge, so the glass reads as
// a frame around it (where a plain photo card would have an outline).
const INSET = 5

const slot = (k: number) =>
  `translate3d(${k * STEP_X}px, ${-k * STEP_Y}px, ${-k * STEP_Z}px) skewY(${SKEW}deg)`

interface Drag {
  id: string
  real: boolean
  pid: number
  x: number
  y: number
  dx: number
  dy: number
  t: number
}

/**
 * Card cycle: a stack of photo cards in depth, each a step further back and
 * up and to the right, slanted. Press the front card — or drag and fling it —
 * and it goes straight to the back while the rest step forward. With `auto`
 * it does that by itself every few seconds.
 *
 * A card IS its slot. The order is the only state (which card is in front,
 * which is behind it), and a slot is a fixed transform, so moving a card is
 * just changing its slot and letting a CSS transition carry it — which also
 * means it always ends *exactly* on the slot, with no tail to crawl and
 * snap. The card sent back takes the back slot's paint order at once and
 * travels there behind the others, which needs paint order to be the
 * z-index rather than the depth: the stage is flat (no preserve-3d) and the
 * perspective sits on the stage itself, aimed at the middle of the block.
 *
 * Each photo is framed by the library's lit glass (see LitGooFilter — the
 * same settings the 5.0 cards use), drawn in an SVG inside the card so it
 * carries the card's 3D transform.
 */
export function CardCycle({ cards, auto = false, every = 4, className, style, ...rest }: CardCycleProps) {
  const filterId = useId().replace(/:/g, '')
  const [order, setOrder] = useState(() => cards.map((c) => c.id))
  const els = useRef<Record<string, HTMLDivElement | null>>({})
  const st = useRef<{ hover: boolean; drag: Drag | null }>({ hover: false, drag: null })

  const n = cards.length
  const spanX = CW + (n - 1) * STEP_X
  const spanY = CH + (n - 1) * STEP_Y
  // The stage is placed so the whole stack — not just the front card — is
  // centered in the block, with the perspective aimed at that block's middle.
  const stageLeft = (W - spanX) / 2
  const stageTop = (H - spanY) / 2 + (n - 1) * STEP_Y
  const originX = spanX / 2
  const originY = CH / 2 - ((n - 1) * STEP_Y) / 2

  // Every card goes back to its slot: no drag survives a swap, so a card can
  // never be left holding where a hand once put it.
  const settle = () => {
    for (const el of Object.values(els.current)) {
      if (el) {
        el.style.transition = ''
        el.style.transform = ''
      }
    }
  }

  const swap = () => {
    settle()
    setOrder((o) => [...o.slice(1), o[0]])
  }

  // The drag: only the grabbed card moves, and the window hears the gesture,
  // so it can't be lost off the edge of the block or picked up by a card the
  // pointer passes over. A real press takes over from a scripted one. Past a
  // little way the card is on a rubber band, so a long drag can't carry it
  // out of the block.
  const unhook = useRef<() => void>(() => {})
  useEffect(() => () => unhook.current(), [])

  const grab = (e: ReactPointerEvent<HTMLDivElement>, id: string, front: boolean) => {
    const s = st.current
    if (s.drag && e.nativeEvent.isTrusted && !s.drag.real) {
      unhook.current()
      s.drag = null
      settle()
    }
    if (!front || s.drag || e.button !== 0) return
    const el = e.currentTarget
    s.drag = { id, real: e.nativeEvent.isTrusted, pid: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, t: performance.now() }
    el.style.transition = 'none'
    const rub = (d: number) => 160 * Math.tanh(d / 160)
    const mine = (ev: PointerEvent) => !!s.drag && ev.pointerId === s.drag.pid && ev.isTrusted === s.drag.real
    const mv = (ev: PointerEvent) => {
      if (!mine(ev) || !s.drag) return
      const d = s.drag
      d.dx = ev.clientX - d.x
      d.dy = ev.clientY - d.y
      const x = rub(d.dx)
      const y = rub(d.dy)
      el.style.transform = `${slot(0)} translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(x * 0.05).toFixed(2)}deg)`
    }
    const up = (ev: PointerEvent) => {
      if (!mine(ev) || !s.drag) return
      const d = s.drag
      s.drag = null
      unhook.current()
      const far = Math.hypot(d.dx, d.dy)
      const quick = far / Math.max(1, performance.now() - d.t) > 0.6
      // A press, or a drag far or quick enough: to the back.
      if (ev.type !== 'pointercancel' && (far < 6 || far > 70 || (quick && far > 24))) {
        swap()
        return
      }
      // Not far enough: it springs back into the front slot.
      settle()
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    unhook.current = () => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      unhook.current = () => {}
    }
  }

  // The timer: one cycle every few seconds, unless a hand is on it.
  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(() => {
      if (!st.current.hover && !st.current.drag && !document.hidden) swap()
    }, Math.max(1.5, every) * 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, every, order])

  const boxW = CW + BLEED * 2
  const boxH = CH + BLEED * 2

  return (
    <div
      className={className ? `ax-card-cycle ${className}` : 'ax-card-cycle'}
      style={{ width: W, height: H, ...style }}
      onPointerEnter={() => {
        st.current.hover = true
      }}
      onPointerLeave={() => {
        st.current.hover = false
      }}
      {...rest}
    >
      {/* The one filter every card's glass refers to: zero-sized rather than
          display:none, which would stop it rendering. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <LitGooFilter id={filterId} width={boxW} height={boxH} blur={1.2} bodyOpacity={0.1} shadowOffset={8} />
        </defs>
      </svg>

      <div
        className="ax-card-cycle__stage"
        style={{
          left: stageLeft,
          top: stageTop,
          width: CW,
          height: CH,
          perspective: PERSPECTIVE,
          perspectiveOrigin: `${originX}px ${originY}px`,
        }}
      >
        {cards.map((c) => {
          const k = order.indexOf(c.id)
          const front = k === 0
          return (
            <div
              key={c.id}
              ref={(el) => {
                els.current[c.id] = el
              }}
              className="ax-card-cycle__card"
              data-front={front || undefined}
              // The slot is a variable the stylesheet turns into the
              // transform; the drag writes the transform itself, which wins
              // until it's cleared.
              style={{ zIndex: n - k, ['--t' as string]: slot(k) }}
              onPointerDown={(e) => grab(e, c.id, front)}
            >
              <svg className="ax-card-cycle__glass" width={boxW} height={boxH} aria-hidden="true">
                <g filter={`url(#${filterId})`}>
                  <rect x={BLEED} y={BLEED} width={CW} height={CH} rx={RADIUS} fill="#000" />
                </g>
              </svg>
              <div className="ax-card-cycle__photo" style={{ inset: INSET, borderRadius: RADIUS - INSET }}>
                <img
                  src={c.src}
                  alt={c.alt}
                  draggable={false}
                  style={{
                    objectPosition: `${c.focus?.x ?? 50}% ${c.focus?.y ?? 50}%`,
                    transformOrigin: `${c.focus?.x ?? 50}% ${c.focus?.y ?? 50}%`,
                    transform: `scale(${c.focus?.zoom ?? 1})`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

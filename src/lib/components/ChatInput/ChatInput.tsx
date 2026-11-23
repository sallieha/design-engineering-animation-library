import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type HTMLAttributes,
} from 'react'
import { LitGooFilter } from '../GooeySurface'
import './ChatInput.css'

export interface ChatInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  placeholder?: string
  /** What the other side says back, cycled in order. An entry that's a list is a double text: its lines land one after another. */
  replies?: (string | string[])[]
  /** The most messages kept above the input; older ones scroll away. */
  maxMessages?: number
  /** A soft tick as a message goes out and again as the reply lands. */
  sound?: boolean
}

interface Message {
  id: number
  mine: boolean
  text: string
}

const DEFAULT_REPLIES: (string | string[])[] = [
  'Lock in 🔥',
  'Ha, okay, I see you. Tell me more 😄',
  ['Wait, really? That’s kind of wild', 'Love that. Keep going 🙌'],
]

const BLEED = 40
const REPLY_DELAY_MS = 650
const DOUBLE_TEXT_MS = 900
const SENT_MS = 1100
const FLIP_MS = 420
const FLIP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * The library's lit glass (see LitGooFilter — the same settings the 5.0 and
 * 6.0 cards use) behind whatever box it sits in. It measures its parent so a
 * bubble that grows with its text keeps a rim and shadow that fit, and each
 * one carries its own filter since the filter's region is in pixels.
 */
function GlassPane({
  radius,
  tint,
  tintOpacity,
  tail,
}: {
  radius: number
  tint?: string
  tintOpacity?: number
  /** Which bottom corner a message-bubble tail curls out of. */
  tail?: 'left' | 'right'
}) {
  const filterId = useId().replace(/:/g, '')
  const ref = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const host = ref.current?.parentElement
    if (!host) return
    const read = () => setSize({ w: host.offsetWidth, h: host.offsetHeight })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  const boxW = (size?.w ?? 0) + BLEED * 2
  const boxH = (size?.h ?? 0) + BLEED * 2

  return (
    <svg
      ref={ref}
      className="ax-chat__glass"
      width={boxW}
      height={boxH}
      style={{ left: -BLEED, top: -BLEED }}
      aria-hidden="true"
    >
      {size && (
        <>
          <defs>
            <LitGooFilter
              id={filterId}
              width={boxW}
              height={boxH}
              blur={tail ? 2 : 1.2}
              bodyColor={tint}
              bodyOpacity={tintOpacity ?? 0.1}
              shadowOffset={8}
            />
          </defs>
          <g filter={`url(#${filterId})`}>
            <rect x={BLEED} y={BLEED} width={size.w} height={size.h} rx={radius} fill="#000" />
            {tail && (
              <path
                d={tailPath(BLEED, BLEED + size.h)}
                fill="#000"
                transform={tail === 'right' ? `translate(${BLEED * 2 + size.w} 0) scale(-1 1)` : undefined}
              />
            )}
          </g>
        </>
      )}
    </svg>
  )
}

/**
 * A bubble's tail, drawn for the bottom-left corner (the right one is this
 * mirrored): it fills the rounded corner in so the bubble comes to a square
 * point there, which sweeps out to the left in a concave curl. It joins the
 * body inside the same filtered group, so the glass fuses it into one shape.
 */
const tailPath = (x: number, y: number) =>
  `M ${x} ${y - 11} C ${x} ${y - 5} ${x - 0.6} ${y - 2.5} ${x - 2} ${y - 1.8} ` +
  `C ${x - 3.6} ${y - 1.2} ${x - 3.2} ${y} ${x - 1.5} ${y} ` +
  `C ${x + 3} ${y} ${x + 8} ${y} ${x + 13} ${y} L ${x + 13} ${y - 13} Z`

/** A short sine blip, made on the spot so there's no audio file to ship. */
function blip(ctx: AudioContext, from: number, to: number, seconds: number, gain: number, at = 0) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + seconds)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  osc.connect(amp).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + seconds + 0.02)
}

/**
 * Chat input: a glass pill with a round add button and a round send button. Sending
 * drops your message above the bar, flashes a colored wash up the bottom of
 * the page, flies the send icon off, and a moment later a reply lands; the older
 * bubbles slide up to make room.
 *
 * The stack is laid out normally and only the bubbles that moved are
 * animated, from where they were to where they are (measured from the feed's
 * bottom edge, which doesn't move) — so every bubble ends exactly on its
 * layout position, with nothing to snap at the end.
 */
export function ChatInput({
  placeholder = 'Send Message',
  replies = DEFAULT_REPLIES,
  maxMessages = 5,
  sound = true,
  className,
  ...rest
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sent, setSent] = useState(false)
  const [burst, setBurst] = useState(0)

  const feed = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<number, HTMLDivElement>())
  const gaps = useRef(new Map<number, number>())
  const nextId = useRef(1)
  const replyIx = useRef(0)
  const audio = useRef<AudioContext | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const ctx = () => {
    if (!sound) return null
    try {
      audio.current ??= new AudioContext()
      if (audio.current.state === 'suspended') void audio.current.resume()
      return audio.current
    } catch {
      return null
    }
  }

  const push = (mine: boolean, body: string) => {
    setMessages((m) => [...m, { id: nextId.current++, mine, text: body }].slice(-maxMessages))
  }

  // Slide each bubble that moved from its old spot to its new one.
  useLayoutEffect(() => {
    const feedEl = feed.current
    if (!feedEl) return
    const next = new Map<number, number>()
    nodes.current.forEach((el, id) => {
      const gap = feedEl.clientHeight - (el.offsetTop + el.offsetHeight)
      next.set(id, gap)
      const before = gaps.current.get(id)
      if (before !== undefined && Math.abs(gap - before) > 0.5) {
        el.animate([{ transform: `translateY(${gap - before}px)` }, { transform: 'none' }], {
          duration: FLIP_MS,
          easing: FLIP_EASE,
        })
      }
    })
    gaps.current = next
  }, [messages])

  const send = (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    push(true, body)
    setSent(true)
    setBurst((b) => b + 1)
    later(() => setSent(false), SENT_MS)

    const audioCtx = ctx()
    if (audioCtx) blip(audioCtx, 520, 880, 0.12, 0.05)

    const reply = replies[replyIx.current++ % replies.length]
    const lines = Array.isArray(reply) ? reply : [reply]
    lines.forEach((line, i) => {
      later(() => {
        push(false, line)
        const c = ctx()
        if (c) {
          blip(c, 660, 660, 0.1, 0.035)
          blip(c, 990, 990, 0.16, 0.035, 0.08)
        }
      }, REPLY_DELAY_MS + i * DOUBLE_TEXT_MS)
    })
  }

  const armed = text.trim().length > 0

  return (
    <div className={['ax-chat', className].filter(Boolean).join(' ')} {...rest}>
      {burst > 0 && (
        <div className="ax-chat__burst" key={burst} aria-hidden="true">
          <span className="ax-chat__blob ax-chat__blob--red" />
          <span className="ax-chat__blob ax-chat__blob--blue" />
          <span className="ax-chat__blob ax-chat__blob--purple" />
        </div>
      )}

      <div className="ax-chat__feed" ref={feed} role="log" aria-live="polite">
        {messages.map((m) => (
          <div
            key={m.id}
            ref={(el) => {
              // Called with null and then the element again on every render;
              // the saved positions have to survive that, so only `nodes`
              // is touched here (gaps are rebuilt from it after each change).
              if (el) nodes.current.set(m.id, el)
              else nodes.current.delete(m.id)
            }}
            className={`ax-chat__msg ${m.mine ? 'ax-chat__msg--mine' : 'ax-chat__msg--theirs'}`}
          >
            <GlassPane
              radius={14}
              tint={m.mine ? '#ffffff' : '#3a3a3a'}
              tintOpacity={m.mine ? 0.24 : 0.55}
              tail={m.mine ? 'right' : 'left'}
            />
            <span className="ax-chat__msg-text">{m.text}</span>
          </div>
        ))}
      </div>

      <form className="ax-chat__bar" onSubmit={send}>
        <GlassPane radius={30} />
        <button type="button" className="ax-chat__btn glass" aria-label="Add attachment">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <input
          className="ax-chat__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="Message"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="ax-chat__btn glass" aria-label="Send message" disabled={!armed}>
          <svg
            className="ax-chat__arrow"
            data-armed={armed || sent}
            data-sent={sent}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="m21.854 2.147-10.94 10.939" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </form>
    </div>
  )
}

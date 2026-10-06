import { useCallback, useId, useRef, useState, type ButtonHTMLAttributes } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import { LitGooFilter } from '../GooeySurface'
import './GooeyToggle.css'

export interface GooeyToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'children'> {
  /** Controlled value. Omit to let the toggle manage its own state. */
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  /** Track width, in px. */
  width?: number
  /** Track height, in px. */
  height?: number
  /** Gap between the knob and the track's edge, in px. */
  inset?: number
  /** Track tint once on, as any CSS color. */
  onColor?: string
  /** Spring for the knob's leading edge (fast). */
  headSpring?: SpringConfig
  /** Spring for the knob's trailing edge (slower — the lag is what stretches the liquid). */
  tailSpring?: SpringConfig
}

const HEAD_SPRING: SpringConfig = { stiffness: 420, damping: 28, mass: 1 }
const TAIL_SPRING: SpringConfig = { stiffness: 70, damping: 12, mass: 1 }
// Room around the track for the shadow's blur and offset.
const BLEED = 24

/**
 * Gooey on/off toggle: the knob is two overlapping circles that run on two
 * different springs — a fast leading edge and a slower trailing edge. A
 * goo filter (blur, then threshold the alpha back to a hard edge) fuses
 * them, so while they're apart the knob stretches into a liquid capsule
 * with a thinning neck, then rounds back into one circle as the tail
 * catches up. At rest both circles sit at the same spot, so it's just a
 * knob. Knob and track are both the library's lit-glass material (an
 * SVG-lit imitation of `.glass` — see LitGooFilter for why), the knob just
 * a good deal whiter; the track is tinted in as it turns on.
 */
export function GooeyToggle({
  checked,
  defaultChecked = false,
  onChange,
  width = 96,
  height = 52,
  inset = 7,
  onColor = 'rgba(110, 140, 255, 0.7)',
  headSpring = HEAD_SPRING,
  tailSpring = TAIL_SPRING,
  className,
  onClick,
  ...rest
}: GooeyToggleProps) {
  const [inner, setInner] = useState(defaultChecked)
  const on = checked ?? inner
  const trackFilterId = useId().replace(/:/g, '') + 't'
  const knobFilterId = useId().replace(/:/g, '') + 'k'

  const headRef = useRef<SVGCircleElement>(null)
  const tailRef = useRef<SVGCircleElement>(null)
  const tintRef = useRef<SVGRectElement>(null)

  const r = (height - inset * 2) / 2
  const travel = width - inset * 2 - r * 2
  const boxWidth = width + BLEED * 2
  const boxHeight = height + BLEED * 2
  const cy = BLEED + height / 2
  const xAt = (p: number) => BLEED + inset + r + travel * p

  // Both circles are redrawn together from the latest position of each
  // spring: the trailing circle also *shrinks* in proportion to how far it
  // lags the leading one, which tapers the fused shape into a teardrop
  // being pulled along rather than a plain capsule.
  const pos = useRef({ head: on ? 1 : 0, tail: on ? 1 : 0 })
  const draw = useCallback(() => {
    const { head: h, tail: t } = pos.current
    const lag = Math.min(1, Math.abs(h - t) * 2.4)
    headRef.current?.setAttribute('cx', String(xAt(h)))
    tailRef.current?.setAttribute('cx', String(xAt(t)))
    tailRef.current?.setAttribute('r', String(r * (1 - 0.45 * lag)))
    tintRef.current?.setAttribute('opacity', String(Math.min(1, Math.max(0, h))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, inset])
  const applyHead = useCallback(
    (value: { x: number }) => {
      pos.current.head = value.x
      draw()
    },
    [draw],
  )
  const applyTail = useCallback(
    (value: { x: number }) => {
      pos.current.tail = value.x
      draw()
    },
    [draw],
  )

  const head = useSpring(headSpring, applyHead, { x: on ? 1 : 0, y: 0 })
  const tail = useSpring(tailSpring, applyTail, { x: on ? 1 : 0, y: 0 })

  // Drive both springs whenever the (possibly controlled) value changes.
  const lastOn = useRef(on)
  if (lastOn.current !== on) {
    lastOn.current = on
    const target = { x: on ? 1 : 0, y: 0 }
    head.setTarget(target)
    tail.setTarget(target)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={className ? `ax-gooey-toggle ${className}` : 'ax-gooey-toggle'}
      style={{ width, height }}
      onClick={(e) => {
        onClick?.(e)
        const next = !on
        if (checked === undefined) setInner(next)
        onChange?.(next)
      }}
      {...rest}
    >
      <svg
        className="ax-gooey-toggle__art"
        style={{ left: -BLEED, top: -BLEED, width: boxWidth, height: boxHeight }}
        aria-hidden="true"
      >
        <defs>
          <LitGooFilter id={trackFilterId} width={boxWidth} height={boxHeight} blur={1.2} />
          <LitGooFilter
            id={knobFilterId}
            width={boxWidth}
            height={boxHeight}
            blur={4}
            bodyOpacity={0.28}
            shadowOpacity={0.35}
            shadowOffset={3}
            shadowBlur={3}
          />
        </defs>
        <g filter={`url(#${trackFilterId})`}>
          <rect x={BLEED} y={BLEED} width={width} height={height} rx={height / 2} fill="#000" />
        </g>
        <rect
          ref={tintRef}
          x={BLEED}
          y={BLEED}
          width={width}
          height={height}
          rx={height / 2}
          fill={onColor}
          opacity={on ? 1 : 0}
        />
        <g filter={`url(#${knobFilterId})`}>
          <circle ref={tailRef} cx={xAt(on ? 1 : 0)} cy={cy} r={r} fill="#000" />
          <circle ref={headRef} cx={xAt(on ? 1 : 0)} cy={cy} r={r} fill="#000" />
        </g>
      </svg>
    </button>
  )
}

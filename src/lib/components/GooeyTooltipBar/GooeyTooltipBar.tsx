import { useCallback, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import { LitGooFilter } from '../GooeySurface'
import './GooeyTooltipBar.css'

export interface GooeyTooltipBarItem {
  icon: ReactNode
  label: string
  /** Small notification dot on the icon. */
  dot?: boolean
  onSelect?: () => void
}

export interface GooeyTooltipBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: GooeyTooltipBarItem[]
  /** Which side of the bar the bubble rises out of. */
  placement?: 'top' | 'bottom'
  /** Height of the tooltip blob, in px. */
  tipHeight?: number
  /** Resting gap between the tooltip and the bar, in px — must stay wider than ~2x the goo blur or the two never visibly separate. */
  tipGap?: number
  /** Horizontal padding inside the tooltip around its label, in px. */
  tipPadding?: number
}

const HEAD: SpringConfig = { stiffness: 380, damping: 26, mass: 1 }
const TAIL: SpringConfig = { stiffness: 110, damping: 15, mass: 1 }
const EVEN: SpringConfig = { stiffness: 260, damping: 22, mass: 1 }
const LIFT: SpringConfig = { stiffness: 200, damping: 26, mass: 1 }
// Blur radius feeding the goo threshold (see LitGooFilter).
const GOO_BLUR = 4
// Extra room around the shapes for the blur, shadow and overshoot.
const BLEED = 48

/**
 * Toolbar with a gooey tooltip: one liquid bubble that grows out of the
 * toolbar pill (above or below it, per `placement`), fused to it by the
 * goo filter and then pinching off as it settles, and — instead of a separate tooltip per icon — stretches along
 * the bar to whichever icon is hovered next. Its two side edges run on two
 * different springs, the leading one fast and the trailing one slow, so
 * while it travels it's pulled out into a long drop that then rounds back
 * up to the new label's width. Leaving the bar sinks it back into the pill.
 *
 * The bubble's text sits in a layer that exactly follows the bubble's own
 * box and clips to it, so the old label is cut off as the box narrows
 * instead of overflowing it.
 */
export function GooeyTooltipBar({
  items,
  placement = 'top',
  tipHeight = 32,
  tipGap = 12,
  tipPadding = 12,
  className,
  style,
  ...rest
}: GooeyTooltipBarProps) {
  const filterId = useId().replace(/:/g, '')
  const barRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const measureRefs = useRef<(HTMLSpanElement | null)[]>([])
  const rectRef = useRef<SVGRectElement>(null)
  const labelBoxRef = useRef<HTMLDivElement>(null)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [labelIndex, setLabelIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [dir, setDir] = useState(0)
  const hoveredRef = useRef(false)
  const labelWidths = useRef<number[]>([])

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const measure = () => {
      setSize({ w: bar.offsetWidth, h: bar.offsetHeight })
      labelWidths.current = measureRefs.current.map((el) => el?.offsetWidth ?? 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [items])

  const barW = size.w
  const barH = size.h
  const above = placement === 'top'
  const oy = (above ? tipHeight + tipGap : 0) + BLEED
  const boxWidth = barW + BLEED * 2
  const boxHeight = barH + tipHeight + tipGap + BLEED * 2

  const state = useRef({ l: 0, r: 0, lift: 0 })

  const draw = useCallback(() => {
    const rect = rectRef.current
    const box = labelBoxRef.current
    if (!rect || !box) return
    const { l, r, lift } = state.current
    const w = Math.max(0, r - l)
    const hiddenY = (barH - tipHeight) / 2
    const shownY = above ? -(tipHeight + tipGap) : barH + tipGap
    const y = hiddenY + (shownY - hiddenY) * lift
    rect.setAttribute('x', String(BLEED + l))
    rect.setAttribute('y', String(oy + y))
    rect.setAttribute('width', String(w))
    rect.setAttribute('height', String(tipHeight))
    rect.setAttribute('rx', String(Math.min(tipHeight / 2, w / 2)))
    box.style.left = `${l}px`
    box.style.top = `${y}px`
    box.style.width = `${w}px`
  }, [barH, tipHeight, tipGap, oy, above])

  const leftSpring = useSpring(dir > 0 ? TAIL : dir < 0 ? HEAD : EVEN, (v) => {
    state.current.l = v.x
    draw()
  })
  const rightSpring = useSpring(dir > 0 ? HEAD : dir < 0 ? TAIL : EVEN, (v) => {
    state.current.r = v.x
    draw()
  })
  const liftSpring = useSpring(LIFT, (v) => {
    state.current.lift = v.x
    draw()
  })

  const show = (i: number) => {
    const el = btnRefs.current[i]
    if (!el) return
    const cx = el.offsetLeft + el.offsetWidth / 2
    const w = (labelWidths.current[i] ?? 0) + tipPadding * 2
    const nl = cx - w / 2
    const nr = cx + w / 2
    if (!hoveredRef.current) {
      // Emerging from nothing: start as a zero-width sliver at the icon so
      // the bubble grows out of the pill instead of sliding in from
      // wherever it last sank.
      leftSpring.jumpTo({ x: cx, y: 0 })
      rightSpring.jumpTo({ x: cx, y: 0 })
      setDir(0)
    } else {
      setDir(nr > (state.current.l + state.current.r) / 2 ? 1 : -1)
    }
    hoveredRef.current = true
    setLabelIndex(i)
    setVisible(true)
    leftSpring.setTarget({ x: nl, y: 0 })
    rightSpring.setTarget({ x: nr, y: 0 })
    liftSpring.setTarget({ x: 1, y: 0 })
  }

  const hide = () => {
    if (!hoveredRef.current) return
    hoveredRef.current = false
    const c = (state.current.l + state.current.r) / 2
    setDir(0)
    setVisible(false)
    leftSpring.setTarget({ x: c, y: 0 })
    rightSpring.setTarget({ x: c, y: 0 })
    liftSpring.setTarget({ x: 0, y: 0 })
  }

  return (
    <div
      className={className ? `ax-gooey-tips ${className}` : 'ax-gooey-tips'}
      style={style}
      onPointerLeave={hide}
      {...rest}
    >
      <svg
        className="ax-gooey-tips__art"
        style={{ left: -BLEED, top: -oy, width: boxWidth, height: boxHeight }}
        aria-hidden="true"
      >
        <defs>
          <LitGooFilter id={filterId} width={boxWidth} height={boxHeight} blur={GOO_BLUR} bodyOpacity={0.1} />
        </defs>
        <g filter={`url(#${filterId})`}>
          <rect x={BLEED} y={oy} width={barW} height={barH} rx={barH / 2} fill="#000" />
          <rect ref={rectRef} x={BLEED} y={oy} width={0} height={tipHeight} rx={tipHeight / 2} fill="#000" />
        </g>
      </svg>

      <div ref={barRef} className="ax-gooey-tips__bar">
        {items.map((item, i) => (
          <button
            key={item.label}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            type="button"
            className="ax-gooey-tips__item"
            aria-label={item.label}
            onPointerEnter={() => show(i)}
            onFocus={() => show(i)}
            onBlur={hide}
            onClick={item.onSelect}
          >
            {item.icon}
            {item.dot && <span className="ax-gooey-tips__dot" />}
          </button>
        ))}
      </div>

      <div
        ref={labelBoxRef}
        className="ax-gooey-tips__label-box"
        style={{ height: tipHeight }}
        data-visible={visible}
        aria-hidden="true"
      >
        <span className="ax-gooey-tips__label">{items[labelIndex]?.label}</span>
      </div>

      <div className="ax-gooey-tips__measure" aria-hidden="true">
        {items.map((item, i) => (
          <span
            key={item.label}
            ref={(el) => {
              measureRefs.current[i] = el
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

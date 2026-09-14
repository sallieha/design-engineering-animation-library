import { useCallback, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSpring, type SpringConfig } from '../../physics/useSpring'
import './MorphBlob.css'

export interface MorphBlobProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Label shown while the blobs are at rest (apart). */
  children: ReactNode
  /** Spring parameters driving the merge/split cycle's timing. */
  spring?: SpringConfig
  /** Plays the merge/split cycle programmatically instead of a real click. */
  active?: boolean
}

const DEFAULT_SPRING: SpringConfig = { stiffness: 46, damping: 15, mass: 1 }

/**
 * Liquid/blob morph: two circles pull together, fuse, and separate again —
 * the "join then separate" the container-morph and path-morph demos don't
 * attempt. The fusing itself is the classic SVG goo filter (blur the
 * circles, then a feColorMatrix pushes the alpha channel's contrast back up
 * hard enough that anything still faintly connected by the blur reads as
 * one solid shape, and anything genuinely separate reads as fully
 * transparent again) — CSS alone can't do this; two circles just overlap.
 *
 * One click plays one full cycle rather than toggling a persistent state,
 * since "join, then separate" only makes sense as a single pass — clicking
 * again replays it. The whole apart→merge→apart shape comes from mapping a
 * single 0→1 spring value through sin(t·π): 0 and 1 both give a separation
 * of 1 (apart), 0.5 gives 0 (fully merged), with no need to reverse the
 * spring's own target mid-flight.
 */
export function MorphBlob({ children, spring = DEFAULT_SPRING, active, className, style, onClick, ...rest }: MorphBlobProps) {
  const filterId = useId()
  const triggerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const circleARef = useRef<HTMLDivElement>(null)
  const circleBRef = useRef<HTMLDivElement>(null)

  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const playingRef = useRef(false)

  const applyT = useCallback((value: { x: number }) => {
    const t = Math.min(1, Math.max(0, value.x))
    const separation = 1 - Math.sin(t * Math.PI)

    const overlay = overlayRef.current
    const circleA = circleARef.current
    const circleB = circleBRef.current
    if (overlay && circleA && circleB) {
      const width = overlay.clientWidth
      const height = overlay.clientHeight
      const centerX = width / 2
      const centerY = height / 2
      const restLeftX = width * 0.32
      const restRightX = width * 0.68

      const ax = centerX - (centerX - restLeftX) * separation
      const bx = centerX + (restRightX - centerX) * separation
      circleA.style.transform = `translate(${ax.toFixed(2)}px, ${centerY.toFixed(2)}px) translate(-50%, -50%)`
      circleB.style.transform = `translate(${bx.toFixed(2)}px, ${centerY.toFixed(2)}px) translate(-50%, -50%)`
    }

    if (labelRef.current) labelRef.current.style.opacity = String(separation)

    // Both endpoints of the sine map give separation===1 (apart) — settling
    // at t===1 looks pixel-identical to the resting, un-played state, so
    // it's safe to unmount here with no visible seam.
    if (t >= 0.999 && playingRef.current) {
      playingRef.current = false
      setMounted(false)
    }
  }, [])

  const { setTarget, jumpTo } = useSpring(spring, applyT, { x: 0, y: 0 })

  const play = useCallback(() => {
    if (playingRef.current) return
    const el = triggerRef.current
    if (!el) return
    const box = el.getBoundingClientRect()
    setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
    playingRef.current = true
    jumpTo({ x: 0, y: 0 })
    setMounted(true)
    requestAnimationFrame(() => setTarget({ x: 1, y: 0 }))
  }, [jumpTo, setTarget])

  useEffect(() => {
    if (active === undefined) return
    if (active) play()
  }, [active, play])

  return (
    <>
      <div
        ref={triggerRef}
        className={className ? `ax-morph-blob ${className}` : 'ax-morph-blob'}
        data-hidden={mounted}
        style={style}
        onClick={(e) => {
          onClick?.(e)
          play()
        }}
        {...rest}
      >
        {children}
      </div>

      {mounted &&
        rect &&
        createPortal(
          // Portaled to <body> for the same reason as MorphContainer's
          // overlay: `position: fixed` resolves against the nearest
          // transformed ancestor, not the true viewport, and this page's
          // own `.playground__stack` has a `transform` — without the
          // portal, the top/left measured from the trigger's real
          // getBoundingClientRect() would land in the wrong box.
          <div
            ref={overlayRef}
            className={`ax-morph-blob-overlay glass${className ? ` ${className}` : ''}`}
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          >
            <div ref={labelRef} className="ax-morph-blob-overlay__label">
              {children}
            </div>
            <div className="ax-morph-blob-overlay__blobs" style={{ filter: `url(#${filterId})` }}>
              <div ref={circleARef} className="ax-morph-blob-overlay__circle" />
              <div ref={circleBRef} className="ax-morph-blob-overlay__circle" />
            </div>
            <svg width="0" height="0" className="ax-morph-blob-overlay__defs" aria-hidden="true">
              <defs>
                <filter id={filterId}>
                  <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                  <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
                </filter>
              </defs>
            </svg>
          </div>,
          document.body,
        )}
    </>
  )
}

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
  /** Expanded panel height, in px. */
  panelHeight?: number
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

const DEFAULT_SPRING: SpringConfig = { stiffness: 210, damping: 26, mass: 1 }

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
 */
export function MorphContainer({
  children,
  panelContent,
  panelWidth = 340,
  panelHeight = 220,
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
  const backdropRef = useRef<HTMLDivElement>(null)
  const pillLabelRef = useRef<HTMLDivElement>(null)
  const panelLabelRef = useRef<HTMLDivElement>(null)

  const [mounted, setMounted] = useState(false)
  const [firstRect, setFirstRect] = useState<Rect | null>(null)
  const [lastRect, setLastRect] = useState<Rect | null>(null)

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

      if (backdropRef.current) backdropRef.current.style.opacity = String(clamp01(t / 0.6))
      // Crossfades the pill's own label out and the panel's content in —
      // the container itself never pops between two looks, only this inner
      // content does, same as the underlying material design "container
      // transform" pattern this technique is named for.
      if (pillLabelRef.current) pillLabelRef.current.style.opacity = String(clamp01(1 - t / 0.25))
      if (panelLabelRef.current) panelLabelRef.current.style.opacity = String(clamp01((t - 0.6) / 0.4))

      // Settling back at the pill's own rect means the overlay is now
      // pixel-identical to the trigger underneath — safe to unmount it and
      // reveal the real button with no visible seam.
      if (t <= 0.001 && directionRef.current === 'closing') setMounted(false)
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

    setFirstRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    setLastRect({
      top: (window.innerHeight - height) / 2,
      left: (window.innerWidth - width) / 2,
      width,
      height,
    })
    directionRef.current = 'opening'
    setMounted(true)
    // One frame's delay so the overlay paints at the pill's own rect (t=0)
    // before the spring starts pulling it toward the panel — otherwise the
    // very first frame could be scheduled before firstRect/lastRect commit.
    requestAnimationFrame(() => setTarget({ x: 1, y: 0 }))
  }, [panelWidth, panelHeight, setTarget])

  const close = useCallback(() => {
    directionRef.current = 'closing'
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
          <>
            <div ref={backdropRef} className="ax-morph-backdrop" onClick={close} aria-hidden="true" />
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
              <div ref={pillLabelRef} className="ax-morph-overlay__pill-label">
                {children}
              </div>
              <div ref={panelLabelRef} className="ax-morph-overlay__panel-content">
                {panelContent ?? (
                  <>
                    <p className="ax-morph-overlay__panel-title">Expanded panel</p>
                    <p className="ax-morph-overlay__panel-subtitle">Same element, new bounds</p>
                  </>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

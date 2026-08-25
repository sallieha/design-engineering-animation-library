import { useCallback, useRef } from 'react'

export type EdgeDirection = 'top' | 'right' | 'bottom' | 'left'

/**
 * Given a pointer position on element entry, figures out which edge of the
 * element the pointer crossed — the geometry powers direction-aware entry
 * animations (e.g. Reveal wiping in from whichever side the cursor arrived
 * from, rather than a single fixed direction).
 */
export function getEntryEdge(rect: DOMRect, clientX: number, clientY: number): EdgeDirection {
  const x = clientX - rect.left
  const y = clientY - rect.top
  const distTop = y
  const distBottom = rect.height - y
  const distLeft = x
  const distRight = rect.width - x

  const min = Math.min(distTop, distBottom, distLeft, distRight)
  if (min === distTop) return 'top'
  if (min === distBottom) return 'bottom'
  if (min === distLeft) return 'left'
  return 'right'
}

/** Pointer position normalized to an element's own box, in [0, 1] on each axis. */
export function getRelativePosition(rect: DOMRect, clientX: number, clientY: number) {
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  }
}

/**
 * Tracks pointer position relative to a ref'd element via a single
 * document-level listener while the pointer is "active" (e.g. hovering),
 * rather than attaching per-element mousemove handlers.
 */
export function usePointerTracking<T extends HTMLElement>(elementRef: React.RefObject<T | null>) {
  const rectRef = useRef<DOMRect | null>(null)

  const measure = useCallback(() => {
    rectRef.current = elementRef.current?.getBoundingClientRect() ?? null
    return rectRef.current
  }, [elementRef])

  return { measure, rect: rectRef }
}

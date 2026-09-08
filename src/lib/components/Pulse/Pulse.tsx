import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import './Pulse.css'

export interface PulseProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode
  /** CSS color for the confirmation flash, e.g. 'rgba(124,159,255,.5)'. */
  color?: string
  /** How long the flash takes to rise and fade, in ms. */
  duration?: number
  /** Fires the flash programmatically (e.g. a scripted demo loop) on each rising edge, instead of requiring a real click. */
  active?: boolean
}

/**
 * A brief full-element color flash on click — reads as a confirmation
 * ("that registered") rather than a continuous hover/press state. Each
 * trigger remounts the flash element (via a bumped key) so a rapid second
 * click restarts the animation from a clean flash instead of blending with
 * one still fading out.
 */
export function Pulse({
  children,
  color = 'rgba(124, 159, 255, 0.5)',
  duration = 480,
  active,
  style,
  className,
  onClick,
  ...rest
}: PulseProps) {
  const [flashKey, setFlashKey] = useState(0)
  const [flashing, setFlashing] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevActive = useRef(active)

  const trigger = useCallback(() => {
    if (flashTimer.current !== null) clearTimeout(flashTimer.current)
    setFlashKey((k) => k + 1)
    setFlashing(true)
    flashTimer.current = setTimeout(() => {
      setFlashing(false)
      flashTimer.current = null
    }, duration)
  }, [duration])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      onClick?.(event)
      trigger()
    },
    [onClick, trigger],
  )

  useEffect(() => {
    if (active && !prevActive.current) trigger()
    prevActive.current = active
  }, [active, trigger])

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) clearTimeout(flashTimer.current)
    }
  }, [])

  return (
    <div
      className={className ? `ax-pulse ${className}` : 'ax-pulse'}
      style={{ '--pulse-color': color, '--pulse-duration': `${duration}ms`, ...style } as React.CSSProperties}
      onClick={handleClick}
      {...rest}
    >
      <span key={flashKey} className="ax-pulse__flash" data-flashing={flashing} aria-hidden="true" />
      <span className="ax-pulse__content">{children}</span>
    </div>
  )
}

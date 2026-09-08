import { useEffect, useState } from 'react'
import { Depress, Pulse, Ripple, Snap } from '../lib'
import './ClickPressStates.css'

/**
 * Same autoplay loop as HoverStates' — kept as a page-local copy rather
 * than shared, matching how each page here is currently self-contained.
 * `startDelayMs` also phase-shifts every later cycle, not just the first
 * one — each call keeps its own independent timer forever, so a per-button
 * offset staggers the whole loop into a cascade instead of every button
 * re-syncing back to lockstep on the second rep.
 */
function useAutoPlay(onMs = 1900, offMs = 1500, startDelayMs = 500) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    function tick(next: boolean) {
      if (cancelled) return
      setActive(next)
      timer = setTimeout(() => tick(!next), next ? onMs : offMs)
    }

    timer = setTimeout(() => tick(true), startDelayMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [onMs, offMs, startDelayMs])

  return active
}

// Small per-button phase offset so the four buttons trigger one after
// another rather than all snapping in unison on every cycle — the sync
// was what read as "abrupt" about the loop, not any single button's own
// (already spring/animation-driven) motion. Ordered (both here and in the
// JSX below) so the quick, one-shot effects — Ripple's wave, Pulse's
// flash — fire and finish first, with Depress and Snap's slower,
// continuous scale easing going last rather than overlapping with them.
const STAGGER_MS = 160

function ClickPressStates() {
  const ripple = useAutoPlay(1900, 1500, 400)
  const pulse = useAutoPlay(1900, 1500, 400 + STAGGER_MS)
  const depress = useAutoPlay(1900, 1500, 400 + STAGGER_MS * 2)
  const snap = useAutoPlay(1900, 1500, 400 + STAGGER_MS * 3)

  return (
    <div className="playground">
      <div className="playground__stack">
        <Ripple className="press-button glass" origin="cursor" color="rgba(124,159,255,.5)" active={ripple}>
          Ripple
        </Ripple>

        <Pulse className="press-button glass" color="rgba(124,159,255,.5)" active={pulse}>
          Pulse
        </Pulse>

        <Depress className="press-button glass" scale={0.94} active={depress}>
          Depress
        </Depress>

        <Snap className="press-button glass" overshoot={0.08} active={snap}>
          Snap
        </Snap>
      </div>
    </div>
  )
}

export default ClickPressStates

import { useEffect, useState } from 'react'
import { Elastic, Glow, Gravity, Liquid } from '../lib'
import './HoverStates.css'

/**
 * Alternates a boolean on a slow, asymmetric loop (settle-in slower than
 * release) so every hover state can be demoed on camera without a real
 * cursor — e.g. for a recorded walkthrough. `startDelayMs` also phase-
 * shifts every later cycle, not just the first one — each call keeps its
 * own independent timer forever, so a per-button offset here staggers the
 * whole loop into a cascade instead of every button re-syncing back to
 * lockstep on the second rep.
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

// Small per-button phase offset so the four buttons ripple into their
// hover state one after another rather than all snapping in unison on
// every cycle — the sync was what read as "abrupt" about the loop, not
// any single button's own (already spring-driven) motion.
const STAGGER_MS = 160

function HoverStates() {
  const elastic = useAutoPlay(1900, 1500, 400)
  const glow = useAutoPlay(1900, 1500, 400 + STAGGER_MS)
  const liquid = useAutoPlay(1900, 1500, 400 + STAGGER_MS * 2)
  const gravity = useAutoPlay(1900, 1500, 400 + STAGGER_MS * 3)

  return (
    <div className="playground">
      <div className="playground__grid">
        <Elastic className="hover-button hover-button--top glass" scale={1.03} active={elastic}>
          Elastic
        </Elastic>

        <Glow className="hover-button hover-button--top hover-button--right glass" color="rgba(124,159,255,.4)" active={glow}>
          Glow
        </Glow>

        <Liquid className="hover-button glass" active={liquid}>
          Liquid
        </Liquid>

        <Gravity className="hover-button hover-button--right glass" pull={6} active={gravity}>
          Gravity
        </Gravity>
      </div>
    </div>
  )
}

export default HoverStates

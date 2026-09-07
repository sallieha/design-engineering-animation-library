import { useEffect, useState } from 'react'
import { Elastic, Glow, Gravity, Liquid } from '../lib'
import './HoverStates.css'

/**
 * Alternates a boolean on a slow, asymmetric loop (settle-in slower than
 * release) so every hover state can be demoed on camera without a real
 * cursor — e.g. for a recorded walkthrough.
 */
function useAutoPlay(onMs = 1600, offMs = 1000, startDelayMs = 500) {
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

function HoverStates() {
  const active = useAutoPlay()

  return (
    <div className="playground">
      <div className="playground__grid">
        <Elastic className="hover-button hover-button--top glass" scale={1.03} active={active}>
          Elastic
        </Elastic>

        <Glow className="hover-button hover-button--top hover-button--right glass" color="rgba(124,159,255,.4)" active={active}>
          Glow
        </Glow>

        <Liquid className="hover-button glass" active={active}>
          Liquid
        </Liquid>

        <Gravity className="hover-button hover-button--right glass" pull={6} active={active}>
          Gravity
        </Gravity>
      </div>
    </div>
  )
}

export default HoverStates

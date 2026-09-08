import { useEffect, useState } from 'react'
import { Depress, Pulse, Ripple, Snap } from '../lib'
import './ClickPressStates.css'

/**
 * Same autoplay loop as HoverStates' — kept as a page-local copy rather
 * than shared, matching how each page here is currently self-contained.
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

function ClickPressStates() {
  const active = useAutoPlay()

  return (
    <div className="playground">
      <div className="playground__stack">
        <Depress className="press-button glass" scale={0.94} active={active}>
          Depress
        </Depress>

        <Ripple className="press-button glass" origin="cursor" color="rgba(124,159,255,.5)" active={active}>
          Ripple
        </Ripple>

        <Snap className="press-button glass" overshoot={0.08} active={active}>
          Snap
        </Snap>

        <Pulse className="press-button glass" color="rgba(124,159,255,.5)" active={active}>
          Pulse
        </Pulse>
      </div>
    </div>
  )
}

export default ClickPressStates

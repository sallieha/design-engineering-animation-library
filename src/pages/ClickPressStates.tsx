import { Depress, Pulse, Ripple, Snap } from '../lib'
import './ClickPressStates.css'

/**
 * Unlike HoverStates, this page has no autoplay loop — every effect here
 * is a real click/press response, so it's driven by actual pointer input
 * (each component's own onPointerDown/onPointerUp/onClick handlers) rather
 * than a scripted `active` prop.
 */
function ClickPressStates() {
  return (
    <div className="playground">
      <div className="playground__stack">
        <Ripple className="press-button glass" origin="cursor" color="rgba(124,159,255,.5)">
          Ripple
        </Ripple>

        <Pulse className="press-button glass" color="rgba(124,159,255,.5)">
          Pulse
        </Pulse>

        <Depress className="press-button glass" scale={0.94}>
          Depress
        </Depress>

        <Snap className="press-button glass" overshoot={0.08}>
          Snap
        </Snap>
      </div>
    </div>
  )
}

export default ClickPressStates

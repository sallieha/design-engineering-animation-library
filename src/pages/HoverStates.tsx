import { Elastic, Glow, Gravity, Liquid } from '../lib'
import './HoverStates.css'

/**
 * No autoplay loop — every effect here is a real hover response, driven by
 * actual pointer input (each component's own onPointerEnter/onPointerLeave/
 * onPointerMove handlers, or Gravity's document-level pointer tracking)
 * rather than a scripted `active` prop.
 */
function HoverStates() {
  return (
    <div className="playground">
      <div className="playground__grid">
        <Elastic className="hover-button hover-button--top glass" scale={1.03}>
          Elastic
        </Elastic>

        <Glow className="hover-button hover-button--top hover-button--right glass" color="rgba(124,159,255,.4)">
          Glow
        </Glow>

        <Liquid className="hover-button glass">
          Liquid
        </Liquid>

        <Gravity className="hover-button hover-button--right glass" pull={6}>
          Gravity
        </Gravity>
      </div>
    </div>
  )
}

export default HoverStates

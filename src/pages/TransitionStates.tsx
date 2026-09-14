import { MorphBlob, MorphContainer, MorphPath } from '../lib'
import './TransitionStates.css'

/**
 * Unlike HoverStates/ClickPressStates, this page has no autoplay loop —
 * each demo is a real click response, driven by the component's own
 * onClick handling rather than a scripted `active` prop, matching the
 * cursor-driven convention the other two pages already use.
 *
 * All three demos share the same base pill (same size, same .glass
 * treatment, same resting radius) so the only variable on display is the
 * morph technique itself — a controlled study, not three unrelated demos.
 */
function TransitionStates() {
  return (
    <div className="playground">
      <div className="playground__stack">
        <MorphContainer
          className="morph-button glass"
          panelContent={
            <>
              <p className="ax-morph-overlay__panel-title">Container Morph</p>
              <p className="ax-morph-overlay__panel-subtitle">One element, new bounds — click to collapse</p>
            </>
          }
        >
          Container
        </MorphContainer>

        <MorphPath className="morph-button glass">Path</MorphPath>

        <MorphBlob className="morph-button glass">Liquid</MorphBlob>
      </div>
    </div>
  )
}

export default TransitionStates

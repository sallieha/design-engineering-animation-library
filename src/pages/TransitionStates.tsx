import { MorphContainer, MorphMerge, MorphPath } from '../lib'
import './TransitionStates.css'

/**
 * Unlike HoverStates/ClickPressStates, this page has no autoplay loop —
 * each demo is a real click response, driven by the component's own
 * onClick handling rather than a scripted `active` prop, matching the
 * cursor-driven convention the other two pages already use.
 *
 * Container Morph and Morph Path share the same base pill (same size,
 * same .glass treatment, same resting radius) so the only variable on
 * display between them is the morph technique itself. Merge/Split is a
 * two-pill demo by nature (it has nothing to morph a single pill's shape
 * against) but keeps the same .glass material and overall footprint
 * (200px / 71px, split across two pills instead of one) for visual
 * parity with the other two.
 */
function TransitionStates() {
  return (
    <div className="playground">
      <div className="playground__stack">
        <MorphContainer
          className="morph-button morph-container-button glass"
          panelContent={<p className="ax-morph-overlay__panel-subtitle">One element, new bounds — click to collapse</p>}
        >
          Container Morph
        </MorphContainer>

        <MorphPath className="morph-button glass">Morph Path</MorphPath>

        <MorphMerge className="glass" />
      </div>
    </div>
  )
}

export default TransitionStates

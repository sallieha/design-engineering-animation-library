/**
 * The source file's own viewBox (0 0 21 20) padded the actual path content
 * asymmetrically — 0.75 on the left edge vs. 1.58 on the right — so
 * flexbox centering the svg element centered the wrong box, and the icon
 * read as shifted left inside the button. This viewBox is cropped tightly
 * to the paths' real bounding box (plus a small, even margin on all sides
 * for the round stroke caps), so the visual content is what's centered.
 * Rendered a little under that box's native size, matching how inset this
 * icon sits in the original Figma circle asset — smaller than the button
 * itself rather than nearly filling it.
 */
function CodeIcon() {
  return (
    <svg width="20.5" height="16" viewBox="-0.5 1.33325 21.668 17.33335" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left chevron nudged 0.5px further left (was 5.75/0.75/5.75) — viewBox widened by the same 0.5px on the left edge to give it room instead of clipping. */}
      <path d="M5.25 5.41675L0.25 10.5968L5.25 15.4167" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Right chevron nudged 1px further right (was 14.418/19.418/14.418) — viewBox widened by the same 1px on the right edge to give it room instead of clipping. */}
      <path d="M15.418 5.41675L20.418 10.5968L15.418 15.4167" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.1925 2.08325L9.20508 17.9166" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default CodeIcon

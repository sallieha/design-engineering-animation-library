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
    <svg width="19" height="16" viewBox="0 1.33325 20.168 17.33335" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.75 5.41675L0.75 10.5968L5.75 15.4167" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.418 5.41675L19.418 10.5968L14.418 15.4167" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.1925 2.08325L9.20508 17.9166" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default CodeIcon

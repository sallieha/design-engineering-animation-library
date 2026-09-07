/**
 * Just the three hamburger lines now — the "liquid glass" look itself
 * comes from the shared `.glass` material (see index.css) applied to the
 * wrapping button in SiteMenu.tsx, the same spec the hover-button demo
 * uses, rather than this SVG's own baked-in shadow/blur filters.
 */
function LiquidGlassIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path className="site-menu__line site-menu__line--1" d="M1 2H15" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path className="site-menu__line site-menu__line--2" d="M1 6H15" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path className="site-menu__line site-menu__line--3" d="M1 10H15" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default LiquidGlassIcon

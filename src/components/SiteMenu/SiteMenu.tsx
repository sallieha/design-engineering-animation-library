import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import LiquidGlassIcon from './LiquidGlassIcon'
import './SiteMenu.css'

const PAGES = [
  { to: '/', label: '1.0 Hover States' },
  { to: '/click-press-states', label: '2.0 Click/Press States' },
]

/**
 * Persistent top-center site nav: a liquid-glass circle button that
 * expands into a dropdown listing every page. Rendered once at the layout
 * level (see App.tsx) so it stays mounted — and its open/closed state
 * persists — across route changes.
 */
function SiteMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape, matching normal dropdown behavior.
  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <>
      {/* Rendered as a sibling of .site-menu (not nested inside it) since
         .site-menu has its own `transform`, which makes it the containing
         block for any position:fixed descendant — a backdrop nested inside
         it would size itself to .site-menu's own small box instead of the
         viewport. Sitting outside .site-menu's ref also means a click here
         is naturally treated as an "outside click" by the existing
         pointerdown listener above, closing the menu with no extra handler
         needed. Dims/blocks the demo buttons while the menu is open —
         necessary now that the toggle sits in the middle of the button
         grid, so the dropdown opening on top of them is an intentional
         overlay rather than an accidental visual collision. */}
      <div className="site-menu-backdrop" data-open={open} aria-hidden="true" />

      <div className="site-menu" ref={rootRef} data-open={open}>
        <button
          type="button"
          className="site-menu__toggle glass"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle site menu"
          aria-expanded={open}
        >
          <LiquidGlassIcon />
        </button>

        <nav className="site-menu__dropdown glass" aria-hidden={!open}>
          {PAGES.map((page) => (
            <NavLink
              key={page.to}
              to={page.to}
              end
              className={({ isActive }) => 'site-menu__item' + (isActive ? ' site-menu__item--active' : '')}
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
            >
              {page.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  )
}

export default SiteMenu

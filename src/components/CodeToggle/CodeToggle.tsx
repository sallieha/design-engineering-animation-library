import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { GooeySurface } from '../../lib'
import CodeIcon from './CodeIcon'
import { CODE_SNIPPETS, DEFAULT_SNIPPET } from './codeSnippets'
import './CodeToggle.css'

/**
 * Fixed bottom-center glass circle, same treatment as SiteMenu's toggle —
 * opens a panel showing the real JSX behind whichever page is currently
 * mounted, keyed off the route rather than being page-specific, so it's
 * one persistent control (like SiteMenu) instead of one instance per page.
 */
function CodeToggle() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // Close whenever the route changes — the open panel's content would
  // otherwise silently swap to the new page's code under the user. Adjusted
  // during render (the "reset state when a prop changes" pattern) rather
  // than in an effect, so it takes effect in the same commit as the route
  // change instead of firing a follow-up render one tick later.
  const [lastPathname, setLastPathname] = useState(location.pathname)
  if (location.pathname !== lastPathname) {
    setLastPathname(location.pathname)
    setOpen(false)
  }

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

  const code = CODE_SNIPPETS[location.pathname] ?? DEFAULT_SNIPPET

  return (
    <>
      {/* Sibling of .code-toggle (not nested), same reasoning as SiteMenu's
         backdrop: .code-toggle has its own `transform`, which would make it
         the containing block for a nested position:fixed backdrop instead
         of the viewport. */}
      <div className="code-toggle-backdrop" data-open={open} aria-hidden="true" />

      <div className="code-toggle" ref={rootRef} data-open={open}>
        <GooeySurface
          open={open}
          direction="up"
          align="center"
          triggerSize={32}
          gap={14}
          panelRadius={20}
          contentClassName="code-toggle__panel"
          contentProps={{ 'aria-hidden': !open }}
          trigger={
            <button
              type="button"
              className="code-toggle__button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle code view"
              aria-expanded={open}
            >
              <CodeIcon />
            </button>
          }
        >
          <pre className="code-toggle__code">
            <code>{code}</code>
          </pre>
        </GooeySurface>
      </div>
    </>
  )
}

export default CodeToggle

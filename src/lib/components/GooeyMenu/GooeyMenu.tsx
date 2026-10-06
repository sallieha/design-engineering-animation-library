import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import type { SpringConfig } from '../../physics/useSpring'
import { GooeySurface } from '../GooeySurface'
import './GooeyMenu.css'

export interface GooeyMenuRow {
  label: string
  value?: ReactNode
  /** `muted` dims the whole row (a header line); `badge` renders `value` as a red count pill. */
  variant?: 'muted' | 'badge'
  onSelect?: () => void
}

export interface GooeyMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onClick'> {
  /** Rows shown in the panel that grows out of the trigger. */
  rows: GooeyMenuRow[]
  /** Panel width once fully open, in px. */
  panelWidth?: number
  /** Gap between the open panel's bottom edge and the trigger's top edge, in px. */
  gap?: number
  /** Panel corner radius once fully open, in px. */
  panelRadius?: number
  /** Diameter of the circular trigger, in px. */
  triggerSize?: number
  /** Spring parameters driving the panel's growth out of the trigger. */
  spring?: SpringConfig
  /** Drives the open state programmatically instead of a real click. */
  active?: boolean
}

const ROW_HEIGHT = 32
const PANEL_PADDING = 12

/**
 * Gooey menu: a circular trigger that morphs into a rows panel, then
 * splits from it — see GooeySurface for how the morph and the glass look
 * are built. This just supplies the trigger, the rows, and the open state
 * (click, Escape, outside click).
 */
export function GooeyMenu({
  rows,
  panelWidth = 200,
  gap = 14,
  panelRadius = 18,
  triggerSize = 58,
  spring,
  active,
  className,
  style,
  ...rest
}: GooeyMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active === undefined) return
    setOpen(active)
  }, [active])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className={className ? `ax-gooey-menu ${className}` : 'ax-gooey-menu'}
      style={{ width: triggerSize, height: triggerSize, ...style }}
      {...rest}
    >
      <GooeySurface
        open={open}
        direction="up"
        align="start"
        triggerSize={triggerSize}
        gap={gap}
        panelRadius={panelRadius}
        spring={spring}
        contentClassName="ax-gooey-menu__content"
        contentStyle={{ minWidth: panelWidth, padding: PANEL_PADDING }}
        contentProps={{ 'aria-hidden': !open }}
        trigger={
          <button
            type="button"
            className="ax-gooey-menu__trigger"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <svg
              className="ax-gooey-menu__trigger-icon"
              data-open={open}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        }
      >
        {rows.map((row) => (
          <div
            key={row.label}
            className="ax-gooey-menu__row"
            data-variant={row.variant}
            data-interactive={row.onSelect ? 'true' : undefined}
            style={{ height: ROW_HEIGHT }}
            onClick={() => {
              if (!row.onSelect) return
              row.onSelect()
              setOpen(false)
            }}
          >
            <span className="ax-gooey-menu__label">{row.label}</span>
            {row.value !== undefined && <span className="ax-gooey-menu__value">{row.value}</span>}
          </div>
        ))}
      </GooeySurface>
    </div>
  )
}

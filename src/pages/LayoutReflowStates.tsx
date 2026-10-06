import { useEffect } from 'react'
import { GooeyMenu, GooeyToggle, GooeyTooltipBar } from '../lib'
import { CommentIcon, InboxIcon, MenuIcon, PreviewIcon, ShareIcon } from './tooltipBarIcons'
import './LayoutReflowStates.css'

/**
 * 4.0 — Gooey Menu: a circular trigger a single rounded panel grows out
 * of (see GooeyMenu's own doc comment for how the liquid read is built
 * without an SVG goo filter).
 */
function LayoutReflowStates() {
  useEffect(() => {
    document.body.setAttribute('data-bg-variant', 'blue')
    return () => document.body.removeAttribute('data-bg-variant')
  }, [])

  return (
    <div className="gooey-playground">
      <GooeyMenu
        rows={[
          { label: 'GOOEY MENU', value: 'v1.0.0', variant: 'muted' },
          { label: 'Springs', value: '12', variant: 'badge' },
          { label: 'Route', value: 'Static' },
        ]}
      />

      <div className="gooey-playground__toggle">
        <GooeyToggle aria-label="Toggle" />
      </div>

      <div className="gooey-playground__tips">
        <GooeyTooltipBar
          placement="bottom"
          items={[
            { icon: <CommentIcon />, label: 'Comments' },
            { icon: <InboxIcon />, label: 'Inbox', dot: true },
            { icon: <PreviewIcon />, label: 'Preview' },
            { icon: <ShareIcon />, label: 'Share' },
            { icon: <MenuIcon />, label: 'Menu', dot: true },
          ]}
        />
      </div>
    </div>
  )
}

export default LayoutReflowStates

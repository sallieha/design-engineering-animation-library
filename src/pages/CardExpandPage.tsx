import { useEffect } from 'react'
import { CardExpand } from '../lib'
import { ArtifactsIcon, DesignIcon, ProjectsIcon, ScheduledIcon } from './cardIcons'
import './CardExpandPage.css'

const CARDS = [
  { id: 'artifacts', title: 'Artifacts', subtitle: '24 Items', icon: <ArtifactsIcon /> },
  { id: 'projects', title: 'Projects', subtitle: '6 Active', icon: <ProjectsIcon /> },
  { id: 'scheduled', title: 'Scheduled', subtitle: '3 Upcoming', icon: <ScheduledIcon /> },
  { id: 'design', title: 'Design', subtitle: '8 Canvases', icon: <DesignIcon /> },
]

/**
 * 5.0 — Cards Expand & Collapse: a 2x2 grid of glass cards where one opens
 * to full width while the rest tuck into a row beneath it. Uses its own
 * background copy (bg-grid-5.png) and line art (bg-lines-*-5.svg) via a data
 * attribute on <body> — see index.css's `body[data-bg-variant='five']`
 * rule — so it can be tuned independently of pages 1.0-4.0.
 */
function CardExpandPage() {
  useEffect(() => {
    document.body.setAttribute('data-bg-variant', 'five')
    return () => document.body.removeAttribute('data-bg-variant')
  }, [])

  return (
    <div className="card-expand-playground">
      <CardExpand cards={CARDS} />
    </div>
  )
}

export default CardExpandPage

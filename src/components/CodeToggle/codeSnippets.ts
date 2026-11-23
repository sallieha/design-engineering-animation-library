// Mirrors each page's own JSX (see src/pages/*.tsx) so the snippet shown
// here stays an honest excerpt of the real usage, not a paraphrase.
export const CODE_SNIPPETS: Record<string, string> = {
  '/': `<Elastic className="hover-button glass" scale={1.03}>
  Elastic
</Elastic>

<Glow className="hover-button glass" color="rgba(124,159,255,.4)">
  Glow
</Glow>

<Liquid className="hover-button glass">
  Liquid
</Liquid>

<Gravity className="hover-button glass" pull={6}>
  Gravity
</Gravity>`,

  '/click-press-states': `<Snap className="press-button glass" overshoot={0.08}>
  Snap
</Snap>

<Ripple className="press-button glass" origin="cursor" color="rgba(124,159,255,.5)">
  Ripple
</Ripple>

<Depress className="press-button glass" scale={0.94}>
  Depress
</Depress>

<Pulse className="press-button glass" color="rgba(124,159,255,.5)">
  Pulse
</Pulse>`,

  '/transition-states': `<MorphContainer
  className="morph-button morph-container-button glass"
  panelWidth={240}
  panelHeight={140}
  panelContent={<p className="ax-morph-overlay__panel-subtitle">One element, new bounds — click to collapse</p>}
>
  Container Morph
</MorphContainer>

<MorphPath className="morph-button glass">
  Morph Path
</MorphPath>

<MorphMerge className="glass" startRevealed />`,

  '/layout-reflow-states': `<GooeyMenu
  rows={[
    { label: 'GOOEY MENU', value: 'v1.0.0', variant: 'muted' },
    { label: 'Springs', value: '12', variant: 'badge' },
    { label: 'Route', value: 'Static' },
  ]}
/>

<GooeyToggle aria-label="Toggle" />

<GooeyTooltipBar
  placement="bottom"
  items={[
    { icon: <CommentIcon />, label: 'Comments' },
    { icon: <InboxIcon />, label: 'Inbox', dot: true },
    { icon: <PreviewIcon />, label: 'Preview' },
    { icon: <ShareIcon />, label: 'Share' },
    { icon: <MenuIcon />, label: 'Menu', dot: true },
  ]}
/>`,

  '/card-expand': `<CardExpand
  cards={[
    { id: 'artifacts', title: 'Artifacts', subtitle: '24 Items', icon: <ArtifactsIcon /> },
    { id: 'projects', title: 'Projects', subtitle: '6 Active', icon: <ProjectsIcon /> },
    { id: 'scheduled', title: 'Scheduled', subtitle: '3 Upcoming', icon: <ScheduledIcon /> },
    { id: 'design', title: 'Design', subtitle: '8 Canvases', icon: <DesignIcon /> },
  ]}
/>`,

  '/card-cycle': `<CardCycle
  cards={[
    { id: 'helmet', src: '/cards/helmet.jpg', alt: 'Porsche Design helmet', focus: { x: 50, y: 50, zoom: 1 } },
    { id: 'skier', src: '/cards/skier.jpg', alt: 'Glowing skier on red', focus: { x: 54, y: 50, zoom: 1 } },
    { id: 'seat', src: '/cards/seat.jpg', alt: 'Tufted leather car seat', focus: { x: 60, y: 50, zoom: 1 } },
    { id: 'aquarium', src: '/cards/aquarium.jpg', alt: 'Aquarium poster', focus: { x: 50, y: 50, zoom: 1 } },
    { id: 'facade', src: '/cards/facade.jpg', alt: 'Perforated metal facade', focus: { x: 50, y: 50, zoom: 1 } },
    { id: 'hancock', src: '/cards/hancock.jpg', alt: 'Herbie Hancock poster', focus: { x: 50, y: 50, zoom: 1 } },
  ]}
/>`,

  '/chat-input': `<ChatInput
  placeholder="Send Message"
  replies={[
    'Lock in 🔥',
    'Ha, okay, I see you. Tell me more 😄',
    ['Wait, really? That’s kind of wild', 'Love that. Keep going 🙌'], // a double text
  ]}
/>`,
}

export const DEFAULT_SNIPPET = '// Coming soon'

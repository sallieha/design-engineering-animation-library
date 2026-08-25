import type { ReactNode } from 'react'
import { Elastic, Glow, Gravity, Liquid, Push, Reveal } from './lib'
import './App.css'

interface DemoProps {
  name: string
  description: string
  children: ReactNode
}

function Demo({ name, description, children }: DemoProps) {
  return (
    <section className="demo-card">
      <div className="demo-card__stage">{children}</div>
      <h2>{name}</h2>
      <p>{description}</p>
    </section>
  )
}

function App() {
  return (
    <div className="playground">
      <header className="playground__header">
        <h1>Animation Design Engineering</h1>
        <p>Six hover states, built as real reusable components — not just named CSS classes.</p>
      </header>

      <div className="playground__grid">
        <Demo name="Elastic" description="Mass-spring overshoot on scale. Re-hovering mid-settle inherits velocity.">
          <Elastic className="chip glass">Hover me</Elastic>
        </Demo>

        <Demo name="Push" description="Content recoils away from the cursor, force falling off with distance.">
          <Push className="chip glass">Get close</Push>
        </Demo>

        <Demo name="Reveal" description="Overlay wipes in from whichever edge the cursor actually entered from.">
          <Reveal className="reveal-card" overlay={<div className="reveal-card__overlay glass">Revealed</div>}>
            <div className="reveal-card__base">Approach from any side</div>
          </Reveal>
        </Demo>

        <Demo name="Gravity" description="A magnetic well — the element is pulled toward the cursor before it's even hovered.">
          <div className="gravity-field">
            <Gravity className="chip glass chip--round">Pull</Gravity>
          </div>
        </Demo>

        <Demo name="Glow" description="A radial highlight tracks the cursor, rAF-throttled to one style write per frame.">
          <Glow className="glow-card glass" color="rgba(124, 159, 255, 0.4)">
            <span>Move around</span>
          </Glow>
        </Demo>

        <Demo name="Liquid" description="Border-radius corners spring independently out of phase — an organic wobble, not a uniform scale.">
          <Liquid className="chip glass">Squish</Liquid>
        </Demo>
      </div>
    </div>
  )
}

export default App

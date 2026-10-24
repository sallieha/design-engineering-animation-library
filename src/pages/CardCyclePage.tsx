import { useEffect } from 'react'
import { CardCycle } from '../lib'
import './CardCyclePage.css'

// One photo per card, front to back. The cards are sized (see CardCycle's CW/CH)
// so the facade photo fits whole; the other photos are a little
// wider than the frame, so `focus` picks which part of each stays in view.
const CARDS = [
  {
    // Extended top, bottom and sides with its own backdrop (the original was
    // wider than the card), so the whole helmet shows, centered, uncropped.
    id: 'helmet',
    src: '/cards/helmet.jpg',
    alt: 'Red and white Porsche Design racing helmet',
    focus: { x: 50, y: 50, zoom: 1 },
  },
  {
    id: 'skier',
    src: '/cards/skier.jpg',
    alt: 'Glowing white skier carving down a red slope',
    focus: { x: 54, y: 50, zoom: 1 },
  },
  {
    // The scan had a player UI icon over its bottom-right corner; cropped off.
    id: 'seat',
    src: '/cards/seat.jpg',
    alt: 'Tufted black leather car seat beside a walnut-trimmed door panel',
    focus: { x: 60, y: 50, zoom: 1 },
  },
  {
    // Padded top and bottom with the poster's own black frame so its full
    // width fits the card.
    id: 'aquarium',
    src: '/cards/aquarium.jpg',
    alt: 'Numazu Deep Sea Aquarium poster: a glowing red-rimmed blue oval with a black sphere',
    focus: { x: 50, y: 50, zoom: 1 },
  },
  {
    id: 'facade',
    src: '/cards/facade.jpg',
    alt: 'Perforated metal facade with a red doorway',
    focus: { x: 50, y: 50, zoom: 1 },
  },
  {
    id: 'hancock',
    src: '/cards/hancock.jpg',
    alt: 'Black and white op-art concert poster for an evening with Herbie Hancock',
    focus: { x: 50, y: 50, zoom: 1 },
  },
]

/**
 * 6.0 — Cards Cycle & Fling: a slanted stack of photo cards in depth, each
 * framed in glass, where pressing or flinging the front card sends it to the
 * back and the rest step forward. Same series as 5.0, so it uses the same
 * background and line art (see index.css's `body[data-bg-variant='five']`
 * rule).
 */
function CardCyclePage() {
  useEffect(() => {
    document.body.setAttribute('data-bg-variant', 'five')
    return () => document.body.removeAttribute('data-bg-variant')
  }, [])

  return (
    <div className="card-cycle-playground">
      <CardCycle cards={CARDS} />
    </div>
  )
}

export default CardCyclePage

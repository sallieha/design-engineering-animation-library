# Design Engineering Animation Library

Hover states built as real, reusable React components — driven by actual
motion primitives (spring physics) instead of named CSS transition presets.

## Components

| Component | What it does |
| --- | --- |
| `Elastic` | Mass-spring overshoot on scale. Re-hovering mid-settle inherits current velocity instead of restarting. |
| `Gravity` | A magnetic well: pulls the element toward the cursor once it's within `radius`, before the cursor even touches the element. |
| `Liquid` | Border-radius corners spring independently, out of phase, for an organic liquid wobble rather than a uniform scale. |
| `Glow` | A radial highlight tracks the cursor, coalesced to one style write per animation frame. |

All four share `useSpring` in `src/lib/physics` — a semi-implicit-Euler
mass-spring integrator (`stiffness`, `damping`, `mass`) driving 2D values
toward a target.

## Development

```bash
npm install
npm run dev
```

Opens the demo playground (`src/App.tsx`), a grid showing all four components live.

## Building the package

```bash
npm run build:lib
```

Outputs `dist-lib/` — ESM (`index.js`), CJS (`index.cjs`), bundled type
declarations (`index.d.ts`), and a stylesheet
(`design-engineering-animation-library.css`) that consumers need to import
once alongside the components:

```tsx
import { Elastic, Gravity, Liquid, Glow } from 'design-engineering-animation-library'
import 'design-engineering-animation-library/dist-lib/design-engineering-animation-library.css'
```

`npm run build` builds the demo playground app instead (`dist/`).

## Usage

```tsx
<Elastic scale={1.15}>
  <button>Hover me</button>
</Elastic>

<Glow color="rgba(124,159,255,.4)" size={220}>
  <span>Move around</span>
</Glow>
```

Each component accepts standard `div` props (`className`, `style`, etc.) plus
a small set of physically-meaningful tuning props (spring `stiffness`/`damping`,
`radius`, `amplitude`) — see each component's props interface in
`src/lib/components/*/*.tsx` for the full list.

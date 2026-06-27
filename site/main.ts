// site/main.ts — the /site LANDING module (A5). The entry index.html points at this file; it renders the
// landing through the shared `mountPage` shell, so the landing carries the SAME nav + header chrome as every
// other page. mountPage (pages/_page.ts) performs the load-bearing foundation import cascade (ADR-0003:
// foundation CSS tokens-first → per-control CSS → the self-defining ui-* controls), so this module imports it
// FIRST and never repeats those imports.
import { mountPage } from './pages/_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './pages/landing.css' // landing-local layout (hero + card grid), after the shared shell

const SVG_NS = 'http://www.w3.org/2000/svg'

const { content } = mountPage({
  title: 'agent-ui',
  intro:
    'A zero-dependency, signals-based web-component library in strict, modern TypeScript. The first component ' +
    'family is FACE form controls — the live ui-button below — and A2UI renders the same controls from a tiny ' +
    'agent-driven payload. Explore the pieces below.',
})

// ── hero — live ui-button specimens (the headline artefact) ──────────────────────────────────────────────
// A decorative leading icon for the slot demo; `currentColor` makes it inherit the button ink, `aria-hidden`
// keeps the label as the accessible name. Sized by button.css (var(--ui-button-icon)).
function makeIcon(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', 'icon')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('viewBox', '0 0 24 24')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M5 12h14m0 0l-6-6m6 6l-6 6')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

interface Specimen {
  readonly label: string
  readonly variant: 'solid' | 'soft' | 'ghost'
  readonly icon?: boolean
}

function makeButton(spec: Specimen): HTMLElement {
  const button = document.createElement('ui-button')
  button.setAttribute('variant', spec.variant)
  if (spec.icon) button.append(makeIcon())
  button.append(document.createTextNode(spec.label))
  return button
}

function buildHero(): HTMLElement {
  const hero = document.createElement('section')
  hero.className = 'hero'

  const label = document.createElement('p')
  label.className = 'hero-label'
  label.textContent = 'Live ui-button — the reference FACE control'
  hero.append(label)

  const specimens = document.createElement('div')
  specimens.className = 'hero-specimens'
  const buttons: readonly Specimen[] = [
    { label: 'Get started', variant: 'solid', icon: true },
    { label: 'Soft', variant: 'soft' },
    { label: 'Ghost', variant: 'ghost' },
  ]
  for (const spec of buttons) specimens.append(makeButton(spec))
  hero.append(specimens)

  return hero
}

// ── card grid — one card per page, linking the same destinations as the shared nav ───────────────────────
interface Card {
  readonly href: string
  readonly title: string
  readonly blurb: string
}
const CARDS: readonly Card[] = [
  {
    href: './permutations.html',
    title: 'Permutations',
    blurb: 'Every size × variant × disabled of ui-button, plus the [scale]/[density] subtree-geometry demo.',
  },
  {
    href: './states.html',
    title: 'Interaction states',
    blurb: 'The live control across hover, focus, active, keyboard activation, and disabled.',
  },
  {
    href: './button-doc.html',
    title: 'API reference',
    blurb: 'The ui-button attribute surface, generated from its button.md descriptor — it cannot drift.',
  },
  {
    href: './a2ui-canvas.html',
    title: 'A2UI canvas',
    blurb: 'A two-line A2UI payload rendered live into a ui-button — the agent-driven payoff (wave 4).',
  },
]

function buildCards(): HTMLElement {
  const grid = document.createElement('section')
  grid.className = 'cards'
  for (const card of CARDS) {
    const anchor = document.createElement('a')
    anchor.className = 'card'
    anchor.href = card.href

    const title = document.createElement('span')
    title.className = 'card-title'
    title.textContent = card.title

    const blurb = document.createElement('span')
    blurb.className = 'card-blurb'
    blurb.textContent = card.blurb

    anchor.append(title, blurb)
    grid.append(anchor)
  }
  return grid
}

content.append(buildHero(), buildCards())

// site/main.ts — the /site LANDING module (A5). The entry index.html points at this file; it renders the
// landing through the shared `mountPage` shell, so the landing carries the SAME nav + header chrome as every
// other page. mountPage (pages/_page.ts) performs the load-bearing foundation import cascade (ADR-0003:
// foundation CSS tokens-first → per-control CSS → the self-defining ui-* controls), so this module imports it
// FIRST and never repeats those imports.
import { mountPage } from './pages/_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './pages/landing.css' // landing-local layout (hero + card grid), after the shared shell
import { applyDemoWidth, searchIcon } from './lib/specimens.ts'

const SVG_NS = 'http://www.w3.org/2000/svg' // the button-hero arrow glyph builds its own SVG; the field uses searchIcon

const { content } = mountPage({
  title: 'agent-ui',
  intro:
    'A zero-dependency, signals-based web-component library in strict, modern TypeScript. The first component ' +
    'family is FACE form controls — the live ui-button and ui-text-field below — and A2UI renders the same ' +
    'controls from a tiny agent-driven payload. Explore the pieces below.',
})

// The display width passed to applyDemoWidth for the text-field hero (the #74 no-intrinsic-width rationale
// lives in that helper).
const FIELD_HERO_WIDTH = '18rem'

// ── hero — live ui-button specimens (the headline artefact) ──────────────────────────────────────────────
// A decorative leading icon for the slot demo. Canonical anatomy markup (ADR-0012): `slot="leading"` is the
// POSITION (start cell) and `data-role="icon"` is the CONTENT role that sizes the glyph to the icon cell
// (var(--ui-button-icon)). `currentColor` inherits the button ink; `aria-hidden` keeps the label as the
// accessible name. (The pre-`12fdf49` `slot="icon"` name no longer matches `:has([slot=leading])`.)
function makeIcon(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', 'leading') // POSITION — the start cell
  svg.setAttribute('data-role', 'icon') // CONTENT role — sized to the icon cell by button.css
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

// A live ui-text-field hero specimen — a real field with a leading search icon (the shared canonical glyph) and
// a placeholder. applyDemoWidth supplies the display width (the #74 no-intrinsic-width rationale lives there).
function makeFieldSpecimen(): HTMLElement {
  const field = document.createElement('ui-text-field')
  field.setAttribute('label', 'Search')
  field.setAttribute('placeholder', 'Type to search…')
  field.append(searchIcon('leading'))
  applyDemoWidth(field, FIELD_HERO_WIDTH)
  return field
}

// buildHero — one hero card carrying a labelled live specimen row per shipped control family (ui-button +
// ui-text-field), so the landing dogfoods the real controls as its headline artefact.
function buildHero(): HTMLElement {
  const hero = document.createElement('section')
  hero.className = 'hero'

  const buttonLabel = document.createElement('p')
  buttonLabel.className = 'hero-label'
  buttonLabel.textContent = 'Live ui-button — the reference FACE control'
  hero.append(buttonLabel)

  const buttons = document.createElement('div')
  buttons.className = 'hero-specimens'
  const specs: readonly Specimen[] = [
    { label: 'Get started', variant: 'solid', icon: true },
    { label: 'Soft', variant: 'soft' },
    { label: 'Ghost', variant: 'ghost' },
  ]
  for (const spec of specs) buttons.append(makeButton(spec))
  hero.append(buttons)

  const fieldLabel = document.createElement('p')
  fieldLabel.className = 'hero-label'
  fieldLabel.textContent = 'Live ui-text-field — the first FACE form control'
  hero.append(fieldLabel)

  const fields = document.createElement('div')
  fields.className = 'hero-specimens'
  fields.append(makeFieldSpecimen())
  hero.append(fields)

  return hero
}

// ── card grid — one card per page, grouped per component to mirror the shared nav (one table of contents,
// two renderings). A new component's docs append one group here AND one in _page.ts's NAV. ─────────────────
interface Card {
  readonly href: string
  readonly title: string
  readonly blurb: string
}
interface CardGroup {
  /** The component label for a per-component cluster; absent for the ungrouped site-level cards. */
  readonly label?: string
  readonly cards: readonly Card[]
}
const CARD_GROUPS: readonly CardGroup[] = [
  {
    label: 'ui-button',
    cards: [
      {
        href: './button-permutations.html',
        title: 'Permutations',
        blurb: 'Every size × variant × disabled of ui-button, plus the [scale]/[density] subtree-geometry demo.',
      },
      {
        href: './button-states.html',
        title: 'Interaction states',
        blurb: 'The live control across hover, focus, active, keyboard activation, and disabled.',
      },
      {
        href: './button-doc.html',
        title: 'API reference',
        blurb: 'The ui-button attribute surface, generated from its button.md descriptor — it cannot drift.',
      },
    ],
  },
  {
    label: 'ui-text-field',
    cards: [
      {
        href: './text-field-permutations.html',
        title: 'Permutations',
        blurb: 'Every size × state of ui-text-field, the adornment anatomy, and the [scale]/[density] geometry demo.',
      },
      {
        href: './text-field-states.html',
        title: 'Interaction states',
        blurb: 'The live field across placeholder, focus, hover, validation, disabled, and readonly — with an event log.',
      },
      {
        href: './text-field-doc.html',
        title: 'API reference',
        blurb: 'The ui-text-field attribute surface, generated from its text-field.md descriptor — it cannot drift.',
      },
    ],
  },
  {
    label: 'Layout primitives',
    cards: [
      {
        href: './layout-overview.html',
        title: 'Overview',
        blurb: 'The layout family — ui-row, ui-column, ui-list, ui-grid — its shared shape, with the member list derived from the descriptors.',
      },
      {
        href: './layout-permutations.html',
        title: 'Surface × layout',
        blurb: 'Every primitive under the shared axes: the flex grammar (align/justify/gap), the surface ladder, and the grid auto-fit.',
      },
      {
        href: './row-doc.html',
        title: 'API references',
        blurb: 'Descriptor-derived API docs for ui-row, ui-column, ui-list, and ui-grid (linked from the overview).',
      },
    ],
  },
  {
    label: 'ui-card',
    cards: [
      {
        href: './card-demo.html',
        title: 'Demo',
        blurb: 'The region sub-elements composed, the elevation × brightness surface range, nested radius, and scrollable content.',
      },
      {
        href: './card-doc.html',
        title: 'API reference',
        blurb: 'The ui-card surface attributes, generated from its card.md descriptor — it cannot drift.',
      },
    ],
  },
  {
    label: 'ui-tabs',
    cards: [
      {
        href: './tabs-demo.html',
        title: 'Demo',
        blurb: 'The live tabs compound — selection + roving keyboard, with a real select event log.',
      },
      {
        href: './tabs-doc.html',
        title: 'API reference',
        blurb: 'The ui-tabs attributes (surface + the bindable selected), generated from its tabs.md descriptor.',
      },
    ],
  },
  {
    label: 'ui-modal',
    cards: [
      {
        href: './modal-demo.html',
        title: 'Demo',
        blurb: 'The native-<dialog> modal — open/close, dismissable vs blocking, focus restore, with a close/toggle log.',
      },
      {
        href: './modal-doc.html',
        title: 'API reference',
        blurb: 'The ui-modal attributes (surface + open/dismissable), generated from its modal.md descriptor.',
      },
    ],
  },
  {
    cards: [
      {
        href: './a2ui-canvas.html',
        title: 'A2UI canvas',
        blurb: 'A two-line A2UI payload rendered live into a ui-button — the agent-driven payoff.',
      },
    ],
  },
]

function buildCard(card: Card): HTMLElement {
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
  return anchor
}

// buildCards — one labelled `.card-group` per group (a component name above its card grid), mirroring the nav.
function buildCards(): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'card-groups'
  for (const group of CARD_GROUPS) {
    const section = document.createElement('section')
    section.className = 'card-group'
    if (group.label) {
      const label = document.createElement('h2')
      label.className = 'card-group-label'
      label.textContent = group.label
      section.append(label)
    }
    const grid = document.createElement('div')
    grid.className = 'cards'
    for (const card of group.cards) grid.append(buildCard(card))
    section.append(grid)
    wrap.append(section)
  }
  return wrap
}

content.append(buildHero(), buildCards())

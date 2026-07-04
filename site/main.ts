// site/main.ts — the /site LANDING module (A5). The entry index.html points at this file; it renders the
// landing through the shared `mountPage` shell, so the landing carries the SAME nav + header chrome as every
// other page. mountPage (pages/_page.ts) performs the load-bearing foundation import cascade (ADR-0003:
// foundation CSS tokens-first → per-control CSS → the self-defining ui-* controls), so this module imports it
// FIRST and never repeats those imports.
import { mountPage } from './pages/_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './pages/landing.css' // landing-local layout (hero + card grid), after the shared shell
import { applyDemoWidth, searchIcon } from './lib/specimens.ts'
import { resolveIcon } from '@agent-ui/icons'
import '@agent-ui/icons/phosphor' // registers + activates the Phosphor default pack (ADR-0066)

const { content } = mountPage({
  title: 'agent-ui',
  intro:
    'A zero-dependency, signals-based web-component library in strict, modern TypeScript. The first component ' +
    'family is FACE form controls — the live ui-button and ui-text-field below — and A2UI renders the same ' +
    'controls from a tiny agent-driven payload. Explore the pieces below.',
})

// The display width passed to applyDemoWidth for the text-field hero (the ADR-0021 width rationale — a ~20ch
// floor, with layout owning the width above it — lives in that helper).
const FIELD_HERO_WIDTH = '18rem'

// ── hero — live ui-button specimens (the headline artefact) ──────────────────────────────────────────────
// A decorative leading icon for the slot demo — the REAL Phosphor `arrow-right` resolved through the
// @agent-ui/icons adapter (ADR-0065/0066) instead of a hand-drawn path. Canonical anatomy markup (ADR-0012):
// `slot="leading"` is the POSITION (start cell) and `data-role="icon"` is the CONTENT role that sizes the glyph
// to the icon cell (var(--ui-button-icon)). resolveIcon emits `fill="currentColor"` (inherits the button ink),
// `aria-hidden` (the label stays the accessible name), and `width/height=100%` so it fills the icon cell.
function makeIcon(): SVGElement {
  const svg = resolveIcon('arrow-right') // authentic Phosphor from the active pack (registered on import)
  svg.setAttribute('slot', 'leading') // POSITION — the start cell
  svg.setAttribute('data-role', 'icon') // CONTENT role — sized to the icon cell by button.css
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
// a placeholder. applyDemoWidth supplies the display width (the ADR-0021 width rationale lives there).
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
        blurb: 'Every size × state of ui-text-field, the adornment anatomy, every [type] variant, and the [scale]/[density] geometry demo.',
      },
      {
        href: './text-field-states.html',
        title: 'Interaction states',
        blurb: 'The live field across placeholder, focus, hover, validation, disabled, readonly, plus the numeric & picker types — with an event log.',
      },
      {
        href: './text-field-doc.html',
        title: 'API reference',
        blurb: 'The ui-text-field attribute surface, generated from its text-field.md descriptor — it cannot drift.',
      },
    ],
  },
  {
    label: 'ui-text',
    cards: [
      {
        href: './text-doc.html',
        title: 'API reference',
        blurb: 'The Display-class text primitive — its single variant enum + the live type ramp, generated from text.md.',
      },
    ],
  },
  {
    label: 'ui-icon',
    cards: [
      {
        href: './icon-doc.html',
        title: 'API reference',
        blurb: 'The Display-class icon primitive over the @agent-ui/icons adapter — the API table + a live Phosphor gallery, generated from icon.md.',
      },
    ],
  },
  {
    label: 'ui-checkbox',
    cards: [
      {
        href: './checkbox-doc.html',
        title: 'API reference',
        blurb: 'The FACE tri-state checkbox (Indicator class) — the size + state specimens and attribute surface, generated from checkbox.md.',
      },
    ],
  },
  {
    label: 'ui-switch',
    cards: [
      {
        href: './switch-doc.html',
        title: 'API reference',
        blurb: 'The FACE switch — a pill track with a 2px-inset thumb (ADR-0041) — its size + state specimens, generated from switch.md.',
      },
    ],
  },
  {
    label: 'ui-radio',
    cards: [
      {
        href: './radio-doc.html',
        title: 'API reference',
        blurb: 'The FACE radio (Indicator class) — its dot glyph, size + state specimens; grouping lives on the ui-radio-group page. From radio.md.',
      },
    ],
  },
  {
    label: 'ui-radio-group',
    cards: [
      {
        href: './radio-group-demo.html',
        title: 'Demo',
        blurb: 'The live single-selection group: click or Arrow-rove between radios, with a select event log proving the value round-trips.',
      },
      {
        href: './radio-group-doc.html',
        title: 'API reference',
        blurb: 'The FACE radio-group container — owns exclusivity, roving, the group value, and required → valueMissing. From radio-group.md.',
      },
    ],
  },
  {
    // Range-class controls (Wave 2, ADR-0042): Indicator-geometry rail + thumb, pointer drag + keyboard step.
    label: 'ui-slider',
    cards: [
      {
        href: './slider-doc.html',
        title: 'API reference',
        blurb: 'The FACE single-thumb range slider (Range class) — rail fill + 2px-inset thumb (ADR-0041), pointer drag and keyboard step. From slider.md.',
      },
    ],
  },
  {
    label: 'ui-slider-multi',
    cards: [
      {
        href: './slider-multi-doc.html',
        title: 'API reference',
        blurb: 'The FACE dual-thumb range slider (Range class) — lo/hi thumbs define a value range, pointer drag and keyboard step for each. From slider-multi.md.',
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
        blurb: 'The native-<dialog> modal — open/close, dismissable vs persistent, focus restore, with a close/toggle log.',
      },
      {
        href: './modal-doc.html',
        title: 'API reference',
        blurb: 'The ui-modal attributes (surface + open/persistent), generated from its modal.md descriptor.',
      },
    ],
  },
  {
    // The Overlay family (Wave 4, ADR-0043): tier=pattern controls on the overlay controller — a live interaction
    // Demo + a descriptor-derived API doc each, mirroring the nav (one table of contents, two renderings).
    label: 'ui-popover',
    cards: [
      {
        href: './popover-demo.html',
        title: 'Demo',
        blurb: 'The disclosure popover — a trigger toggling a top-layer panel, light-dismissed by Escape / outside-click, with a close/toggle log.',
      },
      {
        href: './popover-doc.html',
        title: 'API reference',
        blurb: 'The ui-popover attributes (open + placement) and its overlay surface, generated from its popover.md descriptor.',
      },
    ],
  },
  {
    label: 'ui-tooltip',
    cards: [
      {
        href: './tooltip-demo.html',
        title: 'Demo',
        blurb: 'The non-modal tooltip — shown on hover (with a show-delay) and keyboard focus (immediately); it never steals focus.',
      },
      {
        href: './tooltip-doc.html',
        title: 'API reference',
        blurb: 'The ui-tooltip attributes (open + placement + delay), generated from its tooltip.md descriptor.',
      },
    ],
  },
  {
    label: 'ui-menu',
    cards: [
      {
        href: './menu-demo.html',
        title: 'Demo',
        blurb: 'The overlay menu — a trigger opening [role=menuitem] rows (one disabled), Arrow-rove + type-ahead, with a commit → select log.',
      },
      {
        href: './menu-doc.html',
        title: 'API reference',
        blurb: 'The ui-menu attributes (open + placement), its select event, and the roving keyboard, generated from its menu.md descriptor.',
      },
    ],
  },
  {
    label: 'ui-select',
    cards: [
      {
        href: './select-demo.html',
        title: 'Demo',
        blurb: 'The single-select form control, live in a <form> — the value round-trips into FormData; required + a disabled option, with a select/toggle log.',
      },
      {
        href: './select-doc.html',
        title: 'API reference',
        blurb: 'The ui-select attributes (name/value/open/required + placeholder) and form participation, generated from its select.md descriptor.',
      },
    ],
  },
  {
    label: 'ui-combo-box',
    cards: [
      {
        href: './combo-box-demo.html',
        title: 'Demo',
        blurb: 'The form-associated combo-box — free-text filtering with active-descendant (focus stays in the editor), plus a strict variant, with a change/select log.',
      },
      {
        href: './combo-box-doc.html',
        title: 'API reference',
        blurb: 'The ui-combo-box attributes (value/open/strict + form props) and the active-descendant pattern, generated from its combo-box.md descriptor.',
      },
    ],
  },
  // Picker controls — Wave 5B (ADR-0048): standalone date picker + future type=date overlay body.
  {
    label: 'ui-calendar',
    cards: [
      {
        href: './calendar-demo.html',
        title: 'Demo',
        blurb: 'The standalone month-grid date picker — click or keyboard to select a date, with min/max range, required validation, and form submission.',
      },
      {
        href: './calendar-doc.html',
        title: 'API reference',
        blurb: 'The ui-calendar attributes (value/min/max + form props), keyboard grid navigation, and form-associated ISO YYYY-MM-DD value, generated from its calendar.md descriptor.',
      },
    ],
  },
  // The G7 form-composition family (ADR-0050/0051): the label/description/error wrapper + the coordination
  // provider (both tier=container → a Demo + a descriptor-derived API doc each).
  {
    label: 'ui-field',
    cards: [
      {
        href: './field-demo.html',
        title: 'Demo',
        blurb: 'The label/description/error wrapper around a required text-field — blur it empty to reveal the error part, type to clear.',
      },
      {
        href: './field-doc.html',
        title: 'API reference',
        blurb: 'The ui-field attributes (label · description), slots, the ADR-0051 labelling seam + option-A bridge, and the event-driven error, from field.md.',
      },
    ],
  },
  {
    label: 'ui-form-provider',
    cards: [
      {
        href: './form-provider-demo.html',
        title: 'Demo',
        blurb: 'A provider coordinating a fielded text-field + checkbox + switch — a live values()/valid() readout, a submit() aggregate, and an event log.',
      },
      {
        href: './form-provider-doc.html',
        title: 'API reference',
        blurb: 'The ui-form-provider surface (controls/entries/values/invalid/valid/submit/reset), the change submit event, and the ui-form-connect protocol, from form-provider.md.',
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
      {
        href: './a2ui-catalog.html',
        title: 'A2UI catalog',
        blurb: 'Every default-catalog component rendered live through the real renderer — a live-knobs playground per component.',
      },
      {
        href: './a2ui-list.html',
        title: 'A2UI dynamic list',
        blurb: 'A container whose children is a template over a data array — display, container, interactive, and nested lists, all live (A2UI v1.0).',
      },
      {
        href: './a2ui-form.html',
        title: 'A2UI generative form',
        blurb: 'One payload renders a complete coordinated form — field-wrapped controls under a form-provider, inline checks, and a submit-gated action that refuses to emit while invalid (ADR-0053/0054).',
      },
      {
        href: './a2ui-patterns.html',
        title: 'A2UI patterns',
        blurb: 'Five agent-emittable UI constructs, each payload beside its live surface — settings form, confirmation, wizard, dashboard tiles, and a schedule picker.',
      },
      {
        href: './a2ui-stream.html',
        title: 'A2UI streaming',
        blurb: 'The same payload streamed line-by-line — root-early paints progressively, root-last stays blank until the end, and a malformed line is fault-isolated live (replay + step).',
      },
      {
        href: './a2ui-live.html',
        title: 'A2UI live agent',
        blurb: 'The ladder’s last rung: a chat app where an agent emits A2UI over the wire — prompt → rendered surface → you interact → the agent continues. A deterministic recorded backbone by default; a real model under `vite dev` with a key. Canvas / JSON / HTML tabs.',
      },
    ],
  },
  {
    // Site-level meta pages (ungrouped — no component label, so not a fleet TOC group per site-toc.test.ts).
    cards: [
      {
        href: './adr-index.html',
        title: 'Decision Records',
        blurb: 'Every ADR, newest-first, with live search and full-text expand.',
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

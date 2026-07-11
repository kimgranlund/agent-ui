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
// A decorative trailing icon for the slot demo — the REAL Phosphor `arrow-right` resolved through the
// @agent-ui/icons adapter (ADR-0065/0066) instead of a hand-drawn path. Canonical anatomy markup (ADR-0012):
// `slot="trailing"` is the POSITION (end cell) and `data-role="icon"` is the CONTENT role that sizes the glyph
// to the icon cell (var(--ui-button-icon)). resolveIcon emits `fill="currentColor"` (inherits the button ink),
// `aria-hidden` (the label stays the accessible name), and `width/height=100%` so it fills the icon cell.
function makeIcon(): SVGElement {
  const svg = resolveIcon('arrow-right') // authentic Phosphor from the active pack (registered on import)
  svg.setAttribute('slot', 'trailing') // POSITION — the end cell (an arrow reads as "go" trailing the label)
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
  // button.css places adornments by plain CSS grid AUTO-PLACEMENT (DOM order), not by the `slot`
  // attribute alone (`slot` only selects for sizing/styling, per button.css:121-126) — so a
  // trailing icon must be appended AFTER the label text, or grid auto-placement puts it in the
  // wrong track regardless of the attribute value.
  button.append(document.createTextNode(spec.label))
  if (spec.icon) button.append(makeIcon())
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
    // The conceptual GUIDE cluster — ungrouped site-level cards (no `label:`), mirroring the ungrouped NAV
    // cluster in _page.ts (same posture as the A2UI/A2A/meta clusters below). Seven pages for a cold-start
    // human consumer: how to consume the library, the theming contract, the derived token reference, the
    // sizing/density law, an end-to-end forms walkthrough, a component chooser, and the on-site changelog.
    cards: [
      {
        href: './getting-started.html',
        title: 'Getting started',
        blurb: 'The workspace packages, the load-bearing CSS import order (ADR-0003), a minimal runnable example, and the per-control subpath imports.',
      },
      {
        href: './theming.html',
        title: 'Theming',
        blurb: 'ui-theme-provider’s three live axes (scheme/scale/density), the --md-sys-color-{family}-{role} role system, a live subtree token override, and the reserved multi-theme seam.',
      },
      {
        href: './tokens.html',
        title: 'Tokens',
        blurb: 'Every colour role as a live swatch, parsed straight from tokens.css — plus the five dimensional ramps from dimensions.css. Cannot drift: it is the sheets, rendered.',
      },
      {
        href: './sizing.html',
        title: 'Sizing & density',
        blurb: 'The five size-classes, a live MEASURED [scale] × [size] matrix (real getBoundingClientRect reads), the compact realm’s pad law, and density-rides-rhythm-never-the-box.',
      },
      {
        href: './forms.html',
        title: 'Forms',
        blurb: 'ui-form-provider + ui-field + controls, walked as one working example — registration, labelling, validation display, submit gating, and reset.',
      },
      {
        href: './choosing.html',
        title: 'Which component when',
        blurb: 'A quick chooser between components that overlap in purpose, condensed from the A2UI catalog’s own §5.2 usage-guidance rows, with live specimens.',
      },
      {
        href: './changelog.html',
        title: 'Changelog',
        blurb: 'The on-site changelog, derived straight from the repo root CHANGELOG.md — the same derive-don’t-copy discipline as the Decision Records index.',
      },
    ],
  },
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
  // The Wave M1 chart family (ADR-0107): two Display-class axis-free charts, each a descriptor-derived API doc
  // (tier=display ⇒ {doc} only, the ui-text/ui-icon precedent).
  {
    label: 'ui-sparkline',
    cards: [
      {
        href: './sparkline-doc.html',
        title: 'API reference',
        blurb: 'The Display-class series-shape mark — the line/area variants over a live revenue trend, the degenerate cases, and the generated accessible summary, generated from sparkline.md.',
      },
    ],
  },
  {
    label: 'ui-bar-chart',
    cards: [
      {
        href: './bar-chart-doc.html',
        title: 'API reference',
        blurb: 'The Display-class magnitude-comparison bar list — the all-positive and mixed-sign diverging (zero-baseline) models over real data, generated from bar-chart.md.',
      },
    ],
  },
  // The token-surface family (ADR-0118): three Display-class show-never-edit primitives, each a
  // descriptor-derived API doc (tier=display ⇒ {doc} only, the ui-sparkline/ui-bar-chart precedent).
  {
    label: 'ui-swatch',
    cards: [
      {
        href: './swatch-doc.html',
        title: 'API reference',
        blurb: 'The Display-class color-identity leaf — a bordered color box resolved live, the --var lane, the scheme pin, and the degenerate cases, generated from swatch.md.',
      },
    ],
  },
  {
    label: 'ui-ramp',
    cards: [
      {
        href: './ramp-doc.html',
        title: 'API reference',
        blurb: 'The Display-class ordered-color-series leaf — a wrapping strip of swatch cells over a real tonal progression, generated from ramp.md.',
      },
    ],
  },
  {
    label: 'ui-ladder',
    cards: [
      {
        href: './ladder-doc.html',
        title: 'API reference',
        blurb: 'The Display-class labeled-dimensional-tiers leaf — literal-length magnitude bars over a real dimensional set, no cross-tier normalization, generated from ladder.md.',
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
    // ADR-0095 (supersedes ADR-0086's ui-radio-group[variant='segmented'], hard cutover): the child leaf.
    label: 'ui-segment',
    cards: [
      {
        href: './segment-doc.html',
        title: 'API reference',
        blurb: 'The child leaf of ui-segmented-control — a FACE radio re-tagged, adding no new prop or behavior of its own. From segment.md.',
      },
    ],
  },
  {
    label: 'ui-segmented-control',
    cards: [
      {
        href: './segmented-control-demo.html',
        title: 'Demo',
        blurb: 'The live joined-button single-select: click or Arrow-rove between segments, with the shared moving indicator + an event log proving the value round-trips.',
      },
      {
        href: './segmented-control-doc.html',
        title: 'API reference',
        blurb: 'The standalone segmented control (ADR-0095) — extends ui-radio-group directly for 100% of the exclusivity/roving/value machinery. From segmented-control.md.',
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
      {
        href: './toast-region-doc.html',
        title: 'ui-toast-region',
        blurb: 'The Wave M1 feed family (ADR-0112) top-layer host — a pure inset/gap layout element (tier=layout), folded into this bundle rather than growing its own group.',
      },
      {
        href: './split-doc.html',
        title: 'ui-split',
        blurb: 'The M4 multi-pane resizable split container (ADR-0120 cl.2) — draggable + keyboard-resizable ARIA separators, folded into this bundle (tier=layout) rather than growing its own group.',
      },
      {
        href: './split-pane-doc.html',
        title: 'ui-split-pane',
        blurb: 'The generic pane child of ui-split — a structural content region, same fold as ui-split.',
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
    label: 'ui-toolbar',
    cards: [
      {
        href: './toolbar-demo.html',
        title: 'Demo',
        blurb: 'A Pattern-class action bar, both postures — an embedded document-header bar and a floating raised formatting palette — with real ui-buttons and the one-Tab-stop roving keyboard.',
      },
      {
        href: './toolbar-doc.html',
        title: 'API reference',
        blurb: 'The ui-toolbar attributes (surface + orientation/align/justify/gap/overflow/label), generated from its toolbar.md descriptor.',
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
  {
    label: 'ui-command-modal',
    cards: [
      {
        href: './command-modal-demo.html',
        title: 'Demo',
        blurb: 'The CMD-K command palette — a search combobox filtering a grouped listbox nested inside a ui-modal, with the empty-state affordance, the result-count live region, and both hotkey modes.',
      },
      {
        href: './command-modal-doc.html',
        title: 'API reference',
        blurb: 'The ui-command-modal attributes (open/label/placeholder/hotkey), generated from its command-modal.md descriptor — permanently excluded from the A2UI catalog (app-owner launcher chrome).',
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
  // ADR-0123 — the OKLCH-internal 2-axis color-input control (pad + channel ui-sliders + an editable
  // ui-text-field readout + a composed ui-swatch preview). Also the popup body for the ui-text-field
  // type=color lazy-overlay leg.
  {
    label: 'ui-color-picker',
    cards: [
      {
        href: './color-picker-demo.html',
        title: 'Demo',
        blurb: 'The standalone color-input control — drag the pad or a channel slider, or type a value into the readout, with form submission, required validation, and an author-supplied presets slot.',
      },
      {
        href: './color-picker-doc.html',
        title: 'API reference',
        blurb: 'The ui-color-picker attributes (value/format + form props), the 2-axis pad a11y model, and the OKLCH-internal/format-selected value contract, generated from its color-picker.md descriptor.',
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
  // ADR-0117 — the promoted theming subtree provider (tier=container ⇒ {doc, demo}, the ui-form-provider precedent).
  {
    label: 'ui-theme-provider',
    cards: [
      {
        href: './theme-provider-demo.html',
        title: 'Demo',
        blurb: 'Two nested providers proving subtree independence, plus an unset provider nested inside a dark ancestor — the ancestor-inherit fix, live.',
      },
      {
        href: './theme-provider-doc.html',
        title: 'API reference',
        blurb: 'The ui-theme-provider surface (scheme/scale/density/theme), the unset-inherits scheme mapping, and the reserved theme package seam, from its own descriptor.',
      },
    ],
  },
  // The Wave M1 report family (ADR-0111): three Display-class descriptor-derived API docs (tier=display ⇒
  // {doc} only, the ui-text/ui-icon/chart precedent).
  {
    label: 'ui-table',
    cards: [
      {
        href: './table-doc.html',
        title: 'API reference',
        blurb: 'The Display-class static data table — typed columns + record rows as a real native <table>, the SPEC-R3 cell-resolution matrix as a live fixture, generated from table.md.',
      },
    ],
  },
  {
    label: 'ui-stat',
    cards: [
      {
        href: './stat-doc.html',
        title: 'API reference',
        blurb: 'The Display-class metric tile — label/value/delta/caption as real DOM text, the up/down/flat direction glyph over real data, generated from stat.md.',
      },
    ],
  },
  {
    label: 'ui-badge',
    cards: [
      {
        href: './badge-doc.html',
        title: 'API reference',
        blurb: 'The compact-realm status token — a five-intent live strip, each with a pairwise-distinct non-colour glyph (ADR-0057), generated from badge.md.',
      },
    ],
  },
  // The Wave M1 content family (ADR-0113): the zero-machinery code leaf + the native-<details> disclosure.
  {
    label: 'ui-code',
    cards: [
      {
        href: './code-doc.html',
        title: 'API reference',
        blurb: 'The zero-machinery verbatim code leaf — mono, whitespace-preserved, self-scrolling overflow fixtures, generated from code.md.',
      },
    ],
  },
  {
    label: 'ui-disclosure',
    cards: [
      {
        href: './disclosure-demo.html',
        title: 'Demo',
        blurb: 'The live fold: click (native summary activation) and a model-driven open toggle, with a toggle event log proving exactly-once settlement.',
      },
      {
        href: './disclosure-doc.html',
        title: 'API reference',
        blurb: 'The native-<details>-backed fold — open/summary, the toggle event, the body adoption anatomy, generated from disclosure.md.',
      },
    ],
  },
  // The Wave M1 feed family (ADR-0112): progress/attachment (display) + avatar (indicator) get {doc} only;
  // toast (pattern) gets {doc, demo}; toast-region (layout) folds into the Layout primitives bundle above.
  {
    label: 'ui-progress',
    cards: [
      {
        href: './progress-doc.html',
        title: 'API reference',
        blurb: 'The Display-class thin-rail progress bar — determinate/indeterminate models + SPEC-R1 clamping as live fixtures, generated from progress.md.',
      },
    ],
  },
  {
    label: 'ui-avatar',
    cards: [
      {
        href: './avatar-doc.html',
        title: 'API reference',
        blurb: 'The Indicator-class identity mark — the full image → initials → glyph fallback chain + every [size] tier, generated from avatar.md.',
      },
    ],
  },
  {
    label: 'ui-attachment',
    cards: [
      {
        href: './attachment-doc.html',
        title: 'API reference',
        blurb: 'The Display-class FilePart-aligned file card — one specimen per file category + SPEC-R8/R9 degenerate cases, generated from attachment.md.',
      },
    ],
  },
  {
    label: 'ui-toast',
    cards: [
      {
        href: './toast-demo.html',
        title: 'Demo',
        blurb: 'The live app-surface consumption story — a region + show() buttons (plain/urgent/actionable), pause-on-hover, and a select/close event log.',
      },
      {
        href: './toast-doc.html',
        title: 'API reference',
        blurb: 'The transient notification card — urgent/duration/action, the select/close events, deliberately not catalogued (ADR-0112 cl.6), generated from toast.md.',
      },
    ],
  },
  {
    // ADR-0122 — the timeline family: one shared marker-system rail row (ui-timeline-item) hosted by a
    // durable authored-children chronology (ui-timeline, role=list) and a live imperatively-fed strip
    // (ui-status-stream, role=log, deliberately not catalogued — a consumer-owned streaming host).
    label: 'ui-timeline-item',
    cards: [
      {
        href: './timeline-item-demo.html',
        title: 'Demo',
        blurb: 'The shared rail row, standalone: every status marker shape (pending/active/done/error), an icon-driven marker, and a collapsible detail via the composed ui-disclosure.',
      },
      {
        href: './timeline-item-doc.html',
        title: 'API reference',
        blurb: 'The item\'s status/label/description/timestamp/icon/size attributes, the marker-system geometry, and the one toggle event, generated from timeline-item.md.',
      },
    ],
  },
  {
    label: 'ui-timeline',
    cards: [
      {
        href: './timeline-demo.html',
        title: 'Demo',
        blurb: 'A durable order-tracking chronology — authored ui-timeline-item children, role=list, the terminal connector suppressed on the last entry.',
      },
      {
        href: './timeline-doc.html',
        title: 'API reference',
        blurb: 'The durable host\'s size/label attributes and its static, authored-children contract, generated from timeline.md.',
      },
    ],
  },
  {
    label: 'ui-status-stream',
    cards: [
      {
        href: './status-stream-demo.html',
        title: 'Demo',
        blurb: 'The live "what the system is doing now" strip — a REAL recorded arena match streamed through appendEntry/update/finalize, with tail-follow and the completion invariant.',
      },
      {
        href: './status-stream-doc.html',
        title: 'API reference',
        blurb: 'The imperative appendEntry/update/finalize API, role=log, and the tail-follow + completion-invariant contract, generated from status-stream.md. Deliberately not catalogued (ADR-0122 F5).',
      },
    ],
  },
  // ADR-0124 — the ui-swiper family: a CSS-native scroll-snap carousel. ui-swiper-item (tier=layout) folds
  // into the Layout primitives bundle (no card group of its own); the three pattern/display chrome tags
  // (pagination/paddles/label) each get their own group.
  {
    label: 'ui-swiper',
    cards: [
      {
        href: './swiper-demo.html',
        title: 'Demo',
        blurb: 'A live scroll-snap carousel — the infinite clone-teleport loop, responsive slides-in-view, and author-placed pagination/paddles/label chrome.',
      },
      {
        href: './swiper-doc.html',
        title: 'API reference',
        blurb: 'The ui-swiper attributes (surface + orientation/slides-in-view/align/loop/duration/easing/pagination/paddles + the bindable active), generated from its swiper.md descriptor.',
      },
    ],
  },
  {
    label: 'ui-swiper-pagination',
    cards: [
      {
        href: './swiper-pagination-demo.html',
        title: 'Demo',
        blurb: 'The dots/fraction anchor, author-placed inside a live ui-swiper.',
      },
      {
        href: './swiper-pagination-doc.html',
        title: 'API reference',
        blurb: 'The ui-swiper-pagination type attribute + its renderInto coordinator seam, generated from its swiper-pagination.md descriptor.',
      },
    ],
  },
  {
    label: 'ui-swiper-paddles',
    cards: [
      {
        href: './swiper-paddles-demo.html',
        title: 'Demo',
        blurb: 'The prev/next anchor — two composed ui-buttons, author-placed inside a live ui-swiper.',
      },
      {
        href: './swiper-paddles-doc.html',
        title: 'API reference',
        blurb: 'The ui-swiper-paddles fill coordinator seam, generated from its swiper-paddles.md descriptor.',
      },
    ],
  },
  {
    label: 'ui-swiper-label',
    cards: [
      {
        href: './swiper-label-doc.html',
        title: 'API reference',
        blurb: 'The accessible-name anchor — author text becomes the carousel region\'s aria-labelledby, generated from its swiper-label.md descriptor.',
      },
    ],
  },
  {
    // The application-frame primitive (@agent-ui/app) — an ungrouped site-level card (no `label:`, so not a
    // fleet TOC group per site-toc.test.ts), mirroring its ungrouped nav link in _page.ts.
    cards: [
      {
        href: './app-shell.html',
        title: 'Composing a ui-app-shell',
        blurb:
          'The application frame: how the region, role (landmark), narrow-reflow (collapse), and content-composition systems work — each on a live ui-app-shell (ADR-0082/0083/0084).',
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
        href: './a2ui-gallery.html',
        title: 'A2UI gallery',
        blurb:
          'Every composition on the example-seed shelf, one live card per seed — the scalable gallery whose members are derived from the shelf, so a new seed appears with zero edits. The hand-annotated tour lives on A2UI patterns.',
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
      {
        href: './a2ui-authoring.html',
        title: 'A2UI authoring guide',
        blurb:
          'Exactly how to author a catalog row (the row contract, the factory side, the ADR-0102 intake chooser, the coverage gate) and training data (shelf vs shard, seed anatomy, the quality bar, judged admission) — the worked examples derive live from the shipped catalog and seed shelf.',
      },
    ],
  },
  {
    // The A2A cluster — ungrouped site-level cards, mirroring the ungrouped nav links in _page.ts (same
    // posture as the A2UI cluster above: independent destinations, not a fleet component). The arena
    // (LLD-C11), the corpus-derived concepts/demos section (corpus LLD-C12), and the A2UI-over-A2A
    // artifact feed (LLD-C7, B6) sit together.
    cards: [
      {
        href: './a2a-tic-tac-toe.html',
        title: 'A2A tic-tac-toe arena',
        blurb:
          'Two agents play through a deterministic referee that is the ONLY thing either seat ever talks to. Replay a real recorded Sonnet-5-vs-Haiku-4.5 match, then read the isolation panel: it runs the SAME checker the build gate runs, live, over the loaded transcript — flip to a contaminated fixture to watch it fail loudly.',
      },
      {
        href: './a2a-concepts.html',
        title: 'A2A concepts & demos',
        blurb:
          'The A2A corpus, made readable: one card per admitted record — the wire shape it teaches, its grounding citations, and the exact JSON artifact, verified LIVE through the same validator the corpus’s standing gate runs. Demo records link to the arena for the full recorded replay.',
      },
      {
        href: './a2a-artifact-feed.html',
        title: 'A2A artifact feed',
        blurb:
          'A conversation carried over A2A where some agent turns bear LIVE A2UI artifacts — a metric-tile report, a region-breakdown table — alongside plain prose, each hosted by its own renderer. Every client turn shows its capabilities handshake (HV-8); the verdict line runs the same checks the standing fixture gate runs, live, in this page.',
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

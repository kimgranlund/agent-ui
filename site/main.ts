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
    // cluster in _page.ts (same posture as the A2UI/A2A/meta clusters below). A cold-start human consumer's
    // routes: how to consume the library, the theming contract, the derived token reference, the sizing/
    // density law, an end-to-end forms walkthrough, a component chooser, the composition-patterns hub (GH
    // #1042) + its six recipe pages, and the on-site changelog.
    cards: [
      {
        href: './getting-started.html',
        title: 'Getting started',
        blurb: 'The workspace packages, the load-bearing CSS import order (ADR-0003), a minimal runnable example, and the per-control subpath imports.',
      },
      {
        href: './accessibility.html',
        title: 'Accessibility',
        blurb: 'How the fleet exposes roles/state via ElementInternals, focus + roving-tabindex, landmarks in the shells, live regions, reduced motion, and how a consumer labels a control — plus one live example.',
      },
      {
        href: './testing-guide.html',
        title: 'Testing guide',
        blurb: 'The jsdom/browser vitest harness, the shared @agent-ui/shared/testing/dialog-polyfill stub, when a real-engine run is required, and the ElementInternals/ARIA assertion idiom.',
      },
      {
        href: './theming.html',
        title: 'Theming',
        blurb: "ui-theme-provider's three live axes (scheme/scale/density), the --md-sys-color-{family}-{role} role system, a live subtree token override, and theme packs — swapping whole token palettes live.",
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
        href: './composition.html',
        title: 'Composition patterns',
        blurb: 'The consumer-assembly pattern map (build-time parsed from the composition-patterns skill) plus every shipped recipe page — a hub, not a restatement (GH #1042).',
      },
      {
        href: './onboarding-checklist.html',
        title: 'Onboarding checklist',
        blurb: 'The checklist-onboarding composition recipe: card + list + checkbox + progress bound to a plain signals store (GH #961).',
      },
      {
        href: './card-grid-drawer.html',
        title: 'Card grid + drawer edit',
        blurb: 'ui-grid + ui-card + ui-drawer, a buffered record form, and a page-owned dirty-state/discard-confirm convention (GH #965).',
      },
      {
        href: './toc-content.html',
        title: 'Sticky TOC content layout',
        blurb: 'A scroll-spy’d ui-nav-rail sidebar swapping to a ui-select below the compact line, over a real long-form article (GH #964).',
      },
      {
        href: './workspace-shell.html',
        title: 'Workspace Shell',
        blurb: 'ui-workspace-shell, the full outer-level workspace grammar preset over ui-super-shell.',
      },
      {
        href: './surface-host-doc.html',
        title: 'Surface Host',
        blurb: 'ui-surface-host, the M2 mount/stream seam wrapping one @agent-ui/a2ui RendererHost, standalone-usable.',
      },
      {
        href: './conversation-doc.html',
        title: 'Conversation',
        blurb: 'ui-conversation, the M2 thread + composer + per-turn narration primitive, with an opt-in declarative composition mode.',
      },
      {
        href: './events.html',
        title: 'Events',
        blurb: 'The closed seven-event vocabulary, UIElement.emit’s bubbles/composed/cancelable mechanics sliced from source, a per-control event inventory derived from every descriptor’s events[], and a live ui-select + ui-switch event log.',
      },
      {
        href: './persistence.html',
        title: 'Persistence',
        blurb: '@agent-ui/shared’s StorageAdapter seam (ADR-0193, proposed): the async interface, localStorage + IndexedDB tiers, cross-tab notification, a live demo, and choosing a tier vs SettingsStore / @agent-ui/data.',
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
        href: './button-demo.html',
        title: 'Demo',
        blurb: 'The action control in a document-actions toolbar and a gated form-actions row — three variants, adornments, icon-only — with a click event log telling pointer from keyboard.',
      },
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
    // ADR-0179 GH #686 Amendment S7-a — ui-toggle, the fleet's first pressed-state pill button (GH #832).
    label: 'ui-toggle',
    cards: [
      {
        href: './toggle-demo.html',
        title: 'Demo',
        blurb: 'The pressed-state pill in the workspace-panes header row it was minted for, under a min-one refused-toggle rule — with a toggle/pressed event log.',
      },
      {
        href: './toggle-permutations.html',
        title: 'Permutations',
        blurb: 'Every size × anatomy shape × pressed/disabled of ui-toggle.',
      },
      {
        href: './toggle-states.html',
        title: 'Interaction states',
        blurb: 'The live control across hover, focus, active, keyboard activation, and disabled.',
      },
      {
        href: './toggle-doc.html',
        title: 'API reference',
        blurb: 'The ui-toggle attribute surface, generated from its toggle.md descriptor — it cannot drift.',
      },
    ],
  },
  {
    label: 'ui-text-field',
    cards: [
      {
        href: './text-field-demo.html',
        title: 'Demo',
        blurb: 'A "new vendor" form across the typed variants (email, tel, url, currency, number, percent, date, password) with Save-time validation and an input/change/toggle event log.',
      },
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
    label: 'ui-textarea',
    cards: [
      {
        href: './textarea-demo.html',
        title: 'Demo',
        blurb: 'A support-ticket form: a required, growable description with a character budget, a template seeded via selectToEnd(), a readonly transcript — with an input/change event log.',
      },
      {
        href: './textarea-permutations.html',
        title: 'Permutations',
        blurb: 'Every size × state of ui-textarea, plus the rows growable-minimum demo — no variant/type axis (ADR-0134).',
      },
      {
        href: './textarea-states.html',
        title: 'Interaction states',
        blurb: 'The live field across placeholder, Enter-inserts-newline, focus, hover, validation, disabled, readonly, and resize — with an event log.',
      },
      {
        href: './textarea-doc.html',
        title: 'API reference',
        blurb: 'The ui-textarea attribute surface, generated from its textarea.md descriptor — it cannot drift.',
      },
    ],
  },
  {
    // code-entry-control.lld.md (GH #490 S2-a) — the identity family's segmented N-cell one-time-code
    // entry field: one focusable editable surface, N presentational cells. Permanently catalog-excluded
    // (ADR-0176 cl.3) — still a site-documented fleet member like any other control.
    label: 'ui-otp-field',
    cards: [
      {
        href: './otp-field-demo.html',
        title: 'Demo',
        blurb: 'A sign-in verification step: a page-local fake verifier fires on the completion commit, Resend mints a fresh code after a cooldown — with an input/change event log.',
      },
      {
        href: './otp-field-permutations.html',
        title: 'Permutations',
        blurb: 'Every size × length of ui-otp-field, empty/partial/complete/disabled/required.',
      },
      {
        href: './otp-field-states.html',
        title: 'Interaction states',
        blurb: 'The live field across digit entry, backspace/arrow navigation, paste-split, validation, and disabled — with an announcement log.',
      },
      {
        href: './otp-field-doc.html',
        title: 'API reference',
        blurb: 'The ui-otp-field attribute surface, generated from its otp-field.md descriptor — it cannot drift.',
      },
    ],
  },
  {
    label: 'ui-text',
    cards: [
      {
        href: './text-demo.html',
        title: 'Demo',
        blurb: 'A release-notes article set entirely in ui-text — every role in its editorial job, real headings via the as stamp, a gated link, plus truncate and emphasis in context.',
      },
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
        href: './icon-demo.html',
        title: 'Demo',
        blurb: 'Icons where they live: leading/trailing/icon-only buttons, file-type glyphs beside list rows, the ambient font-size ramp, and meaningful (label) icons inheriting intent ink.',
      },
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
        href: './sparkline-demo.html',
        title: 'Demo',
        blurb: 'Live sparklines over a real KPI strip — revenue, sign-ups, p95 latency, error rate — line vs area, sizing, and the generated accessible summary read back from the real control.',
      },
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
        href: './bar-chart-demo.html',
        title: 'Demo',
        blurb: 'Live bar lists over a real regional revenue report — magnitudes, a mixed-sign diverging month-over-month view, all-equal and negative-only cases, and a density-scaled variant.',
      },
      {
        href: './bar-chart-doc.html',
        title: 'API reference',
        blurb: 'The Display-class magnitude-comparison bar list — the all-positive and mixed-sign diverging (zero-baseline) models over real data, generated from bar-chart.md.',
      },
    ],
  },
  // ADR-0205/GH #1207: the fleet's first axis-bearing chart — a value-range baseline + always-shown
  // min/max labels, single-series. Same shape as the two above — Display-class, a descriptor-derived API doc.
  {
    label: 'ui-line-chart',
    cards: [
      {
        href: './line-chart-demo.html',
        title: 'Demo',
        blurb: 'Live line/area charts over real report series — the value-floor baseline vs the zero-line baseline, area fill, and the always-shown min/max labels read back from the real control.',
      },
      {
        href: './line-chart-doc.html',
        title: 'API reference',
        blurb: 'The Display-class axis-bearing line/area chart — a value-range baseline + always-shown min/max labels over a live revenue trend, the baseline’s two branches, and the degenerate cases, generated from line-chart.md.',
      },
    ],
  },
  // ADR-0219: the fourth chart-family control — the part-of-whole ring (donut, default) or solid pie,
  // lifting ADR-0107's pie fence on its own three stated conditions. Same shape as the two above —
  // Display-class, a descriptor-derived API doc.
  {
    label: 'ui-pie-chart',
    cards: [
      {
        href: './pie-chart-demo.html',
        title: 'Demo',
        blurb: 'Live donut/pie charts over a real revenue-share dataset — the variant switch, the donut center as a sibling composition, degenerate cases, and a live data rewrite.',
      },
      {
        href: './pie-chart-doc.html',
        title: 'API reference',
        blurb: 'The Display-class part-of-whole chart — a printed-percent key list carrying identity by order + label + percent, never hue alone, generated from pie-chart.md.',
      },
    ],
  },
  // The token-surface family (ADR-0118): three Display-class show-never-edit primitives, each a
  // descriptor-derived API doc (tier=display ⇒ {doc} only, the ui-sparkline/ui-bar-chart precedent).
  {
    label: 'ui-swatch',
    cards: [
      {
        href: './swatch-demo.html',
        title: 'Demo',
        blurb: 'The palette review, live: brand key colors, semantic roles, contrast pairs, a candidate-vs-current hex/--var comparison, and a model-driven scheme pin with a review log.',
      },
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
        href: './ramp-demo.html',
        title: 'Demo',
        blurb: 'The brand-ramp review, live: the primary 050→950 ramp, the semantic families stacked, a light/dark pinned pair, a candidate OKLCH ramp, and a model-driven family switcher with a review log.',
      },
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
        href: './ladder-demo.html',
        title: 'Demo',
        blurb: 'The dimensional-token review, live: the spacing scale as --var tiers, control-height and icon ladders, a candidate 4-pt scale, and a model-driven density switch with a review log.',
      },
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
        href: './checkbox-demo.html',
        title: 'Demo',
        blurb: 'A live workspace-permissions list with a tri-state (indeterminate) parent, a required consent box, and an input/change event log.',
      },
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
        href: './switch-demo.html',
        title: 'Demo',
        blurb: 'A live notification-preferences panel — a master switch gating topic rows, a policy-locked disabled row, and a change/input event log.',
      },
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
        href: './radio-demo.html',
        title: 'Demo',
        blurb: 'Live radios inside a real ui-radio-group (a shipping-method picker) plus the standalone toggle shape, with an event log for both surfaces.',
      },
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
    // ADR-0220 (GH #1368) — the `choice` family: the rich-card selection container.
    label: 'ui-choice-group',
    cards: [
      {
        href: './choice-group-demo.html',
        title: 'Demo',
        blurb: 'A single-select room picker + a multi-select amenities gallery, both live — click, Arrow-rove, Enter, or Space, with a select event log proving the committed choice round-trips.',
      },
      {
        href: './choice-group-doc.html',
        title: 'API reference',
        blurb: 'The FACE rich-card selection container — composes rovingFocus + selectionCommit directly over ui-choice-card children, owning the group form value + required → valueMissing. From choice-group.md.',
      },
    ],
  },
  {
    label: 'ui-choice-card',
    cards: [
      {
        href: './choice-card-demo.html',
        title: 'Demo',
        blurb: 'The rich option unit live inside a real ui-choice-group (a plan picker) plus the standalone shape, with an event log for the group’s select event.',
      },
      {
        href: './choice-card-doc.html',
        title: 'API reference',
        blurb: 'The option unit of the choice family — the WHOLE card is the hit target and a11y unit (role=option via internals); no selection commit of its own. From choice-card.md.',
      },
    ],
  },
  {
    // ADR-0224 (GH #1429) — the availability-stated service/agent launch card.
    label: 'ui-service-card',
    cards: [
      {
        href: './service-card-demo.html',
        title: 'Demo',
        blurb: 'A live gateway-style service list plus an availability-toggle scenario — one `available` write repaints the accent edge, status dot, title, and trailing action together — with an action event log.',
      },
      {
        href: './service-card-doc.html',
        title: 'API reference',
        blurb: 'The availability-stated service/agent launch card — ONE bindable `available` boolean drives the accent edge, status dot, title mute, and the Open⟷Unavailable action swap by construction. From service-card.md.',
      },
    ],
  },
  {
    // ADR-0095 (supersedes ADR-0086's ui-radio-group[variant='segmented'], hard cutover): the child leaf.
    label: 'ui-segment',
    cards: [
      {
        href: './segment-demo.html',
        title: 'Demo',
        blurb: "The segment leaf live inside a real ui-segmented-control view switcher — click or Arrow-rove, with a change event log proving the leaf's own change fires and the host re-emits one change per commit.",
      },
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
        href: './slider-demo.html',
        title: 'Demo',
        blurb: 'The live single-thumb range as a playback volume + brightness control — drag, click, or keyboard, with a live readout and an input/change event log proving commit-on-blur.',
      },
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
        href: './slider-multi-demo.html',
        title: 'Demo',
        blurb: 'The live two-thumb range as a price filter over a small catalogue — a from–to readout, matching results, and an input/change event log proving the pair round-trips.',
      },
      {
        href: './slider-multi-doc.html',
        title: 'API reference',
        blurb: 'The FACE dual-thumb range slider (Range class) — lo/hi thumbs define a value range, pointer drag and keyboard step for each. From slider-multi.md.',
      },
    ],
  },
  {
    // ADR-0216 / GH #1395 — the star-value Range control, a THIRD UIRangeElement leaf.
    label: 'ui-rating',
    cards: [
      {
        href: './rating-demo.html',
        title: 'Demo',
        blurb: 'The live star-value control in both shipped modes — a readonly aggregate score (fraction-accurate) and an interactive rate-this input, with a live readout and an input/change event log.',
      },
      {
        href: './rating-doc.html',
        title: 'API reference',
        blurb: 'The FACE star-value range control (Range class) — an owned inline-SVG mark, fraction-accurate display, clamp/snapped input. From rating.md.',
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
        href: './row-demo.html',
        title: 'ui-row demo',
        blurb: 'A settings form row + action bar laid out by the real primitive — live gap / align / justify / wrap / reflow knobs with a knob log.',
      },
      {
        href: './column-demo.html',
        title: 'ui-column demo',
        blurb: 'A card column (release feed) + bounded stack — live gap / align / justify / wrap / stretch / reflow knobs with a knob log.',
      },
      {
        href: './list-demo.html',
        title: 'ui-list demo',
        blurb: 'A contact list of listitem rows + a settings list on the semantic stack — live gap / align / justify / wrap knobs with a knob log.',
      },
      {
        href: './grid-demo.html',
        title: 'ui-grid demo',
        blurb: 'A photo grid (one tile spanning two tracks) + KPI tiles on the auto-fit track grid — live gap / min / elevation knobs, resizable frame.',
      },
      {
        href: './toast-region-doc.html',
        title: 'ui-toast-region',
        blurb: 'The Wave M1 feed family (ADR-0112) top-layer host — a pure inset/gap layout element (tier=layout), folded into this bundle rather than growing its own group.',
      },
      {
        href: './toast-region-demo.html',
        title: 'ui-toast-region demo',
        blurb: 'The live toast queue: raise one, a burst, or a sticky toast; dismiss one by one or sweep the stack; two independent regions; a show/close stack log.',
      },
      {
        href: './split-doc.html',
        title: 'ui-split',
        blurb: 'The M4 multi-pane resizable split container (ADR-0120 cl.2) — draggable + keyboard-resizable ARIA separators, folded into this bundle (tier=layout) rather than growing its own group.',
      },
      {
        href: './split-demo.html',
        title: 'ui-split demo',
        blurb: 'A live editor/preview split — drag or keyboard the divider with an input/change resize log; a controlled-sizes list/detail with presets; a vertical three-pane console.',
      },
      {
        href: './split-pane-doc.html',
        title: 'ui-split-pane',
        blurb: 'The generic pane child of ui-split — a structural content region, same fold as ui-split.',
      },
      {
        href: './split-pane-demo.html',
        title: 'ui-split-pane demo',
        blurb: 'The pane props live: initial/min/max clamps, Enter-to-collapse on a collapsible pane, and panes added/removed at runtime with a re-derivation log.',
      },
      {
        href: './swiper-item-doc.html',
        title: 'ui-swiper-item',
        blurb: 'The slide of the ui-swiper family (ADR-0124) — sized entirely by the owning track, tier=layout, same fold as ui-toast-region.',
      },
      {
        href: './swiper-item-demo.html',
        title: 'ui-swiper-item demo',
        blurb: 'Key identity live: a keyed tour vs an unkeyed deck with active/activeIndex readouts, slides appended and re-labelled at runtime, and real-vs-clone under loop.',
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
    label: 'ui-drawer',
    cards: [
      {
        href: './drawer-demo.html',
        title: 'Demo',
        blurb: 'The native-<dialog> edge-docked drawer — all three edges, dismissable vs persistent, focus restore, a long-list scroll specimen, with a close/toggle log.',
      },
      {
        href: './drawer-doc.html',
        title: 'API reference',
        blurb: 'The ui-drawer attributes (surface + open/persistent/edge), generated from its drawer.md descriptor.',
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
    // M-F — the multi-select field (multi-select-field.lld.md · ADR-0175): an always-visible listbox,
    // no trigger/overlay. tier=pattern ⇒ {doc, demo}, the ui-select precedent.
    label: 'ui-multi-select',
    cards: [
      {
        href: './multi-select-demo.html',
        title: 'Demo',
        blurb: 'The multi-select form field, live in a <form> — toggle options with click/Space/Enter; the value array round-trips into MULTIPLE FormData entries under name, with a select event log.',
      },
      {
        href: './multi-select-doc.html',
        title: 'API reference',
        blurb: 'The ui-multi-select attributes (name/value/label/required/size) and form participation, generated from its multi-select.md descriptor.',
      },
    ],
  },
  {
    // GH #294 F4 — the packaged ui-popover + form-spine recipe: a control-created trigger over a real
    // form-content panel, edited live-apply. tier=pattern ⇒ {doc, demo}, mirroring the nav.
    label: 'ui-form-popover',
    cards: [
      {
        href: './form-popover-demo.html',
        title: 'Demo',
        blurb: 'The packaged popover + form-spine recipe — a control-created trigger carrying a consumer-authored summary label, opening a panel of real form content (check group, radio group, text field), with a close/toggle log.',
      },
      {
        href: './form-popover-doc.html',
        title: 'API reference',
        blurb: 'The ui-form-popover attributes (open/placement/label/size) and its trigger + panel parts, generated from its form-popover.md descriptor.',
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
  {
    label: 'ui-sandbox-frame',
    cards: [
      {
        href: './sandbox-frame-demo.html',
        title: 'Demo',
        blurb: 'The GenUI containment host — a sandboxed iframe rendering a fed HTML/CSS/JS document, the closed action bridge, and the fail-closed fallback affordance on an oversize/malformed payload.',
      },
      {
        href: './sandbox-frame-doc.html',
        title: 'API reference',
        blurb: 'The ui-sandbox-frame attributes (surfaceId/html/csp), generated from its sandbox-frame.md descriptor — permanently excluded from the A2UI catalog (genui-surface.spec.md SPEC-N1/PRD-G4).',
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
        blurb: 'The ui-theme-provider surface (scheme/scale/density/theme), the unset-inherits scheme mapping, and the theme package seam, from its own descriptor.',
      },
    ],
  },
  // The Wave M1 report family (ADR-0111): three Display-class descriptor-derived API docs (tier=display ⇒
  // {doc} only, the ui-text/ui-icon/chart precedent).
  {
    label: 'ui-table',
    cards: [
      {
        href: './table-demo.html',
        title: 'Demo',
        blurb: 'The live widened table (ADR-0163): sortable columns, multi/single selection with a select/change event log, a composed search field, a facet filter, and pagination — over a real sign-ups report.',
      },
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
        href: './stat-demo.html',
        title: 'Demo',
        blurb: 'Live KPI tiles over a real dashboard header — up/down/flat deltas, captions, the ring variant with percent, and a stat-plus-sparkline composition.',
      },
      {
        href: './stat-doc.html',
        title: 'API reference',
        blurb: 'The Display-class metric tile — label/value/delta/caption as real DOM text, the up/down/flat direction glyph over real data, generated from stat.md.',
      },
    ],
  },
  // ADR-0201 (GH #1185) — the key–value receipt primitive, same Display-class {doc}-only shape.
  {
    label: 'ui-description-list',
    cards: [
      {
        href: './description-list-demo.html',
        title: 'Demo',
        blurb: 'Three confirm-step receipts on realistic bookings, the empty-value omission law written live (rows in vs rows rendered), Intl numbers and the aligned-values lever.',
      },
      {
        href: './description-list-doc.html',
        title: 'API reference',
        blurb: 'The key–value receipt primitive — rows as hardened data, label secondary + value adjacent, a valueless field omitted by construction, generated from description-list.md.',
      },
    ],
  },
  // ADR-0214 (GH #1394) — the source-attribution aggregate leaf, same Display-class {doc}-only shape.
  {
    label: 'ui-source-list',
    cards: [
      {
        href: './source-list-doc.html',
        title: 'API reference',
        blurb: 'Source attribution as one aggregate leaf — positional index markers, per-entry safeHref-gated titles, and the drop-malformed-entries cleaner, generated from source-list.md.',
      },
    ],
  },
  {
    label: 'ui-badge',
    cards: [
      {
        href: './badge-demo.html',
        title: 'Demo',
        blurb: 'Status and count tokens in a CI run list (short labels, by law), a live bound intent write with the out-of-enum hardening proven in a log, and count pills / the empty-label floor.',
      },
      {
        href: './badge-doc.html',
        title: 'API reference',
        blurb: 'The compact-realm status token — a five-intent live strip, each with a pairwise-distinct non-colour glyph (ADR-0057), generated from badge.md.',
      },
    ],
  },
  // ADR-0163 cl.6 — ui-pagination, the fleet's first standalone page navigator (tier=pattern).
  {
    label: 'ui-pagination',
    cards: [
      {
        href: './pagination-demo.html',
        title: 'Demo',
        blurb: 'A standalone page navigator, live — a mid-range page (both ellipsis markers), the honest pages<2 empty state, and composing with ui-table\'s own page-size capability.',
      },
      {
        href: './pagination-doc.html',
        title: 'API reference',
        blurb: 'The ui-pagination attributes (page/pages/label) and the fixed page-window algorithm, generated from pagination.md.',
      },
    ],
  },
  // ADR-0213 (GH #1393) — ui-suggestions, the one-shot follow-up/next-prompt chip set (tier=pattern).
  {
    label: 'ui-suggestions',
    cards: [
      {
        href: './suggestions-demo.html',
        title: 'Demo',
        blurb: 'A live 3-chip suggestion set — tap any chip to commit it into `selected` and watch the WHOLE set render spent, the taken chip visibly marked, a select event log.',
      },
      {
        href: './suggestions-doc.html',
        title: 'API reference',
        blurb: 'The `suggestions`/`selected` attributes and the one-shot spent-set law, generated from suggestions.md.',
      },
    ],
  },
  // The Wave M1 content family (ADR-0113): the zero-machinery code leaf + the native-<details> disclosure.
  {
    label: 'ui-code',
    cards: [
      {
        href: './code-demo.html',
        title: 'Demo',
        blurb: 'Inline vs block in an agent answer, seven languages verbatim beside the same blocks projected through the opt-in highlight pack, whitespace fidelity, and the component\'s own overflow.',
      },
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
        href: './progress-demo.html',
        title: 'Demo',
        blurb: 'Progress doing real work, live: a button-driven attachment upload, an indeterminate-to-determinate indexing run, a segments-stepped onboarding readout, and an update log.',
      },
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
        href: './avatar-demo.html',
        title: 'Demo',
        blurb: 'The identity mark in a real team roster — portrait, broken-image → initials, initials-only, and glyph fallbacks in situ, an assignees cluster, and every [size] tier.',
      },
      {
        href: './avatar-doc.html',
        title: 'API reference',
        blurb: 'The Indicator-class identity mark — the full image → initials → glyph fallback chain + every [size] tier, generated from avatar.md.',
      },
    ],
  },
  // GH #1189 — ui-image, the URL-sourced content-image primitive (tier=display ⇒ {doc} only, a conventional
  // component admission — no new ADR). NOT a fallback chain like ui-avatar above — just the <img> mechanics.
  {
    label: 'ui-image',
    cards: [
      {
        href: './image-demo.html',
        title: 'Demo',
        blurb: 'A rental-listing gallery: a hero photo with a scrim caption and a model-driven aspect switch, a 1/1 thumbnail strip, and cover vs contain on a portrait source.',
      },
      {
        href: './image-doc.html',
        title: 'API reference',
        blurb: 'The Display-class URL-sourced content image — a reserved aspect-ratio box (zero CLS), native lazy-loading, and an optional bottom-scrim caption, generated from image.md.',
      },
    ],
  },
  // GH #1209 — the native media players (conventional admissions per the ui-image ruling).
  {
    label: 'ui-video',
    cards: [
      {
        href: './video-demo.html',
        title: 'Demo',
        blurb: 'A course lesson page: the 16/9 lesson player with a poster, a 9/16 short, the three preload policies, and the empty-src no-dead-shell rule proven model-driven.',
      },
      {
        href: './video-doc.html',
        title: 'API reference',
        blurb: 'The Display-class native video player — the real <video controls> in a reserved aspect-ratio box (zero CLS), poster support, no custom chrome, generated from video.md.',
      },
    ],
  },
  {
    label: 'ui-audio',
    cards: [
      {
        href: './audio-demo.html',
        title: 'Demo',
        blurb: 'A support thread with voice memos: a playable memo (a WAV synthesized in the browser), preload policies on an episode list, and the empty-src rule proven model-driven.',
      },
      {
        href: './audio-doc.html',
        title: 'API reference',
        blurb: "The Display-class native audio player — the real <audio controls> at the UA bar's intrinsic height, no custom chrome, generated from audio.md.",
      },
    ],
  },
  {
    label: 'ui-attachment',
    cards: [
      {
        href: './attachment-demo.html',
        title: 'Demo',
        blurb: 'A support-chat composer: attach and remove real file cards from a pending strip, a received message\'s attachment list, and a composer action log.',
      },
      {
        href: './attachment-doc.html',
        title: 'API reference',
        blurb: 'The Display-class FilePart-aligned file card — one specimen per file category + SPEC-R8/R9 degenerate cases, generated from attachment.md.',
      },
    ],
  },
  {
    // ADR-0210 (GH #1391) — the fleet's file-INPUT affordance (the ADR-0112 cl.1 fence opened): a
    // host-mediated HANDLE model. tier=pattern ⇒ {doc, demo}, composing ui-attachment above for its chips.
    label: 'ui-file-drop',
    cards: [
      {
        href: './file-drop-demo.html',
        title: 'Demo',
        blurb: 'The file-drop form field, live in a <form> — drag, paste, or Browse to attach; a stub host intake seam mints handle descriptors with zero byte access, with a change event log.',
      },
      {
        href: './file-drop-doc.html',
        title: 'API reference',
        blurb: 'The ui-file-drop attributes (files/label/accept/multiple/maxSizeBytes/maxFiles + the form trio) and the host-mediated trust boundary, generated from its file-drop.md descriptor.',
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
        href: './swiper-label-demo.html',
        title: 'Demo',
        blurb: 'A storefront home: named carousels vs the "Carousel" fallback, a model-driven rename editing the anchor\'s text in place, and a live name probe.',
      },
      {
        href: './swiper-label-doc.html',
        title: 'API reference',
        blurb: 'The accessible-name anchor — author text becomes the carousel region\'s aria-labelledby, generated from its swiper-label.md descriptor.',
      },
    ],
  },
  {
    // ADR-0195 — ui-drill, the N-level drill-down panel container (GH #954).
    label: 'ui-drill',
    cards: [
      {
        href: './drill-demo.html',
        title: 'Demo',
        blurb: 'A one-panel container drilling down an N-level selection tree — one level visible at a time, with a Back affordance and a bindable path.',
      },
      {
        href: './drill-doc.html',
        title: 'API reference',
        blurb: 'The ui-drill/ui-drill-panel compound, the controlled/uncontrolled path duality, and the drill-trigger authoring convention, generated from drill.md.',
      },
    ],
  },
  {
    // ui-super-shell (@agent-ui/app, M5) — the application-frame archetype family's grammar ceiling: an
    // ungrouped site-level card (no `label:`, so not a fleet TOC group per site-toc.test.ts), mirroring its
    // ungrouped nav link in _page.ts. (The ui-app-shell card retired with its teaching page — ADR-0156.)
    cards: [
      {
        href: './super-shell.html',
        title: 'Composing a ui-super-shell',
        blurb:
          'The shell-archetype family\'s grammar ceiling: a two-level recursive frame — grammar, collapse contract, recursion, narrow reflow, and landmarks, each on a live ui-super-shell (M5, GH #83/#84).',
      },
    ],
  },
  {
    // dom/view-transition.ts (ADR-0183, GH #740/#742/#958/#1005/#1043) — an ungrouped site-level card (no
    // `label:`), mirroring its ungrouped nav link in _page.ts, the Super Shell card precedent just above.
    cards: [
      {
        href: './motion.html',
        title: 'View transitions',
        blurb: 'The shared withViewTransition seam + its four opt-in surfaces (super-shell, surface-host, drill, router outlet) — the opt-in law, per-surface tables, and a live toggle on a real ui-drill.',
      },
    ],
  },
  {
    // ui-agent-admin (@agent-ui/app, TKT-0039/ADR-0131) — the standalone full-app demo, an ungrouped
    // site-level card (no `label:`), mirroring its ungrouped nav link in _page.ts (Kim's 2026-07-25
    // overturn of the 2026-07-19 standalone opt-out). The docs GUIDE page (agent-admin.html) stays
    // card-less here, as it always has (an embedded prose-column teaching page, not a landing highlight);
    // this card is the "click through and see the real thing" entry, the a2ui-live.html/gen-ui-live.html
    // precedent.
    cards: [
      {
        href: './agent-admin-app.html',
        title: 'Agent Admin App',
        blurb:
          'The full ui-agent-admin composition at real viewport scale, no docs-site chrome — the six-persona A2UI-showcase surface exactly as it would ship in production.',
      },
    ],
  },
  // The Devtools Harness (GH #1122, ADR-0200 clause 5) — the @agent-ui/devtools debug surface, mirroring its ungrouped nav link.
  { cards: [{ href: './devtools-harness.html', title: 'Devtools Harness', blurb: 'The chat & A2UI dev/debug harness: three swappable backends (replay · live dev-proxy · A2A peer), the raw DevtoolsEvent NDJSON timeline, per-surface render-confirm verdicts on a real canvas, and capture export/import.' }] },
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
      {
        href: './a2ui-agent.html',
        title: 'A2UI agent guide',
        blurb:
          'The PRODUCER half (ADR-0137): the transport seam, the bounded produce() self-correct loop, the catalog-grounded buildSystemPrompt(), the meta-line channel, and a runnable server-side consumer example — every block sliced live from the exported @agent-ui/a2ui/agent source.',
      },
    ],
  },
  {
    // genui-surface.spec.md SPEC §3.2/§3.3 (D9) — the GenUI chat demo card, mirroring the ungrouped
    // nav link in _page.ts (same posture: an independent destination, not a fleet component, and NOT
    // folded into the A2UI cluster above since GenUI validates the boundary, not a catalog payload).
    cards: [
      {
        href: './gen-ui-live.html',
        title: 'GenUI chat demo',
        blurb:
          'A chat app rendering agent-authored HTML/CSS/JS through the sandboxed ui-sandbox-frame containment host — a recorded backbone of canned turns, one exercising the genui.action bridge round-trip live.',
      },
    ],
  },
  {
    // The SaaS Data Workbench (GH #461, M-A MA-3) — an ungrouped site-level card (no `label:`), mirroring
    // its ungrouped nav link in _page.ts — the M-A flagship: the four ruled parts composed with zero
    // bespoke chrome inside ui-workspace-shell, proving the layers fit together outside their own demos.
    cards: [
      {
        href: './workbench.html',
        title: 'SaaS Data Workbench',
        blurb:
          'A data table + filter toolbar + record-edit modal + agent-summary card composed entirely from published fleet primitives inside ui-workspace-shell — sort, select, filter, paginate, edit a record through the form spine, and read an agent-written summary of the current view.',
      },
    ],
  },
  {
    // The Support Dashboard (GH #499, M-F) — the fleet's SECOND SaaS composition, an ungrouped
    // site-level card (no `label:`) mirroring its ungrouped nav link in _page.ts — proving the SAME
    // ui-workspace-shell frame + recorded agent-summary seam generalize to a materially different content
    // shape (stat tiles + a chart + a read-only table, not a data-table + toolbar + edit-modal).
    cards: [
      {
        href: './dashboard.html',
        title: 'Support Dashboard',
        blurb:
          'Stat cards + a bar chart + a read-only table + an agent-summary card composed entirely from published fleet primitives inside ui-workspace-shell — filter by priority tier with a segmented control and read an agent-written summary of the current queue view.',
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

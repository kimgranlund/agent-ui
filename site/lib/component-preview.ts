// site/lib/component-preview.ts — the <component-preview> docs element: a two-column live playground. LEFT is a
// details block + exactly ONE live-knob control per editable prop (routed by type — ui-segmented-control/
// ui-select for an enum, ui-switch for a boolean, ui-text-field for a number/string; batch A removed the
// redundant derived variant chip-row that used to double every enum); RIGHT is the shared A2UI artboard (lib/canvas-surface)
// carrying the live specimen. It renders EITHER a plain ui-* web component (mode="component", target = a tag
// like `ui-button`) OR an A2UI catalog item (mode="a2ui", target = a catalog NAME like `Button`).
//
// DERIVE-DON'T-DUPLICATE: the knobs carry no hand-maintained prop list. Component mode reads the canonical
// `{name}.md` descriptor (via lib/frontmatter → the ONE parser the contract trip-wire enforces); a2ui mode reads
// the shipped default catalog's component def. A new attribute/prop grows a knob for free — the same
// single-source discipline the doc pages already follow.
//
// It is a PLAIN custom element (a docs meta-component), NOT a ui-* control (light DOM, no ElementInternals/ARIA
// contract, no descriptor) — it composes controls for documentation, it is not itself part of the fleet.
import '@agent-ui/components/components' // self-defining ui-* controls (a component-mode target is defined even standalone)
import './component-preview.css'
import { createRenderer, defaultCatalog } from '@agent-ui/a2ui'
import type { RendererHost, ComponentDef, PropDef, JsonSchema } from '@agent-ui/a2ui'
import { loadDescriptorByTag } from './frontmatter.ts'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import type {
  UISelectElement,
  UISwitchElement,
  UITextFieldElement,
  UISegmentedControlElement,
  UISegmentElement,
  UISwiperPaginationElement,
  UISwiperPaddlesElement,
} from '@agent-ui/components/components'
import { createCanvasSurface, applyRootStretch } from './canvas-surface.ts'

// The `value` of the enum-knob "unset" option. ui-select's selectionCommit treats value="" as "no key"
// and SKIPS it (selection-commit.ts:98/147 — never commits, never emits `select`, panel stays open), so a
// literal empty-value option would be inert. A non-empty sentinel makes "reset to the control's own default"
// a real, committable choice; the `select` handler maps it back to '' (the knob's unset state). Cannot
// collide with a real enum member (all lowercase identifiers).
const KNOB_UNSET = '__cp-unset__'

// ── BATCH A — one control per enum knob, routed by member count (no doubled PROPS knob + VARIANTS chip-row) ───
// A small closed enum reads best fully exposed (every option visible, one click to pick) — `ui-segmented-control`
// (ADR-0095; was `ui-radio-group[variant="segmented"]` under the retired ADR-0086). A larger enum would make a
// segmented control unwieldy — the existing `ui-select` dropdown stays. The boundary (≤5) is Kim's call:
// button/checkbox/radio/switch/slider/select `size` (3), button `variant` (3), row/list `align` (5) land on the
// segmented control; row/list `justify` (6), grid/card/tabs/modal `elevation`/`brightness`/`gap` (7), text
// `variant`/`as` (9/10), text-field `type` (12), and the 8-member overlay `placement` land on select.
const SEGMENTED_MAX = 5

// ── de-doubling closing step — the batch-A knobs render as a REAL ui-segmented-control ────────────────────────
// `ui-segmented-control` (ADR-0095, superseding the retired `ui-radio-group[variant="segmented"]`) is a real
// M3-style segmented control (a joined track + one shared sliding indicator, Control-height). Every batch-A
// knob (above) is EXACTLY the shape it targets — a small mutually-exclusive option set — so every one of them
// uses it; none stay plain. Orientation is the one per-knob judgment call: horizontal (the control's own
// default) reads best when the whole row fits the narrow knob column (component-preview.css's `.knob` control
// track, ≈150–190px in the two-column layout); a wider set — either MORE members (row/list `align`, 5) or just
// LONGER labels at a small member count (ui-radio-group's own `orientation` knob, 2 members but
// "horizontal"/"vertical") — goes vertical (a segmented STACK) instead, so the column never squeezes label text
// or clips a cell. Decided generically from the member set itself (member count × longest label), not a
// per-tag list — same derive-don't-duplicate discipline as `SEGMENTED_MAX` above; measured against the rendered
// knob panel in component-preview.browser.test.ts (component-preview-segmented.browser.test.ts pins the whole shape).
const SEGMENTED_HORIZONTAL_MAX_MEMBERS = 3
// 5, not 6: a 3-member/5-char set (button `variant` solid/soft/ghost) fills the 21rem knob column to EXACTLY 0px
// slack (measured both engines — cells 63px, control right edge flush with the row). 5 is the empirical max
// that fits; a 6-char 3-member set would overflow, so it must stack vertical instead. Guarded by the
// button-`variant` no-overflow probe in component-preview-segmented.browser.test.ts.
const SEGMENTED_HORIZONTAL_MAX_LABEL = 5

/** Segmented orientation for a knob's member set (see the note above): horizontal only for a short (≤3-member),
 *  short-label (≤5-char) set; everything wider or longer-labelled stacks vertical instead. */
function segmentedOrientation(members: readonly string[]): 'horizontal' | 'vertical' {
  if (members.length > SEGMENTED_HORIZONTAL_MAX_MEMBERS) return 'vertical'
  const maxLabelLength = members.reduce((max, m) => Math.max(max, m.length), 0)
  return maxLabelLength <= SEGMENTED_HORIZONTAL_MAX_LABEL ? 'horizontal' : 'vertical'
}

// ── the unified knob model (one shape, both modes) ───────────────────────────────────────────────────────────
type KnobKind = 'enum' | 'boolean' | 'number' | 'string' | 'text' | 'skip'

/** One editable knob derived from a prop/attribute: its name, its control kind, enum members, a skip note. */
interface Knob {
  readonly name: string
  readonly kind: KnobKind
  readonly values?: readonly string[]
  readonly note?: string
}

/** The sentinel knob name for the component-mode default-slot text (edits `element.textContent`). */
const SLOT_TEXT = '#text'

/** A process-unique id for pairing a knob's `<label for>` with its control (accessible name; unique across previews). */
let knobUid = 0
const nextKnobId = (): string => `cp-knob-${(knobUid += 1)}`

/**
 * Write a live DOM property value into #state as its raw knob string — the canvas→knob read-back primitive. Only
 * primitives round-trip to a knob (boolean → 'true'/'false', finite number → String, string → verbatim); anything
 * else (an object/undefined property that is not a knob value) is ignored, leaving #state untouched.
 */
function liveToState(state: Map<string, string>, name: string, live: unknown): void {
  if (typeof live === 'boolean') state.set(name, live ? 'true' : 'false')
  else if (typeof live === 'number' && Number.isFinite(live)) state.set(name, String(live))
  else if (typeof live === 'string') state.set(name, live)
}

// ── knob derivation — a2ui mode (from the default catalog's component def) ───────────────────────────────────
const asRecord = (schema: JsonSchema): Record<string, unknown> => (typeof schema === 'object' ? schema : {})

/** Map one catalog `PropDef.type` JSON-Schema fragment to a knob (enum → radio-group/select · scalar → input · object → skip). */
function knobFromSchema(name: string, def: PropDef): Knob {
  const schema = asRecord(def.type)
  const members = Array.isArray(schema.enum) ? schema.enum.filter((v): v is string => typeof v === 'string') : []
  if (members.length > 0) return { name, kind: 'enum', values: members }
  const t = schema.type
  if (t === 'boolean') return { name, kind: 'boolean' }
  if (t === 'number' || t === 'integer') return { name, kind: 'number' }
  if (t === 'string') return { name, kind: 'string' }
  if (Array.isArray(t)) return { name, kind: 'string' } // e.g. Tabs.selected: ['string','number'] — editable as text
  return { name, kind: 'skip', note: `${typeof t === 'string' ? t : 'complex'} value — edit in code` } // Button.action, etc.
}

/** Every editable knob for an a2ui catalog component, in declared order. */
const a2uiKnobs = (def: ComponentDef): Knob[] =>
  Object.entries(def.properties).map(([name, pd]) => knobFromSchema(name, pd))

// ── knob derivation — component mode (from the {name}.md descriptor's attributes-as-API) ─────────────────────
/** Map one descriptor attribute (its codec `type`) to a knob; `json`/unknown types are read-only skips. */
function knobFromAttribute(attr: ParsedAttribute): Knob {
  const name = attr.name as string // callers filter nameless attrs first
  switch (attr.type) {
    case 'enum':
      return { name, kind: 'enum', values: attr.values ?? [] }
    case 'boolean':
      return { name, kind: 'boolean' }
    case 'number':
      return { name, kind: 'number' }
    case 'string':
      return { name, kind: 'string' }
    default:
      return { name, kind: 'skip', note: `${attr.type ?? 'complex'} value — edit in code` }
  }
}

/** Every editable knob for a component-mode control: one per named attribute, plus the default-slot text knob
 *  — grown ONLY for a SLOT_TEXT_OK target (below, a genuine text/label slot); a NO_SLOT_TEXT or STRUCTURAL
 *  target gets no text knob at all (nothing safe/meaningful for it to edit). */
function componentKnobs(attrs: readonly ParsedAttribute[], tag: string): Knob[] {
  const knobs = attrs.filter((a) => typeof a.name === 'string' && a.name !== '').map(knobFromAttribute)
  if (SLOT_TEXT_OK.has(tag)) knobs.push({ name: SLOT_TEXT, kind: 'text' })
  return knobs
}

// ── initial knob values ──────────────────────────────────────────────────────────────────────────────────────
// a2ui mode carries NO defaults in the catalog (props are all optional), so a bare specimen would render empty.
// These per-component seeds give each a legible starting point (a label/text so it is visible, a modal opened);
// knobs edit the ROOT's own props only. Values are raw knob strings (a boolean is 'true'/'false').
const A2UI_INITIAL: Record<string, Record<string, string>> = {
  Text: { text: 'Sample text', variant: 'body' },
  Button: { label: 'Button', variant: 'solid' },
  TextField: { label: 'Label', placeholder: 'Sample' },
  Field: { label: 'Field label' },
  Checkbox: { label: 'Checkbox' },
  Switch: { label: 'Switch' },
  Select: { placeholder: 'Choose…' },
  Option: { label: 'Option', value: 'a' },
  // Modal is deliberately NOT seeded open: an auto-opened dialog throws a top-layer overlay over the whole
  // gallery on load. It starts closed; the `open` knob reveals it on demand (its sample content is ready).
}

/** A sensible default-slot label for a component-mode control — its title-cased tag stem (`ui-button` → `Button`). */
const slotTextDefault = (tag: string): string =>
  tag.replace(/^ui-/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// ── sample children (so a container renders WITH content; knobs still edit the root only) ────────────────────
/** A sample subtree: the `child`/`children` ref spread onto the root + the flat extra component entries it names. */
interface Sample {
  readonly rootRef: Record<string, unknown>
  readonly extras: Array<Record<string, unknown>>
}

/** Three soft buttons — the sample content for a Row/Column layout root (shows the axis + gap). */
const layoutSample = (): Sample => ({
  rootRef: { children: ['s_l1', 's_l2', 's_l3'] },
  extras: [
    { id: 's_l1', component: 'Button', variant: 'soft', label: 'One' },
    { id: 's_l2', component: 'Button', variant: 'soft', label: 'Two' },
    { id: 's_l3', component: 'Button', variant: 'soft', label: 'Three' },
  ],
})

// Per-container sample trees (mirrors the shapes the example seeds use — Field wraps one control, Select owns its
// Options, Card composes header/content/footer regions (batch D), Tabs pairs Tab/TabPanel, a FormProvider
// coordinates a field + submit).
const SAMPLE_TREES: Record<string, () => Sample> = {
  Field: () => ({ rootRef: { child: 's_in' }, extras: [{ id: 's_in', component: 'TextField', placeholder: 'Sample input' }] }),
  FormProvider: () => ({
    rootRef: { children: ['s_field', 's_actions'] },
    extras: [
      { id: 's_field', component: 'Field', label: 'Full name', child: 's_field_in' },
      { id: 's_field_in', component: 'TextField', name: 'name', placeholder: 'Ada Lovelace' },
      { id: 's_actions', component: 'Row', gap: 'md', justify: 'end', children: ['s_submit'] },
      { id: 's_submit', component: 'Button', variant: 'solid', label: 'Submit', action: { action: 'submit', submit: true } },
    ],
  }),
  Select: () => ({
    rootRef: { children: ['s_o1', 's_o2', 's_o3'] },
    extras: [
      { id: 's_o1', component: 'Option', value: 'a', label: 'Option A' },
      { id: 's_o2', component: 'Option', value: 'b', label: 'Option B' },
      { id: 's_o3', component: 'Option', value: 'c', label: 'Option C' },
    ],
  }),
  Row: layoutSample,
  Column: layoutSample,
  // BATCH D — the region model reads: header (a real heading) · content (body) · footer (an action), mirroring
  // the card-doc.ts reference specimen (header/content/footer, a save action in the footer). Text.variant's
  // catalog wire enum is `h1…h5 | caption | body` (catalog.json) — 'title' is NOT a member (it's the ui-text
  // TRIPLE h5 fans out to internally, TEXT_VARIANT_TABLE in factories.ts — not itself a selectable wire value);
  // an invalid member silently falls back to 'body' (factories.ts's documented unrecognized-value fallback),
  // which is exactly how this shipped broken — the header rendered as body text, losing the header/content
  // distinction. 'h5' is the real wire member that resolves to that title-weight triple.
  Card: () => ({
    rootRef: { children: ['s_header', 's_content', 's_footer'] },
    extras: [
      { id: 's_header', component: 'CardHeader', children: ['s_htext'] },
      { id: 's_htext', component: 'Text', variant: 'h5', text: 'Account' },
      { id: 's_content', component: 'CardContent', children: ['s_ctext'] },
      { id: 's_ctext', component: 'Text', variant: 'body', text: 'A card composes three region sub-elements as a presence-driven grid.' },
      { id: 's_footer', component: 'CardFooter', children: ['s_save'] },
      { id: 's_save', component: 'Button', variant: 'solid', label: 'Save' },
    ],
  }),
  Tabs: () => ({
    rootRef: { children: ['s_tab0', 's_tab1', 's_panel0', 's_panel1'] },
    extras: [
      { id: 's_tab0', component: 'Tab', children: ['s_tl0'] },
      { id: 's_tl0', component: 'Text', variant: 'body', text: 'Tab one' },
      { id: 's_tab1', component: 'Tab', children: ['s_tl1'] },
      { id: 's_tl1', component: 'Text', variant: 'body', text: 'Tab two' },
      { id: 's_panel0', component: 'TabPanel', children: ['s_pt0'] },
      { id: 's_pt0', component: 'Text', variant: 'body', text: 'First panel content' },
      { id: 's_panel1', component: 'TabPanel', children: ['s_pt1'] },
      { id: 's_pt1', component: 'Text', variant: 'body', text: 'Second panel content' },
    ],
  }),
  Modal: () => ({
    rootRef: { children: ['s_mtext'] },
    extras: [{ id: 's_mtext', component: 'Text', variant: 'body', text: 'Modal content' }],
  }),
}

/** The sample subtree for a component: an explicit tree, or a generic single Text/child fallback for any container. */
function sampleFor(name: string, def: ComponentDef): Sample {
  const explicit = SAMPLE_TREES[name]
  if (explicit) return explicit()
  if (!def.children) return { rootRef: {}, extras: [] }
  const text = { id: 's_child', component: 'Text', variant: 'body', text: 'Sample content' }
  return def.children === 'child'
    ? { rootRef: { child: 's_child' }, extras: [text] }
    : { rootRef: { children: ['s_child'] }, extras: [text] }
}

// ── sample children — component mode (BATCH B: representative content for structural containers) ─────────────
// The component-mode counterpart to a2ui-mode's SAMPLE_TREES/A2UI_INITIAL above: a bare `document.createElement
// (tag)` isn't enough for (a) a control whose OWN `connected()` requires real light-DOM structure to construct
// at all (ui-tooltip/ui-menu/ui-popover each throw without a trigger/anchor as their first element child,
// `#ensureParts()` in tooltip.ts / menu.ts / popover.ts), or (b) a STRUCTURAL container (below) whose default
// slot IS its real content model — a bare grid/row/list/card/radio-group/form-provider would render a single
// stub or an empty box, which the representative-specimen law treats as a defect. Component mode otherwise
// NEVER appends children (a knob only ever sets an attribute or the default-slot text) — this map is the one,
// narrow, per-TAG exception (component mode has no catalog def to key by name, unlike SAMPLE_TREES).
const sampleTrigger = (): HTMLElement => {
  // Dogfoods ui-button as the overlay trigger/anchor for the tooltip/menu/popover specimens (Kim's
  // directive). Each of those controls adopts its FIRST element child as the trigger/anchor and sets
  // data-part + the disclosure ARIA (aria-expanded/-controls/-describedby) on it — a ui-button is a valid
  // element child, is focusable, and is semantically a button, so it composes cleanly as the trigger.
  const btn = document.createElement('ui-button')
  btn.textContent = 'Trigger'
  return btn
}

/** A plain labelled block — page-authored demo content (NOT a ui-* control), the component-mode analogue of the
 *  *-doc.ts pages' own `demoBox()` (site/lib/specimens.ts) — reimplemented locally so component-preview.ts
 *  carries no dependency on the docs-page demo-content stylesheet. Fills a layout primitive's default slot so
 *  its axis/gap/track flow is actually visible (a single stub cell teaches nothing — the representative-
 *  specimen law); styled minimally by `.cp-sample-item` in component-preview.css. */
function sampleItem(label: string): HTMLElement {
  const item = document.createElement('div')
  item.className = 'cp-sample-item'
  item.textContent = label
  return item
}

/** A `[role=option]` child — the same shape #buildKnob's own ui-select enum knob uses (select.md / combo-box.md
 *  `slots`): appended BEFORE connection, the control moves it into its own listbox at first connect. */
function sampleOption(value: string, label: string): HTMLElement {
  const option = document.createElement('div')
  option.setAttribute('role', 'option')
  option.setAttribute('value', value)
  option.textContent = label
  return option
}

const COMPONENT_SAMPLE_CHILDREN: Record<string, () => HTMLElement[]> = {
  // ── STRUCTURAL containers (below) — the default slot IS the content model, mirrors the *-doc.ts shapes ────
  'ui-grid': () => ['Cell 1', 'Cell 2', 'Cell 3', 'Cell 4', 'Cell 5', 'Cell 6'].map(sampleItem), // 6 cells (grid-doc.ts): multiple auto-fit tracks form — COMPONENT_INITIAL below seeds gap/min so they're visible
  'ui-row': () => ['Item one', 'Item two', 'Item three'].map(sampleItem),
  'ui-column': () => ['Item one', 'Item two', 'Item three'].map(sampleItem),
  'ui-list': () => ['First item', 'Second item', 'Third item'].map(sampleItem),
  'ui-card': () => {
    const header = document.createElement('ui-card-header')
    header.textContent = 'Account'
    const content = document.createElement('ui-card-content')
    content.textContent = 'A card composes three region sub-elements as a presence-driven grid.'
    const footer = document.createElement('ui-card-footer')
    const save = document.createElement('ui-button')
    save.setAttribute('variant', 'solid')
    save.textContent = 'Save'
    footer.append(save)
    return [header, content, footer]
  },
  'ui-split': () =>
    ['Pane 1', 'Pane 2', 'Pane 3'].map((label) => {
      const pane = document.createElement('ui-split-pane')
      pane.append(sampleItem(label))
      return pane
    }),
  'ui-split-pane': () => [sampleItem('Pane content')],
  // ui-swiper-item (ADR-0124) — the ui-split-pane precedent exactly: its default slot IS the author's own
  // arbitrary slide content, left as direct host children (swiper-item.ts's `connected()` is a documented
  // no-op — it builds nothing of its own, see that file's comment). A bare specimen with no sample content
  // would render an empty box, the same representative-specimen gap ui-split-pane closes above.
  'ui-swiper-item': () => [sampleItem('Slide content')],
  // ui-toolbar (ADR-0121) — the real job, not a one-child stub: a formatting cluster + an alignment cluster +
  // undo/redo, real ui-buttons throughout (the whole-shape/representative-specimen law, LLD §5). Mirrors the
  // ui-modal sample function's own ui-row + ui-button construction, above.
  'ui-toolbar': () => {
    const ghostButton = (label: string): HTMLElement => {
      const b = document.createElement('ui-button')
      b.setAttribute('variant', 'ghost')
      b.textContent = label
      return b
    }
    const cluster = (labels: readonly string[]): HTMLElement => {
      const row = document.createElement('ui-row')
      row.setAttribute('gap', 'xs')
      row.append(...labels.map(ghostButton))
      return row
    }
    return [cluster(['Bold', 'Italic', 'Underline']), cluster(['Left', 'Center', 'Right']), ghostButton('Undo'), ghostButton('Redo')]
  },
  'ui-radio-group': () =>
    (
      [
        ['sm', 'Small'],
        ['md', 'Medium'],
        ['lg', 'Large'],
      ] as const
    ).map(([value, label]) => {
      const radio = document.createElement('ui-radio')
      radio.setAttribute('value', value)
      radio.textContent = label
      return radio
    }),
  // ADR-0095 — the standalone segmented control's own gallery specimen (ui-segment children, not ui-radio).
  'ui-segmented-control': () =>
    (
      [
        ['sm', 'Small'],
        ['md', 'Medium'],
        ['lg', 'Large'],
      ] as const
    ).map(([value, label]) => {
      const segment = document.createElement('ui-segment')
      segment.setAttribute('value', value)
      segment.textContent = label
      return segment
    }),
  'ui-form-provider': () => {
    const field = document.createElement('ui-field')
    field.setAttribute('label', 'Full name')
    const input = document.createElement('ui-text-field')
    input.setAttribute('name', 'name')
    field.append(input)
    const submit = document.createElement('ui-button')
    submit.setAttribute('variant', 'solid')
    submit.textContent = 'Submit'
    return [field, submit]
  },
  // ADR-0117 — a real button so the gallery specimen paints a non-zero box (the provider itself has no
  // geometry of its own; the "test the whole shape" law needs REAL content under a STRUCTURAL target).
  'ui-theme-provider': () => {
    const button = document.createElement('ui-button')
    button.setAttribute('variant', 'solid')
    button.textContent = 'Themed'
    return [button]
  },

  // ── other NO_SLOT_TEXT targets — self-constructing controls that had NO representative content before ─────
  'ui-field': () => {
    const field = document.createElement('ui-text-field')
    field.setAttribute('type', 'email')
    return [field]
  },
  'ui-tabs': () => {
    const tab1 = document.createElement('ui-tab')
    tab1.setAttribute('key', 'overview')
    tab1.textContent = 'Overview'
    const tab2 = document.createElement('ui-tab')
    tab2.setAttribute('key', 'pricing')
    tab2.textContent = 'Pricing'
    const panel1 = document.createElement('ui-tab-panel')
    panel1.textContent = 'The overview panel content.'
    const panel2 = document.createElement('ui-tab-panel')
    panel2.textContent = 'The pricing panel content.'
    return [tab1, tab2, panel1, panel2]
  },
  'ui-select': () => [sampleOption('a', 'Option A'), sampleOption('b', 'Option B'), sampleOption('c', 'Option C')],
  'ui-combo-box': () => [
    sampleOption('apple', 'Apple'),
    sampleOption('banana', 'Banana'),
    sampleOption('cherry', 'Cherry'),
  ],
  'ui-menu': () => {
    const items = ['New file', 'Open file', 'Save', 'Exit'].map((label) => {
      const item = document.createElement('div')
      item.dataset['value'] = label.toLowerCase().replace(/\s+/g, '-')
      item.textContent = label
      return item
    })
    return [sampleTrigger(), ...items]
  },
  'ui-popover': () => {
    const section = document.createElement('section')
    const heading = document.createElement('h3')
    heading.textContent = 'Settings'
    const body = document.createElement('p')
    body.textContent = 'Panel content in the top layer.'
    section.append(heading, body)
    return [sampleTrigger(), section]
  },
  'ui-tooltip': () => {
    const text = document.createElement('span')
    text.textContent = 'Save your changes (Ctrl+S)'
    return [sampleTrigger(), text]
  },
  'ui-modal': () => {
    // do NOT auto-open (the `open` knob stays the reveal mechanism) — content is ready the moment it is.
    const heading = document.createElement('h2')
    heading.textContent = 'Example dialog'
    const body = document.createElement('p')
    body.textContent = 'A representative modal body.'
    const actions = document.createElement('ui-row')
    actions.setAttribute('gap', 'sm')
    actions.setAttribute('justify', 'end')
    const close = document.createElement('ui-button')
    close.setAttribute('variant', 'soft')
    close.textContent = 'Close'
    actions.append(close)
    return [heading, body, actions]
  },
  // ui-command-modal (ADR-0125): the palette's real job — a populated, GROUPED command list (not a one-child
  // stub), the whole-shape/representative-specimen law. Also do NOT auto-open (the ui-modal precedent, above);
  // the `open` knob reveals it, so the viewer sees the trigger-to-palette flow rather than a pre-opened dialog.
  'ui-command-modal': () => {
    const commandOption = (value: string, label: string, shortcut?: string): HTMLElement => {
      const option = document.createElement('div')
      option.setAttribute('role', 'option')
      option.setAttribute('value', value)
      option.append(document.createTextNode(label))
      if (shortcut) {
        const span = document.createElement('span')
        span.setAttribute('data-role', 'shortcut')
        span.setAttribute('aria-hidden', 'true')
        span.textContent = shortcut
        option.append(span)
      }
      return option
    }
    const group = (id: string, label: string, ...options: HTMLElement[]): HTMLElement => {
      const heading = document.createElement('div')
      heading.id = id
      heading.setAttribute('data-role', 'group-label')
      heading.textContent = label
      const g = document.createElement('div')
      g.setAttribute('role', 'group')
      g.setAttribute('aria-labelledby', id)
      g.append(heading, ...options)
      return g
    }
    return [
      group('cp-cmd-nav', 'Navigation', commandOption('home', 'Go Home', '⌘H'), commandOption('settings', 'Settings', '⌘,')),
      group('cp-cmd-actions', 'Actions', commandOption('logout', 'Log out'), commandOption('share', 'Share file')),
    ]
  },
  // ui-disclosure (ADR-0113): the host's light-DOM children seed the fold's body content at connect time —
  // the "children = body" anatomy invariant (disclosure.md). NOT the STRUCTURAL bucket below: #ensureParts()
  // ADOPTS these children into a nested `<div data-part="body">` part rather than leaving them as direct
  // host children, so it lives in NO_SLOT_TEXT (see that Set's own comment).
  'ui-disclosure': () => {
    const body = document.createElement('p')
    body.textContent = 'Folded content, revealed on toggle.'
    return [body]
  },
  // ui-toast (ADR-0112): the message text MUST be a light-DOM child present before connect — #ensureParts()
  // adopts it into the message part at that instant (SPEC-R15 AC2, the toast.md example markup precedent).
  'ui-toast': () => {
    const message = document.createElement('span')
    message.textContent = 'File uploaded.'
    return [message]
  },
  // ui-toast-region (ADR-0112, LLD-C8): a STRUCTURAL target — its real content model is `ui-toast` children,
  // stacked in append order (the toast.md example markup: one plain toast + one actionable urgent toast).
  // Present before connect so the region's own `#syncVisibility()` opens its popover on first paint.
  'ui-toast-region': () => {
    const plain = document.createElement('ui-toast')
    plain.textContent = 'File uploaded.'
    const actionable = document.createElement('ui-toast')
    actionable.setAttribute('urgent', '')
    actionable.setAttribute('duration', '0')
    actionable.setAttribute('action', 'Retry')
    actionable.textContent = 'Upload failed.'
    return [plain, actionable]
  },
  // ui-timeline-item (ADR-0122): the disclosure precedent exactly — a `[data-role="detail"]` child is
  // MOVED into a composed `ui-disclosure` at connect (#ensureAnatomy), so it lives in NO_SLOT_TEXT below.
  'ui-timeline-item': () => {
    const detail = document.createElement('span')
    detail.setAttribute('data-role', 'detail')
    detail.textContent = 'Carrier: UPS · Tracking 1Z999AA10123456784'
    return [detail]
  },
  // ui-timeline (ADR-0122): a STRUCTURAL target — its real content model is authored `ui-timeline-item`
  // children, read back in DOM order (the timeline.md example markup: a real order-tracking chronology).
  'ui-timeline': () => {
    const rows: Array<[string, string, string]> = [
      ['done', 'Order placed', 'Apr 15, 2:30 PM'],
      ['active', 'Shipped', 'Apr 17, 11:45 AM'],
      ['pending', 'Delivered', 'Expected Apr 20'],
    ]
    return rows.map(([status, label, timestamp]) => {
      const item = document.createElement('ui-timeline-item')
      item.setAttribute('status', status)
      item.setAttribute('label', label)
      item.setAttribute('timestamp', timestamp)
      return item
    })
  },
  // ui-status-stream (ADR-0122): the ui-toast-region precedent exactly — a STRUCTURAL target whose real
  // content model is `ui-timeline-item` children this host normally creates via its OWN imperative
  // appendEntry/update API, but which render identically when pre-authored (a representative bare specimen).
  'ui-status-stream': () => {
    const rows: Array<[string, string]> = [
      ['done', 'Searching the codebase…'],
      ['active', 'Generating the patch…'],
    ]
    return rows.map(([status, label]) => {
      const item = document.createElement('ui-timeline-item')
      item.setAttribute('status', status)
      item.setAttribute('label', label)
      return item
    })
  },
}

// The component-mode counterpart to a2ui-mode's A2UI_INITIAL: a per-tag knob-value seed for a control whose
// OWN descriptor default is not demonstrable (not a design fix — icon.md's `glyph: ''` default is CORRECT, an
// unset icon legitimately renders nothing; this only supplies a DEMO value, same discipline as A2UI_INITIAL
// never touching the catalog). ui-icon is one fleet member: `glyph` defaults to '' (renders nothing, icon.ts:
// 38-41), so a bare specimen would be an invisible 0×0 box — seeded with a real, shipped Phosphor name so the
// gallery's whole-shape law (box > 0) has something to measure. ui-grid/ui-field (batch B) seed a legible
// starting prop value to go with their new sample children (grid-doc.ts's own gap/min; field.md's own default
// label is '').
// Wave M1 (ADR-0111/ADR-0113): ui-stat's `label`/`figure` and ui-badge's `label` are real string knobs (not
// a codec skip), but their descriptor default is '' (blank) — same demonstrability gap as ui-icon's `glyph`
// — so a bare specimen would render an empty tile / an unlabeled dot. ui-disclosure's `summary` is likewise
// a real string knob defaulting to '' — an unlabeled fold reads as a bare chevron with no affordance text.
// Wave M1 (ADR-0118): ui-swatch's `color`/`label` are real string knobs (not a codec skip) but default to
// '' (blank) — the same demonstrability gap as ui-icon's `glyph` — so a bare specimen would render an empty
// transparent box with no name to read.
const COMPONENT_INITIAL: Record<string, Record<string, string>> = {
  'ui-icon': { glyph: 'check' },
  'ui-grid': { gap: 'md', min: '8rem' },
  'ui-field': { label: 'Email' },
  'ui-stat': { label: 'Revenue', figure: '48200', delta: '12' },
  'ui-badge': { label: '3 failing', intent: 'danger' },
  'ui-disclosure': { summary: 'Full log' },
  'ui-swatch': { color: '--md-sys-color-primary', label: 'primary' },
  // ui-timeline-item (ADR-0122): `label`/`timestamp` are real string knobs defaulting to '' — the same
  // demonstrability gap as ui-disclosure's `summary` above; a bare specimen would render an unlabeled dot.
  'ui-timeline-item': { status: 'done', label: 'Deployed', timestamp: 'Apr 15, 2:30 PM' },
}

// A per-tag static HOST ATTRIBUTE seed (batch C) — distinct from COMPONENT_INITIAL (which seeds a KNOB's
// value): this is for an attribute the descriptor does NOT expose as an editable prop at all, so no knob could
// ever supply it. ui-slider is the one fleet member: its track is ::before/::after (no text slot — NO_SLOT_TEXT
// below), so without an explicit seed a bare specimen carries no accessible name at all.
//
// Wave M1 (ADR-0107): ui-sparkline/ui-bar-chart's `values`/`data` are JSON-string attributes — a codec
// `knobFromAttribute` maps to `kind: 'skip'` (no editable knob, same as any complex-typed attr), so their
// LIVE descriptor default (an empty array) would mount zero rendered children (an honest empty state per
// SPEC-R3/R7, but an uninstructive bare specimen — the same gap ui-icon's `name: ''` default closes via
// COMPONENT_INITIAL). Seeded here with the SAME JSON-string shape the descriptors' own `.md` examples use.
// Wave M1 (ADR-0111, report-family.lld.md): ui-table's `columns`/`rows` are JSON-string attributes — the
// same `kind: 'skip'` codec gap as ui-sparkline/ui-bar-chart's `values`/`data` above (no editable knob), so
// its LIVE descriptor default (an empty array) would stamp no table at all (an honest empty state per
// SPEC-R3, but an uninstructive bare specimen). Seeded with the same JSON-string shape table.md's own
// example uses.
// Wave M1 (ADR-0118, token-surfaces.lld.md LLD-C9): ui-ramp's `steps`/ui-ladder's `tiers` are JSON-string
// attributes — the same `kind: 'skip'` codec gap as ui-sparkline/ui-bar-chart's `values`/`data` above (no
// editable knob), so their LIVE descriptor default (an empty array) would render an empty strip/list (an
// honest empty state per SPEC-R7/R11, but an uninstructive bare specimen). Seeded with a real color/
// dimension series so the gallery's whole-shape law (a non-collapsed strip/list) has something to measure.
const COMPONENT_SAMPLE_ATTRS: Record<string, Record<string, string>> = {
  'ui-slider': { 'aria-label': 'Volume' },
  'ui-sparkline': { values: '[3,5,4,8,7]' },
  'ui-bar-chart': { data: '[{"label":"EMEA","value":42},{"label":"APAC","value":31}]' },
  'ui-table': {
    columns: '[{"key":"region","label":"Region"},{"key":"revenue","label":"Revenue","type":"number"}]',
    rows: '[{"region":"EMEA","revenue":42000},{"region":"APAC","revenue":31000}]',
  },
  'ui-ramp': {
    steps:
      '[{"label":"100","value":"--md-sys-color-primary-100"},{"label":"300","value":"--md-sys-color-primary-300"},' +
      '{"label":"500","value":"--md-sys-color-primary-500"},{"label":"700","value":"--md-sys-color-primary-700"},' +
      '{"label":"900","value":"--md-sys-color-primary-900"}]',
  },
  'ui-ladder': {
    tiers: '[{"label":"sm","value":"24px"},{"label":"md","value":"28px"},{"label":"lg","value":"36px"}]',
  },
}

// COMPONENT_SAMPLE_INIT — a per-tag post-construction driver call, distinct from COMPONENT_SAMPLE_CHILDREN
// (light-DOM children appended BEFORE connect): ui-swiper-pagination/-paddles are pure coordinator-driven
// anchors (swiper-pagination.md/swiper-paddles.md: `slots: []` on both) — ALL their visible content is built
// imperatively by the owning `ui-swiper`'s `renderInto`/`fill` PUBLIC methods (properties: in their own .md),
// never authored as children. A bare specimen has nothing to seed as light DOM at all; calling their own
// public coordinator method directly (rather than hand-duplicating the dot/button markup it produces) gives a
// representative specimen that can never drift from the real renderInto()/fill() shape.
const COMPONENT_SAMPLE_INIT: Record<string, (el: HTMLElement) => void> = {
  'ui-swiper-pagination': (el) => (el as UISwiperPaginationElement).renderInto(3, 0, () => {}),
  'ui-swiper-paddles': (el) => (el as UISwiperPaddlesElement).fill(() => {}, () => {}, 'horizontal'),
}

// ── SLOT_TEXT gating — component mode (the fleet-wide hardening) ──────────────────────────────────────────────
// `componentKnobs()` grows a SLOT_TEXT knob ONLY for a SLOT_TEXT_OK target (below) — a plain
// `el.textContent = raw` write. That is correct for a control whose default/unnamed slot genuinely IS a
// text/label slot — but it is WRONG for two other shapes: a control that builds/owns real structural children
// in `connected()` (a self-created editor, listbox, dialog, panel, tablist strip, rail/thumbs, or
// label/description/error chrome) that `textContent =` would silently destroy (NO_SLOT_TEXT); and a STRUCTURAL
// container (batch B) whose default slot IS its real content model — children, not a string (grid/row/column/
// list/card/radio-group/form-provider). Both get real sample CHILDREN instead (COMPONENT_SAMPLE_CHILDREN
// above) and NO text knob at all.
//
// MECHANISM (per Kim's ruling): the descriptor model does NOT carry this distinction structurally today —
// `slots[]` is free-text prose (a schema change is real ADR-0004 surgery, out of this file's scope) — so this
// is an EXPLICIT PER-TAG THREE-WAY PARTITION, mirroring the COMPONENT_SAMPLE_CHILDREN / a2ui-mode A2UI_INITIAL
// precedent (three allowlists, not a runtime heuristic). A runtime check (e.g. "skip if el.children.length > 0
// at apply time") was considered and REJECTED: ui-text legitimately builds a heading STAMP element when
// `as ≠ 'none'` (ADR-0025/0078) and runs a self-healing childList observer that re-adopts its text after a
// `textContent` clobber — so a live children-count would misclassify a genuinely SAFE, self-healing control as
// unsafe. The partition below was verified per-control (component-preview-slot-text.test.ts pins it — see
// there for the fleet-wide diagnosis) — NOT by observing runtime state.
//
// NO_SLOT_TEXT — connected() builds/owns real structural children a SLOT_TEXT write would destroy, OR (ui-
// slider, batch C) has NO text slot at all (its track is ::before/::after — `textContent=` would inject stray
// text into the track, not a label). 3 of these (the COMPONENT_SAMPLE_CHILDREN keys ui-menu/ui-popover/
// ui-tooltip) additionally need a sample trigger just to CONSTRUCT; ui-icon builds a name-driven <svg>
// (setIcon(), icon.ts:38-41) whenever its `name` knob is non-empty — NOT the "builds zero children" case
// SLOT_TEXT_OK requires, and a `textContent =` write there would clobber that SVG the moment `name` is set (the
// exact defect class this partition exists to prevent); most of the rest now ALSO get real sample content
// (COMPONENT_SAMPLE_CHILDREN, batch B) so their specimen is representative, not merely non-throwing.
export const NO_SLOT_TEXT = new Set([
  'ui-badge', // connected() builds the glyph+label spans once (replaceChildren) — `label` is a PROP, not a slot at all (slots: [] — badge.md)
  'ui-bar-chart', // component-built rows (replaceChildren) — one role=listitem row per datum, never author-slotted (slots: [] — bar-chart.md)
  'ui-calendar', // #ensureShell() builds the whole nav+grid panel unconditionally
  'ui-color-picker', // #ensureShell() builds the whole pad+channels+readout tree unconditionally (ADR-0123); [slot=presets] is a named exception, not the default slot
  'ui-combo-box', // #ensureParts(): a control-created editor + listbox
  'ui-command-modal', // #ensureParts(): a control-created search/list/status + a nested ui-modal (ADR-0125)
  'ui-field', // #ensureParts(): the label/description/error chrome (3 parts)
  'ui-icon', // setIcon() injects a real <svg> child whenever `name` is non-empty (icon.ts:38-41) — a name-driven slot, not authored text
  'ui-menu', // #ensureParts(): trigger (COMPONENT_SAMPLE_CHILDREN) + panel
  'ui-modal', // #ensureDialog(): the control-owned <dialog> part
  'ui-popover', // #ensureParts(): trigger (COMPONENT_SAMPLE_CHILDREN) + panel
  'ui-select', // #ensureParts(): a control-created trigger button + listbox
  'ui-slider', // ::before/::after track only — no text slot at all (batch C); seeded an aria-label via COMPONENT_SAMPLE_ATTRS instead
  'ui-slider-multi', // JS-managed light-DOM rail/fill/thumb children (NOT ::before/::after, unlike ui-slider)
  'ui-sparkline', // component-built inline <svg> (createElementNS + replaceChildren) — the ui-icon precedent, a name/values-driven mark, not authored text (slots: [] — sparkline.md)
  'ui-disclosure', // #ensureParts(): the details/summary/chevron chrome — host children are ADOPTED into a nested body PART, never left as direct host children (unlike a STRUCTURAL container), so a host-level SLOT_TEXT write would destroy the whole part tree
  'ui-stat', // connected() builds four spans once (replaceChildren) from label/value/delta/caption PROPS — no light-DOM content model at all (slots: [] — stat.md)
  'ui-table', // connected() builds the scroll/table/thead/tbody skeleton — fully columns/rows-prop-driven, no light-DOM content model at all (slots: [] — table.md)
  'ui-tabs', // the control-created tablist strip PART
  'ui-text-field', // the contenteditable editor PART (×2 parts: editor + measurer)
  'ui-textarea', // ADR-0134: the SAME contenteditable editor PART pattern as ui-text-field (editor + message)
  'ui-tooltip', // #ensureParts(): anchor (COMPONENT_SAMPLE_CHILDREN) + panel
  // Feed family (ADR-0112): ui-progress/ui-avatar/ui-attachment build their own display parts once
  // (replaceChildren/append) from PROPS alone — no light-DOM content model at all (slots: [] on all three).
  // ui-toast #ensureParts() ADOPTS any host children present at connect into a nested message PART — the
  // ui-disclosure precedent exactly (a host-level SLOT_TEXT write would land in the wrong place and skip
  // the affordance cluster it also builds there).
  'ui-progress',
  'ui-avatar',
  'ui-attachment',
  'ui-toast', // COMPONENT_SAMPLE_CHILDREN below seeds its message text — must be present BEFORE connect (SPEC-R15 AC2)
  // Token-surface family (ADR-0118, token-surfaces.lld.md LLD-C9): all three build their entire visible
  // content imperatively from PROPS alone (swatch's box+value pair; ramp/ladder's replaceChildren cell/row
  // lists) — no light-DOM content model at all (slots: [] on all three, the ui-stat/ui-bar-chart precedent).
  'ui-swatch',
  'ui-ramp',
  'ui-ladder',
  // ui-timeline-item (ADR-0122): #ensureAnatomy() ADOPTS a `[data-role="detail"]` host child into a
  // composed `ui-disclosure` part (never left as a direct host child) — the ui-disclosure precedent exactly.
  'ui-timeline-item',
  // The ui-swiper family (ADR-0124): ui-swiper reparents ui-swiper-item children into a control-created
  // `[data-part=track]` PART — the ui-tabs tablist-strip precedent exactly. ui-swiper-pagination/-paddles
  // build their ENTIRE visible content imperatively (renderInto()/fill()) from the coordinator — no author
  // content model at all (slots: [] on both).
  'ui-swiper',
  'ui-swiper-pagination',
  'ui-swiper-paddles',
  // genui-surface.spec.md SPEC §3.2 (D9, B1): ui-sandbox-frame builds its ONE child (the iframe, or the
  // fallback affordance) entirely imperatively from props (html/csp) — no light-DOM content model at all
  // (slots: [] — sandbox-frame.md), the ui-stat/ui-swatch precedent exactly.
  'ui-sandbox-frame',
])

// STRUCTURAL (batch B) — the default slot IS the real content model (children ARE the grid cells / flex items /
// list rows / card regions / radio options / coordinated form fields), left as direct host children, never a
// text/label string. Growing a SLOT_TEXT knob here would overwrite the representative sample children with a
// bare string (`.textContent =` clears every child). These get real sample children instead
// (COMPONENT_SAMPLE_CHILDREN above) and no text knob.
// ui-toast-region (ADR-0112, LLD-C8) joins this set too: its `slots` is a real default slot ("zero or more
// ui-toast children, stacked in append order") — parts: [] on the host, nothing adopts/moves them — the
// exact STRUCTURAL shape, not ui-toast's own adopted-into-a-part one.
// ui-theme-provider (ADR-0117) joins this set too: its default slot IS "the themed subtree" (field.md/
// form-provider.md's own coordination-primitive posture) — real content, never a text/label string.
// ui-split / ui-split-pane (ADR-0120 cl.2, app-surfaces-m4.lld.md LLD-C1) join this set too: ui-split's
// default slot IS its N panes (real ui-split-pane children the control lays out via draggable separators);
// ui-split-pane's default slot IS the author's own arbitrary content — both the exact STRUCTURAL shape.
// ui-toolbar (ADR-0121) joins this set too: host-as-flex, light-DOM children ARE the roving items — the exact
// ui-row STRUCTURAL shape, not a text/label slot.
// ui-timeline / ui-status-stream (ADR-0122) join this set too: ui-timeline's default slot IS its authored
// `ui-timeline-item` chronology; ui-status-stream's is the SAME item children, normally created via its own
// appendEntry/update API but rendering identically when pre-authored — both the exact STRUCTURAL shape,
// never a text/label string (the ui-toast-region precedent).
// ui-swiper-item (ADR-0124) joins this set too: its default slot IS the slide's own arbitrary content, left
// as direct host children (sized entirely by the owning track) — the exact STRUCTURAL shape.
export const STRUCTURAL = new Set(['ui-card', 'ui-column', 'ui-form-provider', 'ui-grid', 'ui-list', 'ui-radio-group', 'ui-row', 'ui-segmented-control', 'ui-split', 'ui-split-pane', 'ui-swiper-item', 'ui-theme-provider', 'ui-timeline', 'ui-status-stream', 'ui-toast-region', 'ui-toolbar'])

// SLOT_TEXT_OK — SLOT_TEXT is a real, safe, MEANINGFUL knob: a genuine text/label default slot, the accessible
// label content a viewer edits to see the control's OWN typography/sizing respond (button/checkbox/radio/
// switch/text/code — ui-code's light-DOM children ARE its verbatim text content, textContent-only, host-as-
// content, the ui-text precedent exactly — code.md). Paired with NO_SLOT_TEXT + STRUCTURAL: the three sets
// PARTITION the whole fleet — the coverage test asserts this, so a new control lands in none of them by
// default and fails loud instead of silently inheriting a guess.
// ui-swiper-label (ADR-0124) joins this set too: its default slot IS a genuine text/label content — the
// author's text becomes the owning ui-swiper's accessible name.
export const SLOT_TEXT_OK = new Set(['ui-button', 'ui-checkbox', 'ui-code', 'ui-radio', 'ui-segment', 'ui-swiper-label', 'ui-switch', 'ui-text'])

// ── the element ──────────────────────────────────────────────────────────────────────────────────────────────
type Mode = 'component' | 'a2ui'

class ComponentPreview extends HTMLElement {
  #built = false
  #mode: Mode = 'a2ui'
  #target = ''
  #knobs: Knob[] = []
  #state = new Map<string, string>() // knob name → raw string value ('' / 'true' / a member / free text)
  #refreshers: Array<() => void> = [] // per-knob DOM sync closures (keep each knob control in step with #state)
  #surface: HTMLElement | undefined
  #canvasCol: HTMLElement | undefined // the right column (holds the artboard) — toggles the empty-specimen hint
  #host: RendererHost | undefined // a2ui mode: the CURRENT renderer (disposed + rebuilt each change, N3)
  #liveEl: HTMLElement | undefined // component mode: the ONE element, diff-mutated in place

  connectedCallback(): void {
    if (this.#built) {
      // Reconnected (moved in the DOM): disconnect disposed the a2ui host, so rebuild its canvas from #state (the
      // left column + #state persist with the element; component mode keeps its live element and needs no rebuild).
      if (this.#mode === 'a2ui' && !this.#host && this.#surface) this.#buildA2ui()
      return
    }
    this.#built = true
    this.#mode = this.getAttribute('mode') === 'component' ? 'component' : 'a2ui'
    this.#target = this.getAttribute('target') ?? ''
    this.#build()
  }

  // Resolve metadata → seed knobs + state → build the two columns → first render. A missing/unknown target
  // renders a legible error row rather than a blank frame.
  #build(): void {
    const meta = this.#resolveMeta()
    if (!meta) {
      const err = document.createElement('div')
      err.className = 'preview-error'
      err.textContent = `Unknown ${this.#mode} target "${this.#target}".`
      this.append(err)
      return
    }
    this.#knobs = meta.knobs
    this.#seedState()

    const root = document.createElement('div')
    root.className = 'preview'
    const controls = document.createElement('div')
    controls.className = 'preview-controls'
    controls.append(this.#buildDetails(meta.kindLabel), this.#buildKnobs())

    const canvasCol = document.createElement('div')
    canvasCol.className = 'preview-canvas'
    canvasCol.setAttribute('role', 'figure') // a labelled region so the live artboard is a named landmark for AT
    canvasCol.setAttribute('aria-label', `${this.#target} live preview`)
    const { stage, surface } = createCanvasSurface()
    this.#surface = surface
    this.#canvasCol = canvasCol
    canvasCol.append(stage)

    root.append(controls, canvasCol)
    this.append(root)
    this.#render()
  }

  /** Resolve the target's knobs + a human kind label + (a2ui) its catalog def, or undefined when unknown. */
  #resolveMeta(): { knobs: Knob[]; kindLabel: string; def?: ComponentDef } | undefined {
    if (this.#mode === 'a2ui') {
      const def = defaultCatalog.components[this.#target]
      if (!def) return undefined
      const child = def.children ? ` · children: ${def.children}` : ''
      return { knobs: a2uiKnobs(def), kindLabel: `A2UI catalog component${child}`, def }
    }
    const doc = loadDescriptorByTag(this.#target)
    if (!doc) return undefined
    const tier = doc.descriptor.scalars.get('tier')
    return {
      knobs: componentKnobs(doc.descriptor.attributes, this.#target),
      kindLabel: `ui-* control${tier ? ` · tier: ${tier}` : ''}`,
    }
  }

  /** Seed #state with each knob's starting value: descriptor defaults (component) or the A2UI_INITIAL seed (a2ui). */
  #seedState(): void {
    if (this.#mode === 'a2ui') {
      for (const [name, value] of Object.entries(A2UI_INITIAL[this.#target] ?? {})) this.#state.set(name, value)
      return
    }
    const doc = loadDescriptorByTag(this.#target)
    for (const attr of doc?.descriptor.attributes ?? []) {
      if (typeof attr.name !== 'string') continue
      const d = attr.default
      if (typeof d === 'string' && d !== '' && d !== 'null') this.#state.set(attr.name, d)
    }
    for (const [name, value] of Object.entries(COMPONENT_INITIAL[this.#target] ?? {})) this.#state.set(name, value)
    if (SLOT_TEXT_OK.has(this.#target)) this.#state.set(SLOT_TEXT, slotTextDefault(this.#target))
  }

  // ── left column builders ───────────────────────────────────────────────────────────────────────────────────
  #buildDetails(kindLabel: string): HTMLElement {
    const details = document.createElement('div')
    details.className = 'preview-details'
    const name = document.createElement('p')
    name.className = 'preview-name'
    name.textContent = this.#target
    const kind = document.createElement('span')
    kind.className = 'preview-kind'
    kind.textContent = kindLabel
    details.append(name, kind)
    return details
  }

  #buildKnobs(): HTMLElement {
    const section = document.createElement('div')
    const label = document.createElement('p')
    label.className = 'preview-section-label'
    label.textContent = 'Props'
    const list = document.createElement('div')
    list.className = 'preview-knobs'
    for (const knob of this.#knobs) list.append(this.#buildKnob(knob))
    section.append(label, list)
    return section
  }

  /** One knob row: a labelled control whose change writes #state and re-renders (skip knobs are read-only notes). */
  #buildKnob(knob: Knob): HTMLElement {
    const row = document.createElement('div')
    row.className = 'knob'
    const id = nextKnobId()
    const label = document.createElement('label')
    label.className = 'knob-label'
    label.textContent = knob.name === SLOT_TEXT ? 'text' : knob.name
    label.htmlFor = id // pair the label with its control so the knob carries an accessible name
    row.append(label)

    if (knob.kind === 'skip') {
      const note = document.createElement('span')
      note.className = 'knob-note'
      note.textContent = knob.note ?? 'read-only'
      row.append(note)
      return row
    }

    if (knob.kind === 'enum') {
      const members = knob.values ?? []
      if (members.length > 0 && members.length <= SEGMENTED_MAX) {
        // Dogfoods ui-segmented-control (Kim's routing rule — small closed enum, every option visible at
        // once; ADR-0095's standalone tag, superseding the retired ui-radio-group[variant="segmented"]).
        // Real API (segmented-control.md / segment.md): a `ui-segment` child per member (`.value` + its
        // label text), the CONTROL's own `change` event is the commit signal (NOT the individual segment's
        // — that one bubbles through the control and is consumed/re-emitted; see the target filter below),
        // `.checked` is the read/write property. UNLIKE ui-select's KNOB_UNSET "—", a segmented control
        // always has a selection (its own contract has no "none" state) — pre-select the seeded/current
        // value, falling back to the FIRST member when nothing is seeded yet (a2ui mode's catalog carries
        // no per-prop defaults).
        const group = document.createElement('ui-segmented-control') as UISegmentedControlElement
        group.id = id
        group.className = 'knob-segmented-control'
        group.setAttribute('aria-label', knob.name)
        // de-doubling closing step: every batch-A enum knob renders as a real segmented control (the
        // sliding indicator + roving come from the control itself — nothing here reimplements it).
        // Horizontal is the control's own default (no attribute needed); a wider/longer-labelled set gets
        // an explicit vertical stack instead (segmentedOrientation, above) so it fits the knob column.
        if (segmentedOrientation(members) === 'vertical') group.setAttribute('orientation', 'vertical')
        // The fallback pre-selection must be a REAL #state seed, not merely a visual default: #rootProps() /
        // #applyKnob() read #state, not "whatever the segmented control widget happens to show" — an
        // unseeded knob would render 'sm' checked in the UI while the specimen itself carried no `size` at
        // all (and a click on the ALREADY-checked 'sm' segment is then a no-op — segments can only be
        // REPLACED, never toggled off — so the desync would never self-correct). Seeding here, once, keeps
        // the widget and the specimen in sync.
        if (!this.#state.has(knob.name)) this.#state.set(knob.name, members[0])
        const segments: UISegmentElement[] = []
        for (const member of members) {
          const segment = document.createElement('ui-segment') as UISegmentElement
          segment.value = member
          segment.textContent = member
          segments.push(segment)
          group.append(segment)
        }
        const syncChecked = (): void => {
          const current = this.#state.get(knob.name) || members[0]
          for (const segment of segments) segment.checked = segment.value === current
        }
        syncChecked()
        group.addEventListener('change', (event) => {
          // Only the control's OWN re-emitted commit event (target === group) carries the SETTLED
          // selection — the individual segment's raw bubbled `change` (target === the segment) fires on
          // this same node too (event listeners on an ancestor see the bubble phase), but at that instant
          // the control has not yet enforced exclusivity (#commit runs inside its own listener, registered
          // separately), so reading `.checked` there can still see the PREVIOUS selection. Filtering to the
          // target skips that transient read and reacts to the one authoritative event
          // segmented-control.md documents.
          if (event.target !== group) return
          const checked = segments.find((s) => s.checked)
          if (checked) this.#setKnob(knob.name, checked.value)
        })
        this.#refreshers.push(syncChecked)
        row.append(group)
        return row
      }

      // Dogfoods ui-select in place of a native <select> (Kim's directive) for a larger enum. Options are
      // [role=option] light-DOM children appended BEFORE connection — ui-select moves them into its listbox at
      // first connect (select.md `slots`). The `label` prop names the trigger (ADR-0085); the visible <label
      // for> above adds click-to-focus. The `select` event (NOT `change`) is the commit signal; `.value` is
      // the read/write property (the gallery themeSelect() precedent).
      const select = document.createElement('ui-select') as UISelectElement
      select.id = id
      select.className = 'knob-select'
      select.setAttribute('size', 'sm')
      select.setAttribute('label', knob.name)
      select.setAttribute('placeholder', '—') // the unset display → the control's own default
      // The unset choice — a non-empty sentinel value (an empty-value option is inert; see KNOB_UNSET).
      const unset = document.createElement('div')
      unset.setAttribute('role', 'option')
      unset.setAttribute('value', KNOB_UNSET)
      unset.textContent = '—'
      select.append(unset)
      for (const member of knob.values ?? []) {
        const option = document.createElement('div')
        option.setAttribute('role', 'option')
        option.setAttribute('value', member)
        option.textContent = member
        select.append(option)
      }
      select.value = this.#state.get(knob.name) ?? ''
      select.addEventListener('select', () => {
        const v = select.value
        this.#setKnob(knob.name, v === KNOB_UNSET ? '' : v)
      })
      this.#refreshers.push(() => {
        select.value = this.#state.get(knob.name) ?? ''
      })
      row.append(select)
      return row
    }

    if (knob.kind === 'boolean') {
      // Dogfoods ui-switch in place of a native <input type=checkbox> (Kim's directive — an instant on/off
      // toggle reads better as a switch than a checkbox for a live knob; same UIIndicatorElement API as
      // ui-checkbox, so this is a drop-in swap). `checked` + the `change` event are the wire; `aria-label`
      // names the bare box (switch.md labelSource) and the visible <label for> above adds click-to-focus.
      const toggle = document.createElement('ui-switch') as UISwitchElement
      toggle.id = id
      toggle.className = 'knob-switch'
      toggle.setAttribute('size', 'sm')
      toggle.setAttribute('aria-label', knob.name)
      toggle.checked = this.#state.get(knob.name) === 'true'
      toggle.addEventListener('change', () => this.#setKnob(knob.name, toggle.checked ? 'true' : 'false'))
      this.#refreshers.push(() => {
        toggle.checked = this.#state.get(knob.name) === 'true'
      })
      row.append(toggle)
      return row
    }

    // Number/text knob → ui-text-field (Kim's directive): type=number for a numeric prop, type=text
    // otherwise. `value` + the `input` event are the wire; the input-time value is the RAW typed string
    // (the numeric codec only reformats on blur/change — which the knob never listens to). `label` gives the
    // editor its aria-label; the visible <label for> above adds click-to-focus.
    const field = document.createElement('ui-text-field') as UITextFieldElement
    field.id = id
    field.className = 'knob-input'
    field.setAttribute('size', 'sm')
    field.setAttribute('type', knob.kind === 'number' ? 'number' : 'text')
    field.setAttribute('label', knob.name === SLOT_TEXT ? 'text' : knob.name)
    field.value = this.#state.get(knob.name) ?? ''
    field.addEventListener('input', () => this.#setKnob(knob.name, field.value))
    this.#refreshers.push(() => {
      field.value = this.#state.get(knob.name) ?? ''
    })
    row.append(field)
    return row
  }

  // ── state + render ─────────────────────────────────────────────────────────────────────────────────────────
  // The rendered specimen stays INTERACTIVE, and a knob edit never reverts what the user did in the canvas. The
  // specimen is authoritative for its OWN live state (a typed value, a toggled control, a dismissed modal); #state
  // is the seed + the knob-driven props. Component mode applies only the ONE changed prop (a diff, not a blind
  // full resync) and reads live interaction back into the knobs; a2ui mode reads the live value back into #state
  // before it rebuilds. Both skip the just-changed knob — the user's explicit edit wins over the live value.

  /** A knob edit: write #state, then re-apply — component mode diffs ONE prop; a2ui reads back live state + rebuilds. */
  #setKnob(name: string, value: string): void {
    this.#state.set(name, value)
    if (this.#mode === 'a2ui') this.#rerenderA2ui(name)
    else this.#applyKnobToLive(name)
    this.#refreshers.forEach((r) => r())
  }

  /** First paint: full build of the specimen from the seeded #state. */
  #render(): void {
    if (!this.#surface) return
    this.#refreshers.forEach((r) => r()) // reflect the seeded state in the knob controls
    if (this.#mode === 'a2ui') this.#buildA2ui()
    else this.#buildComponent()
  }

  // ── a2ui mode ──────────────────────────────────────────────────────────────────────────────────────────────
  /** A knob change: read the live value back into #state (so it survives), then dispose+rebuild from #state. */
  #rerenderA2ui(changed: string): void {
    this.#readBackA2ui(changed)
    this.#buildA2ui()
  }

  // Rebuild the surface through a FRESH renderer (teardown-safe, N3). The mount-once tree cannot patch a STATIC
  // literal prop in place (only data-model-BOUND props update reactively — tree.ts), so a knob edit to a static
  // prop like `size`/`variant` genuinely needs a rebuild; `#readBackA2ui` first preserves the live interactive state.
  #buildA2ui(): void {
    const surface = this.#surface as HTMLElement
    this.#host?.dispose()
    surface.replaceChildren()
    this.#host = createRenderer()
    this.#host.mount(surface)
    for (const line of this.#a2uiPayload()) this.#host.ingest(line)
    this.#host.finalize('preview')
    applyRootStretch(surface)
    this.#updateEmptyHint()
  }

  /**
   * Read the rendered root's live two-way-bindable value — the catalog `value` prop (a typed field, a toggled
   * control, a dismissed modal's `open`) — back into #state, so the imminent rebuild PRESERVES it rather than
   * reverting to the seed. Skips `changed`: the knob the user just set is their explicit intent and must win.
   * Residual limitation (documented): a rebuild recreates the root, so caret position / transient focus reset —
   * the VALUE survives, the cursor does not; and a container root's non-knob sample children reset on its own edit.
   */
  #readBackA2ui(changed: string): void {
    const def = defaultCatalog.components[this.#target]
    const prop = def?.value?.prop
    if (!prop || prop === changed) return
    const root = (this.#surface as HTMLElement).firstElementChild as HTMLElement | null
    if (!root) return
    const mapsTo = def.properties[prop]?.mapsTo ?? prop
    liveToState(this.#state, prop, (root as unknown as Record<string, unknown>)[mapsTo])
  }

  /** The two JSONL lines: createSurface, then updateComponents with the knob-driven root + its sample children. */
  #a2uiPayload(): [string, string] {
    const def = defaultCatalog.components[this.#target]
    const sample = sampleFor(this.#target, def)
    const root: Record<string, unknown> = { id: 'root', component: this.#target, ...this.#rootProps(), ...sample.rootRef }
    const createSurface = { version: 'v1.0', createSurface: { surfaceId: 'preview', catalogId: 'agent-ui' } }
    const updateComponents = { version: 'v1.0', updateComponents: { surfaceId: 'preview', components: [root, ...sample.extras] } }
    return [JSON.stringify(createSurface), JSON.stringify(updateComponents)]
  }

  /** The root's own props from #state, typed per knob kind (boolean → real boolean, number → real number). */
  #rootProps(): Record<string, unknown> {
    const props: Record<string, unknown> = {}
    for (const knob of this.#knobs) {
      if (knob.kind === 'skip' || knob.kind === 'text') continue
      const raw = this.#state.get(knob.name)
      if (raw === undefined || raw === '') continue
      if (knob.kind === 'boolean') props[knob.name] = raw === 'true'
      else if (knob.kind === 'number') {
        const n = Number(raw)
        if (Number.isFinite(n)) props[knob.name] = n
      } else props[knob.name] = raw
    }
    return props
  }

  // ── component mode ─────────────────────────────────────────────────────────────────────────────────────────
  // Create the element ONCE and mutate it in place. First paint applies every knob; a later knob edit applies ONLY
  // that one prop (a diff), so an unrelated edit never touches a value the user changed live. Read-back listeners
  // reflect direct interaction (toggle/type/select) into the matching knob, keeping #state ≡ the live control.
  #buildComponent(): void {
    const surface = this.#surface as HTMLElement
    const el = document.createElement(this.#target)
    const sample = COMPONENT_SAMPLE_CHILDREN[this.#target]
    if (sample) el.append(...sample())
    for (const [attr, value] of Object.entries(COMPONENT_SAMPLE_ATTRS[this.#target] ?? {})) el.setAttribute(attr, value)
    this.#liveEl = el
    surface.replaceChildren(el)
    COMPONENT_SAMPLE_INIT[this.#target]?.(el)
    for (const knob of this.#knobs) this.#applyKnob(el, knob) // no SLOT_TEXT knob at all for a NO_SLOT_TEXT/STRUCTURAL target (above)
    for (const evt of ['change', 'input', 'toggle', 'select']) el.addEventListener(evt, () => this.#readBackComponent())
    applyRootStretch(surface)
    this.#updateEmptyHint()
  }

  /** Apply ONLY the one changed knob to the live element (a diff — never a blind full resync that reverts live state). */
  #applyKnobToLive(name: string): void {
    const el = this.#liveEl
    if (!el) return
    const knob = this.#knobs.find((k) => k.name === name)
    if (knob) this.#applyKnob(el, knob)
    this.#updateEmptyHint()
  }

  /** Apply one knob to the live element: slot-text → textContent · boolean → attribute presence · else → attribute value. */
  #applyKnob(el: HTMLElement, knob: Knob): void {
    const raw = this.#state.get(knob.name)
    if (knob.name === SLOT_TEXT) {
      // componentKnobs() no longer GROWS a SLOT_TEXT knob at all for a NO_SLOT_TEXT or STRUCTURAL target, so
      // this branch is unreachable for either in normal operation — kept as defense-in-depth (a stale #knobs
      // entry from a future caching bug would still no-op here rather than wipe the control's own structural
      // children / STRUCTURAL sample content).
      if (NO_SLOT_TEXT.has(this.#target) || STRUCTURAL.has(this.#target)) return
      el.textContent = raw ?? ''
      return
    }
    if (knob.kind === 'skip') return
    if (knob.kind === 'boolean') {
      if (raw === 'true') el.setAttribute(knob.name, '')
      else el.removeAttribute(knob.name)
      return
    }
    if (raw === undefined || raw === '') el.removeAttribute(knob.name)
    else el.setAttribute(knob.name, raw)
  }

  /** Canvas→knob: read every knob's live property off the specimen back into #state, then reflect it in the knobs. */
  #readBackComponent(): void {
    const el = this.#liveEl
    if (!el) return
    for (const knob of this.#knobs) {
      if (knob.kind === 'skip' || knob.name === SLOT_TEXT) continue
      liveToState(this.#state, knob.name, (el as unknown as Record<string, unknown>)[knob.name])
    }
    this.#refreshers.forEach((r) => r())
  }

  // ── empty-state affordance ─────────────────────────────────────────────────────────────────────────────────
  /**
   * Flag the canvas when the specimen renders nothing visible — a closed native-`<dialog>` Modal is `display:none`
   * and IS a surface child, so `.canvas-surface:empty` never fires and the artboard would read as blank. Measured
   * after a frame (`getClientRects().length === 0` ⇒ nothing laid out); the CSS then shows a "toggle a knob" hint.
   */
  #updateEmptyHint(): void {
    const col = this.#canvasCol
    if (!col) return
    requestAnimationFrame(() => {
      const root = (this.#surface as HTMLElement | undefined)?.firstElementChild as HTMLElement | null
      const visible = !!root && root.getClientRects().length > 0
      col.classList.toggle('is-empty-specimen', !visible)
    })
  }

  disconnectedCallback(): void {
    this.#host?.dispose()
    this.#host = undefined
  }
}

if (!customElements.get('component-preview')) customElements.define('component-preview', ComponentPreview)

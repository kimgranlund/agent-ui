// site/lib/component-preview.ts — the <component-preview> docs element: a two-column live playground. LEFT is a
// details block + one live-knob control per editable prop + a derived variant chip-row per enum; RIGHT is the
// shared A2UI artboard (lib/canvas-surface) carrying the live specimen. It renders EITHER a plain ui-* web
// component (mode="component", target = a tag like `ui-button`) OR an A2UI catalog item (mode="a2ui", target = a
// catalog NAME like `Button`).
//
// DERIVE-DON'T-DUPLICATE: neither the knobs nor the chips carry a hand-maintained prop list. Component mode reads
// the canonical `{name}.md` descriptor (via lib/frontmatter → the ONE parser the contract trip-wire enforces);
// a2ui mode reads the shipped default catalog's component def. A new attribute/prop grows a knob for free; a new
// enum member grows a chip for free — the same single-source discipline the doc pages already follow.
//
// It is a PLAIN custom element (a docs meta-component), NOT a ui-* control (light DOM, no ElementInternals/ARIA
// contract, no descriptor) — it composes controls for documentation, it is not itself part of the fleet.
import '@agent-ui/components/components' // self-defining ui-* controls (a component-mode target is defined even standalone)
import './component-preview.css'
import { createRenderer, defaultCatalog } from '@agent-ui/a2ui'
import type { RendererHost, ComponentDef, PropDef, JsonSchema } from '@agent-ui/a2ui'
import { loadDescriptorByTag } from './frontmatter.ts'
import type { ParsedAttribute } from '@agent-ui/components/descriptor'
import { createCanvasSurface, applyRootStretch } from './canvas-surface.ts'

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

/** Map one catalog `PropDef.type` JSON-Schema fragment to a knob (enum → chips/select · scalar → input · object → skip). */
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

/** Every editable knob for a component-mode control: one per named attribute, plus the default-slot text knob. */
function componentKnobs(attrs: readonly ParsedAttribute[]): Knob[] {
  const knobs = attrs.filter((a) => typeof a.name === 'string' && a.name !== '').map(knobFromAttribute)
  knobs.push({ name: SLOT_TEXT, kind: 'text' })
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
// Options, Card nests a CardContent, Tabs pairs Tab/TabPanel, a FormProvider coordinates a field + submit).
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
  Card: () => ({
    rootRef: { children: ['s_content'] },
    extras: [
      { id: 's_content', component: 'CardContent', children: ['s_ctext'] },
      { id: 's_ctext', component: 'Text', variant: 'body', text: 'Sample content' },
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

// ── the element ──────────────────────────────────────────────────────────────────────────────────────────────
type Mode = 'component' | 'a2ui'

class ComponentPreview extends HTMLElement {
  #built = false
  #mode: Mode = 'a2ui'
  #target = ''
  #knobs: Knob[] = []
  #state = new Map<string, string>() // knob name → raw string value ('' / 'true' / a member / free text)
  #refreshers: Array<() => void> = [] // per-knob DOM sync closures (keep chips + inputs in step with #state)
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
    controls.append(this.#buildDetails(meta.kindLabel), this.#buildKnobs(), ...this.#buildVariants())

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
    return { knobs: componentKnobs(doc.descriptor.attributes), kindLabel: `ui-* control${tier ? ` · tier: ${tier}` : ''}` }
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
    this.#state.set(SLOT_TEXT, slotTextDefault(this.#target))
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
      const select = document.createElement('select')
      select.className = 'knob-select'
      select.id = id
      select.append(new Option('—', '')) // the unset choice → the control's own default
      for (const member of knob.values ?? []) select.append(new Option(member, member))
      select.value = this.#state.get(knob.name) ?? ''
      select.addEventListener('change', () => this.#setKnob(knob.name, select.value))
      this.#refreshers.push(() => {
        select.value = this.#state.get(knob.name) ?? ''
      })
      row.append(select)
      return row
    }

    if (knob.kind === 'boolean') {
      const check = document.createElement('input')
      check.type = 'checkbox'
      check.className = 'knob-check'
      check.id = id
      check.checked = this.#state.get(knob.name) === 'true'
      check.addEventListener('change', () => this.#setKnob(knob.name, check.checked ? 'true' : 'false'))
      this.#refreshers.push(() => {
        check.checked = this.#state.get(knob.name) === 'true'
      })
      row.append(check)
      return row
    }

    const input = document.createElement('input')
    input.type = knob.kind === 'number' ? 'number' : 'text'
    input.className = 'knob-input'
    input.id = id
    input.value = this.#state.get(knob.name) ?? ''
    input.addEventListener('input', () => this.#setKnob(knob.name, input.value))
    this.#refreshers.push(() => {
      input.value = this.#state.get(knob.name) ?? ''
    })
    row.append(input)
    return row
  }

  /** A derived variant switcher: one chip-row per enum knob (zero hand-maintained variant data). */
  #buildVariants(): HTMLElement[] {
    const enums = this.#knobs.filter((k) => k.kind === 'enum')
    if (enums.length === 0) return []
    const section = document.createElement('div')
    const label = document.createElement('p')
    label.className = 'preview-section-label'
    label.textContent = 'Variants'
    const rows = document.createElement('div')
    rows.className = 'preview-variants'
    for (const knob of enums) rows.append(this.#buildChipRow(knob))
    section.append(label, rows)
    return [section]
  }

  #buildChipRow(knob: Knob): HTMLElement {
    const row = document.createElement('div')
    row.className = 'chip-row'
    const label = document.createElement('span')
    label.className = 'chip-row-label'
    label.textContent = knob.name
    const set = document.createElement('div')
    set.className = 'chip-set'
    const chips: Array<{ value: string; el: HTMLButtonElement }> = []
    for (const member of knob.values ?? []) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'chip'
      chip.textContent = member
      chip.setAttribute('aria-pressed', 'false') // a toggle button — its pressed state is exposed to AT, not CSS-only
      chip.addEventListener('click', () => this.#setKnob(knob.name, member))
      chips.push({ value: member, el: chip })
      set.append(chip)
    }
    this.#refreshers.push(() => {
      const current = this.#state.get(knob.name) ?? ''
      for (const c of chips) {
        const active = c.value === current
        c.el.classList.toggle('is-active', active)
        c.el.setAttribute('aria-pressed', String(active))
      }
    })
    row.append(label, set)
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
    this.#liveEl = el
    surface.replaceChildren(el)
    for (const knob of this.#knobs) this.#applyKnob(el, knob)
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

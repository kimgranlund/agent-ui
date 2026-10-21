// factories.ts — the `concierge` persona's factory table (SPEC-R1, GH #497). Two composite factories —
// `BookingForm`/`BookingConfirmation` — the first `WidgetFactory`s in the fleet whose `create()` assembles
// a MULTI-ELEMENT subtree of REAL `@agent-ui/components` controls rather than one leaf element (no
// precedent in `default/`/`a2ui-basic/`; GH #497 authorizes the shape for this slice — see the decomp
// note `md-content-concierge-croupier-promotion.decomp.md` §2.1/§4).
//
// Design resolution for the note's §2.1 "open build question" (how `fields[].path`/`rows[].path`
// resolve to LIVE data-model values — genuinely undecided there): a `WidgetFactory`'s `create()`/
// `applyProp(el,prop,value)` NEVER receive `surface` (types.ts) — verified against `widget.ts`'s
// `create`/`wireProps`, so neither of the note's two candidate mechanisms is actually reachable from
// inside a factory (top-level bindable resolution only resolves the WHOLE prop value, never a path
// nested inside an array item; `checks.ts`'s per-path `surface`/`evaluate` pattern is a HOST-level
// controller invoked WITH surface in scope, structurally unavailable to a catalog-owned factory).
// The resolution actually landed reuses TWO mechanisms EXACTLY as built, adding nothing new to the
// renderer/registry contract:
//   (1) `BookingForm.value` is an ORDINARY bindable/two-way prop (ADR-0161's `ValueSlot`, the Calendar/
//       Select precedent) whose bound value is ONE AGGREGATE OBJECT keyed by each field's `path` (a
//       RELATIVE key into that object — NOT a JSON pointer). READ: the outer renderer's own reactive
//       bind-effect (widget.ts `bindProp`, which DOES have surface access) resolves `{path}` and calls
//       `applyProp(el,'value',obj)` — this factory then prefills each inner control from `obj[path]`.
//       WRITE: the factory exposes the CURRENT aggregate as a plain readable property
//       (`el.a2uiFormValue`, a getter proxying `ui-form-provider`'s OWN native `values()` — see below) —
//       `installInputBinding` (LLD-C8, ALSO surface-aware) reads it on the slot's `change` event and
//       writes the whole object back via `setPointer`, byte-identical to any other input widget.
//   (2) `BookingConfirmation.data` is the SAME trick without the write half: an ordinary bindable prop
//       (no `value` mark — display-only) whose resolved aggregate object is handed to `applyProp`,
//       which re-derives every row's Text from `data[row.path]` — so a row's displayed value can NEVER
//       be a producer-typed literal (the §1 argument (b) closed structurally, not by prose).
// The required-gating half (§1 argument (a)) needs NO surface access at all — closes for free via
// `ui-form-provider`'s OWN native cross-descendant validity aggregation (ADR-0050/ADR-0054,
// `form-provider.ts`): `submit()` walks its light-DOM `UIFormElement` descendants (by NATIVE
// `required`/`checkValidity`, entirely local DOM state, no data-model binding needed at all) and
// refuses (first-invalid `reportValidity()`, no emit) on any failure.
//
// The SUBMIT button is deliberately NOT factory-synthesized (the note's own sketch's "trailing button"
// language, revised at build): `BookingForm` declares `children:"child"` (the shipped `Field` precedent,
// `default/catalog.json`) and the PRODUCER supplies one real `Button` a2ui node as its `child`, with its
// own `action:{...,submit:true}` — the renderer's OWN per-node `#wireAction` then attaches DIRECTLY to
// that Button's real element (never to the composite root), so ADR-0054's gate (`el.closest(submitGate
// selector)` walking UP from the actual click target to the `ui-form-provider` ancestor) fires ONLY on
// that button's click — never on an incidental click inside a field control (a synthesized-button design
// bubbling to the composite ROOT was tried and rejected: `el`'s own click listener would fire on EVERY
// descendant click, including picking a calendar day, silently emitting the submit action early).
//
// Field kinds (§2.1 sketch named "range Calendar" — narrowed at build): `dateSingle | dateRange | select | checkbox |
// radio | text | number | time | stepper` (T-0079 added `text` and `number`, T-0197 `dateRange`, `radio`, `time` and
// `stepper`). `text`, `number` and `time` mint a `ui-text-field` of that type. A `dateSingle` is a
// DATE INPUT (T-0092, reshaped T-0106, a real input since T-0135): a `ui-field` label over a `ui-text-field
// type=date`, the field's form control (named for the path). It shows the date in the reader's locale ("Choose
// date" placeholder while empty), submits the ISO `YYYY-MM-DD` string (the wire contract is unchanged), and draws
// its own round calendar trigger whose panel opens on the booked month (today's when empty). No nested card, no
// month grid inline. `ui-calendar`'s `mode="range"` commits via a two-ENTRY `FormData` (start+end under one
// `name`), which `ui-form-provider`'s native `values()` aggregation does not flatten into the single
// scalar-per-path shape `BookingConfirmation.rows` needs, so a date RANGE is two date inputs, each a scalar: either
// two consecutive `dateSingle` fields (e.g. `checkIn`/`checkOut`), which share one run, or one `dateRange` item
// (T-0197) whose `path` is the start and `endPath` the end (`endLabel`, default "End date"), which always draws its
// own run; a `dateRange` with no `endPath` is a `dateSingle`. A run is drawn side by side where the width allows.
// Within a run the later field takes the earlier field's date as its `min` (its calendar disables earlier days, a
// typed earlier date is rangeUnderflow), and an earlier date that passes a later one clears it.
// A `checkbox` kind is a Yes / No `ui-radio-group` (T-0092), its value the string `Yes` or `No`; `required`
// means the guest must answer, not that the answer must be Yes. A `radio` kind (T-0197) is the same horizontal
// group over the item's `options`, its value the chosen option's `value`. A `stepper` kind (T-0197) is a
// `ui-amount-picker` with the item's `min`, `max` and `step` and no commit button of its own (the producer's one
// Button still submits), its form value the number's string.
//
// Look (T-0085, the ADR-0046 box model; the action under the card, T-0197): `BookingForm`'s root stays the
// `ui-form-provider` (the submit-gate ancestor) and is a plain column: the card part above, the producer's Button
// under it at the end edge, the widget gutter between them (ConfirmReceipt's action bar; no button inside a card,
// Kim 2026-10-14 and 2026-10-20). The Button stays a direct child of the root, where the renderer appends it, and
// hugs its label as a flex item. The minted `[data-part="card"]` div holds the title and the fields and is the card
// surface (the `ui-card` frame tokens on its `style`) and a `[data-box]`, so each child takes the shared 6px inset,
// plus the region padding (12 inline, 6 block), the ADR-0056 region-less card reading, so ink sits 19px in like a
// stock card's regions, and the last field sits as far from the bottom as the title from the top. Every field wears
// a `ui-field` (the fleet's visible label; the stepper too, whose own label part hides under it), fields stack at
// the region gap, and the form uses the `sm` and `md` steps only: its inputs and the producer's Buttons are `md`
// (ADR-0245 Amendment 2; T-0106) and each date input's round trigger is the text field's own, one step below at
// `sm` height (T-0135) (the other composites' actions stay `lg`, ADR-0243 Amendment 2, via `sizedActionButtons`).
// `BookingConfirmation` is a
// `ui-card` with real `ui-card-header`/`ui-card-content` regions and one label (muted, start) / value
// (emphasis, end) row per entry, hairline dividers between rows.

import type { WidgetFactory } from '../../types.ts'
import { sizedActionButtons } from '../../personas/action-row.ts'

// ── display formatting (the wire value is never touched) ────────────────────────────────────────────

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** An ISO `YYYY-MM-DD` in the reader's locale ("Mon, 12 Oct 2026" in en-GB), or '' when it is not a real date. */
function formatIsoDate(iso: string): string {
  const m = ISO_DATE.exec(iso)
  if (m === null) return ''
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d) // local construction: no timezone shift of the calendar day
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return ''
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** A bound boolean-ish value as the Yes / No answer it stands for; null when there is no answer yet. */
function answerFor(raw: unknown): 'Yes' | 'No' | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  return ['yes', 'true', 'on', '1'].includes(String(raw).toLowerCase()) ? 'Yes' : 'No'
}

/** What a summary row shows for a bound value: dates in locale form, booleans as Yes / No, the rest as text. */
function displayValue(raw: unknown): string {
  if (raw == null || raw === '') return '—'
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  const text = String(raw)
  return formatIsoDate(text) || text
}

// ── shared field schema (wire-authored, NOT a JSON pointer — see the header) ────────────────────────

interface BookingFieldOption {
  value: string
  label: string
}

interface BookingField {
  kind: string
  path: string
  label: string
  required?: boolean
  options?: BookingFieldOption[]
  /** `dateRange` only: the end date's path and label (T-0197). */
  endPath?: string
  endLabel?: string
  /** `stepper` only: the picker's bounds and step (T-0197). */
  min?: number
  max?: number
  step?: number
}

function isBookingField(v: unknown): v is BookingField {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { kind?: unknown }).kind === 'string' &&
    typeof (v as { path?: unknown }).path === 'string' &&
    typeof (v as { label?: unknown }).label === 'string'
  )
}

function readFields(value: unknown): BookingField[] {
  return Array.isArray(value) ? value.filter(isBookingField) : []
}

// A structural duck-type over `UIFormProviderElement`'s public surface (form-provider.ts) — matching
// the fleet's own generic-cast convention in `default/factories.ts` (never importing the concrete
// element class into a factory module).
interface FormProviderLike extends HTMLElement {
  submit(): boolean
  values(): Readonly<Record<string, unknown>>
}

// A structural duck-type over the universal form-control accessors (`UIFormElement.formProps`).
interface FieldControlLike extends HTMLElement {
  name: string
  required: boolean
}

// ── BookingForm ────────────────────────────────────────────────────────────────────────────────────

interface BookingFormParts {
  titleEl: HTMLElement
  fieldsEl: HTMLElement
  fields: BookingField[]
  dateFields: Map<string, DateField>
  dateRuns: DateField[][]
}

const bookingFormParts = new WeakMap<HTMLElement, BookingFormParts>()

/** A `ui-field` wrapping one control: the fleet's visible label above it (ADR-0051), tagged with the field's path. */
function labelledField(field: BookingField, control: HTMLElement): HTMLElement {
  const wrap = document.createElement('ui-field') as unknown as HTMLElement & { label: string }
  wrap.label = field.label
  wrap.setAttribute('data-a2ui-booking-field', field.path)
  wrap.appendChild(control)
  return wrap
}

/** A horizontal `ui-radio-group` named for the field, one `ui-radio` per choice (the checkbox and radio kinds). */
function radioGroup(field: BookingField, choices: readonly BookingFieldOption[]): HTMLElement {
  const el = document.createElement('ui-radio-group') as unknown as FieldControlLike & { orientation: string }
  el.name = field.path
  el.required = Boolean(field.required)
  el.orientation = 'horizontal'
  for (const choice of choices) {
    const radio = document.createElement('ui-radio') as unknown as HTMLElement & { value: string }
    radio.value = choice.value
    radio.textContent = choice.label
    el.appendChild(radio)
  }
  return el
}

/** Build one field: its live control, labelled by a `ui-field`. */
function buildFieldControl(field: BookingField): HTMLElement {
  switch (field.kind) {
    case 'select': {
      const el = document.createElement('ui-select') as unknown as FieldControlLike & { label: string; placeholder: string }
      el.name = field.path
      el.required = Boolean(field.required)
      el.label = field.label
      el.placeholder = 'Choose one'
      for (const opt of field.options ?? []) {
        const optEl = document.createElement('div')
        optEl.setAttribute('role', 'option')
        optEl.setAttribute('value', opt.value)
        optEl.textContent = opt.label
        el.appendChild(optEl)
      }
      return labelledField(field, el)
    }
    case 'checkbox':
      // A Yes / No choice (the group's value is the checked radio's string), labelled by its `ui-field`.
      return labelledField(field, radioGroup(field, [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]))
    case 'radio':
      // A few fixed choices (a seating, a room view): the group's value is the chosen option's `value` (T-0197).
      return labelledField(field, radioGroup(field, field.options ?? []))
    case 'stepper': {
      // A party size or a count (T-0197): no `actionName`, so the picker draws no commit button and the producer's
      // one Button submits; its own label part hides under the `ui-field` (amount-picker.md).
      const el = document.createElement('ui-amount-picker') as unknown as FieldControlLike & { label: string; min: number; max: number; step: number }
      el.name = field.path
      el.required = Boolean(field.required)
      el.label = field.label
      if (Number.isFinite(field.min)) el.min = field.min!
      if (Number.isFinite(field.max)) el.max = field.max!
      if (Number.isFinite(field.step)) el.step = field.step!
      return labelledField(field, el)
    }
    case 'text':
    case 'number':
    case 'time':
    default: {
      // `type=number` brings the stepper, the numeric codec and native range validity, `type=time` the time codec
      // (ADR-0048); the committed value is the field's canonical string form. `label` stays the bare-usage
      // accessible name, yielding to the `ui-field` label once associated.
      const el = document.createElement('ui-text-field') as unknown as FieldControlLike & { label: string; type: string }
      el.name = field.path
      el.required = Boolean(field.required)
      el.label = field.label
      el.type = field.kind === 'number' || field.kind === 'time' ? field.kind : 'text'
      return labelledField(field, el)
    }
  }
}

/** Find a direct child of `container` carrying `attr === value` — never a `querySelector` attribute
 *  selector (would need `CSS.escape` for an arbitrary producer-authored path string; absent in jsdom
 *  and not worth a dependency for a plain equality scan over a small, known-flat child list). */
function findByAttr(container: HTMLElement, attr: string, value: string): HTMLElement | undefined {
  for (const child of container.children) {
    if (child instanceof HTMLElement && child.getAttribute(attr) === value) return child
  }
  return undefined
}

/** The control tag each non-date kind mints; every other kind is a `ui-text-field`. */
const CONTROL_TAG: Readonly<Record<string, string>> = { checkbox: 'ui-radio-group', radio: 'ui-radio-group', select: 'ui-select', stepper: 'ui-amount-picker' }

/** Set one control's CURRENT value from the bound aggregate — read direction (`applyProp('value', …)`). */
function prefillFieldControl(wrap: HTMLElement, field: BookingField, raw: unknown): void {
  const control = wrap.querySelector(CONTROL_TAG[field.kind] ?? 'ui-text-field')
  if (control === null) return
  if (field.kind === 'checkbox') (control as unknown as { value: string | null }).value = answerFor(raw)
  else if (field.kind === 'radio') (control as unknown as { value: string | null }).value = raw == null || raw === '' ? null : String(raw)
  else if (field.kind === 'stepper') {
    const n = Number(raw)
    if (raw != null && raw !== '' && Number.isFinite(n)) (control as unknown as { value: number }).value = n // else the picker keeps its default
  } else (control as unknown as { value: string }).value = raw == null ? '' : String(raw)
}

// ── date fields (T-0092, T-0106, T-0135) ────────────────────────────────────────────────────────────

/** One date field: its element and what the form drives. `value()` is always an ISO date or ''. Reading the input
 *  inside `applyProp` is safe: the renderer runs it untracked, so the bind never re-applies over a guest's edit (T-0171). */
interface DateField {
  el: HTMLElement
  input: HTMLElement
  value(): string
  setValue(iso: string): void
  setMin(iso: string): void
}

interface DateInputLike extends FieldControlLike {
  label: string
  type: string
  placeholder: string
  value: string
  min: string
}

/** A labelled date input (T-0135): a `ui-text-field type=date`, the field's form control (named for the path), which
 *  shows the date in the reader's locale, submits the ISO date, and draws its own round calendar trigger and picker
 *  panel (opening on the booked month, honouring `min`). */
function buildDateField(field: BookingField, form: FormProviderLike): DateField {
  const input = document.createElement('ui-text-field') as unknown as DateInputLike
  input.name = field.path
  input.required = Boolean(field.required)
  input.label = field.label
  input.type = 'date'
  input.placeholder = 'Choose date'
  const wrap = labelledField(field, input)
  wrap.setAttribute('data-part', 'date-field')
  // The text is the locale date once the field formats it; the form value is the ISO date throughout.
  const value = (): string => {
    const shown = input.value
    if (shown === '' || ISO_DATE.test(shown)) return shown
    const committed = form.values()[field.path]
    return typeof committed === 'string' && ISO_DATE.test(committed) ? committed : ''
  }
  return {
    el: wrap,
    input,
    value,
    setValue: (iso) => {
      const next = ISO_DATE.test(iso) ? iso : ''
      if (next === value()) return // the guest's own commit coming back through the binding is a no-op
      input.value = next
    },
    setMin: (iso) => {
      input.min = iso
    },
  }
}

/** Hold a run of date fields in order: each takes the one before as its `min`. `clear` also empties a later date a
 *  fresh pick has moved before (a guest cannot leave before they arrive), returning the cleared fields; a bound
 *  prefill never clears. */
function reconcileDateRun(run: DateField[], clear: boolean): DateField[] {
  const cleared: DateField[] = []
  for (let i = 1; i < run.length; i++) {
    const [prev, cur] = [run[i - 1]!, run[i]!]
    cur.setMin(prev.value())
    if (clear && prev.value() !== '' && cur.value() !== '' && cur.value() < prev.value()) {
      cur.setValue('')
      cleared.push(cur)
    }
  }
  return cleared
}

/** After a guest commits a date in the run: re-hold the run (the field's form value already carries the commit), and
 *  announce each cleared field with its own change so the bound aggregate drops it too. */
function onDateCommit(run: DateField[]): void {
  for (const cleared of reconcileDateRun(run, true)) cleared.input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** A run of consecutive `dateSingle` fields (arrival and departure) shares one wrapping row: side by side where the
 *  form is wide enough for two 12rem fields, stacked on a phone. */
function dateRow(): HTMLElement {
  const row = document.createElement('div')
  row.setAttribute('data-part', 'date-row')
  row.style.display = 'flex'
  row.style.flexWrap = 'wrap'
  row.style.gap = 'var(--ui-box-gap)'
  return row
}

/** A `dateRange` with a string `endPath` (T-0197); one without is read as a `dateSingle`. */
const isDateRange = (field: BookingField): field is BookingField & { endPath: string } => field.kind === 'dateRange' && typeof field.endPath === 'string'

/** Each field as the form reads it: a `dateRange` with no `endPath` is a `dateSingle`. */
function normalizeField(field: BookingField): BookingField {
  return field.kind === 'dateRange' && !isDateRange(field) ? { ...field, kind: 'dateSingle' } : field
}

function rebuildFields(parts: BookingFormParts, form: FormProviderLike, fields: BookingField[]): void {
  parts.fields = fields.map(normalizeField)
  parts.dateFields = new Map()
  parts.dateRuns = []
  const nodes: HTMLElement[] = []
  let row: HTMLElement | null = null
  let run: DateField[] = []
  const addDate = (field: BookingField): void => {
    if (row === null) {
      row = dateRow()
      nodes.push(row)
      run = []
      parts.dateRuns.push(run)
    }
    const thisRun = run
    const dateField = buildDateField(field, form)
    dateField.input.addEventListener('change', () => onDateCommit(thisRun))
    dateField.el.style.flex = '1 1 12rem'
    thisRun.push(dateField)
    parts.dateFields.set(field.path, dateField)
    row.appendChild(dateField.el)
  }
  for (const field of parts.fields) {
    if (isDateRange(field)) {
      // Its own run, never joined to an adjacent dateSingle run: the start, then the end.
      row = null
      const required = Boolean(field.required)
      addDate({ kind: 'dateSingle', path: field.path, label: field.label, required })
      addDate({ kind: 'dateSingle', path: field.endPath, label: field.endLabel ?? 'End date', required })
      row = null
      continue
    }
    if (field.kind !== 'dateSingle') {
      row = null
      nodes.push(buildFieldControl(field))
      continue
    }
    addDate(field)
  }
  parts.fieldsEl.replaceChildren(...nodes)
}

/** Every field wrapper under the fields part, a date row's included, keyed by its path (plain attribute equality). */
function fieldWrapsByPath(fieldsEl: HTMLElement): Map<string, HTMLElement> {
  const byPath = new Map<string, HTMLElement>()
  for (const wrap of fieldsEl.querySelectorAll<HTMLElement>('[data-a2ui-booking-field]')) {
    const path = wrap.getAttribute('data-a2ui-booking-field')!
    if (!byPath.has(path)) byPath.set(path, wrap) // first wins, as the flat scan did
  }
  return byPath
}

/** The `ui-card` frame and surface (card.css: the neutral surface plane, the hairline border, the base corner). */
function paintCardSurface(el: HTMLElement): void {
  const s = el.style
  s.boxSizing = 'border-box'
  s.backgroundColor = 'var(--md-sys-color-neutral-surface)'
  s.border = '1px solid var(--md-sys-color-neutral-outline-variant)'
  s.borderRadius = 'var(--md-sys-shape-corner-base)'
}

/**
 * `BookingForm` → `ui-form-provider` wrapping a static title + one live control per `fields` entry
 * (catalog LLD-C5, GH #497). See the module header for the full binding/gating design.
 */
export const bookingFormFactory: WidgetFactory = {
  tag: 'ui-form-provider',
  // ADR-0233: the field controls it mints (a date field is a ui-text-field type=date, which brings its own calendar)
  uses: ['ui-amount-picker', 'ui-field', 'ui-radio', 'ui-radio-group', 'ui-select', 'ui-text', 'ui-text-field'],
  create: () => {
    const el = document.createElement('ui-form-provider') as unknown as FormProviderLike
    // The root is a column: the card above, the producer's Button under it at the end edge (T-0197, ConfirmReceipt's
    // host column and action bar), the widget gutter between them.
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.alignItems = 'flex-end'
    el.style.gap = 'var(--md-sys-widget-gutter)'
    // The card surface and the ADR-0046 box: `[data-box]` insets every child 6px (margins collapsing in its
    // flow-root BFC) and the card holds the region padding, so ink lands 19px in.
    const cardEl = document.createElement('div')
    cardEl.setAttribute('data-part', 'card')
    cardEl.setAttribute('data-box', '')
    paintCardSurface(cardEl)
    cardEl.style.display = 'flow-root'
    cardEl.style.paddingBlock = 'var(--ui-box-pad-block)'
    cardEl.style.paddingInline = 'var(--ui-box-pad-inline)'
    cardEl.style.alignSelf = 'stretch'
    const titleEl = document.createElement('ui-text')
    ;(titleEl as unknown as { as: string; variant: string; size: string }).as = 'h4'
    ;(titleEl as unknown as { as: string; variant: string; size: string }).variant = 'title'
    ;(titleEl as unknown as { as: string; variant: string; size: string }).size = 'md'
    titleEl.setAttribute('data-part', 'title')
    const fieldsEl = document.createElement('div')
    fieldsEl.setAttribute('data-part', 'fields')
    fieldsEl.style.display = 'flex'
    fieldsEl.style.flexDirection = 'column'
    fieldsEl.style.gap = 'var(--ui-box-gap)' // 8px between fields
    fieldsEl.style.marginBlockStart = 'var(--ui-box-gap)' // collapses with the title's 6px inset: 8px to the title
    cardEl.append(titleEl, fieldsEl)
    el.append(cardEl)
    sizedActionButtons(el, 'md') // the form's own Reserve steps down to md (T-0106)
    bookingFormParts.set(el, { titleEl, fieldsEl, fields: [], dateFields: new Map(), dateRuns: [] })
    // Expose the LIVE aggregate as a plain readable property — a getter proxying the form-provider's
    // OWN native `values()` (name → committed FormValue, form-registry.ts). `installInputBinding`
    // (LLD-C8) reads this via the factory's `value` mark's `readProp` on every commit — no manual
    // stashing, always the current snapshot at read time.
    Object.defineProperty(el, 'a2uiFormValue', {
      configurable: true,
      get(this: FormProviderLike) {
        return this.values()
      },
    })
    return el as unknown as HTMLElement
  },
  applyProp: (rawEl, prop, value) => {
    const el = rawEl as unknown as FormProviderLike
    const parts = bookingFormParts.get(el)
    if (parts === undefined) return // defensive — create() always sets this
    switch (prop) {
      case 'title':
        parts.titleEl.textContent = value == null ? '' : String(value)
        break
      case 'fields':
        rebuildFields(parts, el, readFields(value))
        break
      case 'value': {
        if (typeof value !== 'object' || value === null) break
        const obj = value as Record<string, unknown>
        // Plain attribute-value equality over the field wrappers (never a `querySelector` attribute selector,
        // which would need CSS.escape — absent in jsdom, ADR-N5 zero-dep-friendly either way).
        const wraps = fieldWrapsByPath(parts.fieldsEl)
        for (const field of parts.fields) {
          const raw = obj[field.path]
          if (isDateRange(field)) {
            parts.dateFields.get(field.path)?.setValue(raw == null ? '' : String(raw))
            const end = obj[field.endPath]
            parts.dateFields.get(field.endPath)?.setValue(end == null ? '' : String(end))
            continue
          }
          if (field.kind === 'dateSingle') {
            parts.dateFields.get(field.path)?.setValue(raw == null ? '' : String(raw))
            continue
          }
          const wrap = wraps.get(field.path)
          if (wrap !== undefined) prefillFieldControl(wrap, field, raw)
        }
        for (const run of parts.dateRuns) reconcileDateRun(run, false)
        break
      }
      default:
        break // 'submitAction'-shaped props never reach here — see header; anything else is a no-op
    }
  },
  value: { prop: 'value', event: 'change', readProp: 'a2uiFormValue' },
  submitGate: true,
}

// ── BookingConfirmation ───────────────────────────────────────────────────────────────────────────

interface BookingConfirmationRow {
  label: string
  path: string
  /** T-0172: the value-to-label map for a row whose value is a code (a `select` field's `value`), so the row
   *  prints "Twin room" rather than the raw 'twin'. A value with no match prints as before. */
  options?: BookingFieldOption[]
}

function isConfirmationRow(v: unknown): v is BookingConfirmationRow {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { label?: unknown }).label === 'string' &&
    typeof (v as { path?: unknown }).path === 'string'
  )
}

function isFieldOption(v: unknown): v is BookingFieldOption {
  return typeof v === 'object' && v !== null && typeof (v as { value?: unknown }).value === 'string' && typeof (v as { label?: unknown }).label === 'string'
}

function readRows(value: unknown): BookingConfirmationRow[] {
  if (!Array.isArray(value)) return []
  return value.filter(isConfirmationRow).map((row) => {
    const options = Array.isArray(row.options) ? row.options.filter(isFieldOption) : []
    return options.length > 0 ? { label: row.label, path: row.path, options } : { label: row.label, path: row.path }
  })
}

interface BookingConfirmationParts {
  titleEl: HTMLElement
  rowsEl: HTMLElement
  rows: BookingConfirmationRow[]
}

const bookingConfirmationParts = new WeakMap<HTMLElement, BookingConfirmationParts>()

/** One summary row: the label muted at the start, the value in emphasis at the end, a long value wrapping under
 *  itself. Rows after the first carry a hairline divider above; the row padding keeps 8px either side of it. */
function buildRow(row: BookingConfirmationRow, index: number, count: number): HTMLElement {
  const wrap = document.createElement('div')
  wrap.setAttribute('data-a2ui-confirmation-row', row.path)
  const w = wrap.style
  w.display = 'flex'
  w.alignItems = 'baseline'
  w.justifyContent = 'space-between'
  w.gap = 'var(--md-sys-space-md)'
  w.paddingBlockStart = index === 0 ? '0' : 'var(--md-sys-space-sm)'
  w.paddingBlockEnd = index === count - 1 ? '0' : 'var(--md-sys-space-sm)'
  if (index > 0) w.borderBlockStart = '1px solid var(--md-sys-color-neutral-outline-variant)'
  const label = document.createElement('ui-text')
  ;(label as unknown as { as: string; variant: string; size: string }).as = 'none'
  ;(label as unknown as { as: string; variant: string; size: string }).variant = 'body'
  ;(label as unknown as { as: string; variant: string; size: string }).size = 'md'
  label.setAttribute('data-part', 'label')
  label.style.color = 'var(--md-sys-color-neutral-on-surface-variant)'
  label.style.flex = '0 1 auto'
  label.style.maxInlineSize = '50%'
  label.textContent = row.label
  const valueEl = document.createElement('ui-text')
  ;(valueEl as unknown as { as: string; variant: string; size: string; emphasis: boolean }).as = 'none'
  ;(valueEl as unknown as { as: string; variant: string; size: string; emphasis: boolean }).variant = 'body'
  ;(valueEl as unknown as { as: string; variant: string; size: string; emphasis: boolean }).size = 'md'
  ;(valueEl as unknown as { as: string; variant: string; size: string; emphasis: boolean }).emphasis = true
  valueEl.setAttribute('data-part', 'value')
  valueEl.style.flex = '1 1 0'
  valueEl.style.minInlineSize = '0'
  valueEl.style.textAlign = 'end'
  valueEl.style.overflowWrap = 'anywhere'
  valueEl.textContent = '—'
  wrap.append(label, valueEl)
  return wrap
}

function applyConfirmationData(parts: BookingConfirmationParts, data: unknown): void {
  const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  for (const row of parts.rows) {
    const wrap = findByAttr(parts.rowsEl, 'data-a2ui-confirmation-row', row.path)
    const valueEl = wrap?.querySelector('[data-part="value"]')
    if (valueEl === null || valueEl === undefined) continue
    const raw = obj[row.path]
    const option = typeof raw === 'string' ? row.options?.find((o) => o.value === raw) : undefined
    valueEl.textContent = option !== undefined ? option.label : displayValue(raw)
  }
}

/**
 * `BookingConfirmation` → `ui-card` holding a title (in a `ui-card-header`) + one label/value row per `rows`
 * entry (in a `ui-card-content`), EVERY row's value ALWAYS derived from the bound `data` aggregate (never a
 * producer literal — see the module header + the decomp note §1 argument (b)).
 */
export const bookingConfirmationFactory: WidgetFactory = {
  tag: 'ui-card',
  uses: ['ui-card-content', 'ui-card-header', 'ui-text'], // ADR-0233: the regions, title and row texts it mints
  create: () => {
    const el = document.createElement('ui-card')
    const headerEl = document.createElement('ui-card-header')
    const titleEl = document.createElement('ui-text')
    ;(titleEl as unknown as { as: string; variant: string; size: string }).as = 'h4'
    ;(titleEl as unknown as { as: string; variant: string; size: string }).variant = 'title'
    ;(titleEl as unknown as { as: string; variant: string; size: string }).size = 'md'
    titleEl.setAttribute('data-part', 'title')
    headerEl.appendChild(titleEl)
    const contentEl = document.createElement('ui-card-content')
    const rowsEl = document.createElement('div')
    rowsEl.setAttribute('data-part', 'rows')
    contentEl.appendChild(rowsEl)
    el.append(headerEl, contentEl)
    bookingConfirmationParts.set(el, { titleEl, rowsEl, rows: [] })
    return el
  },
  applyProp: (el, prop, value) => {
    const parts = bookingConfirmationParts.get(el)
    if (parts === undefined) return
    switch (prop) {
      case 'title':
        parts.titleEl.textContent = value == null ? '' : String(value)
        break
      case 'rows':
        parts.rows = readRows(value)
        parts.rowsEl.replaceChildren(...parts.rows.map((row, i, all) => buildRow(row, i, all.length)))
        break
      case 'data':
        applyConfirmationData(parts, value)
        break
      default:
        break
    }
  },
}

/** Every component the fragment's `catalog.json` declares MUST appear here (the FACTORY_MISSING
 *  precondition, mirroring `fixture-demo/factories.ts`). */
export const hospitalityFactories: Record<string, WidgetFactory> = {
  BookingForm: bookingFormFactory,
  BookingConfirmation: bookingConfirmationFactory,
}

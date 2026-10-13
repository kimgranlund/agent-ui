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
// Field kinds (§2.1 sketch named "range Calendar" — narrowed at build): `dateSingle | select | checkbox |
// text | number` (T-0079 added the last two). `text` and `number` mint a `ui-text-field`. A `dateSingle` is a
// DATE CARD (T-0092): a `ui-card` with the field's label, the chosen date in the reader's locale format and one
// `ui-button` ("Choose date", "Change" once set) that opens a `ui-calendar` in a `ui-popover`, never a month
// grid inline. The `ui-calendar` is the card's form control (named for the path), so the committed value is
// still the ISO `YYYY-MM-DD` string and the wire contract is unchanged; only the shown text is formatted.
// The calendar is swapped for a fresh one each time the popover opens, because a live calendar only seeds its
// displayed month at connect: a fresh one opens on the booked month (today's when empty). `ui-calendar`'s
// `mode="range"` commits via a two-ENTRY `FormData` (start+end under one `name`), which
// `ui-form-provider`'s native `values()` aggregation does not flatten into the single scalar-per-path shape
// `BookingConfirmation.rows` needs, so a date RANGE is authored as two ordinary `dateSingle` fields (e.g.
// `checkIn`/`checkOut`), drawn as two cards side by side where the width allows. Within a run the later card
// takes the earlier card's date as its calendar `min`, and an earlier pick that passes a later date clears it.
// A `checkbox` kind is a Yes / No `ui-radio-group` (T-0092), its value the string `Yes` or `No`; `required`
// means the guest must answer, not that the answer must be Yes.
//
// Look (T-0085, the ADR-0046 box model): `BookingForm`'s root is the card surface itself (the `ui-card` frame
// tokens on `el.style`) and a `[data-box]`, so every child, the producer's action Buttons included, takes the
// shared 6px inset; the root carries the region padding (12 inline, 6 block), the ADR-0056 region-less card
// reading, so ink sits 19px in like a stock card's regions. Every field but the self-labelled checkbox wears a
// `ui-field` (the fleet's visible label), fields stack at the 8px region gap, and the producer's Buttons step
// up to the 36px `lg` action size (`largeActionButtons`, ADR-0243 Amendment 2). `BookingConfirmation` is a
// `ui-card` with real `ui-card-header`/`ui-card-content` regions and one label (muted, start) / value
// (emphasis, end) row per entry, hairline dividers between rows.

import type { WidgetFactory } from '../../types.ts'
import { largeActionButtons } from '../action-row.ts'

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
  dateCards: Map<string, DateCard>
  dateRuns: DateCard[][]
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

/** Build one field: its live control, labelled by a `ui-field` (the checkbox labels itself, beside its box). */
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
    case 'checkbox': {
      // A Yes / No choice (the group's value is the checked radio's string), labelled by its `ui-field`.
      const el = document.createElement('ui-radio-group') as unknown as FieldControlLike & { orientation: string }
      el.name = field.path
      el.required = Boolean(field.required)
      el.orientation = 'horizontal'
      for (const answer of ['Yes', 'No']) {
        const radio = document.createElement('ui-radio') as unknown as HTMLElement & { value: string }
        radio.value = answer
        radio.textContent = answer
        el.appendChild(radio)
      }
      return labelledField(field, el)
    }
    case 'text':
    case 'number':
    default: {
      // `type=number` brings the stepper, the numeric codec and native range validity; the committed value is
      // the field's canonical string form. `label` stays the bare-usage accessible name, yielding to the
      // `ui-field` label once associated.
      const el = document.createElement('ui-text-field') as unknown as FieldControlLike & { label: string; type: string }
      el.name = field.path
      el.required = Boolean(field.required)
      el.label = field.label
      el.type = field.kind === 'number' ? 'number' : 'text'
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

/** Set one control's CURRENT value from the bound aggregate — read direction (`applyProp('value', …)`). */
function prefillFieldControl(wrap: HTMLElement, field: BookingField, raw: unknown): void {
  const control = wrap.querySelector(field.kind === 'checkbox' ? 'ui-radio-group' : field.kind === 'select' ? 'ui-select' : 'ui-text-field')
  if (control === null) return
  if (field.kind === 'checkbox') (control as unknown as { value: string | null }).value = answerFor(raw)
  else (control as unknown as { value: string }).value = raw == null ? '' : String(raw)
}

// ── date cards (T-0092) ─────────────────────────────────────────────────────────────────────────────

/** One date card: its element and the three things the form drives. `value` is always an ISO date or ''. */
interface DateCard {
  el: HTMLElement
  value(): string
  setValue(iso: string): void
  setMin(iso: string): void
}

interface CalendarLike extends HTMLElement {
  name: string
  required: boolean
  value: string
  min: string
}

interface PopoverLike extends HTMLElement {
  open: boolean
}

type TextLike = HTMLElement & { as: string; variant: string; size: string; emphasis: boolean }

function dateText(variant: string, size: string): TextLike {
  const el = document.createElement('ui-text') as TextLike
  el.as = 'none'
  el.variant = variant
  el.size = size
  el.style.display = 'block'
  return el
}

/** A `ui-card` showing the label, the chosen date and one button opening a calendar popover. `onPick` runs when the
 *  guest picks a date, before the change reaches the form. */
function buildDateCard(field: BookingField, onPick: () => void): DateCard {
  const card = document.createElement('ui-card')
  card.setAttribute('data-a2ui-booking-field', field.path)
  card.setAttribute('data-part', 'date-card')
  const label = dateText('label', 'md')
  label.setAttribute('data-part', 'label')
  label.style.color = 'var(--md-sys-color-neutral-on-surface-variant)'
  label.textContent = field.label
  if (field.required === true) {
    const mark = document.createElement('span') // the ui-field required marker, drawn here because a card is no ui-field
    mark.setAttribute('aria-hidden', 'true')
    mark.textContent = ' *'
    label.append(mark)
  }
  const text = dateText('title', 'md')
  text.setAttribute('data-part', 'date-text')
  text.style.marginBlockEnd = 'var(--md-sys-space-sm)' // air between the date and its button
  const popover = document.createElement('ui-popover') as PopoverLike
  const button = document.createElement('ui-button') as HTMLElement & { size: string }
  button.setAttribute('data-a2ui-date-button', '') // not data-part: the popover claims it for the trigger
  button.size = 'lg' // the library's large action step, 36px (also stamped by largeActionButtons)
  popover.append(button) // the first child is the trigger; the calendar joins it in the panel
  card.append(label, text, popover)

  let value = ''
  let min = ''
  let cal: CalendarLike | null = null

  const paint = (): void => {
    const shown = formatIsoDate(value)
    text.textContent = shown === '' ? 'No date chosen' : shown
    text.style.color = shown === '' ? 'var(--md-sys-color-neutral-on-surface-variant)' : ''
    button.textContent = shown === '' ? 'Choose date' : 'Change'
    button.setAttribute('aria-label', `${shown === '' ? 'Choose' : 'Change'} ${field.label.toLowerCase()} date`)
  }

  // A fresh `ui-calendar` per open: it seeds its displayed month from `value` only when it connects.
  const mountCalendar = (): void => {
    const next = document.createElement('ui-calendar') as CalendarLike
    next.name = field.path
    next.required = Boolean(field.required)
    next.value = value
    next.min = min
    next.addEventListener('change', () => {
      value = next.value
      paint()
      popover.open = false
      onPick()
    })
    if (cal === null) popover.append(next)
    else cal.replaceWith(next)
    cal = next
  }

  // Capture phase on the popover: runs before the trigger's own click toggles it open.
  popover.addEventListener(
    'click',
    (ev) => {
      if (!(ev.target instanceof Element) || ev.target.closest('[data-a2ui-date-button]') === null) return
      if (!popover.open) mountCalendar()
    },
    true,
  )

  mountCalendar()
  paint()
  return {
    el: card,
    value: () => value,
    setValue: (iso) => {
      value = ISO_DATE.test(iso) ? iso : ''
      if (cal !== null) cal.value = value
      paint()
    },
    setMin: (iso) => {
      min = iso
      if (cal !== null) cal.min = iso
    },
  }
}

/** Hold a run of date cards in order: each takes the one before as its `min`. `clear` also empties a later date a
 *  fresh pick has moved before (a guest cannot leave before they arrive); a bound prefill never clears. */
function reconcileDateRun(run: DateCard[], clear: boolean): void {
  for (let i = 1; i < run.length; i++) {
    const [prev, cur] = [run[i - 1]!, run[i]!]
    cur.setMin(prev.value())
    if (clear && prev.value() !== '' && cur.value() !== '' && cur.value() < prev.value()) cur.setValue('')
  }
}

/** A run of consecutive `dateSingle` fields (arrival and departure) shares one wrapping row: side by side where the
 *  form is wide enough for two 12rem cards, stacked on a phone. */
function dateRow(): HTMLElement {
  const row = document.createElement('div')
  row.setAttribute('data-part', 'date-row')
  row.style.display = 'flex'
  row.style.flexWrap = 'wrap'
  row.style.gap = 'var(--ui-box-gap)'
  return row
}

function rebuildFields(parts: BookingFormParts, fields: BookingField[]): void {
  parts.fields = fields
  parts.dateCards = new Map()
  parts.dateRuns = []
  const nodes: HTMLElement[] = []
  let row: HTMLElement | null = null
  let run: DateCard[] = []
  for (const field of fields) {
    if (field.kind !== 'dateSingle') {
      row = null
      nodes.push(buildFieldControl(field))
      continue
    }
    if (row === null) {
      row = dateRow()
      nodes.push(row)
      run = []
      parts.dateRuns.push(run)
    }
    const thisRun = run
    const card = buildDateCard(field, () => reconcileDateRun(thisRun, true))
    card.el.style.flex = '1 1 12rem'
    thisRun.push(card)
    parts.dateCards.set(field.path, card)
    row.appendChild(card.el)
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
  // ADR-0233: the field controls and date-card parts it mints
  uses: ['ui-button', 'ui-calendar', 'ui-card', 'ui-field', 'ui-popover', 'ui-radio', 'ui-radio-group', 'ui-select', 'ui-text', 'ui-text-field'],
  create: () => {
    const el = document.createElement('ui-form-provider') as unknown as FormProviderLike
    // The card surface and the ADR-0046 box: `[data-box]` insets every child 6px (margins collapsing in its
    // flow-root BFC) and the root holds the region padding, so ink lands 19px in, the action row included.
    el.setAttribute('data-box', '')
    paintCardSurface(el)
    el.style.display = 'flow-root'
    el.style.paddingBlock = 'var(--ui-box-pad-block)'
    el.style.paddingInline = 'var(--ui-box-pad-inline)'
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
    fieldsEl.style.marginBlock = 'var(--ui-box-gap)' // collapses with its neighbours' 6px inset: 8px to the title and actions
    el.append(titleEl, fieldsEl)
    largeActionButtons(el)
    bookingFormParts.set(el, { titleEl, fieldsEl, fields: [], dateCards: new Map(), dateRuns: [] })
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
        rebuildFields(parts, readFields(value))
        break
      case 'value': {
        if (typeof value !== 'object' || value === null) break
        const obj = value as Record<string, unknown>
        // Plain attribute-value equality over the field wrappers (never a `querySelector` attribute selector,
        // which would need CSS.escape — absent in jsdom, ADR-N5 zero-dep-friendly either way).
        const wraps = fieldWrapsByPath(parts.fieldsEl)
        for (const field of parts.fields) {
          const raw = obj[field.path]
          if (field.kind === 'dateSingle') {
            parts.dateCards.get(field.path)?.setValue(raw == null ? '' : String(raw))
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
}

function isConfirmationRow(v: unknown): v is BookingConfirmationRow {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { label?: unknown }).label === 'string' &&
    typeof (v as { path?: unknown }).path === 'string'
  )
}

function readRows(value: unknown): BookingConfirmationRow[] {
  return Array.isArray(value) ? value.filter(isConfirmationRow) : []
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
    valueEl.textContent = displayValue(raw)
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
export const conciergeFactories: Record<string, WidgetFactory> = {
  BookingForm: bookingFormFactory,
  BookingConfirmation: bookingConfirmationFactory,
}

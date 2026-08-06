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
// Field kinds (§2.1 sketch named "range Calendar" — narrowed at build): `dateSingle | select | checkbox`
// only. `ui-calendar`'s `mode="range"` commits via a two-ENTRY `FormData` (`calendar.ts` — start+end
// under one `name`), which `ui-form-provider`'s native `values()`/`entries()` aggregation (FormData
// parity) does not flatten into the single scalar-per-path shape `BookingConfirmation.rows` needs — a
// verified fit gap, not a guess. A date RANGE is authored as two ordinary `dateSingle` fields instead
// (e.g. `checkIn`/`checkOut`), which is both simpler to implement and a better fit for
// `BookingConfirmation`'s one-row-per-value display.

import '@agent-ui/components/components' // self-defines ui-form-provider/ui-calendar/ui-select/ui-checkbox/ui-text/ui-card on import
import type { WidgetFactory } from '../../types.ts'

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
}

const bookingFormParts = new WeakMap<HTMLElement, BookingFormParts>()

/** One field label — a small caption row above a control with no native visible-label surface. */
function fieldCaption(label: string): HTMLElement {
  const el = document.createElement('ui-text')
  ;(el as unknown as { as: string; variant: string; size: string }).as = 'none'
  ;(el as unknown as { as: string; variant: string; size: string }).variant = 'body'
  ;(el as unknown as { as: string; variant: string; size: string }).size = 'sm'
  el.textContent = label
  return el
}

/** Build one field's live control (+ its caption, for kinds with no native visible label). */
function buildFieldControl(field: BookingField): HTMLElement {
  switch (field.kind) {
    case 'select': {
      const el = document.createElement('ui-select') as unknown as FieldControlLike & { label: string; placeholder: string }
      el.name = field.path
      el.required = Boolean(field.required)
      el.label = field.label
      el.placeholder = field.label
      for (const opt of field.options ?? []) {
        const optEl = document.createElement('div')
        optEl.setAttribute('role', 'option')
        optEl.setAttribute('value', opt.value)
        optEl.textContent = opt.label
        el.appendChild(optEl)
      }
      const wrap = document.createElement('div')
      wrap.setAttribute('data-a2ui-booking-field', field.path)
      wrap.append(fieldCaption(field.label), el)
      return wrap
    }
    case 'checkbox': {
      // Self-labeled (textContent IS the accessible label, the indicatorFactory precedent) — no caption wrap.
      const el = document.createElement('ui-checkbox') as unknown as FieldControlLike
      el.name = field.path
      el.required = Boolean(field.required)
      el.textContent = field.label
      const wrap = document.createElement('div')
      wrap.setAttribute('data-a2ui-booking-field', field.path)
      wrap.appendChild(el)
      return wrap
    }
    case 'dateSingle':
    default: {
      const el = document.createElement('ui-calendar') as unknown as FieldControlLike
      el.name = field.path
      el.required = Boolean(field.required)
      const wrap = document.createElement('div')
      wrap.setAttribute('data-a2ui-booking-field', field.path)
      wrap.append(fieldCaption(field.label), el)
      return wrap
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
  const control = wrap.querySelector(field.kind === 'checkbox' ? 'ui-checkbox' : field.kind === 'select' ? 'ui-select' : 'ui-calendar')
  if (control === null) return
  if (field.kind === 'checkbox') (control as unknown as { checked: boolean }).checked = Boolean(raw)
  else (control as unknown as { value: string }).value = raw == null ? '' : String(raw)
}

function rebuildFields(parts: BookingFormParts, fields: BookingField[]): void {
  parts.fields = fields
  parts.fieldsEl.replaceChildren(...fields.map(buildFieldControl))
}

/**
 * `BookingForm` → `ui-form-provider` wrapping a static title + one live control per `fields` entry
 * (catalog LLD-C5, GH #497). See the module header for the full binding/gating design.
 */
export const bookingFormFactory: WidgetFactory = {
  tag: 'ui-form-provider',
  create: () => {
    const el = document.createElement('ui-form-provider') as unknown as FormProviderLike
    const titleEl = document.createElement('ui-text')
    ;(titleEl as unknown as { as: string; variant: string; size: string }).as = 'h4'
    ;(titleEl as unknown as { as: string; variant: string; size: string }).variant = 'title'
    ;(titleEl as unknown as { as: string; variant: string; size: string }).size = 'md'
    titleEl.setAttribute('data-part', 'title')
    const fieldsEl = document.createElement('div')
    fieldsEl.setAttribute('data-part', 'fields')
    el.append(titleEl, fieldsEl)
    bookingFormParts.set(el, { titleEl, fieldsEl, fields: [] })
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
        // Plain attribute-value equality over the direct children (never a `querySelector` attribute
        // selector, which would need CSS.escape — absent in jsdom, ADR-N5 zero-dep-friendly either way).
        for (const field of parts.fields) {
          const wrap = findByAttr(parts.fieldsEl, 'data-a2ui-booking-field', field.path)
          if (wrap !== undefined) prefillFieldControl(wrap, field, obj[field.path])
        }
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

function buildRow(row: BookingConfirmationRow): HTMLElement {
  const wrap = document.createElement('div')
  wrap.setAttribute('data-a2ui-confirmation-row', row.path)
  const label = document.createElement('ui-text')
  ;(label as unknown as { as: string; variant: string; size: string }).as = 'none'
  ;(label as unknown as { as: string; variant: string; size: string }).variant = 'body'
  ;(label as unknown as { as: string; variant: string; size: string }).size = 'sm'
  label.textContent = row.label
  const valueEl = document.createElement('ui-text')
  ;(valueEl as unknown as { as: string; variant: string; size: string }).as = 'none'
  ;(valueEl as unknown as { as: string; variant: string; size: string }).variant = 'body'
  ;(valueEl as unknown as { as: string; variant: string; size: string }).size = 'md'
  valueEl.setAttribute('data-part', 'value')
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
    valueEl.textContent = raw == null || raw === '' ? '—' : String(raw)
  }
}

/**
 * `BookingConfirmation` → `ui-card` holding a title + one label/value row per `rows` entry, EVERY row's
 * value ALWAYS derived from the bound `data` aggregate (never a producer literal — see the module header
 * + the decomp note §1 argument (b)).
 */
export const bookingConfirmationFactory: WidgetFactory = {
  tag: 'ui-card',
  create: () => {
    const el = document.createElement('ui-card')
    const titleEl = document.createElement('ui-text')
    ;(titleEl as unknown as { as: string; variant: string; size: string }).as = 'h4'
    ;(titleEl as unknown as { as: string; variant: string; size: string }).variant = 'title'
    ;(titleEl as unknown as { as: string; variant: string; size: string }).size = 'md'
    titleEl.setAttribute('data-part', 'title')
    const rowsEl = document.createElement('div')
    rowsEl.setAttribute('data-part', 'rows')
    el.append(titleEl, rowsEl)
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
        parts.rowsEl.replaceChildren(...parts.rows.map(buildRow))
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

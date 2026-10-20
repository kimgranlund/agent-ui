// confirm-receipt.ts: UIConfirmReceiptElement, the read-back, confirm and receipt record for a booking or an
// order (T-0195, Direction A approved by Kim 2026-10-20). Behaviour, props, internals ARIA and the control-built
// parts only; every visual rule lives in confirm-receipt.css.
//
// A pattern-tier display primitive: not form-associated, the host takes no focus. The host is `role="group"`
// named by `title`, set through ElementInternals. The header part is the one polite live region, so the settle is
// announced once.
//
// Every displayed row, total and ref value is `data[path]` (a relative key into the bound record, the concierge
// BookingConfirmation law), so a value is never a producer literal, and the control does no arithmetic: item
// amounts and the total are bound strings. Back and Confirm are the control's own native buttons in an `actions`
// row OUTSIDE the record card, so no button ever sits inside a card container (Kim 2026-10-14).
//
// The press contract: Confirm writes `status = 'confirmed'`, emits `change`, then emits `action` with
// `{action, context}` from `confirmAction` (the Suggestions commit-then-emit order); Back emits `action` with
// `backAction` and leaves `status` alone. The a2ui renderer forwards the host's own `action` event by its
// `detail.action`. Once confirmed the actions row is removed from the DOM, the Confirmed mark takes the header and
// the ref line shows, so a re-render on the same data cannot ask again. A Confirm press moves focus to the mark
// (tabindex -1), so focus never drops to the body when the pressed button leaves.
//
// `title` is observed as `receipt-title`, never the global `title` attribute, so a receipt never paints a native
// tooltip (the ui-result-card `result-title` precedent).

import { UIElement, type ReactiveProps } from '../../dom/index.ts'
import { createGlyph } from '../glyph/glyph.ts'
// Generated from confirm-receipt.md's `attributes[]` (ADR-0173): `node scripts/generate-props.mjs confirm-receipt`.
import { props } from './confirm-receipt.props.gen.ts'

/** What a row shows when its path holds no value (the concierge BookingConfirmation mark). */
const MISSING = '—'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

interface Option {
  value: string
  label: string
}

interface Row {
  label: string
  path: string
  options: Option[]
}

interface Item {
  label: string
  quantity: string
  amount: string
}

interface ActionDetail {
  action: string
  context: Record<string, unknown> | undefined
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const isOption = (v: unknown): v is Option => isRecord(v) && typeof v.value === 'string' && typeof v.label === 'string'

/** A scalar as display text: a finite number or a string, else ''. */
const textOf = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')

function cleanRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((r): r is Record<string, unknown> => isRecord(r) && typeof r.label === 'string' && typeof r.path === 'string')
    .map((r) => ({ label: r.label as string, path: r.path as string, options: Array.isArray(r.options) ? r.options.filter(isOption) : [] }))
}

function cleanItems(value: unknown): Item[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((i): i is Record<string, unknown> => isRecord(i) && typeof i.label === 'string')
    .map((i) => ({ label: i.label as string, quantity: textOf(i.quantity), amount: textOf(i.amount) }))
}

function cleanTotal(value: unknown): Row | null {
  return isRecord(value) && typeof value.label === 'string' && typeof value.path === 'string'
    ? { label: value.label, path: value.path, options: [] }
    : null
}

function cleanAction(value: unknown): ActionDetail | null {
  if (!isRecord(value) || typeof value.action !== 'string' || value.action === '') return null
  return { action: value.action, context: isRecord(value.context) ? value.context : undefined }
}

/** An ISO `YYYY-MM-DD` in the reader's locale, or '' when it is not a real calendar date. */
function formatIsoDate(iso: string): string {
  const m = ISO_DATE.exec(iso)
  if (m === null) return ''
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d) // local construction: no timezone shift of the calendar day
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return ''
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** What a row shows for a bound value: an options label, a locale date, Yes or No, else the value as text. */
function displayValue(raw: unknown, options: readonly Option[]): string {
  if (raw == null || raw === '') return MISSING
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  const text = String(raw)
  const option = options.find((o) => o.value === text)
  if (option !== undefined) return option.label
  return formatIsoDate(text) || text
}

const part = <T extends HTMLElement = HTMLElement>(tag: string, name: string): T => {
  const node = document.createElement(tag) as T
  node.dataset.part = name
  return node
}

const setText = (node: Node, text: string): void => {
  if (node.textContent !== text) node.textContent = text
}

/** Put `node` in `parent` when `present`, before the first of `later` already attached; remove it otherwise. */
const place = (parent: Element, node: Element, present: boolean, later: readonly Element[] = []): void => {
  if (!present) {
    if (node.parentNode === parent) node.remove()
    return
  }
  if (node.parentNode === parent) return
  parent.insertBefore(node, later.find((n) => n.parentNode === parent) ?? null)
}

/** One label and value line (a row or the total). */
function line(name: 'row' | 'total', label: string, value: string): HTMLElement {
  const root = part('div', name)
  const labelEl = part('span', 'label')
  labelEl.textContent = label
  const valueEl = part('span', 'value')
  valueEl.textContent = value
  root.append(labelEl, valueEl)
  return root
}

export interface UIConfirmReceiptElement extends ReactiveProps<typeof props> {}
export class UIConfirmReceiptElement extends UIElement {
  static props = props

  #record: HTMLElement | undefined
  #header!: HTMLElement
  #title!: HTMLElement
  #mark!: HTMLElement
  #items!: HTMLElement
  #rows!: HTMLElement
  #total!: HTMLElement
  #ref!: HTMLElement
  #actions!: HTMLElement
  #back!: HTMLButtonElement
  #confirm!: HTMLButtonElement

  protected override connected(): void {
    this.internals.role = 'group'
    this.#ensureParts()
    place(this, this.#record!, true, [this.#actions])

    // Re-armed every connect: `this.listen` rides the current connection's AbortSignal; the buttons are reused.
    this.listen(this.#confirm, 'click', () => this.#onConfirm())
    this.listen(this.#back, 'click', () => this.#onBack())

    this.effect(() => {
      const title = typeof this.title === 'string' ? this.title.trim() : ''
      const confirmed = this.status === 'confirmed'
      this.internals.ariaLabel = confirmed ? (title === '' ? 'Confirmed' : `${title}: Confirmed`) : title === '' ? null : title
    })
    this.effect(() => this.#renderHeader())
    this.effect(() => this.#renderBody())
    this.effect(() => this.#renderActions())
  }

  #onConfirm(): void {
    if (this.status === 'confirmed') return
    this.status = 'confirmed' // commit before emit: a change listener reading el.status sees the settle
    // The pressed button leaves with the actions row, so focus moves to the Confirmed mark instead of dropping to
    // the body (Kim 2026-10-20). The mark is placed now, ahead of the header effect, so it can take focus.
    place(this.#header, this.#mark, true)
    this.#mark.focus()
    this.emit('change', 'confirmed')
    const action = cleanAction(this.confirmAction)
    if (action !== null) this.emit('action', action)
  }

  #onBack(): void {
    const action = cleanAction(this.backAction)
    if (action !== null) this.emit('action', action)
  }

  #ensureParts(): void {
    if (this.#record) return // parts persist across reconnects; built once ever
    this.#record = part('section', 'record')
    this.#header = part('div', 'header')
    this.#header.setAttribute('aria-live', 'polite')
    this.#title = part('span', 'title')
    this.#mark = part('span', 'mark')
    this.#mark.tabIndex = -1 // programmatically focusable only: Confirm moves focus here, Tab never stops on it
    const check = createGlyph('check')
    check.dataset.part = 'glyph'
    this.#mark.append(check, 'Confirmed')
    this.#items = part('div', 'items')
    this.#rows = part('div', 'rows')
    this.#total = part('div', 'total')
    this.#ref = part('p', 'ref')
    this.#record.append(this.#header)

    this.#actions = part('div', 'actions')
    this.#back = part<HTMLButtonElement>('button', 'back')
    this.#back.type = 'button'
    this.#back.dataset.size = 'lg' // the part's own step: 28px on an A2UI canvas (ADR-0245 Amendment 2)
    const caret = createGlyph('caret-left')
    caret.dataset.part = 'glyph'
    this.#back.append(caret, 'Back')
    this.#confirm = part<HTMLButtonElement>('button', 'confirm')
    this.#confirm.type = 'button'
    this.#confirm.dataset.size = 'lg'
    this.#confirm.textContent = 'Confirm'
    this.#actions.append(this.#confirm)
  }

  #renderHeader(): void {
    const title = typeof this.title === 'string' ? this.title : ''
    setText(this.#title, title)
    place(this.#header, this.#title, title !== '', [this.#mark])
    place(this.#header, this.#mark, this.status === 'confirmed')
  }

  #renderBody(): void {
    const data = isRecord(this.data) ? this.data : {}
    const record = this.#record!
    const later = [this.#items, this.#rows, this.#total, this.#ref]
    const after = (node: HTMLElement): HTMLElement[] => later.slice(later.indexOf(node) + 1)

    const items = cleanItems(this.items)
    this.#items.replaceChildren(
      ...items.map((item) => {
        const root = part('div', 'item')
        if (item.quantity !== '') {
          const quantity = part('span', 'quantity')
          quantity.textContent = `${item.quantity} ×`
          root.append(quantity)
        }
        const labelEl = part('span', 'label')
        labelEl.textContent = item.label
        const valueEl = part('span', 'value')
        valueEl.textContent = item.amount
        root.append(labelEl, valueEl)
        return root
      }),
    )
    place(record, this.#items, items.length > 0, after(this.#items))

    const rows = cleanRows(this.rows)
    this.#rows.replaceChildren(...rows.map((row) => line('row', row.label, displayValue(data[row.path], row.options))))
    place(record, this.#rows, rows.length > 0, after(this.#rows))

    const total = cleanTotal(this.total)
    if (total !== null) {
      const fresh = line('total', total.label, displayValue(data[total.path], total.options))
      this.#total.replaceChildren(...fresh.childNodes)
    }
    place(record, this.#total, total !== null, after(this.#total))

    const refPath = typeof this.refPath === 'string' ? this.refPath : ''
    const ref = refPath === '' ? '' : textOf(data[refPath])
    setText(this.#ref, ref)
    place(record, this.#ref, this.status === 'confirmed' && ref.trim() !== '')
  }

  #renderActions(): void {
    const pending = this.status !== 'confirmed'
    place(this.#actions, this.#back, cleanAction(this.backAction) !== null, [this.#confirm])
    place(this, this.#actions, pending)
  }
}

if (!customElements.get('ui-confirm-receipt')) customElements.define('ui-confirm-receipt', UIConfirmReceiptElement)

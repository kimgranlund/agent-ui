// amount-picker.ts: UIAmountPickerElement, one bounded number with minus and plus, optional preset chips, an
// optional slider, a formatted readout and one commit (T-0196 Design, the fork sheet Kim approved 2026-10-20).
// Behaviour, props, internals ARIA and the control-built parts only; the pure codec and formatter live in
// amount-picker-model.ts and every visual rule in amount-picker.css.
//
// A pattern-tier FACE control, but not a Range: UIRangeElement sets role=slider on its host, and this host is a
// group. The clamp and snap law is the Range base's own, shared through `_base/range-normalize.ts`.
//
// Parts are control-created and built once: label, stepper (decrease, readout, increase), presets, slider, commit.
// The readout is the spinbutton and the one tab stop of the stepper (the APG spinbutton pattern); minus and plus
// are tabindex -1. A part with nothing to show is detached (the empty-box law).
//
// Events (ADR-0153 set): `input` per live change, `change` once per settled change, `action` once per commit with
// `{action: actionName, context: {value}}` after any pending `change`, so a bound data model holds the value the
// action reports (the T-0172 bet-strip order). None fires from a programmatic write. The composed slider's own
// `input` and `change` are stopped at the part and re-emitted from the host by these rules.

import { UIFormElement, type FieldLabelling, type FormValue, type ReactiveProps } from '../../dom/index.ts'
import { normalizeRangeValue } from '../_base/index.ts'
import { createGlyph } from '../glyph/glyph.ts' // the step and check marks are library marks (ADR-0245 cl.5)
import type { UISliderElement } from '../slider/slider.ts'
import '../slider/slider.ts' // the slider row composes the shipped rail
import { amountFormatter, cleanPresets } from './amount-picker-model.ts'
// Generated from amount-picker.md's `attributes[]` (ADR-0173): `node scripts/generate-props.mjs amount-picker`.
import { props } from './amount-picker.props.gen.ts'

/** PageUp and PageDown move by this many steps (the Range base's largeStep). */
const LARGE_STEP = 10

const part = <K extends keyof HTMLElementTagNameMap>(tag: K, name: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.dataset.part = name
  return node
}

const button = (name: string): HTMLButtonElement => {
  const node = part('button', name)
  node.type = 'button'
  return node
}

const setText = (node: Node, text: string): void => {
  if (node.textContent !== text) node.textContent = text
}

const setAttr = (node: Element, name: string, value: string | null): void => {
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name)
  } else if (node.getAttribute(name) !== value) {
    node.setAttribute(name, value)
  }
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

export interface UIAmountPickerElement extends ReactiveProps<typeof props> {}
export class UIAmountPickerElement extends UIFormElement {
  static props = props

  #label: HTMLElement | undefined
  #stepper!: HTMLElement
  #decrease!: HTMLButtonElement
  #readout!: HTMLElement
  #increase!: HTMLButtonElement
  #presets!: HTMLElement
  #presetButtons: HTMLButtonElement[] = []
  #slider!: UISliderElement
  #commit!: HTMLButtonElement

  // The value when the current settle window opened (focus or pointer down inside the host); `null` when none is
  // open. `change` fires when a settle finds the value moved off it.
  #baseline: number | null = null

  /** The current value, clamped and snapped against the current bounds. */
  #normalized(raw: number = this.value ?? 0): number {
    return normalizeRangeValue(raw, this.min ?? 0, this.max ?? 100, this.step ?? 1)
  }

  protected override formValue(): FormValue {
    return String(this.#normalized())
  }

  protected override connected(): void {
    this.internals.role = 'group'
    this.#ensureParts()
    this.#baseline = null

    this.effect(() => {
      this.internals.ariaLabel = this.label || null
    })

    // Keep the value clamped and snapped on every change to value, min, max or step (the Range base's normaliser).
    this.effect(() => {
      const raw = this.value ?? 0
      const normalized = this.#normalized(raw)
      if (!Object.is(normalized, raw)) this.value = normalized
    })

    this.effect(() => this.#renderLabel())
    this.effect(() => this.#renderStepper())
    this.effect(() => this.#renderPresets())
    this.effect(() => this.#renderSlider())
    this.effect(() => this.#renderCommit())

    this.listen(this.#decrease, 'click', () => this.#press(-1))
    this.listen(this.#increase, 'click', () => this.#press(1))
    this.listen(this.#presets, 'click', (event) => this.#onPreset(event))
    this.listen(this.#commit, 'click', () => this.#fireCommit())
    this.listen(this.#readout, 'keydown', (event) => this.#onKeydown(event as KeyboardEvent))

    // The composed slider: its events stay inside; the host re-emits its own by the rules above.
    this.listen(this.#slider, 'input', (event) => {
      event.stopPropagation()
      if (this.effectiveDisabled()) return
      this.#write(this.#slider.value ?? 0)
    })
    this.listen(this.#slider, 'change', (event) => {
      event.stopPropagation()
      this.#settle()
    })
    this.listen(this.#slider, 'pointerup', () => this.#settle())
    this.listen(this.#slider, 'pointercancel', () => this.#settle())

    // The settle window: opened by focus or a press inside the host, closed when focus leaves the host.
    this.listen(this, 'focusin', () => this.#open())
    this.listen(this, 'pointerdown', () => this.#open())
    this.listen(this, 'focusout', (event) => {
      const next = (event as FocusEvent).relatedTarget
      if (next instanceof Node && this.contains(next)) return
      this.#settle()
      this.#baseline = null
    })
  }

  /** The field owns the visible label: its ids land on the readout, the ui-text-field editor precedent. */
  protected override applyFieldLabelling(refs: FieldLabelling | null): void {
    const readout = this.#readout
    if (!readout) return
    if (refs === null) {
      readout.removeAttribute('aria-labelledby')
      readout.removeAttribute('aria-describedby')
      return
    }
    setAttr(readout, 'aria-labelledby', refs.label ? refs.label.id : null)
    const described = [refs.description, refs.error].filter((el): el is HTMLElement => el !== null)
    setAttr(readout, 'aria-describedby', described.length > 0 ? described.map((el) => el.id).join(' ') : null)
  }

  #ensureParts(): void {
    if (this.#label) return // parts persist across reconnects; built once ever
    this.#label = part('span', 'label')
    this.#label.setAttribute('aria-hidden', 'true')
    this.#stepper = part('div', 'stepper')
    this.#decrease = button('decrease')
    this.#decrease.tabIndex = -1
    this.#decrease.setAttribute('aria-label', 'Decrease')
    this.#decrease.append(this.#glyph('minus'))
    this.#readout = part('div', 'readout')
    this.#readout.setAttribute('role', 'spinbutton')
    this.#increase = button('increase')
    this.#increase.tabIndex = -1
    this.#increase.setAttribute('aria-label', 'Increase')
    this.#increase.append(this.#glyph('plus'))
    this.#stepper.append(this.#decrease, this.#readout, this.#increase) // minus left of plus (GH #1406)
    this.#presets = part('div', 'presets')
    this.#slider = document.createElement('ui-slider') as UISliderElement
    this.#slider.dataset.part = 'slider'
    this.#slider.setAttribute('readout-hidden', '') // the picker's readout is the one readout
    this.#commit = button('commit')
    this.append(this.#label, this.#stepper)
  }

  #glyph(symbol: 'minus' | 'plus' | 'check'): HTMLElement {
    const glyph = createGlyph(symbol)
    glyph.dataset.part = 'glyph'
    return glyph
  }

  /** The parts that come after `node` in the host's order, for `place`. */
  #after(node: Element): Element[] {
    const order: Element[] = [this.#label!, this.#stepper, this.#presets, this.#slider, this.#commit]
    return order.slice(order.indexOf(node) + 1)
  }

  #format(): (value: number) => string {
    return amountFormatter(this.currency ?? '', this.unit ?? '')
  }

  #renderLabel(): void {
    const label = this.label ?? ''
    setText(this.#label!, label)
    place(this, this.#label!, label !== '' && this.fieldLabelling === null, this.#after(this.#label!))
  }

  #renderStepper(): void {
    const value = this.#normalized()
    const min = this.min ?? 0
    const max = this.max ?? 100
    const format = this.#format()
    const disabled = this.effectiveDisabled()
    const text = format(value)
    setText(this.#readout, text)
    setAttr(this.#readout, 'aria-valuenow', String(value))
    setAttr(this.#readout, 'aria-valuemin', String(min))
    setAttr(this.#readout, 'aria-valuemax', String(max))
    setAttr(this.#readout, 'aria-valuetext', text)
    setAttr(this.#readout, 'aria-disabled', disabled ? 'true' : null)
    setAttr(this.#readout, 'tabindex', disabled ? null : '0')
    // The readout never shrinks below its widest bound, so the step buttons hold still as the value moves.
    const widest = Math.max(format(min).length, format(max).length, text.length)
    this.#readout.style.setProperty('--ui-amount-picker-readout-chars', String(widest))
    this.#decrease.disabled = disabled || value <= min
    this.#increase.disabled = disabled || value >= max
  }

  #renderPresets(): void {
    const value = this.#normalized()
    const presets = cleanPresets(this.presets, this.min ?? 0, this.max ?? 100)
    const format = this.#format()
    const disabled = this.effectiveDisabled()
    const buttons = this.#presetButtons
    while (buttons.length > presets.length) buttons.pop()!.remove()
    while (buttons.length < presets.length) {
      const chip = button('preset')
      this.#presets.append(chip)
      buttons.push(chip)
    }
    presets.forEach((preset, i) => {
      const chip = buttons[i]!
      const selected = Object.is(preset, value)
      chip.dataset.value = String(preset)
      setAttr(chip, 'aria-pressed', selected ? 'true' : 'false')
      chip.disabled = disabled
      const label = format(preset)
      const glyph = chip.querySelector(':scope > [data-part="glyph"]')
      if (selected && glyph === null) chip.prepend(this.#glyph('check'))
      if (!selected && glyph !== null) glyph.remove()
      const textNode = Array.from(chip.childNodes).find((n) => n.nodeType === Node.TEXT_NODE)
      if (textNode) setText(textNode, label)
      else chip.append(label)
    })
    place(this, this.#presets, presets.length > 0, this.#after(this.#presets))
  }

  #renderSlider(): void {
    const on = this.slider === true
    if (on) {
      const slider = this.#slider
      slider.min = this.min ?? 0
      slider.max = this.max ?? 100
      slider.step = this.step ?? 1
      slider.value = this.#normalized()
      slider.size = this.size ?? 'md'
      slider.disabled = this.effectiveDisabled()
      setAttr(slider, 'aria-label', this.label || null)
    }
    place(this, this.#slider, on, this.#after(this.#slider))
  }

  #renderCommit(): void {
    const name = this.actionName ?? ''
    setText(this.#commit, (this.actionLabel ?? '') || 'Confirm')
    this.#commit.disabled = this.effectiveDisabled()
    place(this, this.#commit, name !== '', this.#after(this.#commit))
  }

  /** Write a user value: normalised, and `input` only when it moved. Returns whether it moved. */
  #write(raw: number): boolean {
    const current = this.#normalized()
    const next = this.#normalized(raw)
    if (Object.is(next, current)) return false
    this.value = next
    this.emit('input')
    return true
  }

  #open(): void {
    if (this.#baseline === null) this.#baseline = this.#normalized()
  }

  /** Close the current settle: `change` when the value moved off the baseline, then a fresh baseline while focus
   *  stays inside the host. */
  #settle(): void {
    const value = this.#normalized()
    if (this.#baseline !== null && !Object.is(value, this.#baseline)) this.emit('change')
    const active = this.ownerDocument.activeElement
    this.#baseline = active !== null && this.contains(active) ? value : null
  }

  /** A discrete press (minus, plus or a preset): write, then settle at once. */
  #commitPress(raw: number): void {
    if (this.effectiveDisabled()) return
    this.#open()
    this.#write(raw)
    this.#settle()
  }

  #stepSize(): number {
    const step = this.step ?? 1
    return step > 0 ? step : 1
  }

  #press(dir: 1 | -1): void {
    this.#commitPress(this.#normalized() + dir * this.#stepSize())
  }

  #onPreset(event: Event): void {
    const chip = (event.target as Element | null)?.closest('[data-part="preset"]')
    if (!(chip instanceof HTMLElement) || chip.parentNode !== this.#presets) return
    const preset = Number(chip.dataset.value)
    if (Number.isFinite(preset)) this.#commitPress(preset)
  }

  #fireCommit(): void {
    if (this.effectiveDisabled()) return
    const action = this.actionName ?? ''
    if (action === '') return
    this.#settle() // any pending change first, so a bound model holds the value the action reports
    this.emit('action', { action, context: { value: this.#normalized() } })
  }

  #onKeydown(event: KeyboardEvent): void {
    if (this.effectiveDisabled()) return
    const current = this.#normalized()
    const step = this.#stepSize()
    let next: number
    // Under rtl the horizontal arrows mirror like the slider's (ArrowLeft increments), so the keys follow the
    // reading direction (T-0540). Up/Down, Page and Home/End are direction-free.
    const rtl = getComputedStyle(this).direction === 'rtl'
    const key = rtl && event.key === 'ArrowLeft' ? 'ArrowRight' : rtl && event.key === 'ArrowRight' ? 'ArrowLeft' : event.key
    switch (key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = current + step
        break
      case 'ArrowDown':
      case 'ArrowLeft':
        next = current - step
        break
      case 'PageUp':
        next = current + step * LARGE_STEP
        break
      case 'PageDown':
        next = current - step * LARGE_STEP
        break
      case 'Home':
        next = this.min ?? 0
        break
      case 'End':
        next = this.max ?? 100
        break
      case 'Enter':
        event.preventDefault()
        this.#fireCommit()
        return
      default:
        return
    }
    event.preventDefault()
    this.#open()
    this.#write(next)
  }
}

if (!customElements.get('ui-amount-picker')) customElements.define('ui-amount-picker', UIAmountPickerElement)

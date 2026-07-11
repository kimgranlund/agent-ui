// color-picker.ts — UIColorPickerElement, the standalone `ui-color-picker` control (LLD-C1..C7,
// color-picker.lld.md · ADR-0123 · SPEC-R1…R9/R12/R13). A Pattern-class `UIFormElement` composite that
// edits ONE color value through a 2-axis pad + hue/chroma/lightness channel sliders + an editable numeric
// readout, on an OKLCH-internal model whose `value` serializes to a `format`-selected syntax (hex default,
// oklch opt-in), gamut-mapped into sRGB. It composes `ui-slider` (channels — the accessible spine, SPEC-R6),
// `ui-text-field` (the readout) and `ui-swatch` (the preview) — the ADR-0118 fence honored: this control
// EDITS, `ui-swatch` shows; the preview is always a composed `<ui-swatch>`, never a bespoke color div.
//
// The pad ([data-part=pad]) is a pointer/keyboard ACCELERATOR over the chroma(X)/lightness(Y) plane at the
// current hue — NOT the accessible spine. It wires the NEW `area-drag` trait (the 2-axis sibling of
// value-drag, traits/area-drag.ts) for pointer gesture, and a bespoke keydown handler (the ui-calendar
// #handleGridKey precedent) for 2-axis keyboard stepping. Its own a11y rides `role=slider` +
// `aria-roledescription="2D slider"` + a cross-announcing `aria-valuetext` on the PART (the ui-calendar
// role-on-a-part precedent — the host is the form element, the role lives on the part).
//
// Commit choke point (`#commit`): every gesture serializes the OKLCH model through `format` (gamut-mapping
// before hex), writes `this.value`, repaints every composed part, and emits the event. The `#lastCommittedValue`
// echo-guard (compared by VALUE, not a one-shot flag — a stale one-shot flag would wrongly swallow a later
// genuine external `value` set whenever a commit's write happened to be an Object.is no-op) tells the
// model→surface effect not to re-parse (and thereby round-trip-quantize) its own just-serialized write —
// preserving full drag precision mid-gesture (the adia `#internalUpdate` precedent, LLD-C2).
//
// Layer: controls/ → dom + traits (inward-only ✓). Composes sibling controls (ui-slider/ui-text-field/
// ui-swatch) via a static sibling-control import — the sanctioned command-modal→ui-modal /
// swiper-paddles→ui-button precedent. erasableSyntaxOnly ✓. verbatimModuleSyntax ✓.

import { UIFormElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import type { FormValue, ValidityResult, FieldLabelling } from '../../dom/index.ts'
import { signal } from '../../reactive/index.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'
import { areaDrag } from '../../traits/area-drag.ts'
import { UISliderElement } from '../slider/slider.ts'
import { UITextFieldElement } from '../text-field/text-field.ts'
import { UISwatchElement } from '../swatch/swatch.ts'
import {
  MAX_CHROMA,
  oklchToRgb,
  gamutMapChroma,
  parseColor,
  serializeColor,
  colorCodecOptions,
} from './color.ts'

// ── props (SPEC-R2 — exactly five reflected attributes: value/format own two + the three formProps) ────

const props = {
  ...UIFormElement.formProps, // name / disabled / required
  value: { ...prop.string(''), reflect: true }, // serialized per `format`; '' = unset (SPEC §2 unset-display)
  format: { ...prop.enum(['hex', 'oklch'] as const, 'hex'), reflect: true }, // selects `value` SERIALIZATION only
} satisfies PropsSchema

// ── the default working color (§2 unset-display: a fresh, untouched control still PAINTS a color) ──────
const DEFAULT_L = 0.62
const DEFAULT_C = 0.12
const DEFAULT_H = 260

export interface UIColorPickerElement extends ReactiveProps<typeof props> {}
export class UIColorPickerElement extends UIFormElement {
  static props = props

  // ── the internal OKLCH working model (NOT reactive props — ephemeral, the adia #L/#C/#H precedent) ──
  #L = DEFAULT_L
  #C = DEFAULT_C
  #H = DEFAULT_H

  // Shell parts, created ONCE (idempotent across disconnect/reconnect — the ui-calendar shell precedent).
  #pad: HTMLElement | null = null
  #padThumb: HTMLElement | null = null
  #canvas: HTMLCanvasElement | null = null
  #hueSlider: UISliderElement | null = null
  #chromaSlider: UISliderElement | null = null
  #lightnessSlider: UISliderElement | null = null
  // Visible per-channel numeral (ADR-0123 cl.8 / SPEC-R8 AC2 — "every channel prints a numeric value, so
  // the control never signifies by hue alone"; a plain composed ui-slider carries no VISIBLE text of its
  // own, only ARIA, so this control adds the printed non-color signifier itself).
  #hueValueEl: HTMLElement | null = null
  #chromaValueEl: HTMLElement | null = null
  #lightnessValueEl: HTMLElement | null = null
  #readoutField: UITextFieldElement | null = null
  #swatch: UISwatchElement | null = null

  // The HTML-authored initial value, captured at FIRST connect (the calendar formReset precedent — `value`
  // reflects, so getAttribute('value') later would read the CURRENT value, not the original).
  #initialValue = ''

  // Readout parse-error state (LLD-C6 — the STANDALONE control reads this directly; it does NOT instantiate
  // the `valueCodec` controller, that is the `type=color` text-field leg's job, LLD-C9). A signal so the
  // base's merged-validity effect (form.ts) re-runs formValidity() when it flips.
  #readoutError = signal(false)

  // The echo-guard: the LAST value this control itself wrote via #commit. Compared by VALUE (not consumed
  // as a one-shot flag) so a same-string re-commit (an Object.is no-op that never re-runs the tracking
  // effect) can never leave a stale "skip reparse" signal that would swallow a LATER genuine external set.
  #lastCommittedValue: string | null = null

  // Canvas paint cache — redraw only on hue change (or resize), never on every chroma/lightness tick
  // (LLD §12 risk: "the thumb moves, the field does not").
  #lastPaintedHue: number | null = null
  #resizeObserver: ResizeObserver | null = null

  // Per-drag baseline (for the pad's OWN pointer-up `change`, distinct from the channel sliders' native
  // blur-based commit — SPEC-R5 AC1: "a drag that returns to its start fires no change"). Captured
  // AFTER the drag's own first jump — see the connected() wiring's doc for why.
  #dragBaselineValue: string | null = null
  #dragJustStarted = false
  #areaRelease: (() => void) | null = null

  #userInvalid: TrackUserInvalidController | null = null
  #warnedBadParse = false
  #fieldLabelText: string | null = null

  // ── form seams (LLD-C6) ─────────────────────────────────────────────────────────────────────

  protected override formValue(): FormValue {
    return this.value !== '' ? this.value : null // SPEC-R9 AC4: unset submits null even though it PAINTS a color
  }

  protected override formValidity(): ValidityResult {
    if (this.required && this.value === '') {
      return { valid: false, flags: { valueMissing: true }, message: 'Please select a color.' }
    }
    if (this.#readoutError.value) {
      return { valid: false, flags: { customError: true }, message: 'Please enter a valid color.' }
    }
    return { valid: true }
  }

  protected override formReset(): void {
    this.value = this.#initialValue
    this.#readoutError.value = false
    this.#userInvalid?.reset()
  }

  protected override formStateRestore(state: File | string | FormData | null): void {
    if (typeof state === 'string') this.value = state
  }

  protected override formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }

  /** The pad is the labelled part (the ui-calendar grid precedent — the host is the form element, the
   *  role/name ride the PART). Merges the field's label text into the pad's own fixed axis description
   *  (string concat — the pad has no stable self-describing id'd node to combine via aria-labelledby, unlike
   *  calendar's title span, so a text merge is the pragmatic mechanism here). */
  protected override applyFieldLabelling(refs: FieldLabelling | null): void {
    const pad = this.#pad
    if (!pad) return
    this.#fieldLabelText = refs?.label?.textContent ?? null
    this.#updatePadAriaLabel()
    if (refs === null) {
      pad.removeAttribute('aria-describedby')
      return
    }
    const described = [refs.description, refs.error].filter((el): el is HTMLElement => el !== null)
    if (described.length > 0) pad.setAttribute('aria-describedby', described.map((el) => el.id).join(' '))
    else pad.removeAttribute('aria-describedby')
  }

  #updatePadAriaLabel(): void {
    const pad = this.#pad
    if (!pad) return
    const axisLabel = 'Chroma and lightness' // F1 ruling = OKLCH vocabulary (an HSV ruling would read "Saturation and value")
    pad.setAttribute('aria-label', this.#fieldLabelText ? `${this.#fieldLabelText}, ${axisLabel}` : axisLabel)
  }

  // ── connection lifecycle ────────────────────────────────────────────────────────────────────

  protected override connected(): void {
    const { pad } = this.#ensureShell()

    if (this.#initialValue === '' && this.getAttribute('value')) {
      this.#initialValue = this.getAttribute('value')!
    }
    // The initial `value` (if any) is seeded into the model by the model→surface effect's first run,
    // below — its first pass always parses (since `#lastCommittedValue` starts null); no separate seed
    // step is needed here (unset stays the default working color, §2).

    // ── user-invalid TIMING controller (ADR-0051 — the calendar/text-field precedent) ──────────
    const invalidController = trackUserInvalid(this, { invalid: () => !this.formValidity().valid })
    this.#userInvalid = invalidController
    this.effect(() => {
      if (invalidController.userInvalid()) this.internals.states?.add('user-invalid')
      else this.internals.states?.delete('user-invalid')
    })

    // ── the pad: area-drag (pointer) + a baseline/pointerup listener for the PAD's own `change`
    // (SPEC-R5 AC1 — distinct from the channels' blur-based commit). The baseline is captured AFTER
    // the drag's OWN first jump (inside onValue, on the first call of a fresh press) — matching the
    // ui-slider precedent exactly: UIRangeElement's #committed baseline is captured on 'focus', which
    // native mousedown default-action ordering fires AFTER pointerdown's own dispatch (so AFTER
    // valueDrag's own onValue jump) — "a drag that returns to its start" means the position the drag
    // ITSELF started from (post-jump), not whatever the control held before the user ever touched it. ──
    this.listen(pad, 'pointerdown', () => { this.#dragJustStarted = true })
    this.listen(pad, 'pointerup', () => {
      if (this.#dragBaselineValue !== null && this.#dragBaselineValue !== this.value) this.emit('change')
      this.#dragBaselineValue = null
    })
    this.#areaRelease = areaDrag(this, {
      area: () => this.#pad,
      onValue: (x, y) => {
        if (this.effectiveDisabled()) return
        this.#C = x * MAX_CHROMA
        this.#L = 1 - y
        this.#commit('input')
        if (this.#dragJustStarted) {
          this.#dragBaselineValue = this.value // the drag's OWN start — after its first jump
          this.#dragJustStarted = false
        }
      },
    })
    this.listen(pad, 'keydown', (event) => { this.#handlePadKey(event as KeyboardEvent) })

    // ── channel sliders — the EVENT-BOUNDARY GUARD (the ADR-0048 calendar precedent): stop each
    // composed slider's OWN input/change from bubbling out of ui-color-picker (it would otherwise
    // double-emit alongside the picker's own explicit emit below), then drive the model + re-emit
    // the picker's OWN input/change. ─────────────────────────────────────────────────────────────
    const hue = this.#hueSlider!
    const chroma = this.#chromaSlider!
    const lightness = this.#lightnessSlider!

    this.listen(hue, 'input', (e) => { e.stopPropagation(); this.#H = hue.value ?? 0; this.#commit('input') })
    this.listen(hue, 'change', (e) => { e.stopPropagation(); this.#commit('change') })
    this.listen(chroma, 'input', (e) => { e.stopPropagation(); this.#C = chroma.value ?? 0; this.#commit('input') })
    this.listen(chroma, 'change', (e) => { e.stopPropagation(); this.#commit('change') })
    this.listen(lightness, 'input', (e) => { e.stopPropagation(); this.#L = lightness.value ?? 0; this.#commit('input') })
    this.listen(lightness, 'change', (e) => { e.stopPropagation(); this.#commit('change') })

    // ── readout — boundary guard (attached directly to the field, the calendar-in-text-field precedent);
    // only `change` (blur/Enter commit) parses through colorCodecOptions ──────────────────────────────
    const readoutField = this.#readoutField!
    this.listen(readoutField, 'input', (e) => { e.stopPropagation() })
    this.listen(readoutField, 'change', (e) => {
      e.stopPropagation()
      this.#commitReadout(readoutField.value)
    })

    // ── model → surface: parse EXTERNAL value/format changes into the model (the echo-guard skips
    // re-parsing a write this control JUST made itself — see #lastCommittedValue's own doc), then
    // NORMALIZE `value` to the current model+format (SPEC-R2 AC2 — a format switch alone re-serializes;
    // SPEC-R3 — value ALWAYS reads through `format`, whatever syntax it was last written in) — a plain
    // re-entrant prop write, NEVER an event (the UIRangeElement normalizer-effect precedent, range-
    // element.ts: "if (!Object.is(normalized, raw)) this.value = normalized", the same self-write-inside-
    // its-own-effect pattern, converging in one extra pass since the 2nd run's value then equals
    // #lastCommittedValue). Always repaints every composed part last. ────────────────────────────────
    this.effect(() => {
      const value = this.value
      const format = this.format
      if (value === '') {
        // unset — nothing to parse or normalize; keep painting the current (default/last-set) color (§2)
      } else if (value === this.#lastCommittedValue) {
        // our own echo — the model is already authoritative, skip reparse (precision guard, LLD-C2)
      } else {
        const parsed = parseColor(value)
        if (parsed) { this.#L = parsed.L; this.#C = parsed.C; this.#H = parsed.H }
        else this.#warnOnce(value) // SPEC-R3 AC4 — leave the prior model intact, no throw
      }
      if (value !== '') {
        const normalized = serializeColor({ L: this.#L, C: this.#C, H: this.#H }, format)
        if (normalized !== this.value) {
          this.#lastCommittedValue = normalized
          this.value = normalized
        }
      }
      this.#paint()
    })

    // ── disabled channel — forward effectiveDisabled() onto every composed child (each is an
    // independent custom element with its OWN `disabled` prop, defaulting false regardless of the
    // picker's own state) + the pad's tabindex (out of the tab order while disabled, ADR-0010). ──────
    this.effect(() => {
      const dis = this.effectiveDisabled()
      hue.disabled = dis
      chroma.disabled = dis
      lightness.disabled = dis
      if (this.#readoutField) this.#readoutField.disabled = dis
      pad.setAttribute('tabindex', dis ? '-1' : '0')
    })

    // ResizeObserver — redraw the pad canvas on resize (feature-detected; jsdom lacks it — LLD §12).
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver(() => { this.#lastPaintedHue = null; this.#drawPad() })
      this.#resizeObserver.observe(pad)
    }
  }

  protected override disconnected(): void {
    this.#userInvalid?.release()
    this.#userInvalid = null
    this.#areaRelease?.()
    this.#areaRelease = null
    this.#resizeObserver?.disconnect()
    this.#resizeObserver = null
  }

  // ── shell creation (idempotent — SPEC-R1 AC2) ───────────────────────────────────────────────

  #ensureShell(): { pad: HTMLElement; readout: HTMLElement } {
    if (this.#pad && this.#hueSlider && this.#chromaSlider && this.#lightnessSlider && this.#readoutField && this.#swatch) {
      return { pad: this.#pad, readout: this.#readoutField.parentElement as HTMLElement }
    }

    // ── the pad ([data-part=pad]) — the 2-axis chroma×lightness area (F1 sub-fork: canvas paint) ────
    const pad = document.createElement('div')
    pad.setAttribute('data-part', 'pad')
    pad.setAttribute('tabindex', '0')
    pad.setAttribute('role', 'slider')
    pad.setAttribute('aria-roledescription', '2D slider')
    pad.style.touchAction = 'none'

    const canvas = document.createElement('canvas')
    canvas.setAttribute('data-part', 'pad-canvas')
    pad.appendChild(canvas)
    this.#canvas = canvas

    const thumb = document.createElement('div')
    thumb.setAttribute('data-part', 'pad-thumb')
    pad.appendChild(thumb)
    this.#padThumb = thumb

    this.appendChild(pad)
    this.#pad = pad
    this.#updatePadAriaLabel()

    // ── channels ([data-part=channels]) — hue always; chroma + lightness mirrored (SPEC-R6 spine).
    // Each channel is a labeled row: a text label, the composed ui-slider, and a printed numeral
    // (ADR-0123 cl.8 — a plain ui-slider carries no visible text of its own, only ARIA; this control
    // adds the printed non-color signifier itself, SPEC-R8 AC2). ──────────────────────────────────
    const channels = document.createElement('div')
    channels.setAttribute('data-part', 'channels')

    const { row: hueRow, slider: hueSlider, valueEl: hueValueEl } = this.#makeChannelRow('Hue', 'hue')
    hueSlider.min = 0
    hueSlider.max = 360
    hueSlider.step = 1
    channels.appendChild(hueRow)
    this.#hueSlider = hueSlider
    this.#hueValueEl = hueValueEl

    const { row: chromaRow, slider: chromaSlider, valueEl: chromaValueEl } = this.#makeChannelRow('Chroma', 'chroma')
    chromaSlider.min = 0
    chromaSlider.max = MAX_CHROMA
    chromaSlider.step = 0.001
    channels.appendChild(chromaRow)
    this.#chromaSlider = chromaSlider
    this.#chromaValueEl = chromaValueEl

    const { row: lightnessRow, slider: lightnessSlider, valueEl: lightnessValueEl } = this.#makeChannelRow('Lightness', 'lightness')
    lightnessSlider.min = 0
    lightnessSlider.max = 1
    lightnessSlider.step = 0.001
    channels.appendChild(lightnessRow)
    this.#lightnessSlider = lightnessSlider
    this.#lightnessValueEl = lightnessValueEl

    this.appendChild(channels)

    // ── readout ([data-part=readout]) — editable ui-text-field + composed ui-swatch preview ─────────
    const readout = document.createElement('div')
    readout.setAttribute('data-part', 'readout')

    const readoutField = document.createElement('ui-text-field') as UITextFieldElement
    readoutField.label = 'Color value'
    readout.appendChild(readoutField)
    this.#readoutField = readoutField

    const swatch = document.createElement('ui-swatch') as UISwatchElement
    swatch.label = 'Selected color'
    readout.appendChild(swatch)
    this.#swatch = swatch

    // ── EyeDropper (SPEC-R13/F7) — feature-detected progressive enhancement, no polyfill, no layout
    // hole where absent. No dedicated icon asset exists in @agent-ui/icons for this glyph (the pack
    // carries a small hand-curated set) — a plain text-labeled button avoids inventing a new icon
    // outside this control's scope (a judgment call, flagged in the handoff). ─────────────────────
    if ('EyeDropper' in window) {
      const eyedropperBtn = document.createElement('button')
      eyedropperBtn.type = 'button'
      eyedropperBtn.setAttribute('data-part', 'eyedropper')
      eyedropperBtn.setAttribute('aria-label', 'Pick color from screen')
      eyedropperBtn.textContent = 'Pick'
      eyedropperBtn.addEventListener('click', () => { this.#openEyedropper() })
      readout.appendChild(eyedropperBtn)
    }

    this.appendChild(readout)

    return { pad, readout }
  }

  /** Build one labeled channel row: a text label, a composed `<ui-slider>`, and a printed numeral span
   *  (ADR-0123 cl.8 non-color signifier — see the field doc above `#hueValueEl`). */
  #makeChannelRow(label: string, channel: string): { row: HTMLElement; slider: UISliderElement; valueEl: HTMLElement } {
    const row = document.createElement('div')
    row.setAttribute('data-part', 'channel-row')
    row.setAttribute('data-channel', channel)

    const labelEl = document.createElement('span')
    labelEl.setAttribute('data-part', 'channel-label')
    labelEl.textContent = label
    row.appendChild(labelEl)

    const slider = document.createElement('ui-slider') as UISliderElement
    slider.setAttribute('data-channel', channel)
    slider.setAttribute('aria-label', label)
    row.appendChild(slider)

    const valueEl = document.createElement('span')
    valueEl.setAttribute('data-part', 'channel-value')
    row.appendChild(valueEl)

    return { row, slider, valueEl }
  }

  // ── model → surface paint (LLD-C2) ──────────────────────────────────────────────────────────

  #paint(): void {
    const pad = this.#pad
    const thumb = this.#padThumb
    if (pad && thumb) {
      const xPct = (this.#C / MAX_CHROMA) * 100
      const yPct = (1 - this.#L) * 100
      thumb.style.left = `${xPct}%`
      thumb.style.top = `${yPct}%`
      pad.setAttribute('aria-valuetext', `Chroma ${this.#C.toFixed(2)}, Lightness ${this.#L.toFixed(2)}`)
      if (this.#lastPaintedHue !== this.#H) {
        this.#lastPaintedHue = this.#H
        this.#drawPad()
      }
    }
    if (this.#hueSlider) this.#hueSlider.value = Math.round(this.#H)
    if (this.#chromaSlider) this.#chromaSlider.value = Number(this.#C.toFixed(3))
    if (this.#lightnessSlider) this.#lightnessSlider.value = Number(this.#L.toFixed(3))
    if (this.#hueValueEl) this.#hueValueEl.textContent = String(Math.round(this.#H))
    if (this.#chromaValueEl) this.#chromaValueEl.textContent = this.#C.toFixed(3)
    if (this.#lightnessValueEl) this.#lightnessValueEl.textContent = this.#L.toFixed(2)
    if (this.#readoutField) this.#readoutField.value = this.value
    if (this.#swatch) this.#swatch.value = this.value
  }

  /** Per-pixel OKLCH→sRGB canvas paint of the chroma(X)×lightness(Y) plane at the current hue (the adia
   *  `#drawArea` mechanism, promoted). DPR-capped `min(dpr,2)*0.5`. A no-op under jsdom — `getContext('2d')`
   *  returns null there (no canvas polyfill installed); the canvas pixels are NOT the test contract
   *  (LLD §11 — the browser leg asserts thumb position + emitted value, never the raster). */
  #drawPad(): void {
    const canvas = this.#canvas
    const pad = this.#pad
    if (!canvas || !pad) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * 0.5
    const w = Math.round(pad.clientWidth * dpr)
    const h = Math.round(pad.clientHeight * dpr)
    if (w <= 0 || h <= 0) return
    canvas.width = w
    canvas.height = h
    const img = ctx.createImageData(w, h)
    const data = img.data
    const hue = this.#H
    for (let y = 0; y < h; y++) {
      const L = h <= 1 ? 1 : 1 - y / (h - 1)
      for (let x = 0; x < w; x++) {
        const C = w <= 1 ? 0 : (x / (w - 1)) * MAX_CHROMA
        const mappedC = gamutMapChroma(L, C, hue)
        const [r, g, b] = oklchToRgb(L, mappedC, hue)
        const i = (y * w + x) * 4
        data[i] = Math.round(r * 255)
        data[i + 1] = Math.round(g * 255)
        data[i + 2] = Math.round(b * 255)
        data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  // ── commit choke point (LLD-C2) ─────────────────────────────────────────────────────────────

  #commit(kind: 'input' | 'change'): void {
    const serialized = serializeColor({ L: this.#L, C: this.#C, H: this.#H }, this.format)
    this.#lastCommittedValue = serialized
    this.value = serialized
    // LLD-C6: cleared on a successful parse OR a pad/channel commit — a pad drag or channel step after a
    // stuck-invalid readout entry must clear the customError, not leave the control invalid forever.
    this.#readoutError.value = false
    this.#paint()
    this.emit(kind)
  }

  /** The readout's committed (blur/Enter) entry — parses through `colorCodecOptions(format)` (LLD-C6: the
   *  standalone control does NOT instantiate the `valueCodec` controller; validity reads `#readoutError`
   *  directly). An unparseable entry surfaces `customError` and fires no `change` (SPEC-R5 AC2). */
  #commitReadout(raw: string): void {
    const codec = colorCodecOptions(this.format)
    const serialized = codec.parse(raw)
    if (serialized === null) {
      this.#readoutError.value = true
      return
    }
    this.#readoutError.value = false
    const oklch = parseColor(serialized) // always parseable — it is the codec's own output
    if (oklch) { this.#L = oklch.L; this.#C = oklch.C; this.#H = oklch.H }
    this.#commit('change')
  }

  // ── the pad's 2-axis keyboard (LLD-C5, SPEC-R7) ─────────────────────────────────────────────

  #handlePadKey(event: KeyboardEvent): void {
    if (this.effectiveDisabled()) return
    const key = event.key
    const NAV = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])
    if (!NAV.has(key)) return
    event.preventDefault() // suppresses scroll + (in the overlay leg) anchor re-activation — ADR-0045/0048

    const coarse = event.shiftKey
    const cStep = coarse ? 0.04 : 0.004 // the adia keyboard-step constants, promoted
    const lStep = coarse ? 0.05 : 0.01

    switch (key) {
      case 'ArrowRight': this.#C = Math.min(MAX_CHROMA, this.#C + cStep); break
      case 'ArrowLeft': this.#C = Math.max(0, this.#C - cStep); break
      case 'ArrowUp': this.#L = Math.min(1, this.#L + lStep); break
      case 'ArrowDown': this.#L = Math.max(0, this.#L - lStep); break
      case 'Home': this.#C = 0; break
      case 'End': this.#C = MAX_CHROMA; break
      case 'PageUp': this.#L = 1; break
      case 'PageDown': this.#L = 0; break
      default: return
    }

    // SPEC-R7 AC2 — each key-step fires BOTH input and change (an atomic committed step, unlike the
    // continuous pointer-drag gesture which streams input and commits change once on pointer-up).
    this.#commit('input')
    this.#commit('change')
  }

  /** The EyeDropper affordance's click handler (SPEC-R13) — opens the OS picker; a resolved sample commits
   *  through the model (`change`). Never a hard dependency: only wired when `'EyeDropper' in window`. */
  #openEyedropper(): void {
    const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropperCtor) return
    const instance = new EyeDropperCtor()
    instance.open().then((result) => {
      const parsed = parseColor(result.sRGBHex)
      if (parsed) {
        this.#L = parsed.L
        this.#C = parsed.C
        this.#H = parsed.H
        this.#commit('change')
      }
    }).catch(() => { /* user cancelled the OS picker — no-op */ })
  }

  /** A once-per-element dev warning for an unparseable EXTERNAL `value` set (SPEC-R3 AC4) — the model is
   *  left intact, no throw. */
  #warnOnce(raw: string): void {
    if (this.#warnedBadParse) return
    this.#warnedBadParse = true
    console.warn(`<ui-color-picker>: could not parse value=${JSON.stringify(raw)}. Expected #rrggbb/#rgb or oklch(L C H). Keeping the prior color.`)
  }
}

if (!customElements.get('ui-color-picker')) customElements.define('ui-color-picker', UIColorPickerElement)

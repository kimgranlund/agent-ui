// text-field.ts — UITextFieldElement, the first FACE form-associated control (goals.md §G6 / ADR-0014).
// BEHAVIOUR + props + the contenteditable editor part + self-define ONLY; geometry/colour live in
// text-field.css (s6), the public contract in text-field.md (s7).
//
// Editable surface — a stable contenteditable editor PART (ADR-0014 cl.1): a control-created light-DOM
// `<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="false">`, appended
// ONCE (an idempotent guard) and NEVER re-rendered — `render()` stays the inherited void, so the text-field
// has no `html\`\``/G3 dependency (re-committing a contenteditable subtree under the caret would destroy the
// selection on every keystroke). `value`↔surface is two scope-owned wires: surface→model (an editor `input`
// listener → `this.value` + a host `input`) and model→surface (an effect writing `editor.textContent` ONLY
// when the model diverges — the CARET GUARD: equal ⇒ skip), both suppressed during IME composition.
//
// The HOST carries no `role`/`aria-*` attribute — form semantics ride `internals` (the FACE pattern, ADR-0013)
// and the editor PART carries `role=textbox`. ARIA + the custom states are set THROUGH the protected
// `internals` (a trait cannot reach it). Disabled rides the editor + the platform form-disabled channel
// (`effectiveDisabled = own || form`, ADR-0014 dev#b), NOT host `ariaDisabled`; `readonly` is editable=false
// but focusable (still submits). `user-invalid` timing comes from the `trackUserInvalid` controller (the
// danger treatment surfaces only after the first blur/change), reinforced by a non-colour `aria-describedby`
// message node (WCAG 1.4.1, ADR-0014 cl.4). `controls → dom + traits` is the allowed import direction.
//
// Wave 3 growth (ADR-0044): a `type` prop (8 variants, reflected) drives a static type-resolver (TYPE_CONFIG,
// an as-const map — erasableSyntaxOnly: no enum) that maps type → inputmode + auto-adornments + codec +
// validation. type='text' resolves to the identity config — no adornments, no codec, no extra validation —
// preserving byte-identical behaviour with the shipped text-field. Number/currency types use the valueCodec
// trait (traits/value-codec.ts) for the display↔canonical split (formValue() returns canonical, not display).
//
// Wave 5A growth (ADR-0047): TYPE_CONFIG v2 — splits the single `trailing` role into
// `{ leading, suffix, affordance, codec }`. NEW types `unit` and `percent`. Multi-currency fraction digits,
// generalized steppers with `step`/`min`/`max`, suffix spans, ArrowUp/Down stepping, and range validity
// (rangeUnderflow/rangeOverflow). type='text' stays byte-identical.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIFormElement, type FormValue, type ValidityResult } from '../../dom/form.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'
import {
  valueCodec,
  numberCodecOptions,
  currencyCodecOptions,
  unitCodecOptions,
  currencySymbol,
  unitLabel,
  type ValueCodecController,
} from '../../traits/value-codec.ts'

// The editor's editable mode (ADR-0014 cl.1) and a per-instance id seed for aria-describedby.
const EDITABLE = 'plaintext-only'
let messageSeq = 0

// ── email / URL validation patterns ──────────────────────────────────────────

// A practical email pattern (RFC 5321 simple form): local@domain.tld — no embedded whitespace or @.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── type-resolver v2 (TYPE_CONFIG, Wave 5A ADR-0047 — the static as-const config map) ──────────────
//
// The single `trailing` role from v1 is split into independent facets so `unit`/`percent` can carry a
// suffix TEXT label AND steppers in the same trailing cell. Key invariants:
//   • A non-null `codec` IMPLIES steppers (all numeric types are steppable — ADR-0047).
//   • `affordance` (exclusive interactive button) NEVER coexists with steppers.
//   • `suffix` is the trailing text label ('percent' → '%', 'unit' → this.unit via unitLabel()).
//   • `percent` reuses codec='number' — its canonical is the TYPED number ("50", not ÷100).

type LeadingRole = 'magnifier' | 'currency'
type SuffixKind = 'percent' | 'unit'
type AffordanceRole = 'clear' | 'reveal'
type ValidationType = 'email' | 'url' | 'number'
type CodecKind = 'number' | 'currency' | 'unit'

interface TypeConfig {
  readonly inputmode: string
  readonly leading: LeadingRole | null
  readonly suffix: SuffixKind | null       // trailing text label ('percent'=static '%', 'unit'=dynamic this.unit)
  readonly affordance: AffordanceRole | null  // exclusive interactive trailing button (never with steppers)
  readonly validation: ValidationType | null
  readonly codec: CodecKind | null           // non-null ⇒ steppers present
}

const TYPE_CONFIG = {
  //            inputmode    leading        suffix       affordance    validation   codec
  text:     { inputmode: 'text',    leading: null,        suffix: null,      affordance: null,     validation: null,     codec: null       },
  email:    { inputmode: 'email',   leading: null,        suffix: null,      affordance: null,     validation: 'email',  codec: null       },
  url:      { inputmode: 'url',     leading: null,        suffix: null,      affordance: null,     validation: 'url',    codec: null       },
  tel:      { inputmode: 'tel',     leading: null,        suffix: null,      affordance: null,     validation: null,     codec: null       },
  search:   { inputmode: 'search',  leading: 'magnifier', suffix: null,      affordance: 'clear',  validation: null,     codec: null       },
  password: { inputmode: 'text',    leading: null,        suffix: null,      affordance: 'reveal',  validation: null,     codec: null       },
  number:   { inputmode: 'numeric', leading: null,        suffix: null,      affordance: null,     validation: 'number', codec: 'number'   },
  currency: { inputmode: 'decimal', leading: 'currency',  suffix: null,      affordance: null,     validation: 'number', codec: 'currency' },
  unit:     { inputmode: 'decimal', leading: null,        suffix: 'unit',    affordance: null,     validation: 'number', codec: 'unit'     },
  percent:  { inputmode: 'decimal', leading: null,        suffix: 'percent', affordance: null,     validation: 'number', codec: 'number'   },
} as const satisfies Record<string, TypeConfig>

// ── props ─────────────────────────────────────────────────────────────────────

const props = {
  // The universal form attributes (name / disabled(reflect) / required(reflect)) are SPREAD, not inherited —
  // props.ts has no static-props prototype merge, so UIFormElement exposes them as a spreadable bag (ADR-0013).
  ...UIFormElement.formProps,
  // `value` is OBSERVED (its initial attribute seeds the reset baseline) but NOT reflected — the live value
  // rides the editor surface, never a host attribute.
  value: prop.string(),
  label: prop.string(), // → the editor's aria-label (the labelling SEAM; the visible wrapper is ui-field at G7)
  placeholder: prop.string(), // shown via [data-empty]::before { content: attr(data-placeholder) } when empty
  // size/readonly reflect so the [size] dimensional-ramp repoint + the [readonly]/[disabled] CSS hooks apply
  // to JS-set values too, not only author-set attributes.
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
  // type reflects so [type] CSS selectors (e.g. [type=password] for masking) and the type-resolver apply
  // to JS-set values; 'text' is the identity config (byte-identical to the pre-Wave-3 shipped control).
  type: { ...prop.enum(['text', 'email', 'url', 'tel', 'password', 'search', 'number', 'currency', 'unit', 'percent'] as const, 'text'), reflect: true },
  readonly: { ...prop.boolean(false), reflect: true },
  // Wave 5A — the five new numeric-type props (ADR-0047). All reflected for native attribute-IDL parity.
  // Reading this.currency / this.unit inside the type-effect's currency/unit branch makes the effect reactive
  // ONLY for currency/unit types — a plain field never reads them, never re-runs (the kernel's tracking law).
  currency: { ...prop.string('USD'), reflect: true }, // ISO 4217; drives leading symbol + codec fraction digits
  unit: { ...prop.string(''), reflect: true },         // CLDR unit id → localized short label (type=unit)
  step: { ...prop.number(1), reflect: true },          // stepper/Arrow increment; null (unset attr) → 1
  min: { ...prop.string(''), reflect: true },          // '' = unconstrained; numeric → rangeUnderflow guard
  max: { ...prop.string(''), reflect: true },          // '' = unconstrained; numeric → rangeOverflow guard
} satisfies PropsSchema

export interface UITextFieldElement extends ReactiveProps<typeof props> {}
export class UITextFieldElement extends UIFormElement {
  static props = props

  // The stable contenteditable editor PART + the aria-describedby message node. Light-DOM children, so they
  // persist across disconnect/reconnect — created ONCE and never re-appended (the idempotent guard below).
  #editor: HTMLElement | null = null
  #message: HTMLElement | null = null

  // The native-parity reset baseline — seeded ONCE from the initial `value` attribute (native `defaultValue`).
  #defaultValue = ''
  #defaultCaptured = false

  // The `change`-on-commit baseline (value at the last focus/commit) + the IME-composition guard.
  #committed = ''
  #composing = false

  // The user-invalid TIMING controller, created per connection (re-arms on reconnect; released on disconnect).
  #userInvalid: TrackUserInvalidController | null = null

  // The active value-codec controller for number/currency/unit/percent types. Null for all other types.
  // formValue() returns codec.canonical.value when set; formValidity() checks codec.hasError.
  #codec: ValueCodecController | null = null

  // Password reveal state: tracks whether -webkit-text-security is suppressed.
  // Drives :state(revealed) on internals and aria-pressed on the reveal button.
  #revealed = false

  protected connected(): void {
    // Seed the reset baseline ONCE from the INITIAL `value` attribute (native `defaultValue` — the value
    // attribute is never reflected, so it stays the markup value and survives later property writes).
    if (!this.#defaultCaptured) {
      this.#defaultValue = this.getAttribute('value') ?? ''
      this.#defaultCaptured = true
    }

    const editor = this.#ensureParts()
    const message = this.#message as HTMLElement

    // ── surface → model (ADR-0014 cl.1) — the editor's edits flow into `value`, IME-guarded ──
    this.listen(editor, 'input', (event) => {
      if (this.#composing) return // never mid-composition — compositionend commits the final composed text
      event.stopPropagation() // suppress the raw editor input; the host re-emits ONE composed `input` (target = host)
      this.value = editor.textContent ?? '' // model ← surface (the caret guard below then skips the echo write)
      this.emit('input')
    })
    this.listen(editor, 'compositionstart', () => {
      this.#composing = true
    })
    this.listen(editor, 'compositionend', () => {
      this.#composing = false
      this.value = editor.textContent ?? '' // catch the model up to the composed result (the suppressed inputs)
    })

    // ── change on commit — blur-with-change or Enter (the value-at-focus baseline gates the blur) ──
    this.listen(editor, 'focus', () => {
      this.#committed = this.value
    })
    this.listen(editor, 'blur', () => {
      if (this.value === this.#committed) return
      this.#committed = this.value
      this.emit('change')
    })
    this.listen(editor, 'keydown', (event) => {
      const key = (event as KeyboardEvent).key
      if (key === 'Enter') {
        if (this.#composing) return
        event.preventDefault() // single-line field — Enter never inserts a newline
        this.#committed = this.value
        this.emit('change') // Enter commits (resets the baseline, so a following blur does not double-fire)
        return
      }
      // ArrowUp/Down: step the numeric value when a codec is active (native type=number parity).
      // Never mid-composition; preventDefault prevents cursor movement / page scroll during stepping.
      if ((key === 'ArrowUp' || key === 'ArrowDown') && this.#codec !== null && !this.#composing) {
        event.preventDefault()
        this.#step(key === 'ArrowUp' ? 1 : -1)
      }
    })

    // ── the user-invalid TIMING controller — gates the danger treatment until the first blur/change ──
    const controller = trackUserInvalid(this, { invalid: () => !this.formValidity().valid })
    this.#userInvalid = controller

    // ── type-dependent behavior: inputmode + auto-adornments + codec + validation (Wave 3/5A) ──
    // The effect re-runs when this.type changes, running the cleanup from the previous run first.
    // type='text' is the identity config (no adornments, no codec). Wave 5A: reading this.currency
    // inside the currency branch / this.unit inside the unit branch makes the effect reactive to
    // those props ONLY for the matching types — a plain field never reads them (kernel tracking law).
    this.effect((): (() => void) => {
      const type = this.type
      const config = TYPE_CONFIG[type]

      // inputmode: virtual-keyboard hint (omit for 'text' to stay byte-identical to the pre-Wave-3 editor).
      if (config.inputmode !== 'text') {
        editor.setAttribute('inputmode', config.inputmode)
      } else {
        editor.removeAttribute('inputmode')
      }

      // Per-type AbortController: adornment-button click listeners live for one type config lifetime
      // (aborted in the effect cleanup on type change or scope.dispose() on disconnect).
      const typeAc = new AbortController()

      // Leading adornment: magnifier glyph for search, currency symbol for currency.
      // For currency: reading this.currency makes the effect re-run when currency changes (only while
      // type=currency — a non-currency field never reads this.currency, so it never becomes a dep).
      let leadingText = ''
      if (config.leading === 'magnifier') {
        leadingText = '⌕'
      } else if (config.leading === 'currency') {
        leadingText = currencySymbol(this.currency ?? 'USD')
      }
      const leadingEl = config.leading ? this.#createLeadingAdornment(config.leading, leadingText) : null

      // Trailing adornment: affordance (search/password) XOR numeric (steppers ± suffix).
      // These two never coexist — the TYPE_CONFIG invariant (ADR-0047).
      let trailingEl: HTMLElement | null = null
      if (config.affordance !== null) {
        // Exclusive interactive button (clear / reveal) — no steppers alongside.
        trailingEl = this.#createAffordanceAdornment(config.affordance, typeAc.signal)
      } else if (config.codec !== null) {
        // Steppers, optionally with a suffix span.
        // For unit: reading this.unit makes the effect re-run when unit changes (only while type=unit).
        const suffixText =
          config.suffix === 'percent'
            ? '%'
            : config.suffix === 'unit'
              ? unitLabel(this.unit ?? '')
              : null
        trailingEl = this.#createNumericAdornment(suffixText, typeAc.signal)
      }

      // Codec: number/currency/unit get the display↔canonical split (formValue + formValidity check it).
      // percent reuses numberCodecOptions (canonical = the typed number, not ÷100 — ADR-0047).
      // typeAc.signal is passed so the codec's focus/blur listeners die on the NEXT type change, not just
      // on disconnect — closing the M1 listener-accumulation gap without needing the released=true guard
      // (which masked but did not fix the root cause). Wave 5B date/time codecs reuse this same seam.
      const codec: ValueCodecController | null =
        config.codec === 'number'
          ? valueCodec(this, numberCodecOptions(), typeAc.signal)
          : config.codec === 'currency'
            ? valueCodec(this, currencyCodecOptions(this.currency ?? 'USD'), typeAc.signal)
            : config.codec === 'unit'
              ? valueCodec(this, unitCodecOptions(this.unit ?? ''), typeAc.signal)
              : null
      this.#codec = codec

      // Clear reveal state on type change so switching away from 'password' doesn't leave ghost state.
      if (type !== 'password') {
        this.#revealed = false
        this.internals.states?.delete('revealed')
      }

      // Effect cleanup: runs before the next type-change run AND on scope.dispose() (disconnect).
      return (): void => {
        typeAc.abort() // removes adornment-button listeners registered with typeAc.signal
        leadingEl?.remove()
        trailingEl?.remove()
        codec?.release()
        this.#codec = null
      }
    })

    // ── model → surface (ADR-0014 cl.1: the CARET GUARD) + the placeholder presence flag ──
    this.effect(() => {
      const value = this.value // tracked — re-runs on every value change (typed OR programmatic/reset/restore)
      if (this.#composing) return // never write mid-composition
      // CARET GUARD: rewrite the editor ONLY when the model diverges from the surface, so a keystroke (which
      // already updated textContent) never resets the caret; a programmatic write/reset/restore DOES flow.
      if (editor.textContent !== value) editor.textContent = value
      editor.toggleAttribute('data-empty', value === '') // keys the CSS placeholder (not :empty — see ADR cl.1)
    })

    // ── editor attribute mirror — the label seam, the placeholder text, the required mirror ──
    this.effect(() => {
      if (this.label) editor.setAttribute('aria-label', this.label)
      else editor.removeAttribute('aria-label')
      editor.setAttribute('data-placeholder', this.placeholder) // the CSS placeholder reads attr(data-placeholder)
      if (this.required) editor.setAttribute('aria-required', 'true')
      else editor.removeAttribute('aria-required')
    })

    // ── the disabled / readonly channel (ADR-0014 dev#b) — effectiveDisabled = own || form-disabled ──
    this.effect(() => {
      if (this.effectiveDisabled()) {
        editor.setAttribute('contenteditable', 'false')
        editor.removeAttribute('tabindex') // not focusable (out of the tab order, like <input disabled>)
        editor.setAttribute('aria-disabled', 'true')
        editor.removeAttribute('aria-readonly')
        this.internals.states?.add('disabled') // the :state(disabled) CSS hook (NOT host ariaDisabled)
      } else if (this.readonly) {
        editor.setAttribute('contenteditable', 'false') // not editable …
        editor.setAttribute('tabindex', '0') // … but still focusable / selectable (and still submits)
        editor.removeAttribute('aria-disabled')
        editor.setAttribute('aria-readonly', 'true')
        this.internals.states?.delete('disabled')
      } else {
        editor.setAttribute('contenteditable', EDITABLE) // editable; a contenteditable region is intrinsically focusable
        editor.removeAttribute('tabindex')
        editor.removeAttribute('aria-disabled')
        editor.removeAttribute('aria-readonly')
        this.internals.states?.delete('disabled')
      }
    })

    // ── user-invalid → aria-invalid + the non-colour message cue + :state(user-invalid) (ADR-0014 cl.2c/4) ──
    // ADR-0029 A1 (user-ratified): when carrying a message the message node is VISIBLE — `message.hidden`
    // toggled false (dangerous treatment: --c-danger ink, small type, gated by :state(user-invalid) in CSS).
    // The `aria-describedby` wiring is unchanged; making the node visible is an extension only.
    this.effect(() => {
      if (controller.userInvalid()) {
        // userInvalid ⇒ invalid, so formValidity() is the invalid branch carrying the message + flags.
        const verdict = this.formValidity()
        const text = verdict.valid ? '' : verdict.message // the WCAG 1.4.1 non-colour reinforcement
        editor.setAttribute('aria-invalid', 'true')
        editor.setAttribute('aria-describedby', message.id)
        message.textContent = text
        message.hidden = text === '' // visible when there is a message (ADR-0029 A1)
        this.internals.states?.add('user-invalid')
      } else {
        editor.removeAttribute('aria-invalid')
        editor.removeAttribute('aria-describedby')
        message.textContent = ''
        message.hidden = true // no message → out of flow
        this.internals.states?.delete('user-invalid')
      }
    })

    // Motion gate (interaction-states standard) — arm `ready` ONE frame past first paint so the upgrade/first
    // paint SNAPS and only subsequent state changes animate (the text-field.css transition is gated behind
    // :state(ready)). `states` optional-chained — jsdom has no CustomStateSet (the real motion is the s11 smoke).
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  protected disconnected(): void {
    this.#userInvalid?.release() // idempotent — the controller's listeners already die with the connection scope
    this.#userInvalid = null
    // #codec is released + nulled by the type-effect's cleanup (which fires on scope.dispose()); explicit
    // null here is defensive for any code that reads #codec after disconnect.
    this.#codec = null
  }

  /** Forward host focus to the editor PART (label-association + native `.focus()` parity). */
  override focus(options?: FocusOptions): void {
    if (this.#editor) this.#editor.focus(options)
    else super.focus(options)
  }

  // ── form hooks (overrides of the UIFormElement seams) ─────────────────────────

  /**
   * The value contributed to the owning form (FACE — the base publishes it via internals.setFormValue).
   * When a value codec is active (number/currency/unit/percent types), the CANONICAL parsed value is the
   * form value, not `this.value` which holds the formatted display string after blur. For all other types,
   * `this.value` IS the form value (the editor textContent is the submission value).
   */
  protected formValue(): FormValue {
    return this.#codec?.canonical.value ?? this.value
  }

  /**
   * The validity verdict: `required && value === ''` → `valueMissing`; codec parse error → `customError`;
   * range check (min/max) → `rangeUnderflow`/`rangeOverflow`; email/url type mismatch → `typeMismatch`;
   * valid otherwise. A disabled field is barred from constraint validation (native parity).
   * `stepMismatch` is NOT enforced — too strict for free numeric entry (ADR-0047).
   */
  protected formValidity(): ValidityResult {
    if (this.effectiveDisabled()) return { valid: true }

    // valueMissing: required + empty (gated on this.value, the display; an empty field is empty in all types).
    if (this.required && this.value === '') {
      return {
        valid: false,
        flags: { valueMissing: true },
        message: 'Please fill out this field.',
        anchor: this.#editor ?? undefined,
      }
    }

    // Codec parse error (number/currency/unit/percent): hasError is set by the valueCodec controller on blur.
    if (this.#codec?.hasError.value) {
      return {
        valid: false,
        flags: { customError: true },
        message: this.#codec.errorMessage,
        anchor: this.#editor ?? undefined,
      }
    }

    // Type-specific validation (non-empty values only — empty passes to avoid double-reporting).
    const v = this.value
    if (v !== '') {
      // Range validity for numeric types (ADR-0047): rangeUnderflow / rangeOverflow from min/max.
      // Checked against the codec's canonical (the last successfully parsed value — updated on blur).
      // stepMismatch is NOT enforced (recorded in ADR-0047 — too strict for free numeric entry).
      if (this.#codec !== null) {
        const canonical = this.#codec.canonical.value
        if (canonical !== '') {
          const numVal = parseFloat(canonical)
          if (Number.isFinite(numVal)) {
            if (this.min !== '') {
              const minNum = parseFloat(this.min)
              if (Number.isFinite(minNum) && numVal < minNum) {
                return {
                  valid: false,
                  flags: { rangeUnderflow: true },
                  message: `Value must be greater than or equal to ${minNum}.`,
                  anchor: this.#editor ?? undefined,
                }
              }
            }
            if (this.max !== '') {
              const maxNum = parseFloat(this.max)
              if (Number.isFinite(maxNum) && numVal > maxNum) {
                return {
                  valid: false,
                  flags: { rangeOverflow: true },
                  message: `Value must be less than or equal to ${maxNum}.`,
                  anchor: this.#editor ?? undefined,
                }
              }
            }
          }
        }
      }

      const type = this.type
      if (type === 'email' && !EMAIL_PATTERN.test(v)) {
        return {
          valid: false,
          flags: { typeMismatch: true },
          message: 'Please enter a valid email address.',
          anchor: this.#editor ?? undefined,
        }
      }
      if (type === 'url') {
        try {
          new URL(v) // throws for invalid URLs
        } catch {
          return {
            valid: false,
            flags: { typeMismatch: true },
            message: 'Please enter a valid URL.',
            anchor: this.#editor ?? undefined,
          }
        }
      }
    }

    return { valid: true }
  }

  /**
   * Form reset → value ← the initial `value` attribute (native-parity defaultValue) + clear the touched state.
   * A reset must not leave a required-empty field showing `:state(user-invalid)` until the user re-interacts, so
   * the timing controller is reset to its first-paint suppression (the danger treatment re-arms on the next
   * blur/change). The optional chain is defensive — `formReset` only fires while connected (the controller is live).
   */
  protected formReset(): void {
    this.value = this.#defaultValue
    this.#codec?.setCanonical(this.#defaultValue) // keep canonical in sync on reset
    this.#userInvalid?.reset()
  }

  /** Restore the value after navigation/autofill (FACE state restore). */
  protected formStateRestore(state: File | string | FormData | null): void {
    if (typeof state === 'string') this.value = state
  }

  // ── auto-adornment creation (Wave 3 + Wave 5A) ─────────────────────────────────

  /**
   * Create and prepend a control-injected LEADING adornment. Placed BEFORE the editor in the DOM so
   * the host-as-grid's `order` property (slot leading=0 · editor=1 · trailing=2) correctly positions
   * it in the leading cell. Returns the element for the effect cleanup to remove.
   *
   * @param role  The TYPE_CONFIG leading role ('magnifier' or 'currency').
   * @param text  The glyph text — '⌕' for magnifier, currencySymbol(this.currency) for currency.
   */
  #createLeadingAdornment(role: LeadingRole, text: string): HTMLElement {
    const el = document.createElement('span')
    el.setAttribute('slot', 'leading')
    el.setAttribute('data-part', 'leading-adornment')
    el.setAttribute('data-role', role)
    el.setAttribute('aria-hidden', 'true') // decorative — the editor carries the accessible name
    el.textContent = text
    // prepend: appears before the editor in DOM order; slot+order CSS positions it correctly.
    this.prepend(el)
    return el
  }

  /**
   * Create and append a control-injected TRAILING affordance adornment (clear / reveal). The exclusive
   * interactive buttons register their listeners with `typeAc` so they are aborted on type change and
   * on disconnect (the cleanup's typeAc.abort()). Returns the element for the effect cleanup to remove.
   */
  #createAffordanceAdornment(role: AffordanceRole, typeAc: AbortSignal): HTMLElement {
    const container = document.createElement('span')
    container.setAttribute('slot', 'trailing')
    container.setAttribute('data-part', 'trailing-adornment')
    container.setAttribute('data-role', role)

    if (role === 'clear') {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-part', 'clear-button')
      btn.setAttribute('aria-label', 'Clear')
      btn.textContent = '✕'
      btn.addEventListener('click', () => {
        if (this.value === '') return // nothing to clear
        this.value = ''
        this.#codec?.setCanonical('')
        this.emit('input')
        this.emit('change')
        this.#editor?.focus()
      }, { signal: typeAc })
      container.append(btn)
    } else {
      // reveal: toggle password masking via :state(revealed) (ADR-0044)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-part', 'reveal-button')
      btn.setAttribute('aria-label', 'Show password')
      btn.setAttribute('aria-pressed', 'false')
      btn.textContent = '👁'
      btn.addEventListener('click', () => {
        this.#revealed = !this.#revealed
        btn.setAttribute('aria-pressed', String(this.#revealed))
        btn.setAttribute('aria-label', this.#revealed ? 'Hide password' : 'Show password')
        if (this.#revealed) {
          this.internals.states?.add('revealed')
        } else {
          this.internals.states?.delete('revealed')
        }
        this.emit('toggle')
      }, { signal: typeAc })
      container.append(btn)
    }

    this.append(container)
    return container
  }

  /**
   * Create and append a control-injected TRAILING numeric adornment: steppers (▲▼) with an optional
   * suffix span. Used for ALL numeric types (number · currency · unit · percent — ADR-0047: codec ≠ null
   * implies steppers). `suffixText` is non-null for unit (the localized label) and percent ('%').
   * The trailing container's data-role is 'numeric' when a suffix is present, 'stepper' otherwise —
   * the two roles drive different CSS layout (row vs. column; inline-size auto vs. icon-sized).
   */
  #createNumericAdornment(suffixText: string | null, typeAc: AbortSignal): HTMLElement {
    const container = document.createElement('span')
    container.setAttribute('slot', 'trailing')
    container.setAttribute('data-part', 'trailing-adornment')
    // 'numeric' has suffix+steppers in a flex row; 'stepper' has steppers only in an icon-sized column.
    container.setAttribute('data-role', suffixText !== null ? 'numeric' : 'stepper')

    if (suffixText !== null) {
      const suffix = document.createElement('span')
      suffix.setAttribute('data-part', 'suffix')
      suffix.setAttribute('aria-hidden', 'true') // decorative label — the editor carries the value
      suffix.textContent = suffixText
      container.append(suffix)
    }

    const up = document.createElement('button')
    up.type = 'button'
    up.setAttribute('data-part', 'step-up')
    up.setAttribute('aria-label', 'Increase')
    up.textContent = '▲'
    up.addEventListener('click', () => { this.#step(1) }, { signal: typeAc })

    const down = document.createElement('button')
    down.type = 'button'
    down.setAttribute('data-part', 'step-down')
    down.setAttribute('aria-label', 'Decrease')
    down.textContent = '▼'
    down.addEventListener('click', () => { this.#step(-1) }, { signal: typeAc })

    container.append(up, down)
    this.append(container)
    return container
  }

  /**
   * Step the numeric value by `dir * step` (clamped to [min, max]). Called by stepper buttons AND by
   * ArrowUp/Down on the editor (native type=number parity). `this.step ?? 1` guards against a null step
   * (cleared attribute). Empty min/max = unbounded (native .min/.max parity — ADR-0047).
   */
  #step(dir: 1 | -1): void {
    // Prefer codec canonical (the last successfully parsed value); fall back to this.value for cases
    // where the user hasn't blurred yet (canonical is still the initial empty seed). Use || not ??
    // so an empty-string canonical (never blurred) falls through to this.value.
    const current = parseFloat(this.#codec?.canonical.value || this.value)
    const stepSize = this.step ?? 1
    const raw = Number.isFinite(current) ? current + dir * stepSize : dir * stepSize
    // Clamp to [min, max]: '' = unconstrained; invalid parse → treat as unbounded.
    const minNum = this.min !== '' ? parseFloat(this.min) : -Infinity
    const maxNum = this.max !== '' ? parseFloat(this.max) : Infinity
    const clamped = Math.max(
      Number.isFinite(minNum) ? minNum : -Infinity,
      Math.min(Number.isFinite(maxNum) ? maxNum : Infinity, raw),
    )
    const nextStr = String(clamped)
    this.value = nextStr // raw numeric string (will format on next blur via the codec)
    this.#codec?.setCanonical(nextStr) // keep canonical in sync immediately
    this.emit('input')
    this.emit('change')
  }

  /**
   * Create the editor PART + the aria message node ONCE (idempotent across reconnect — both are light-DOM
   * children that persist through disconnect), returning the editor. The message node is NOT a public part (the
   * descriptor lists only `editor` under `parts`; it is the control-managed `aria-describedby` node, ADR-0014
   * cl.4) — it is `hidden` (out of the host-as-grid + visual layout in G6; the VISIBLE error wrapper is ui-field
   * at G7 — aria-describedby still reads a hidden node's text), carrying `validity().message` only under
   * `user-invalid`.
   */
  #ensureParts(): HTMLElement {
    if (this.#editor) return this.#editor

    const editor = document.createElement('div')
    editor.setAttribute('data-part', 'editor')
    editor.setAttribute('contenteditable', EDITABLE)
    editor.setAttribute('role', 'textbox') // the role rides the PART — the host carries NO role/aria-* attribute
    editor.setAttribute('aria-multiline', 'false')
    this.#editor = editor

    const message = document.createElement('div')
    message.className = 'ui-text-field-message' // a queryable hook, NOT a [data-part] (it is not a public part)
    message.id = `ui-text-field-message-${++messageSeq}`
    message.hidden = true
    this.#message = message

    this.append(editor, message)
    return editor
  }
}

if (!customElements.get('ui-text-field')) customElements.define('ui-text-field', UITextFieldElement)

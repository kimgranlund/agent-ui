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

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIFormElement, type FormValue, type ValidityResult } from '../../dom/form.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'
import {
  valueCodec,
  numberCodecOptions,
  currencyCodecOptions,
  type ValueCodecController,
} from '../../traits/value-codec.ts'

// The editor's editable mode (ADR-0014 cl.1) and a per-instance id seed for aria-describedby.
const EDITABLE = 'plaintext-only'
let messageSeq = 0

// ── email / URL validation patterns ──────────────────────────────────────────

// A practical email pattern (RFC 5321 simple form): local@domain.tld — no embedded whitespace or @.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── type-resolver (the static as-const config map, erasableSyntaxOnly: no enum) ─────────────────

type LeadingRole = 'magnifier' | 'currency'
type TrailingRole = 'clear' | 'reveal' | 'stepper'
type ValidationType = 'email' | 'url' | 'number'
type CodecKind = 'number' | 'currency'

interface TypeConfig {
  readonly inputmode: string
  readonly leading: LeadingRole | null
  readonly trailing: TrailingRole | null
  readonly validation: ValidationType | null
  readonly codec: CodecKind | null
}

const TYPE_CONFIG = {
  //            inputmode    leading        trailing    validation  codec
  text:     { inputmode: 'text',    leading: null,         trailing: null,       validation: null,     codec: null       },
  email:    { inputmode: 'email',   leading: null,         trailing: null,       validation: 'email',  codec: null       },
  url:      { inputmode: 'url',     leading: null,         trailing: null,       validation: 'url',    codec: null       },
  tel:      { inputmode: 'tel',     leading: null,         trailing: null,       validation: null,     codec: null       },
  search:   { inputmode: 'search',  leading: 'magnifier',  trailing: 'clear',    validation: null,     codec: null       },
  password: { inputmode: 'text',    leading: null,         trailing: 'reveal',   validation: null,     codec: null       },
  number:   { inputmode: 'numeric', leading: null,         trailing: 'stepper',  validation: 'number', codec: 'number'   },
  currency: { inputmode: 'decimal', leading: 'currency',   trailing: null,       validation: 'number', codec: 'currency' },
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
  type: { ...prop.enum(['text', 'email', 'url', 'tel', 'password', 'search', 'number', 'currency'] as const, 'text'), reflect: true },
  readonly: { ...prop.boolean(false), reflect: true },
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

  // The active value-codec controller for number/currency types. Null for all other types.
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
      if ((event as KeyboardEvent).key !== 'Enter' || this.#composing) return
      event.preventDefault() // single-line field — Enter never inserts a newline
      this.#committed = this.value
      this.emit('change') // Enter commits (resets the baseline, so a following blur does not double-fire)
    })

    // ── the user-invalid TIMING controller — gates the danger treatment until the first blur/change ──
    const controller = trackUserInvalid(this, { invalid: () => !this.formValidity().valid })
    this.#userInvalid = controller

    // ── type-dependent behavior: inputmode + auto-adornments + codec + validation (Wave 3 / ADR-0044) ──
    // The effect re-runs when this.type changes, running the cleanup from the previous run first (the
    // kernel's cleanup return mechanism). type='text' is the identity config (no adornments, no codec).
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

      // Control-injected leading adornment (magnifier for search, currency symbol for currency).
      const leadingEl = config.leading ? this.#createLeadingAdornment(config.leading) : null

      // Control-injected trailing adornment (clear-✕ for search, eye-reveal for password, ▲▼ for number).
      const trailingEl = config.trailing
        ? this.#createTrailingAdornment(config.trailing, typeAc.signal)
        : null

      // Codec: number/currency get the display↔canonical split (formValue + formValidity check it).
      const codec: ValueCodecController | null =
        config.codec === 'number'
          ? valueCodec(this, numberCodecOptions())
          : config.codec === 'currency'
            ? valueCodec(this, currencyCodecOptions())
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
   * When a value codec is active (number/currency types), the CANONICAL parsed value is the form value,
   * not `this.value` which holds the formatted display string after blur. For all other types, `this.value`
   * IS the form value (the editor textContent is the submission value).
   */
  protected formValue(): FormValue {
    return this.#codec?.canonical.value ?? this.value
  }

  /**
   * The validity verdict: `required && value === ''` → `valueMissing` (anchored on the editor); codec
   * parse error → `customError`; email/url type mismatch → `typeMismatch`; valid otherwise. A disabled
   * field is barred from constraint validation (native parity), so it reports valid.
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

    // Codec parse error (number/currency): hasError is set by the valueCodec controller on blur.
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

  // ── auto-adornment creation (Wave 3) ──────────────────────────────────────────

  /**
   * Create and prepend a control-injected LEADING adornment. Placed BEFORE the editor in the DOM so
   * the host-as-grid's `order` property (slot leading=0 · editor=1 · trailing=2) correctly positions
   * it in the leading cell. Returns the element for the effect cleanup to remove.
   */
  #createLeadingAdornment(role: LeadingRole): HTMLElement {
    const el = document.createElement('span')
    el.setAttribute('slot', 'leading')
    el.setAttribute('data-part', 'leading-adornment')
    el.setAttribute('data-role', role)
    el.setAttribute('aria-hidden', 'true') // decorative — the editor carries the accessible name
    if (role === 'magnifier') {
      el.textContent = '⌕' // the search magnifier glyph
    } else {
      // currency: extract the narrow symbol from Intl (falls back to '$' for default USD).
      el.textContent = UITextFieldElement.#currencySymbol()
    }
    // prepend: appears before the editor in DOM order, but slot+order CSS positions it correctly.
    this.prepend(el)
    return el
  }

  /**
   * Create and append a control-injected TRAILING adornment. The interactive affordances (clear button,
   * reveal toggle, steppers) register their listeners with `typeAc.signal` so they are aborted on
   * type change (the effect cleanup) and on disconnect (the typeAc.abort() in the cleanup). Returns
   * the element for the effect cleanup to remove.
   */
  #createTrailingAdornment(role: TrailingRole, typeAc: AbortSignal): HTMLElement {
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
    } else if (role === 'reveal') {
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
    } else {
      // stepper: two buttons for number fields (▲ step up, ▼ step down)
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
    }

    this.append(container)
    return container
  }

  /** Increment or decrement the numeric value by `delta` (used by the stepper buttons). */
  #step(delta: number): void {
    // Prefer codec canonical (the last successfully parsed value); fall back to this.value for cases
    // where the user hasn't blurred yet (canonical is still the initial empty seed). Use || not ??
    // so an empty-string canonical (never blurred) falls through to this.value.
    const current = parseFloat(this.#codec?.canonical.value || this.value)
    const next = Number.isFinite(current) ? current + delta : delta
    const nextStr = String(next)
    this.value = nextStr // raw numeric string (will format on next blur)
    this.#codec?.setCanonical(nextStr) // keep canonical in sync immediately
    this.emit('input')
    this.emit('change')
  }

  /**
   * Extract the narrow currency symbol for the default currency (USD) using Intl.
   * Used as the text content of the currency leading adornment. Falls back to '$' if Intl fails.
   * Static so it can be called from the private method without `this` depending on instance state.
   */
  static #currencySymbol(): string {
    try {
      const parts = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
      }).formatToParts(0)
      return parts.find((p) => p.type === 'currency')?.value ?? '$'
    } catch {
      return '$'
    }
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

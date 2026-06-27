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

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIFormElement, type FormValue, type ValidityResult } from '../../dom/form.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'

// The editor's editable mode (ADR-0014 cl.1; a `true` + input-sanitize fallback for an engine lacking
// `plaintext-only` is a noted, deferred risk in the ADR consequences — out of the G6 build) and a per-instance
// id seed so each field's `aria-describedby` message node has a unique IDREF.
const EDITABLE = 'plaintext-only'
let messageSeq = 0

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
    this.effect(() => {
      if (controller.userInvalid()) {
        // userInvalid ⇒ invalid, so formValidity() is the invalid branch carrying the message + flags.
        const verdict = this.formValidity()
        editor.setAttribute('aria-invalid', 'true')
        editor.setAttribute('aria-describedby', message.id)
        message.textContent = verdict.valid ? '' : verdict.message // the WCAG 1.4.1 non-colour reinforcement
        this.internals.states?.add('user-invalid')
      } else {
        editor.removeAttribute('aria-invalid')
        editor.removeAttribute('aria-describedby')
        message.textContent = ''
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
  }

  /** Forward host focus to the editor PART (label-association + native `.focus()` parity). */
  override focus(options?: FocusOptions): void {
    if (this.#editor) this.#editor.focus(options)
    else super.focus(options)
  }

  // ── form hooks (overrides of the UIFormElement seams) ─────────────────────────

  /** The value contributed to the owning form (FACE — the base publishes it via internals.setFormValue). */
  protected formValue(): FormValue {
    return this.value
  }

  /**
   * The validity verdict: `required && value === ''` → `valueMissing` (anchored on the editor); valid
   * otherwise. A disabled field is barred from constraint validation (native parity), so it reports valid —
   * which also gates the `user-invalid` treatment off (text-field.css relies on this: its disabled block does
   * NOT repoint the danger border, so an un-gated disabled+invalid field would wrongly show the danger colour).
   */
  protected formValidity(): ValidityResult {
    if (this.effectiveDisabled()) return { valid: true }
    if (this.required && this.value === '') {
      return {
        valid: false,
        flags: { valueMissing: true },
        message: 'Please fill out this field.',
        anchor: this.#editor ?? undefined,
      }
    }
    return { valid: true }
  }

  /** Form reset → value ← the initial `value` attribute (native-parity defaultValue). */
  protected formReset(): void {
    this.value = this.#defaultValue
  }

  /** Restore the value after navigation/autofill (FACE state restore). */
  protected formStateRestore(state: File | string | FormData | null): void {
    if (typeof state === 'string') this.value = state
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

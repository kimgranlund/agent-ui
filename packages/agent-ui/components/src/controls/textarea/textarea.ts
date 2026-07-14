// textarea.ts — UITextareaElement, the FACE multi-line text primitive (ADR-0134; a SIBLING of ui-text-field,
// NOT a text-field mode). BEHAVIOUR + props + the contenteditable editor part + self-define ONLY;
// geometry/colour live in textarea.css (its OWN multi-line law, not the single-line (scale×size)→§1-row
// lookup), the public contract in textarea.md.
//
// Editable surface — the ADR-0014 contenteditable PATTERN reused verbatim: a stable, control-created
// light-DOM `<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="true">`,
// appended ONCE (an idempotent guard) and NEVER re-rendered. `value`↔surface is the same two scope-owned
// wires as ui-text-field (surface→model on `input`, model→surface under the CARET GUARD), both suppressed
// during IME composition.
//
// The INVERSION from ui-text-field (ADR-0134's whole reason to be a sibling, not a mode): `aria-multiline`
// is `true`, and `Enter` is NOT intercepted — it inserts a newline exactly like a native `<textarea>`, and
// commit is BLUR-with-change ONLY (never Enter). Geometry inverts too: `rows` sets a GROWABLE
// `min-block-size`, real `padding-block`, `align-items: start`, prose `line-height`, `resize: vertical` —
// see textarea.css for the law. No `type` prop, no adornment/overlay/codec machinery — none of that applies
// to plain multi-line text (ADR-0134 "Decision").
//
// The HOST carries no `role`/`aria-*` attribute — form semantics ride `internals` (ADR-0013) and the editor
// PART carries `role=textbox`. ARIA + the custom states are set THROUGH the protected `internals`. Disabled
// rides the editor + the platform form-disabled channel (`effectiveDisabled = own || form`), NOT host
// `ariaDisabled`; `readonly` is editable=false but focusable (still submits). `user-invalid` timing comes
// from the `trackUserInvalid` controller, reinforced by a non-colour `aria-describedby` message node (WCAG
// 1.4.1). `controls → dom + traits` is the allowed import direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIFormElement, type FormValue, type ValidityResult, type FieldLabelling } from '../../dom/form.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'

// The editor's editable mode (ADR-0014 cl.1, reused) and a per-instance id seed for aria-describedby.
const EDITABLE = 'plaintext-only'
let messageSeq = 0

// ── props ─────────────────────────────────────────────────────────────────────

const props = {
  // The universal form attributes (name / disabled(reflect) / required(reflect)) are SPREAD, not inherited —
  // props.ts has no static-props prototype merge, so UIFormElement exposes them as a spreadable bag (ADR-0013).
  ...UIFormElement.formProps,
  // `value` is OBSERVED (its initial attribute seeds the reset baseline) but NOT reflected — the live value
  // rides the editor surface, never a host attribute.
  value: prop.string(),
  label: prop.string(), // → the editor's aria-label (the labelling SEAM; yields under a ui-field association)
  placeholder: prop.string(), // shown via [data-empty]::before { content: attr(data-placeholder) } when empty
  // rows: native <textarea rows> parity — the MIN-height lever (ADR-0134), not a fixed control height. reflects
  // so [rows] attribute-selector / attr-based CSS repoints apply to JS-set values too.
  rows: { ...prop.number(3), reflect: true },
  // size repoints font + block-padding + the per-row line-box in textarea.css (NOT a fixed height lever —
  // the single-line (scale×size)→§1-row lookup does not apply here, ADR-0134).
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
  readonly: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UITextareaElement extends ReactiveProps<typeof props> {}
export class UITextareaElement extends UIFormElement {
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

    // ── surface → model (ADR-0014 cl.1, reused) — the editor's edits flow into `value`, IME-guarded ──
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

    // ── change on commit — blur-with-change ONLY (ADR-0134: the Enter-commits law INVERTS — Enter inserts a
    // newline here, never commits; no keydown interception at all, unlike ui-text-field) ──
    this.listen(editor, 'focus', () => {
      this.#committed = this.value
    })
    this.listen(editor, 'blur', () => {
      if (this.value === this.#committed) return
      this.#committed = this.value
      this.emit('change')
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
      // Yield: aria-label is the BARE stand-in only — a `ui-field` association carries the name via
      // aria-labelledby (applyFieldLabelling below), which beats aria-label in accname resolution anyway;
      // clearing it here keeps the editor's AX tree clean under association (the ADR-0051 pattern).
      if (this.label && this.fieldLabelling === null) editor.setAttribute('aria-label', this.label)
      else editor.removeAttribute('aria-label')
      editor.setAttribute('data-placeholder', this.placeholder) // the CSS placeholder reads attr(data-placeholder)
      if (this.required) editor.setAttribute('aria-required', 'true')
      else editor.removeAttribute('aria-required')
    })

    // ── the disabled / readonly channel (ADR-0014 dev#b, reused) — effectiveDisabled = own || form-disabled ──
    this.effect(() => {
      if (this.effectiveDisabled()) {
        editor.setAttribute('contenteditable', 'false')
        editor.removeAttribute('tabindex') // not focusable (out of the tab order, like <textarea disabled>)
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
    // Reused verbatim from ui-text-field: the message node is VISIBLE when carrying a message (ADR-0029 A1);
    // under a `ui-field` association the internal message yields — empty, hidden, dropped from
    // aria-describedby — so the field's own error part is the ONE AT-announced error (ADR-0051 cl.4).
    this.effect(() => {
      const fielded = this.fieldLabelling !== null
      if (controller.userInvalid()) {
        const verdict = this.formValidity()
        const text = verdict.valid ? '' : verdict.message
        editor.setAttribute('aria-invalid', 'true')
        if (fielded) {
          message.textContent = ''
          message.hidden = true
        } else {
          editor.setAttribute('aria-describedby', message.id)
          message.textContent = text
          message.hidden = text === ''
        }
        this.internals.states?.add('user-invalid')
      } else {
        editor.removeAttribute('aria-invalid')
        if (!fielded) editor.removeAttribute('aria-describedby') // never touch it while fielded (F3 precedent)
        message.textContent = ''
        message.hidden = true
        this.internals.states?.delete('user-invalid')
      }
    })

    // ── rows → the CSS min-block-size lever (ADR-0134: rows is a MIN, not a fixed height) ──
    this.effect(() => {
      this.style.setProperty('--ui-textarea-rows', String(this.rows ?? 3))
    })

    // Motion gate (interaction-states standard) — arm `ready` ONE frame past first paint so the upgrade/first
    // paint SNAPS and only subsequent state changes animate. `states` optional-chained — jsdom has no
    // CustomStateSet (the real motion is the browser smoke).
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

  /**
   * Focus the editor and move the caret to the END of its text (a `ui-textarea`-friendly equivalent of the
   * native `<textarea>.setSelectionRange(len, len)` a contenteditable host does not expose — the ADR-0134
   * migration seam `entry-list.ts` uses to restore an in-progress edit after a re-render). A no-op before
   * the editor part exists (guards a not-yet-connected control, mirroring `focus()`'s own guard above).
   */
  selectToEnd(): void {
    const editor = this.#editor
    if (!editor) return
    editor.focus()
    const selection = editor.ownerDocument.defaultView?.getSelection() ?? window.getSelection()
    if (!selection) return
    const range = editor.ownerDocument.createRange()
    range.selectNodeContents(editor)
    range.collapse(false) // collapse to the END
    selection.removeAllRanges()
    selection.addRange(range)
  }

  // ── form hooks (overrides of the UIFormElement seams) ─────────────────────────

  /** The value contributed to the owning form (FACE — the base publishes it via internals.setFormValue). */
  protected formValue(): FormValue {
    return this.value
  }

  /**
   * The validity verdict: `required && value === ''` → `valueMissing`; valid otherwise. No codec/type
   * validation — plain multi-line text has no value-shape to mismatch (ADR-0134). A disabled field is barred
   * from constraint validation (native parity).
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

  /**
   * Form reset → value ← the initial `value` attribute (native-parity defaultValue) + clear the touched
   * state (so a required-empty field does not show `:state(user-invalid)` until the user re-interacts).
   */
  protected formReset(): void {
    this.value = this.#defaultValue
    this.#userInvalid?.reset()
  }

  /** Restore the value after navigation/autofill (FACE state restore). */
  protected formStateRestore(state: File | string | FormData | null): void {
    if (typeof state === 'string') this.value = state
  }

  // ── ADR-0051 — the field-labelling seam wire (the ui-text-field part-role override, reused verbatim) ──────

  /**
   * The part-role override (ADR-0051 cl.2) — the editor's `role=textbox` rides a light-DOM PART, not
   * `internals.role`, so the base's guarded internals-reflection default never fires here; id-reference the
   * editor directly instead. See text-field.ts's own doc for the full ordering rationale (reused verbatim —
   * `aria-describedby` is only WRITTEN here on association; on dissociation the user-invalid/message effect
   * above stays the exclusive owner, avoiding a two-effect write race).
   */
  protected applyFieldLabelling(refs: FieldLabelling | null): void {
    const editor = this.#editor
    if (!editor) return
    if (refs === null) {
      editor.removeAttribute('aria-labelledby')
      return
    }
    if (refs.label) editor.setAttribute('aria-labelledby', refs.label.id)
    else editor.removeAttribute('aria-labelledby')
    const described = [refs.description, refs.error].filter((el): el is HTMLElement => el !== null)
    if (described.length > 0) editor.setAttribute('aria-describedby', described.map((el) => el.id).join(' '))
    else editor.removeAttribute('aria-describedby')
  }

  /** Feeds `FormConnectDetail.userInvalid` (ADR-0050) — the `trackUserInvalid` tracker IS the timing source. */
  protected formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }

  /**
   * Create the editor PART + the aria message node ONCE (idempotent across reconnect — both are light-DOM
   * children that persist through disconnect), returning the editor. The message node is NOT a public part
   * (the descriptor lists only `editor` under `parts`) — it is `hidden`, carrying `validity().message` only
   * under `user-invalid`.
   */
  #ensureParts(): HTMLElement {
    if (this.#editor) return this.#editor

    const editor = document.createElement('div')
    editor.setAttribute('data-part', 'editor')
    editor.setAttribute('contenteditable', EDITABLE)
    editor.setAttribute('role', 'textbox') // the role rides the PART — the host carries NO role/aria-* attribute
    editor.setAttribute('aria-multiline', 'true') // the ADR-0134 inversion from ui-text-field's aria-multiline="false"
    this.#editor = editor

    const message = document.createElement('div')
    message.className = 'ui-textarea-message' // a queryable hook, NOT a [data-part] (it is not a public part)
    message.id = `ui-textarea-message-${++messageSeq}`
    message.hidden = true
    this.#message = message

    this.append(editor, message)
    return editor
  }
}

if (!customElements.get('ui-textarea')) customElements.define('ui-textarea', UITextareaElement)

// form.ts — `UIFormElement`, the FACE form-associated base (ADR-0013; decomp g4-g6 slice s1).
//
// The base every value-carrying FACE control (`ui-text-field`, `ui-checkbox`, `ui-switch`, `ui-select`,
// `ui-listbox`) extends. It turns a `UIElement` into a form participant: `static formAssociated = true`
// activates the platform's form lifecycle, and the inherited `ElementInternals` — acquired ONCE in the
// `UIElement` constructor, reused here and NEVER re-`attachInternals()`d (a second acquisition throws) —
// carries the value + validity to the owning `<form>`. Two scope-owned effects publish the control's
// `formValue()` / `formValidity()` hooks to `internals.setFormValue` / `setValidity`, so a control declares
// WHAT its value + validity are and the base wires the reactive plumbing. The base owns the three universal
// form attributes via the SPREADABLE `formProps` (props.ts has no static-props prototype merge — the
// subclass folds them into its own `static props`); it deliberately does NOT own a typed `value` — the
// value's type + codec are the subclass's (string for text-field; a `checked` boolean for checkbox; …).
//
// Super-wrapped wiring keeps subclass authoring identical to a plain `UIElement` control: a subclass still
// overrides the clean, no-`super` `connected()` hook; this base wraps `connectedCallback` to add its own
// scope-owned effects after `super` has opened the scope.
//
// Imports only `../reactive` (the kernel) + same-layer `./element.ts` / `./props.ts` (the layering holds).
// `ElementInternals` / `ValidityState` / `ValidityStateFlags` / `HTMLFormElement` / `HTMLElement` / `File` /
// `FormData` are ambient DOM globals, not imports.

import { signal } from '../reactive/index.ts'
import type { Signal } from '../reactive/index.ts'
import { UIElement } from './element.ts'
import { prop, type PropsSchema, type ReactiveProps } from './props.ts'

/**
 * The value a form control contributes to its owning form — exactly the platform's `setFormValue` value
 * type. `null` contributes no entry (the base's default). The subclass's `formValue()` returns its typed
 * value coerced into this shape (a string for text-field; a `File` / `FormData` for richer controls).
 */
export type FormValue = File | string | FormData | null

/**
 * A control's validity VERDICT — a discriminated union the base maps onto `internals.setValidity`: valid
 * clears it; invalid publishes the platform `flags` + the `message` (+ an optional `anchor` element the UA
 * focuses on `reportValidity`). Distinct from the platform's `ValidityState` (the live IDL object the
 * `validity` getter returns): this is the control's per-render assertion that DRIVES it.
 */
export type ValidityResult =
  | { valid: true }
  | { valid: false; flags: ValidityStateFlags; message: string; anchor?: HTMLElement }

// The three universal form attributes every value-carrying control shares (clause 2). All three REFLECT:
// `name` reflects for native parity (the HTML `name` IDL attribute reflects its content attribute) AND
// because FACE submission keys the entry by the `name` CONTENT attribute — so the imperative `el.name = …`
// path must update the attribute or the value submits unkeyed; `disabled` / `required` reflect so
// attribute-selector styling (`[disabled]` / `[required]`) applies to JS-set values too. `value` is ABSENT —
// its type/codec belong to the subclass. A subclass spreads this into its own `static props`:
// `static props = { ...UIFormElement.formProps, value: prop.string(), … }`.
const formProps = {
  name: { ...prop.string(), reflect: true },
  disabled: { ...prop.boolean(), reflect: true },
  required: { ...prop.boolean(), reflect: true },
} satisfies PropsSchema

export interface UIFormElement extends ReactiveProps<typeof formProps> {}
export class UIFormElement extends UIElement {
  /** Activates platform form association — `setFormValue`/`setValidity` + the form lifecycle callbacks (clause 1). */
  static formAssociated = true

  /** The spreadable universal form attributes — the no-static-props-inheritance workaround (clause 2). */
  static formProps = formProps

  // Fieldset / `<form disabled>` state, pushed in by `formDisabledCallback`. A signal so `effectiveDisabled()`
  // is reactive — a subclass effect reading it re-runs when an ancestor fieldset toggles disabled.
  #formDisabled: Signal<boolean> = signal(false)

  // Renderer-driven custom validity (ADR-0029 §5 — the A2UI `checks` controller seam). A signal so the
  // merged validity effect below re-runs when the renderer calls `setCustomValidity` (live validation).
  // Empty string = no custom message = no custom-error contribution (native-parity clear, like `input.setCustomValidity('')`).
  #customValidity: Signal<string> = signal('')

  /**
   * Super-wrapped wiring (clause 4). `super.connectedCallback()` opens the connection scope + AbortController,
   * runs the no-`super` `connected()` hook, and installs the render effect; the scope is now live, so the two
   * form effects below are scope-owned and disposed on disconnect (zero residue). They install AFTER the
   * render effect — harmless: the form family's `render()` is the inherited void. The subclass keeps the
   * clean, no-`super` `connected()` hook — it never sees this wrapper.
   */
  connectedCallback(): void {
    super.connectedCallback()
    // Publish the control's value to the form, reactively: reading `formValue()` tracks whatever signals the
    // subclass's hook reads (its `value` prop), so a value change re-runs ONLY this effect → one setFormValue.
    this.effect(() => {
      this.internals.setFormValue(this.formValue())
    })
    // Publish the control's validity verdict to the platform, reactively (same tracking discipline).
    // Merges the subclass `formValidity()` verdict with the renderer-driven `#customValidity` signal
    // (ADR-0029 §5, setCustomValidity seam): native wins when already invalid; a non-empty custom
    // message produces `{valid:false, flags:{customError:true}, message}`; both empty → valid (clear).
    this.effect(() => {
      const native = this.formValidity()
      const custom = this.#customValidity.value
      if (!native.valid) {
        this.#applyValidity(native) // native wins (e.g. valueMissing overrides the custom message)
      } else if (custom !== '') {
        this.#applyValidity({ valid: false, flags: { customError: true }, message: custom })
      } else {
        this.#applyValidity(native) // both valid: clear
      }
    })
  }

  /** Map a `ValidityResult` onto `internals.setValidity`: valid clears it; invalid sets flags + message (+ anchor). */
  #applyValidity(result: ValidityResult): void {
    if (result.valid) this.internals.setValidity({})
    else this.internals.setValidity(result.flags, result.message, result.anchor)
  }

  /**
   * Set a renderer-driven custom validity message (ADR-0029 §5 — the A2UI `checks` seam, native-parity name).
   * An empty string clears the custom contribution (native parity: `el.setCustomValidity('')` = valid).
   * A non-empty message drives `{valid:false, flags:{customError:true}, message}` unless `formValidity()`
   * is already invalid (native wins — e.g. `valueMissing` takes the display slot over a custom message).
   * The reactive effect in `connectedCallback` picks up the `#customValidity` signal change and re-publishes
   * through `#applyValidity` without any direct caller → `internals.setValidity` call here.
   */
  setCustomValidity(message: string): void {
    this.#customValidity.value = message
  }

  // ── overridable control hooks (clause 3) ──────────────────────────────────────

  /** The value this control contributes to its form. Default: nothing (`null`); the subclass returns its value. */
  protected formValue(): FormValue {
    return null
  }

  /**
   * This control's validity verdict, published to `internals.setValidity` by a scope-owned effect. Default:
   * always valid; the subclass computes it from its props (e.g. `required && value === '' → valueMissing`).
   *
   * NAMED `formValidity`, NOT `validity` (parallel to `formValue`): the public IDL `validity` GETTER below
   * returns the platform's `ValidityState`, so the verdict hook cannot share that name. ADR-0013 clauses 3/6
   * both wrote `validity`; this base resolves the collision in favour of native IDL parity for `validity`.
   */
  protected formValidity(): ValidityResult {
    return { valid: true }
  }

  // ── effective-disabled (clause 5) ─────────────────────────────────────────────

  /**
   * The disabled state a control should obey: its OWN `disabled` prop OR an ancestor `<fieldset disabled>` /
   * form-disabled state (`formDisabledCallback`). Reactive — read it inside an effect and it re-runs when
   * either source flips. (The form-disabled channel is the ADR-0013 divergence from ADR-0010's `ariaDisabled`
   * for non-form controls.)
   */
  effectiveDisabled(): boolean {
    return this.disabled || this.#formDisabled.value
  }

  // ── platform form lifecycle callbacks → overridable hooks (clause 5) ──────────

  /** Platform reset → the `formReset()` hook (the subclass restores value ← its defaultValue; clause 2). */
  formResetCallback(): void {
    this.formReset()
  }

  /** Platform fieldset/form-disabled change → the reactive `#formDisabled` signal behind `effectiveDisabled()`. */
  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled.value = disabled
  }

  /** Platform state restore (navigation/autofill) → the `formStateRestore(state)` hook. */
  formStateRestoreCallback(state: File | string | FormData | null, _mode: 'restore' | 'autocomplete'): void {
    this.formStateRestore(state)
  }

  /** Platform association change → the no-op `formAssociated(form)` hook (an extension point). */
  formAssociatedCallback(form: HTMLFormElement | null): void {
    this.formAssociated(form)
  }

  /** Restore value ← defaultValue on form reset. Default no-op — the subclass owns `value` + its defaultValue. */
  protected formReset(): void {}

  /** Restore value from a previously-submitted/autofilled form state. Default no-op — the subclass decodes `state`. */
  protected formStateRestore(_state: File | string | FormData | null): void {}

  /** Called when the element associates with / disassociates from a form. Default no-op extension point. */
  protected formAssociated(_form: HTMLFormElement | null): void {}

  // ── IDL delegators (clause 6) — native form-control parity, via the inherited internals ───────
  // `name` is NOT delegated here: it is the reactive `name` prop (spread from `formProps`), the same surface
  // a consumer reads as `el.name` — and `internals` has no `name` member to delegate to.

  /** The owning `<form>`, or null. */
  get form(): HTMLFormElement | null {
    return this.internals.form
  }

  /** The platform's live `ValidityState` (the IDL object; distinct from the `formValidity()` verdict hook). */
  get validity(): ValidityState {
    return this.internals.validity
  }

  /** The platform validation message (the `setValidity` message; empty when valid). */
  get validationMessage(): string {
    return this.internals.validationMessage
  }

  /** Whether this control is a candidate for constraint validation. */
  get willValidate(): boolean {
    return this.internals.willValidate
  }

  /** Run constraint validation, firing an `invalid` event when invalid. */
  checkValidity(): boolean {
    return this.internals.checkValidity()
  }

  /** Like `checkValidity`, and additionally reports the problem to the user (focuses the anchor). */
  reportValidity(): boolean {
    return this.internals.reportValidity()
  }
}

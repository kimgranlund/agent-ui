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
// G7 growth (ADR-0050 + ADR-0051, the fleet's first context/provider primitive + its labelling seam):
//   • ADR-0050 — at the END of `connectedCallback` (scope + effects all live) the base dispatches the
//     `ui-form-connect` protocol event: a composed, bubbling, NOT-cancelable event (`dispatchEvent`, not
//     `this.emit` — `emit`'s cancelable/public shape is for consumer events) whose detail is the control's
//     PUBLIC reactive surface, closing over `formValue()`/the merged validity/`formUserInvalid()`, plus the
//     live connection `AbortSignal` (the teardown handle a registry subscribes `abort` on — a disconnected
//     control cannot dispatch, so deregistration rides the handle, never a second event). `formResetCallback`
//     grows a matching `ui-form-reset` dispatch (no detail — the target IS the resetting control).
//   • ADR-0051 — a small signal-backed field-labelling seam: `setFieldLabelling`/`fieldLabelling` are the
//     handoff surface a `ui-field` calls (elements, not id strings — the internals path consumes elements);
//     a base scope-owned effect forwards the current labelling through the overridable `applyFieldLabelling`
//     hook, whose GUARDED default reflects via `ElementInternals` ARIA-element accessors ONLY when
//     `internals.role` is set (feature-detected — the tabs `reflectAriaElements` precedent) — a part-role
//     control (text-field) overrides it. `formUserInvalid()` is the parallel hook feeding the connect
//     detail's `userInvalid` read; a control composing `trackUserInvalid` overrides it with the tracker gate.
//   Both are additive: provider-less/field-less usage shows ZERO behavioral drift (the events bubble to
//   nobody; `fieldLabelling` stays `null`, so `applyFieldLabelling`'s default no-op — jsdom has no
//   `internals.role` reflection surface either — never fires a visible change).
//   • F1 (review-caught upgrade-order hole): the one connect dispatch above assumes a listening
//     provider/field is ALREADY live — true for insertion order, but NOT custom-element UPGRADE order
//     (pre-existing DOM whose control module upgrades before the provider/field module does ⇒ the dispatch
//     fires into the void). `announceFormConnect()` (public) re-dispatches the SAME event with a fresh
//     detail on demand — a provider/field's one-shot catch-up scan calls it per already-connected control
//     it discovers late. Blanket-safe: the registry/field acceptance guards are already idempotent.
//
// Imports only `../reactive` (the kernel) + same-layer `./element.ts` / `./props.ts` (the layering holds).
// `ElementInternals` / `ValidityState` / `ValidityStateFlags` / `HTMLFormElement` / `HTMLElement` / `File` /
// `FormData` / `AbortSignal` / `CustomEvent` are ambient DOM globals, not imports.

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

// ── ADR-0050 — the protocol events ──────────────────────────────────────────────
// The `ui-` namespace: base↔provider/field plumbing, OUTSIDE the public component-event vocab
// (change·input·select·open·close·toggle). Both composed + bubbling, NOT cancelable (dispatched directly
// with `dispatchEvent`, not `this.emit` — `emit`'s cancelable/public shape is for consumer events).

/** Fired once, at the end of `connectedCallback` — the control announcing full connection to the nearest
 *  provider/field ancestor. */
export const FORM_CONNECT_EVENT = 'ui-form-connect'
/** Fired from `formResetCallback`, after `formReset()` — detail: none (the target IS the resetting
 *  control). Covers BOTH reset paths: native `form.reset()` and a provider's direct `formResetCallback()` call. */
export const FORM_RESET_EVENT = 'ui-form-reset'

/** The `ui-form-connect` detail. The closures are the control's PUBLIC reactive surface, minted by the base
 *  (ADR-0050 §4 realized without widening the class API): each read, inside a computed/effect, tracks
 *  exactly the signals the underlying hook reads. */
export interface FormConnectDetail {
  control: UIFormElement
  /** The connection-scoped teardown handle — the control's live connection AbortSignal (ADR-0050 §3).
   *  Aborts on disconnect; a NEW signal is minted per connection (reconnect ⇒ fresh handle). */
  signal: AbortSignal
  /** Reactive read of the submission value — closes over the protected `formValue()`. */
  value: () => FormValue
  /** Reactive read of the MERGED validity verdict — `formValidity()` ⊕ `setCustomValidity` (the same merge
   *  the base publishes to internals; `#mergedValidity` is the single source feeding both). */
  validity: () => ValidityResult
  /** Reactive read of the user-invalid gate — closes over the `formUserInvalid()` hook (below). jsdom
   *  cannot match `:state(user-invalid)` (no CustomStateSet), so the field's error gate rides THIS read;
   *  the browser smokes assert its equivalence with `:state(user-invalid)` (same tracker source). */
  userInvalid: () => boolean
}

// ── ADR-0051 — the field-labelling seam ─────────────────────────────────────────

/** The field-labelling handoff (ADR-0051 cl.1). ELEMENTS, not id strings — the internals path consumes
 *  elements; the id path reads `.id` off the node (the field seeds ids before handing over). */
export interface FieldLabelling {
  label: HTMLElement | null
  description: HTMLElement | null
  error: HTMLElement | null
}

// Reflect an ARIA element-list relation through `internals` (feature-detected — the reflection accessors
// landed in modern Chromium/WebKit but NOT jsdom, so this is a no-op under the jsdom inner loop and live in
// the real engines, verified by the s11 browser smokes; the tabs `reflectAriaElements` precedent — tab.ts /
// tab-panel.ts carry their own local copies too, the folder ships no shared module for this one-liner).
// `null` clears the relation.
function reflectAriaElements(
  internals: ElementInternals,
  name: 'ariaLabelledByElements' | 'ariaDescribedByElements',
  elements: HTMLElement[] | null,
): void {
  if (name in internals) (internals as unknown as Record<string, HTMLElement[] | null>)[name] = elements
}

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

  // ADR-0051 — the field-labelling handoff, written by `setFieldLabelling`, read by the base's forwarding
  // effect (below) + `fieldLabelling`. `null` = unassociated (the default; every existing control's behavior).
  #fieldLabelling: Signal<FieldLabelling | null> = signal(null)

  /**
   * Super-wrapped wiring (clause 4). `super.connectedCallback()` opens the connection scope + AbortController,
   * runs the no-`super` `connected()` hook, and installs the render effect; the scope is now live, so the
   * effects below are scope-owned and disposed on disconnect (zero residue). They install AFTER the render
   * effect — harmless: the form family's `render()` is the inherited void. The subclass keeps the clean,
   * no-`super` `connected()` hook — it never sees this wrapper.
   */
  connectedCallback(): void {
    super.connectedCallback()
    // Publish the control's value to the form, reactively: reading `formValue()` tracks whatever signals the
    // subclass's hook reads (its `value` prop), so a value change re-runs ONLY this effect → one setFormValue.
    this.effect(() => {
      this.internals.setFormValue(this.formValue())
    })
    // Publish the control's MERGED validity verdict to the platform, reactively (same tracking discipline;
    // `#mergedValidity` is the single source — also fed to the ADR-0050 connect detail below).
    this.effect(() => {
      this.#applyValidity(this.#mergedValidity())
    })
    // ADR-0051 — forward the current field labelling through the overridable hook. Base scope-owned, so
    // association (a `ui-field`'s `setFieldLabelling` call) / clear re-apply reactively. Installed BEFORE
    // the connect dispatch below (LLD-C2) — nothing can call `setFieldLabelling` before this control has
    // even announced itself, so there is no real race, but the ordering is the documented contract.
    this.effect(() => {
      this.applyFieldLabelling(this.#fieldLabelling.value)
    })
    // ADR-0050 — announce full connection to the nearest provider/field ancestor. Dispatched LAST — the
    // scope is open, `connected()` has run, and all three effects above are installed, so a listener sees
    // a fully-wired control. `dispatchEvent` directly (not `this.emit`): composed + bubbling, NOT cancelable
    // — this is base↔provider/field plumbing, not a consumer-facing semantic event.
    this.dispatchEvent(new CustomEvent<FormConnectDetail>(FORM_CONNECT_EVENT, {
      bubbles: true,
      composed: true,
      detail: this.#connectDetail(),
    }))
  }

  /**
   * Mint a FRESH `FormConnectDetail` off the CURRENT connection signal — the single source both the
   * connect dispatch above and `announceFormConnect` (F1, below) construct from, so the two never drift
   * apart. Only meaningful while connected (`connectionSignal` is live); the non-null assertion holds
   * because both call sites already guard on `connectionSignal !== null` before calling this (not
   * `isConnected` — see `announceFormConnect`'s doc for why that guard is the wrong one).
   */
  #connectDetail(): FormConnectDetail {
    return {
      control: this,
      signal: this.connectionSignal as AbortSignal,
      value: () => this.formValue(),
      validity: () => this.#mergedValidity(),
      userInvalid: () => this.formUserInvalid(),
    }
  }

  /**
   * Re-announce full connection (F1 — the review-caught upgrade-order hole). "Ancestors connect before
   * descendants" holds for INSERTION order but NOT custom-element UPGRADE order: pre-existing DOM whose
   * control module registers/upgrades before the provider/field module does means the ONE connect dispatch
   * in `connectedCallback` fires into the void — no listener is live yet — and registration would be lost
   * forever without a catch-up path. Public so a provider/field's one-shot catch-up scan (built at their
   * own build slice) can call it on every already-connected `UIFormElement` it discovers late, re-dispatching
   * `ui-form-connect` with a FRESH detail (the same minting `#connectDetail()` uses, so a reconnect since
   * the original dispatch is reflected — a NEW connection signal, current prop values).
   *
   * Guard: `connectionSignal === null`, NOT `isConnected` (a real bug an s9 repro caught — the bulk-insert
   * hazard). `isConnected` reflects DOM tree membership, set the instant a subtree is spliced in; a custom
   * element's OWN `connectedCallback` (which opens the connection scope + mints `#ac`) fires ASYNC to that,
   * in a separate reaction-queue pass, ancestor-first. So on a bulk insert of a pre-built offline subtree
   * (assemble, then one `append()` — the house test idiom), every descendant is already `isConnected` the
   * moment the PARENT's `connectedCallback` runs (and could catch-up-scan its already-`isConnected`
   * children) even though THEIR OWN `connectedCallback` — and so `connectionSignal` — hasn't fired yet.
   * NOT a jsdom accommodation: atomic-subtree-connect ordering (ancestor-`connectedCallback`-before-
   * descendant, all descendants already `isConnected` throughout) is SPEC-MANDATED and holds identically in
   * every real engine (s8 confirmed with a plain-HTMLElement probe) — this is a real-browser correctness
   * fix, not a test-environment workaround. `connectionSignal === null` is the correct predicate for "has
   * this control's OWN connect wiring run yet": it is null before that control's first `connectedCallback`
   * (nothing to announce — that `connectedCallback` will dispatch for itself momentarily) AND after its
   * `disconnectedCallback` (`#ac` is nulled there too, element.ts) — one guard covers both the not-yet-mine
   * and no-longer-mine legs; `isConnected` is redundant once this holds and is dropped to avoid it masking
   * the real invariant.
   *
   * This guard closes TWO bugs, not one. The obvious one: the pre-fix crash (a `null` `signal` in the
   * minted detail, `detail.signal.aborted` throwing in a registry/field listener). The SILENT one (s8-found):
   * in the same-cascade race, `ui-field`'s association still applies `aria-labelledby` (the labelling signal
   * write does not ride the connection scope), but the affected control's OWN `connectedCallback` — and so
   * its abort listener — had not yet run, so `this.listen(detail.signal, 'abort', …)` in `#associate` would
   * have wired against a signal that was never live, and a later removal would never dissociate (stale
   * labelling, forever). This guard skips the same-cascade announce entirely and lets the descendant's OWN
   * end-of-`connectedCallback` dispatch (below the guard here — see that dispatch's own signal, always live
   * by construction) carry the association instead, once the field/provider is already listening — so the
   * abort listener installs correctly, every time.
   */
  announceFormConnect(): void {
    if (this.connectionSignal === null) return
    this.dispatchEvent(new CustomEvent<FormConnectDetail>(FORM_CONNECT_EVENT, {
      bubbles: true,
      composed: true,
      detail: this.#connectDetail(),
    }))
  }

  /** Map a `ValidityResult` onto `internals.setValidity`: valid clears it; invalid sets flags + message (+ anchor). */
  #applyValidity(result: ValidityResult): void {
    if (result.valid) this.internals.setValidity({})
    else this.internals.setValidity(result.flags, result.message, result.anchor)
  }

  /**
   * The MERGED validity verdict — `formValidity()` ⊕ the renderer-driven `#customValidity` signal (ADR-0029
   * §5): native wins when already invalid; a non-empty custom message produces `{valid:false,
   * flags:{customError:true}, message}`; both empty → valid (clear). The SINGLE source feeding both the
   * internals-publishing effect above and `FormConnectDetail.validity` (ADR-0050 — extracted so the two
   * never drift apart).
   */
  #mergedValidity(): ValidityResult {
    const native = this.formValidity()
    const custom = this.#customValidity.value
    if (!native.valid) return native // native wins (e.g. valueMissing overrides the custom message)
    if (custom !== '') return { valid: false, flags: { customError: true }, message: custom }
    return native // both valid: clear
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

  /**
   * Platform reset → the `formReset()` hook (the subclass restores value ← its defaultValue; clause 2), THEN
   * the ADR-0051 `ui-form-reset` protocol dispatch (composed, bubbling, no detail — the target IS the
   * resetting control) so an observing `ui-field` re-suppresses its visible error. Covers BOTH reset paths:
   * native `form.reset()` (the platform walks its FACE members' `formResetCallback`s) and a form-less
   * provider's direct call to this same public platform callback.
   */
  formResetCallback(): void {
    this.formReset()
    this.dispatchEvent(new CustomEvent(FORM_RESET_EVENT, { bubbles: true, composed: true }))
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

  // ── ADR-0051 — the field-labelling seam ───────────────────────────────────────

  /**
   * Public — a `ui-field` calls this with its label/description/error part elements; `null` clears the
   * association (control removed from its field, or the field itself torn down). Signal-backed (the
   * `setCustomValidity` precedent, ADR-0029 §5) — deliberately NOT a prop: elements can't ride attributes,
   * so this stays off the attributes-as-API descriptor surface. Safe on a disconnected control (a plain
   * signal write); the base effect applies it on next connect.
   */
  setFieldLabelling(refs: FieldLabelling | null): void {
    this.#fieldLabelling.value = refs
  }

  /** Protected reactive read — an override's forwarding effect (or a subclass's own label/message effects,
   *  e.g. text-field's wire) re-runs on association/clear. */
  protected get fieldLabelling(): FieldLabelling | null {
    return this.#fieldLabelling.value
  }

  /**
   * Protected forwarding hook (ADR-0051 cl.2), applied by the base scope-owned effect installed in
   * `connectedCallback`. Default: internals ARIA element reflection, GUARDED on `internals.role != null` —
   * every internals-role control (checkbox/switch/radio/slider/calendar) wires for FREE, while a role-less
   * host deliberately no-ops (a half-attached name on a role-less AX node is silent lossiness that can fool
   * a probe — a part-role control, e.g. text-field, MUST override instead). Contract for an override:
   * idempotent; handle `null` (clear); guard a not-yet-created part.
   */
  protected applyFieldLabelling(refs: FieldLabelling | null): void {
    if (this.internals.role == null) return // role-less host — a part-role control MUST override (ADR-0051)
    reflectAriaElements(this.internals, 'ariaLabelledByElements', refs?.label ? [refs.label] : null)
    const described = refs ? [refs.description, refs.error].filter((el): el is HTMLElement => el !== null) : null
    reflectAriaElements(this.internals, 'ariaDescribedByElements', described && described.length > 0 ? described : null)
  }

  /**
   * Protected user-invalid gate, feeding `FormConnectDetail.userInvalid` (ADR-0050). Default `false`. A
   * control composing `trackUserInvalid` overrides it with its tracker's gate (`() =>
   * tracker.userInvalid()`), keeping ONE timing source — the field's error observation rides this read
   * (jsdom cannot match `:state(user-invalid)`; the browser gate asserts the equivalence).
   */
  protected formUserInvalid(): boolean {
    return false
  }
}

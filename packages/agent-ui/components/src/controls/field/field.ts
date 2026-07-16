// field.ts — UIFieldElement, the visible label/description/error wrapper around ONE slotted form control
// (goals.md §G7 / decomp g7-field-form-provider slice s2, LLD-C4). BEHAVIOUR + props + the three parts +
// self-define ONLY; geometry/colour live in field.css (s3), the public contract in field.md (s4).
//
// `ui-field` extends `UIElement` (NOT `UIFormElement` — a field carries no form value of its own; wrapping
// it form-associated would double-submit) and reads the ADR-0050 `ui-form-connect` protocol event the base
// dispatches on EVERY `UIFormElement` connect. Labelling rides the ADR-0051 seam (`setFieldLabelling`) — the
// field never reaches into a control's internals or parts; the visible error rides the control's OWN
// user-invalid timing (`FormConnectDetail.userInvalid`), so there is exactly one timing source, never a
// second one duplicated here.
//
// Error-rendering history (two shipped bugs, same root smell — event-driven OBSERVATION of a timing
// signal, instead of just reading it reactively): (1) five DOM listeners (input/change/blur/invalid/reset)
// each calling a render — broke because `blur`/`invalid` are capture-only (they don't bubble): capture runs
// ancestor→target, so this field's listener (ancestor) could read the control's `userInvalid()` BEFORE the
// deeper `trackUserInvalid` listener (registered on the control itself) flipped `interacted` on the SAME
// dispatch — a stale read, first blur showed nothing. (2) a microtask-deferred re-render — passed every
// scripted/jsdom repro (a synchronous `dispatchEvent` call holds the JS stack through the WHOLE
// propagation, so a deferred read always lands after), but s11's real cross-engine browser probe falsified
// it: a genuine user-driven blur inserts a microtask CHECKPOINT between capture listeners (each listener
// return empties the call stack), so the deferred read still ran before the tracker's, in BOTH engines — no
// microtask-hop count survives a UA checkpoint. THIS (3rd) design has no event-listener race to have at
// all: `#associate` installs a scope-owned reactive EFFECT over the connect detail's tracked closures
// (`userInvalid()` / `validity()`, ADR-0050 §4) — every real trigger (typing, blur/change flipping
// `interacted`, a live `setCustomValidity` write, a reset writing `interacted` back to false) is a plain
// signal write the kernel wakes this effect for directly; there is no DOM dispatch order to depend on.
//
// Association is event-driven, first-wins, nearest-field-scoped: the field does NOT stop the connect event
// from bubbling (a provider ancestor still needs to see it), and accepts a control only when
// `control.closest('ui-field') === this` — the guard that also refuses a control belonging to a nested
// inner field. The option-A bridge (ADR-0051 cl.3) is the fallback for a control with no seam wire: when
// the associating control exposes an empty string `label` prop, a scope-owned effect writes this field's
// `label` text into it, disposed (and the write undone) on dissociation — never touching a consumer-set label.
//
// Upgrade order (define order ≠ tree order, ADR-0051 cl.5): a control can upgrade before this field does,
// so its one connect dispatch lands before any listener is live here. The complement is a one-shot catch-up
// scan at THIS field's own connect — `querySelectorAll('*')` → `instanceof UIFormElement` →
// `announceFormConnect()` — re-run again after a dissociation (while the field stays connected) so a second,
// still-slotted control can associate next (first-wins is per-tenure, not forever).
//
// Host carries no role/aria-* attribute (a structural wrapper); the only internals use is the
// `user-invalid` custom state, mirroring the associated control's own gate. `controls → dom` is the
// allowed import direction.

import {
  UIElement,
  UIFormElement,
  FORM_CONNECT_EVENT,
  prop,
  type PropsSchema,
  type ReactiveProps,
  type FormConnectDetail,
} from '../../dom/index.ts'

// A per-instance id seed for the three parts (the text-field `messageSeq` precedent) — one sequence number
// shared by all three ids on a given instance, so `ui-field-label-3` / `-description-3` / `-error-3` read as
// a set at a glance.
let fieldSeq = 0

// The option-A bridge target shape (ADR-0051 cl.3): a control exposing a string `label` prop. Detected
// STRUCTURALLY — the field must stay control-agnostic (it never imports text-field to check `instanceof`).
interface LabelledControl {
  label: string
}

function hasStringLabel(control: UIFormElement): control is UIFormElement & LabelledControl {
  return typeof (control as unknown as Partial<LabelledControl>).label === 'string'
}

const props = {
  label: { ...prop.string(), reflect: true }, // the visible label text → [data-part=label] (reflect: false — text-field precedent)
  description: prop.string(), // the visible description text → [data-part=description] (reflect: false)
} satisfies PropsSchema

export interface UIFieldElement extends ReactiveProps<typeof props> {}
export class UIFieldElement extends UIElement {
  static props = props

  // The three parts, created ONCE (idempotent across reconnect — light-DOM children persist through
  // disconnect, the text-field editor precedent). Nullable until `#ensureParts` runs; every other read
  // happens after `connected()` has run, so a cast is safe there (the `#message as HTMLElement` precedent).
  #label: HTMLElement | null = null
  #description: HTMLElement | null = null
  #error: HTMLElement | null = null

  // The associated control's connect detail — `null` while unassociated. First-wins: set once per tenure,
  // cleared by `#dissociate` (control removal, or the field's own teardown).
  #assoc: FormConnectDetail | null = null

  // The option-A bridge (ADR-0051 cl.3). `#bridgeControl` doubles as its own "armed" flag: non-null iff the
  // bridge effect is live for THAT control, so `#dissociate` knows both whether to dispose the effect and
  // whether to clear the control's label (never touching a consumer-set one).
  #bridgeControl: (UIFormElement & LabelledControl) | null = null
  #bridgeDispose: (() => void) | null = null

  // The reactive error-render effect (design #3 — see the header history), installed per association
  // (`#associate`) and disposed at `#dissociate` — the bridge-disposer pattern, applied twice.
  #renderDispose: (() => void) | null = null

  protected connected(): void {
    const { label, description } = this.#ensureParts()

    // Visible text — reactive; the part ELEMENTS (and ids) stay stable across a prop change, so an
    // associated control's labelling references never need a re-handoff.
    this.effect(() => {
      label.textContent = this.label
    })
    this.effect(() => {
      description.textContent = this.description
    })

    // ── association (event-driven, the LLD-C1 event doing double duty) ──
    // Deliberately NO stopPropagation — the event must keep bubbling to a provider ancestor.
    this.listen(this, FORM_CONNECT_EVENT, (event) => {
      const detail = (event as CustomEvent<FormConnectDetail>).detail
      if (!(detail?.control instanceof UIFormElement)) return // defense — the event never fires without one
      if (this.#assoc !== null) return // first-wins — a second control in this field stays un-associated
      if (detail.control.closest('ui-field') !== this) return // nearest-field rule (also rejects a nested field's control)
      this.#associate(detail)
    })

    // Error rendering is no longer a listener here at all — it rides a reactive effect installed per
    // association (`#associate`, design #3 in the header history). No event listener, no dispatch-order
    // to depend on: `assoc.control`'s own `formReset()` (text-field: writes `this.value` + the tracker's
    // `interacted` back to false, both tracked signals) wakes the same effect, so a reset needs no separate
    // observation path either.

    // ── upgrade-path catch-up (LLD-C1 / ADR-0051 cl.5) — AFTER the listeners above install ──
    this.#catchUp()
  }

  protected disconnected(): void {
    this.#dissociate() // resources still live — a field removed from around its control must not leave stale labelling
  }

  /**
   * Accept a connect detail: store it, hand the parts to the control via the ADR-0051 seam, arm the
   * option-A bridge, install the reactive error-render effect (design #3 — the header history), and watch
   * the control's own connection signal so its removal dissociates this field.
   */
  #associate(detail: FormConnectDetail): void {
    this.#assoc = detail
    detail.control.setFieldLabelling({ label: this.#label, description: this.#description, error: this.#error })
    this.#armBridge(detail.control)
    this.#renderDispose = this.effect(() => this.#renderValidity(detail))
    this.listen(detail.signal, 'abort', () => this.#dissociate(), { once: true })
  }

  /**
   * Idempotence insurance (the `#assoc === null` early return) — TWO paths reach this: the associated
   * control's own abort listener (removed from the field) and this field's `disconnected()` (field itself
   * removed). Clears the labelling handoff, the bridge, and the visible error; then, IFF the field itself
   * stays connected, re-runs the catch-up scan so a remaining slotted control can associate next — first-wins
   * is per-tenure, not forever. Skipped on the field-disconnect path: re-associating from a field being torn
   * down would mint labelling refs into a detached subtree.
   */
  #dissociate(): void {
    const assoc = this.#assoc
    if (assoc === null) return
    this.#renderDispose?.() // stop the reactive render — otherwise it outlives dissociation, reading a removed control
    this.#renderDispose = null
    this.#bridgeDispose?.() // stop the scope-owned effect — otherwise it outlives dissociation and keeps writing
    this.#bridgeDispose = null
    if (this.#bridgeControl) this.#bridgeControl.label = '' // only the bridge's own write; a consumer-set label stands
    this.#bridgeControl = null
    assoc.control.setFieldLabelling(null) // safe on a detached node — a plain signal write
    this.#assoc = null
    const error = this.#error as HTMLElement
    error.textContent = ''
    error.hidden = true
    this.internals.states?.delete('user-invalid')
    if (this.isConnected) this.#catchUp() // per-tenure re-arm — skipped when it is the field itself being removed
  }

  /**
   * The option-A bridge (ADR-0051 cl.3): the fallback name path for a control with no seam wire. Arms ONLY
   * when the control exposes a string `label` prop currently equal to `''` — a pre-set (consumer-owned)
   * label is never touched, arriving or leaving. The effect tracks this field's `label` prop, so a later
   * edit keeps the bridged control's name current.
   */
  #armBridge(control: UIFormElement): void {
    if (!hasStringLabel(control) || control.label !== '') return
    this.#bridgeControl = control
    this.#bridgeDispose = this.effect(() => {
      control.label = this.label
    })
  }

  /**
   * One-shot re-announce of every already-connected `UIFormElement` descendant (LLD-C1 / ADR-0051 cl.5) —
   * covers a control that upgraded BEFORE this field did, whose own connect dispatch landed before any
   * listener here was live. A not-yet-upgraded control is skipped (the `instanceof` filter) and covers
   * itself: its own `connectedCallback` dispatches at upgrade, once this field is already listening.
   */
  #catchUp(): void {
    for (const el of this.querySelectorAll('*')) {
      if (el instanceof UIFormElement) el.announceFormConnect()
    }
  }

  /**
   * The reactive error render (design #3 — the header history). Reads the associated control's OWN gates
   * through the ADR-0050 connect closures — `assoc.validity()` / `assoc.userInvalid()` are TRACKED reads
   * (an effect subscribes to whatever signals they close over: the control's `value`/`required` props, the
   * `trackUserInvalid` tracker's `interacted` signal, `setCustomValidity`'s signal); `control.validationMessage`
   * (the platform DOM getter) is deliberately NOT read here — an effect cannot subscribe to it, which is
   * exactly the gap the two prior designs papered over with an event listener. Installed once per
   * association (`this.effect(...)` in `#associate`) — its lifetime IS the association's, so there is no
   * `#assoc` null-guard to write: `#dissociate` disposes this effect before anything else. An empty message
   * while user-invalid is treated as not-showing — no empty-but-visible error box.
   */
  #renderValidity(assoc: FormConnectDetail): void {
    const verdict = assoc.validity()
    const message = !verdict.valid ? verdict.message : ''
    const showing = assoc.userInvalid() && message !== ''
    const error = this.#error as HTMLElement
    error.textContent = showing ? message : ''
    error.hidden = !showing
    if (showing) this.internals.states?.add('user-invalid')
    else this.internals.states?.delete('user-invalid')
  }

  /**
   * Create the three parts ONCE (idempotent across reconnect — light-DOM children persist through
   * disconnect, the text-field editor precedent). DOM placement IS the reading order: label PREPENDED,
   * description + error APPENDED (author children — the slotted control — sit between); column flow needs
   * no CSS `order`. A `<div>` label, not a `<label>`: no `for` semantics apply here, and a bare `<label>`
   * invites click-forwarding expectations this seam doesn't need. `error` starts hidden + empty.
   */
  #ensureParts(): { label: HTMLElement; description: HTMLElement; error: HTMLElement } {
    if (this.#label && this.#description && this.#error) {
      return { label: this.#label, description: this.#description, error: this.#error }
    }

    const seq = ++fieldSeq

    const label = document.createElement('div')
    label.setAttribute('data-part', 'label')
    label.id = `ui-field-label-${seq}`
    this.#label = label
    this.prepend(label)

    const description = document.createElement('div')
    description.setAttribute('data-part', 'description')
    description.id = `ui-field-description-${seq}`
    this.#description = description

    const error = document.createElement('div')
    error.setAttribute('data-part', 'error')
    error.id = `ui-field-error-${seq}`
    error.hidden = true
    this.#error = error

    this.append(description, error)

    return { label, description, error }
  }
}

if (!customElements.get('ui-field')) customElements.define('ui-field', UIFieldElement)

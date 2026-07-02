// form-provider.ts — UIFormProviderElement, the fleet's first context/provider primitive (ADR-0050;
// LLD-C7, decomp g7-field-form-provider slice s5). BEHAVIOUR + self-define ONLY — geometry lives in
// form-provider.css (s6), the public contract in form-provider.md (s7).
//
// A pure coordination element: NO static props (a coordination element takes no configuration — the
// descriptor's `attributes: []`), extends `UIElement` directly — NOT `UIFormElement` (the provider carries
// no value of its own; wrapping it `formAssociated` would double-submit, ADR-0050 alternatives) and NOT
// `UIContainerElement` (no surface paint). Discovery/aggregation is entirely the ADR-0050 connect-time
// registration event + `traits/form-registry.ts`'s reactive registry (the listener, the four aggregate
// computeds, teardown-by-abort all live there); this class is the thin public surface over that registry
// plus the two coordination methods, submit()/reset().
//
// Upgrade-path catch-up (LLD-C1 / ADR-0051 cl.5): "ancestors connect before descendants" holds for
// INSERTION order but not custom-element UPGRADE order — pre-existing DOM whose control module upgrades
// before this provider's does dispatches `ui-form-connect` into the void (no listener yet). `connected()`
// runs a one-shot `querySelectorAll('*')` AFTER the registry's listener installs and re-announces every
// already-connected `UIFormElement` it finds via `announceFormConnect()` — the registry's dup guard makes
// the re-announce idempotent, so this scan never double-registers a control that connected in time.
//
// `controls → dom + traits` is the allowed import direction.

import { UIElement, UIFormElement } from '../../dom/index.ts'
import type { FormValue, PropsSchema } from '../../dom/index.ts'
import { formRegistry, type FormRegistryController } from '../../traits/form-registry.ts'

/**
 * The `submit()` aggregate detail (LLD-C7 — pinned event naming). The closed house event vocab has no
 * `submit`; a provider-level submit IS a commit semantically, so it rides `change`. Disambiguation from a
 * bubbled member `change` (which carries `detail: null` through the provider): `event.target === provider`.
 */
export interface FormSubmitDetail {
  entries: ReadonlyArray<readonly [string, FormValue]>
  values: Readonly<Record<string, FormValue>>
}

export class UIFormProviderElement extends UIElement {
  // EMPTY by design — a coordination element takes no configuration (descriptor `attributes: []`). The
  // field exists (rather than being omitted) for the fleet convention + the s10 descriptor trip-wire
  // (`compareDescriptorToProps` needs a live PropsSchema object to compare against).
  static props = {} satisfies PropsSchema
  #registry: FormRegistryController | null = null // created in connected(), nulled in disconnected()

  protected connected(): void {
    this.#registry = formRegistry(this)
    // Upgrade-path catch-up (see header) — AFTER the registry's listener is live, so a re-announced
    // control registers immediately rather than racing this scan.
    for (const el of this.querySelectorAll('*')) {
      if (el instanceof UIFormElement) el.announceFormConnect()
    }
  }

  protected disconnected(): void {
    this.#registry?.release()
    this.#registry = null
  }

  /** Live registered controls, registration order — a reactive read (projects `registry.members`). Empty while disconnected. */
  get controls(): readonly UIFormElement[] {
    return this.#registry?.members.value.map((member) => member.control) ?? []
  }

  /** Submission entries — native FormData parity (see form-registry.ts). Empty while disconnected. */
  entries(): ReadonlyArray<readonly [string, FormValue]> {
    return this.#registry?.entries.value ?? []
  }

  /** Keyed convenience view of entries() — last entry wins on a duplicate name. Empty while disconnected. */
  values(): Readonly<Record<string, FormValue>> {
    return this.#registry?.values.value ?? {}
  }

  /** Members whose merged verdict is invalid, registration order. Empty while disconnected. */
  invalid(): readonly UIFormElement[] {
    return this.#registry?.invalid.value ?? []
  }

  /** invalid().length === 0. Vacuously true while disconnected. */
  valid(): boolean {
    return this.#registry?.valid.value ?? true
  }

  /**
   * If invalid: `reportValidity()` on the FIRST invalid member (registration order — native "focus the
   * first invalid control" parity; the UA anchors/announces it) and return `false`, no event. Else emit
   * the aggregate as a `change` (this module's `FormSubmitDetail` — see the type doc for the
   * disambiguation from a bubbled member `change`) and return `true`.
   */
  submit(): boolean {
    // Disconnected FIRST, ahead of the validity check: valid() is a read and degrades gracefully
    // (vacuously true with no registry), but submit() is an ACTION — an empty aggregate from a
    // disconnected provider means "I can't see the form," not "the form is empty," so it must refuse
    // (no reportValidity, no emit), not report a hollow success.
    if (this.#registry === null) return false
    if (!this.valid()) {
      this.invalid()[0]?.reportValidity()
      return false
    }
    this.emit('change', { entries: this.entries(), values: this.values() } satisfies FormSubmitDetail)
    return true
  }

  /**
   * Native composition (decomp `provider_and_native_form`): partition members by their public `.form` —
   * each DISTINCT non-null owning `<form>` gets ONE `form.reset()` (the platform itself walks that form's
   * FACE members' `formResetCallback`s — calling reset per-member here would double-reset); form-less
   * members get a direct `formResetCallback()` call (the public platform callback). Both paths end in the
   * base's `ui-form-reset` dispatch (LLD-C1, `dom/form.ts`) — this method never dispatches it itself.
   */
  reset(): void {
    const resetForms = new Set<HTMLFormElement>()
    for (const control of this.controls) {
      const form = control.form
      if (form === null) {
        control.formResetCallback()
        continue
      }
      if (resetForms.has(form)) continue // already reset via this form
      resetForms.add(form)
      form.reset()
    }
  }
}

if (!customElements.get('ui-form-provider')) customElements.define('ui-form-provider', UIFormProviderElement)

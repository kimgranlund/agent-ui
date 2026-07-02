// form-registry.ts — the reactive form-registry CONTROLLER (ADR-0050 §2/§3, LLD-C3): the aggregation half of
// the connect-time registration mechanism form.ts's `ui-form-connect` protocol event feeds. Invoked from
// `ui-form-provider`'s `connected()` — the connection scope + AbortSignal are live there, the same
// `trackUserInvalid` controller pattern — NOT invoked from a plain control.
//
// Discovery rides the protocol event alone (no MutationObserver): a control connected under the provider
// dispatches `ui-form-connect` at the END of its own `connectedCallback` (form.ts), the listener installed
// here registers it, and `stopPropagation()` scopes membership to the NEAREST provider under nesting.
// Teardown rides the event's connection-scoped `AbortSignal`, not a second event — a disconnected control
// cannot dispatch, so the registry subscribes to the handle's `abort` instead (dual-lifetime: the control's
// OWN disconnect aborts its handle → its entry alone is removed; the PROVIDER's disconnect aborts the HOST
// signal every one of these listeners rides via `host.listen` → all per-member listeners die at once — zero
// residue either way, no dead node ever lingers in `members`).
//
// The four aggregates (entries/values/invalid/valid) are `computed`s over the plain `members` signal —
// UN-owned (not wrapped in `scope.run`): a computed's subscriber set lives only while a reading effect
// subscribes to it (kernel semantics), so residue dies with the READERS, not with this controller. Every
// add/remove writes a NEW frozen array into `members` (Object.is cutoff ⇒ fine-grained waking for anyone
// reading a single aggregate, not all four).
//
// Layering: traits → reactive (L0) + dom (L1) — both downward, the import-layering trip-wire holds. The
// runtime `instanceof UIFormElement` guard (not just the TS type) is defense: the event never fires from a
// non-form child, but the guard makes that a proven negative control (s9), not an assumption.

import { computed, signal } from '../reactive/index.ts'
import type { ReadonlySignal } from '../reactive/index.ts'
import { UIFormElement, FORM_CONNECT_EVENT } from '../dom/index.ts'
import type { UIElement, FormConnectDetail, FormValue, ValidityResult } from '../dom/index.ts'

/** One registered control's PUBLIC reactive surface — the `ui-form-connect` detail, minus the teardown
 *  handle the registry has already consumed (its `abort` is wired to `removeMember` at registration). */
export interface FormMember {
  control: UIFormElement
  value: () => FormValue
  validity: () => ValidityResult
}

export interface FormRegistryController {
  /** Live members, registration order (≈ document order for parse/append; a re-slotted control re-enters
   *  at the end — documented, not corrected). */
  members: ReadonlySignal<readonly FormMember[]>
  /** Submission entries — native FormData parity: name ≠ '', not effectiveDisabled(), value() ≠ null;
   *  duplicate names PRESERVED. */
  entries: ReadonlySignal<ReadonlyArray<readonly [string, FormValue]>>
  /** Keyed convenience view of entries — LAST entry wins on a duplicate name (documented). */
  values: ReadonlySignal<Readonly<Record<string, FormValue>>>
  /** Members whose merged verdict is invalid — unnamed controls INCLUDED (native: validation is
   *  name-independent), effectiveDisabled() members EXCLUDED (native: disabled ⇒ barred from constraint
   *  validation). */
  invalid: ReadonlySignal<readonly UIFormElement[]>
  /** invalid().length === 0 */
  valid: ReadonlySignal<boolean>
  /** Idempotent early teardown (the trait contract); otherwise everything dies with the connection. */
  release: () => void
}

/**
 * Attach the reactive form registry to a `ui-form-provider` host. Invoke from `connected()` (connection
 * scope + AbortSignal live). Listens for `ui-form-connect` on the host, registers each control at the
 * NEAREST provider (`stopPropagation`), and deregisters on the control's connection-scoped `abort` — a
 * late-added control is discovered by construction (its own connect dispatch re-fires), a removed one drops
 * out with zero residue.
 */
export function formRegistry(host: UIElement): FormRegistryController {
  let released = false
  const members = signal<readonly FormMember[]>([])

  // ── the four aggregates — computeds over `members`, un-owned (kernel semantics; see the header note) ──

  const entries = computed<ReadonlyArray<readonly [string, FormValue]>>(() => {
    const result: Array<readonly [string, FormValue]> = []
    for (const member of members.value) {
      if (member.control.name === '' || member.control.effectiveDisabled()) continue
      const value = member.value()
      if (value === null) continue
      result.push([member.control.name, value])
    }
    return result
  })

  const values = computed<Readonly<Record<string, FormValue>>>(() => {
    const result: Record<string, FormValue> = {}
    for (const [name, value] of entries.value) result[name] = value // last entry wins on a duplicate name
    return result
  })

  const invalid = computed<readonly UIFormElement[]>(() => {
    const result: UIFormElement[] = []
    for (const member of members.value) {
      if (member.control.effectiveDisabled()) continue // native parity: disabled is barred from validation
      if (!member.validity().valid) result.push(member.control)
    }
    return result
  })

  const valid = computed(() => invalid.value.length === 0)

  // ── membership writes — always a NEW frozen array (Object.is cutoff) ──────────────────────────────────

  const addMember = (member: FormMember): void => {
    members.value = Object.freeze([...members.value, member])
  }
  const removeMember = (control: UIFormElement): void => {
    members.value = Object.freeze(members.value.filter((member) => member.control !== control))
  }

  // ── the connect listener (ADR-0050 §2/§3) ─────────────────────────────────────────────────────────────

  const onConnect = (event: Event): void => {
    if (released) return
    const detail = (event as CustomEvent<FormConnectDetail>).detail
    // Defense, not the discovery path — the event never fires from a non-form child (s9 negative control).
    if (!(detail?.control instanceof UIFormElement)) return
    event.stopPropagation() // nearest-provider scoping — stopped even for a dup/aborted registration below
    if (detail.signal.aborted) return // a stale reconnect handle can never register
    if (members.value.some((member) => member.control === detail.control)) return // idempotence guard
    addMember({ control: detail.control, value: detail.value, validity: detail.validity })
    // Dual-lifetime: the control's OWN disconnect aborts `detail.signal` → this fires → the entry is
    // removed. The PROVIDER's disconnect aborts the connection signal `host.listen` rides → this listener
    // itself is removed (no residue on a still-connected control's signal).
    host.listen(detail.signal, 'abort', () => {
      if (released) return
      removeMember(detail.control)
    }, { once: true })
  }
  host.listen(host, FORM_CONNECT_EVENT, onConnect)

  return {
    members,
    entries,
    values,
    invalid,
    valid,
    release: (): void => {
      released = true
      members.value = Object.freeze([])
    },
  }
}

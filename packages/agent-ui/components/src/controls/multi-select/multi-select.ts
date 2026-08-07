// multi-select.ts — UIMultiSelectElement, the M-F multi-select field (multi-select-field.lld.md
// LLD-C1/C2/C6 · multi-select-field.spec.md SPEC-R1..R8 · ADR-0175).
//
// Composition: a UIFormElement host that IS the listbox — `role=listbox` via `ElementInternals` (never a
// host attribute), holding author- or catalog-adopted `[role=option]` children as DIRECT light-DOM
// children (no control-created panel — unlike ui-select's overlay trigger+panel, there is no separate
// element to move options into: the host itself is both the wrapper AND the always-visible surface,
// LLD §4). `rovingFocus` (keyboard navigation, type-ahead OFF) + `selectionCommit` (mode 'multi-toggle',
// LLD-C4) are composed directly, the same `ui-select`/`ui-combo-box` idiom (traits on the control, never
// via extending `UIListboxElement`).
//
// Anatomy: NO trigger, NO popup, NO overlay-controller — an inline block-level listbox surface. The
// checkmark is painted ENTIRELY in CSS as `[role=option][aria-selected="true"]::before` (LLD-C3) — zero
// DOM injection into author/catalog-adopted option nodes, reading `aria-selected` (already reflected by
// `selectionCommit`) directly. No new anatomy attribute.
//
// The MutationObserver (LLD §4, the TKT-0026 pattern `select.ts`/`combo-box.ts` each already carry,
// copied locally per §12's "no shared extraction forced at the third consumer" note): because the host
// IS the listbox, there is no separate panel to MOVE options into — what the observer actually does here
// is re-run `#syncOptionState()` on every childList change, so a LATE-adopted option (added after connect,
// or via a catalog full-rebuild) is immediately painted correctly: `aria-selected` matching the CURRENT
// `value` array, and `aria-disabled` matching the CURRENT `effectiveDisabled()` state — both of which
// `selectionCommit`'s own reflection only re-applies on a USER commit, never on an external `value` write
// or a DOM mutation. `#syncOptionState()` is also what makes SPEC-R5 AC2 ("`el.value = […]` externally
// reflects the checked set") true: `selectionCommit`'s internal `multiKeys` Set has no external setter, so
// this control owns the value→aria-selected reflection itself, decoupled from the trait's own commit-time
// paint (harmless redundancy on a user commit — both agree).
//
// Form: formValue() = a `FormData` with one `.append(this.name, v)` per selected value (SPEC-R5 —
// contributes MULTIPLE entries under `name`, matching native `<select multiple>`/checkbox-group
// semantics); zero selections → an empty `FormData()`, submitting nothing (LLD-C6). formValidity() =
// required && value.length === 0 → valueMissing (mirrors `UIListboxElement`'s own required-empty check).
// formReset() restores `value` to the array the `value` ATTRIBUTE held at connect time (the
// `combo-box.md` "the attribute seeds the reset baseline" convention).
//
// Labelling (ADR-0085): the host itself carries `internals.role`, so the BASE `UIFormElement`'s own
// GUARDED default `applyFieldLabelling` (fielded case: `ariaLabelledByElements`) already wires for free —
// no override needed (unlike `ui-select`'s button trigger / `ui-combo-box`'s editor part, neither of
// which carries `internals.role` on the host). Bare/unfielded usage sets `internals.ariaLabel` directly
// from the `label` prop — simpler than `ui-select`'s visually-hidden-span concatenation, since a listbox
// container has no OWN visible "current value" text an aria-label could erase (unlike a trigger button).
//
// Import layers: controls/ → dom + traits + reactive (inward-only ✓).
// erasableSyntaxOnly ✓ (no enum/namespace/decorators). verbatimModuleSyntax ✓ (import type).

import { prop, type PropConfig, type PropType, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIFormElement } from '../../dom/index.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { selectionCommit } from '../../traits/selection-commit.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'

// ── LLD-C2 — the `value: string[]` codec ────────────────────────────────────────────────────────────
//
// Co-located (mirrors `table-model.ts`'s in-file `safeJsonCodec` placement — a control-owned codec, not
// exported shared infra). `cleanValue` hardens an arbitrary input into a string array (a non-array input
// → `[]`; a non-string member is dropped, never coerced — order preserved, duplicates not deduped, the
// `table-model.ts` `cleanSelected` precedent). The codec's `from(null) → []`, and malformed attribute
// JSON also falls back to `[]` — NEVER throws, NEVER `null`/`undefined` (SPEC-R4), unlike bare
// `prop.json()` (`dom/props.ts`), which throws on malformed JSON and returns `null` on attribute absence.

/** Harden an arbitrary `value` input into a string array (SPEC-R4's never-null floor). */
function cleanValue(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((v): v is string => typeof v === 'string')
}

/** The safe JSON-array codec: `from(null) → []`; malformed JSON also → `[]`, never throws. */
const valueType: PropType<string[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanValue(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

/** NOT reflected — bindable selection state, not an authored dimension (the `table-model.ts`
 *  `tableSelectedProp` precedent). The attribute is still INBOUND-parsed (coerceAttribute), so a
 *  declarative `<ui-multi-select value='["a"]'>` still seeds the initial value. */
const valueProp: PropConfig<string[]> = {
  type: valueType,
  default: [],
}

// ── Props ────────────────────────────────────────────────────────────────────────────────────────────

const props = {
  // Universal form attributes from the spreadable formProps (name/disabled/required).
  ...UIFormElement.formProps,

  // `value` — the selected option keys, LLD-C2's codec. Never null/undefined (SPEC-R4).
  value: valueProp,

  // `label` — the bare-usage accessible-name source (ADR-0085; `select.md`/`combo-box.md` precedent).
  // NOT reflected — an accessibility hint, not a styling hook.
  label: { ...prop.string(), reflect: true },

  // `size` — the dimensional-ramp step (LLD-C5's geometry dial: sm/md/lg → §1 rows 24/28/36).
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
} satisfies PropsSchema

// ── Element ──────────────────────────────────────────────────────────────────────────────────────────

export interface UIMultiSelectElement extends ReactiveProps<typeof props> {}
export class UIMultiSelectElement extends UIFormElement {
  static props = props

  // Native-parity reset baseline — seeded ONCE from the initial `value` attribute (the `combo-box.ts`
  // `#defaultValue`/`#defaultCaptured` precedent).
  #defaultValue: string[] = []
  #defaultCaptured = false

  // TKT-0026-pattern observer (see the file header) — re-syncs option PAINT (aria-selected/aria-disabled)
  // on every later light-DOM mutation. Created fresh on every connect; disconnected + nulled in disconnected().
  #optionObserver: MutationObserver | null = null

  // The user-invalid TIMING controller (ADR-0051), created per connection (re-arms on reconnect;
  // released on disconnect) — the `select.ts`/`radio-group.ts` precedent.
  #userInvalid: TrackUserInvalidController | null = null

  // Options this control itself marked `aria-disabled` (because the WHOLE control is disabled) — tracked
  // so re-enabling only clears OUR marks, never an author-set `aria-disabled` on an individually-disabled
  // option (§8's "all-disabled" case stays the author's own call).
  #hostDisabledOptions = new WeakSet<HTMLElement>()

  // ── Form seams (UIFormElement hooks) ──────────────────────────────────────────────────────────────

  protected override formValue(): FormValue {
    // LLD-C6 — a FormData with one entry per selected value; zero selections → an empty FormData()
    // (submits nothing, native `<select multiple>` parity, no special-case code).
    const fd = new FormData()
    for (const v of this.value) fd.append(this.name, v)
    return fd
  }

  protected override formValidity(): ValidityResult {
    if (this.required && this.value.length === 0) {
      return { valid: false, flags: { valueMissing: true }, message: 'Please select at least one option.' }
    }
    return { valid: true }
  }

  protected override formReset(): void {
    this.value = this.#defaultValue
    // ADR-0051 — a reset must not leave a required-empty control showing :state(user-invalid) until the
    // user re-interacts (the text-field/select formReset() precedent).
    this.#userInvalid?.reset()
  }

  protected override disconnected(): void {
    this.#userInvalid?.release() // idempotent — the listeners already die with the connection scope
    this.#userInvalid = null
    this.#optionObserver?.disconnect()
    this.#optionObserver = null
  }

  /** Feeds `FormConnectDetail.userInvalid` (ADR-0050) — the `trackUserInvalid` tracker IS the one timing
   *  source; this override just exposes its gate. */
  protected override formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────────────────────────────

  protected override connected(): void {
    // Capture the reset baseline ONCE from the initial `value` attribute (see combo-box.ts pattern).
    if (!this.#defaultCaptured) {
      this.#defaultValue = valueType.from(this.getAttribute('value'))
      this.#defaultCaptured = true
    }

    // LLD-C1 — `role=listbox` + `aria-multiselectable` via ElementInternals, never a host attribute
    // (SPEC-R8: a real ARIAMixin IDL member, never a bespoke ARIA invention).
    this.internals.role = 'listbox'
    this.internals.ariaMultiSelectable = 'true'

    // ADR-0051 — the user-invalid TIMING controller. This control never emits a native `change` event
    // (only `select`, SPEC-R2), so blur is the sole interaction signal (the `ui-select` precedent — that
    // control shares this same one-signal shape).
    const invalidController = trackUserInvalid(this, { invalid: () => !this.formValidity().valid })
    this.#userInvalid = invalidController
    this.effect(() => {
      if (invalidController.userInvalid()) {
        this.internals.states?.add('user-invalid')
        this.internals.ariaInvalid = 'true'
      } else {
        this.internals.states?.delete('user-invalid')
        this.internals.ariaInvalid = null
      }
    })

    // The effective-disabled channel (own `disabled` prop OR ancestor <fieldset disabled>/form-disabled) —
    // :state(disabled) mirrors select.ts/text-field.ts's own CSS hook, so the `disabled` attribute reflect
    // ALONE never has to carry the form-disabled case too.
    this.effect(() => {
      if (this.effectiveDisabled()) this.internals.states?.add('disabled')
      else this.internals.states?.delete('disabled')
    })

    // ADR-0085 — the bare-usage accessible-name seam. The host carries `internals.role`, so the BASE
    // `applyFieldLabelling` default (guarded on `internals.role != null`, dom/form.ts) already wires the
    // FIELDED case for free (`ariaLabelledByElements`) — this effect owns ONLY the bare/unfielded case,
    // the same split-ownership discipline `ui-select`'s own bare-mode effect documents (never touches the
    // labelledby wiring while fielded, so the two can never race in the same flush wave).
    this.effect(() => {
      if (this.fieldLabelling !== null) return // fielded — the base default owns naming exclusively
      this.internals.ariaLabel = this.label || null
    })

    // Live option accessor (re-reads the DOM on each event for dynamic option sets — options are DIRECT
    // light-DOM children, no separate panel to scope into).
    const items = (): HTMLElement[] => [...this.querySelectorAll<HTMLElement>('[role=option]')]
    const keyOf = (el: HTMLElement): string => el.getAttribute('value') ?? ''

    // Re-paint every option's `aria-selected` (from the CURRENT `value` array) and `aria-disabled` (from
    // the CURRENT `effectiveDisabled()`) — see the file header for why this control owns this reflection
    // itself rather than relying solely on `selectionCommit`'s own commit-time paint.
    const syncOptionState = (): void => {
      const selected = new Set(this.value)
      const disabled = this.effectiveDisabled()
      for (const opt of items()) {
        const k = keyOf(opt)
        opt.setAttribute('aria-selected', String(k !== '' && selected.has(k)))
        if (disabled) {
          if (!opt.hasAttribute('aria-disabled')) {
            opt.setAttribute('aria-disabled', 'true')
            this.#hostDisabledOptions.add(opt)
          }
        } else if (this.#hostDisabledOptions.has(opt)) {
          opt.removeAttribute('aria-disabled')
          this.#hostDisabledOptions.delete(opt)
        }
      }
    }
    this.effect(syncOptionState) // tracks `this.value` + `effectiveDisabled()` reactively

    // The TKT-0026-pattern observer (file header) — re-syncs paint for a late-adopted/removed option.
    this.#optionObserver = new MutationObserver(() => syncOptionState())
    this.#optionObserver.observe(this, { childList: true })

    // rovingFocus — keyboard navigation over the option set. typeAhead OFF (LLD §5 — a deliberate
    // scope simplification for a small, already-loaded option list, so Space is never captured by the
    // type-ahead buffer instead of committing a toggle).
    rovingFocus(this, { items, typeAhead: false })

    // selectionCommit — 'multi-toggle' mode (LLD-C4): every click/Enter toggles the targeted item,
    // ignoring modifier keys entirely. onSelect publishes the whole committed array to `value`.
    // `syncSelection` re-seeds the trait's own internal Set from the CURRENT `value` at the start of
    // every commit (the selection-commit.ts doc comment) — without it, an externally-written `value`
    // (a declarative `value="[...]"` attribute, a programmatic write, a two-way data bind) would be
    // invisible to the trait's own tracking, and the NEXT user toggle would silently discard it.
    selectionCommit(this, {
      mode: 'multi-toggle',
      items,
      keyOf,
      syncSelection: () => new Set(this.value),
      onSelect: (selection) => {
        this.value = [...(selection as ReadonlySet<string>)]
      },
    })

    // LLD §5 — Space toggles the roving-focused option's membership (byte-identical outcome to Enter
    // and to click). `selectionCommit` itself only wires click + Enter (LLD-C4's exact scoped touch) —
    // Space has no analogous platform default-action on a plain [role=option] div (unlike a real
    // <button>, where the platform itself converts Space into a click), so this control synthesizes
    // one: `.click()` on the focused option rides selectionCommit's OWN click handler unchanged, so
    // there is no separate commit logic to keep in sync (and the disabled-option guard already there
    // applies for free).
    this.listen(this, 'keydown', (event) => {
      const e = event as KeyboardEvent
      if (e.key !== ' ') return
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !this.contains(active)) return
      if (active.getAttribute('role') !== 'option') return
      e.preventDefault() // no page scroll
      active.click()
    })
  }
}

if (!customElements.get('ui-multi-select')) customElements.define('ui-multi-select', UIMultiSelectElement)

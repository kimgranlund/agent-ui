// radio-group.ts — UIRadioGroupElement, the radio-group container (Wave 1 Indicator, S3).
//
// The CONTAINER owns everything the radio itself cannot own: single-selection exclusivity, roving-focus
// keyboard navigation (Arrow/Home/End), the group form value (the selected radio's `value`), and the
// required → valueMissing validity verdict. Extends UIFormElement DIRECTLY — NOT UIIndicatorElement; the
// group itself is not an indicator, it is a form-value-owning container whose children are the indicators.
//
// ARIA: `role='radiogroup'` via internals (FACE — never a host attribute). Each `ui-radio` child carries
// `role='radio'` via its own internals. The group provides no `tabindex` of its own; the rovingFocus trait
// manages tabindexes on the radio children (exactly one is tabindex=0; others are -1), matching the ARIA
// APG radio-group keyboard pattern.
//
// Selection model:
//   · Arrow keys (Up/Down) + Home/End: move focus AND selection simultaneously (selection-follows-focus,
//     the ARIA APG radio-group contract; ADR-0022 roving tier).
//   · Click / Space: check the targeted radio → base toggle fires `change` → group's delegated change
//     listener calls #commit() for exclusivity + form-value update.
//   · #commit(index): the ONE commit path — checks radios[index], clears all others, updates #selectedValue,
//     emits `change` on the group when the selection is new.
//
// Form value: #selectedValue (a signal) drives the UIFormElement effects for setFormValue + setValidity.
// The signal is updated inside #commit, which both paths (Arrow key via onMove, click via change delegation)
// converge on. Reading this.#selectedValue.value inside formValue() + formValidity() keeps the effects
// reactive — they re-publish to internals automatically when the signal changes.
//
// Layer: controls/ — imports reactive + dom + traits + controls/radio (inward-only ✓).

import { signal } from '../../reactive/index.ts'
import { UIFormElement } from '../../dom/form.ts'
import type { FormValue, ValidityResult } from '../../dom/form.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/props.ts'
import { rovingFocus, type RovingOrientation } from '../../traits/roving-focus.ts'
import { UIRadioElement } from './radio.ts'

const groupProps = {
  // Universal form attributes (name / disabled / required) — spread so the group participates
  // in forms as the single form value owner for the radio family (ADR-0013 formProps spread pattern).
  ...UIFormElement.formProps,
  // ADR-0086 clause 1 — the presentation variant. Default 'default' (dots-in-a-row, layout-neutral,
  // unchanged); 'segmented' restyles the ui-radio children as joined segments (radio-group.css). The
  // children carry no per-radio attribute — the group owns the presentation via a descendant selector.
  variant: { ...prop.enum(['default', 'segmented'] as const, 'default'), reflect: true },
  // ADR-0086 clause 1 — the roving axis + (for 'segmented') the grid main axis. Default 'vertical'
  // (today's shipped roving). Newly minted: no orientation attribute existed before this ADR. The
  // EFFECTIVE orientation (author-set vs the variant-derived default) is resolved once at connect —
  // see `connected()` below — and reflected back here so CSS and the roving trait read ONE source.
  orientation: { ...prop.enum(['horizontal', 'vertical'] as const, 'vertical'), reflect: true },
} satisfies PropsSchema

export interface UIRadioGroupElement extends ReactiveProps<typeof groupProps> {}
export class UIRadioGroupElement extends UIFormElement {
  static props = groupProps

  // The committed selection — the group's form value. A signal so the UIFormElement base's scope-owned
  // `formValue()` + `formValidity()` effects re-run (and re-publish to internals) when it changes.
  // null = no radio selected; a string = the selected radio's `value` prop.
  #selectedValue = signal<string | null>(null)

  protected connected(): void {
    // ARIA: radiogroup role via internals, never a host role/aria-* attribute (FACE).
    this.internals.role = 'radiogroup'

    // Well-known data attribute marker: lets UIRadioElement.grouped() detect any UIRadioGroupElement
    // subclass (e.g. probe subclasses in tests) via a CSS attribute selector without a circular import.
    this.dataset['radioGroup'] = ''

    // Seed from any initially-checked radio (HTML-parsed content: radios connect before the group's
    // connected() runs, so they are already present and may carry a `checked` attribute from markup).
    const radios = this.#radios()
    const initial = radios.find((r) => r.checked)
    if (initial) this.#selectedValue.value = initial.value

    // ADR-0086 clause 1 — resolve the EFFECTIVE orientation ONCE, here, BEFORE the rovingFocus call
    // below. `rovingFocus` captures `orientation` as a static value at call time (roving-focus.ts:148
    // reads the closed-over param directly, not a callback like `items`/`syncIndex`), so resolving
    // this AFTER the call would silently keep the trait on `'vertical'`. Precedence: an author-set
    // `orientation` attribute wins; otherwise the variant supplies the default — `segmented` ⇒
    // `'horizontal'`, `default` ⇒ `'vertical'` (today's shipped roving, unchanged). Reflecting the
    // resolved value back to the host attribute gives CSS (`[orientation]`) and the roving trait one
    // single source of truth.
    const resolvedOrientation: RovingOrientation = this.hasAttribute('orientation')
      ? this.orientation
      : this.variant === 'segmented' ? 'horizontal' : 'vertical'
    this.orientation = resolvedOrientation

    // ADR-0086 clauses 2/3 — seed the segmented variant's state seam (the `--value-pct`-style pattern,
    // range-element.ts:111): the selected index + segment count, read by the moving `::before` in
    // radio-group.css. Harmless when variant='default' (the tokens are simply unconsumed).
    this.#writeIndexCount(radios, this.#checkedIndex())

    // ── roving-focus (Arrow/Home/End: selection-follows-focus) ──────────────────────────────────
    // The ARIA APG radio-group keyboard contract: Arrow keys move focus AND selection simultaneously.
    // `initialIndex` seeds the roving cursor at the currently-checked radio (or first if none), so
    // reconnect restores the correct tabindex=0 position. `syncIndex` re-reads the checked position
    // before each keydown so a preceding click (processed via the change-delegation path below) is
    // visible to the next Arrow move.
    rovingFocus(this, {
      items: () => this.#radios() as HTMLElement[],
      orientation: resolvedOrientation,
      loop: true,
      typeAhead: false,
      initialIndex: () => {
        const i = this.#checkedIndex()
        return i >= 0 ? i : 0 // default to first when nothing is checked
      },
      syncIndex: () => this.#checkedIndex(),
      onMove: (index) => { if (!this.effectiveDisabled()) this.#commit(index) },
    })

    // ── delegated change listener (click / Space commit path) ───────────────────────────────────
    // The base indicator emits `change` (bubbling) when it toggles unchecked → checked via a click or
    // Space keyup. The group's capture guard in UIRadioElement.grouped() prevents the already-checked →
    // unchecked direction from firing (stopImmediatePropagation before the base toggle), so only the
    // relevant direction (unchecked → checked) bubbles here. This handler:
    //   · Identifies the originating UIRadioElement inside this group.
    //   · Stops the radio's change event from propagating further (the group re-emits its own).
    //   · Calls #commit to enforce exclusivity and update the group's form value.
    this.listen(this, 'change', (event) => {
      if (this.effectiveDisabled()) {
        // A disabled group swallows child change events entirely: stopImmediatePropagation prevents
        // any other listener on this element (or ancestors) from seeing the radio's change (C7).
        event.stopImmediatePropagation()
        return
      }
      const target = event.target
      if (!(target instanceof UIRadioElement)) return
      if (!this.contains(target)) return
      // Stop immediate propagation: prevent the radio's internal change event from reaching
      // other listeners registered on the group (e.g. external consumers). The group re-emits
      // its own semantic change event below via #commit, so external code sees exactly one change.
      event.stopImmediatePropagation()
      const index = this.#radios().indexOf(target)
      if (index !== -1) this.#commit(index)
    })
  }

  // ── private helpers ─────────────────────────────────────────────────────────────────────────────

  /**
   * Live ordered set of `UIRadioElement` children (direct children only; re-read on each call).
   * Uses `instanceof UIRadioElement` so subclasses (e.g. probe subclasses in tests) are also found,
   * rather than relying on the `ui-radio` tag name which would miss subclasses.
   */
  #radios(): UIRadioElement[] {
    return [...this.children].filter((el): el is UIRadioElement => el instanceof UIRadioElement)
  }

  /** Index of the currently checked radio (first match), or -1 when nothing is checked. */
  #checkedIndex(): number {
    return this.#radios().findIndex((r) => r.checked)
  }

  /**
   * ADR-0086 clauses 2/3/4 — the segmented variant's shared-moving-indicator state seam: write the
   * selected index + segment count as host CUSTOM PROPERTIES (the `--value-pct` precedent,
   * range-element.ts:111 / slider-multi.ts:196–197 — reactive STATE, never a stylesheet injection).
   * `radio-group.css`'s `::before` reads `--ui-radio-group-index`/`-count` to size + translate the
   * shared fill. A no-op cost when `variant='default'` (the tokens are simply unconsumed). `index < 0`
   * (nothing selected) writes `0` — the indicator itself is hidden by `:not(:has(ui-radio[checked]))`
   * in CSS, so the fallback position is irrelevant while hidden.
   */
  #writeIndexCount(radios: UIRadioElement[], index: number): void {
    this.style.setProperty('--ui-radio-group-index', String(Math.max(0, index)))
    this.style.setProperty('--ui-radio-group-count', String(radios.length))
  }

  /**
   * The ONE commit path — invoked from both the rovingFocus `onMove` callback (Arrow keys) and the
   * delegated change listener (click/Space). Enforces exclusivity and updates the group's form value:
   *   · Checks `radios[index]`, unchecks all others (direct prop writes — no click events, no change
   *     events on siblings, avoids re-entrancy into this handler via the UIRadioElement guard).
   *   · Updates `#selectedValue` and emits `change` on the group when the selection is new.
   */
  #commit(index: number): void {
    const radios = this.#radios()
    const radio = radios[index]
    if (!radio) return

    const newValue = radio.value
    const changed = newValue !== this.#selectedValue.value

    // Exclusivity: check the target, uncheck all others (direct writes — no click, no re-entrancy).
    radios.forEach((r, i) => {
      r.checked = i === index
    })

    // ADR-0086 clauses 2/3 — refresh the state seam on every commit (both the Arrow-key and click/Space
    // paths converge here), so the segmented indicator's transform stays in lockstep with the selection.
    this.#writeIndexCount(radios, index)

    if (changed) {
      this.#selectedValue.value = newValue
      this.emit('change')
    }
  }

  // ── form hooks ──────────────────────────────────────────────────────────────────────────────────

  /**
   * The group's form value: the selected radio's `value`, or `null` when nothing is checked.
   * Reads `#selectedValue.value` (a signal) so the UIFormElement base's scope-owned setFormValue
   * effect re-runs automatically when selection changes.
   */
  protected override formValue(): FormValue {
    return this.#selectedValue.value
  }

  /**
   * Validity: `required` + no selection → `valueMissing`. Reads `#selectedValue.value` so the
   * UIFormElement base's setValidity effect re-runs when selection changes. An empty, required group
   * stays invalid until a radio is committed; a non-required empty group is always valid.
   */
  protected override formValidity(): ValidityResult {
    if (this.required && this.#selectedValue.value === null) {
      return {
        valid: false,
        flags: { valueMissing: true },
        message: 'Please select one of these options.',
      }
    }
    return { valid: true }
  }

  /**
   * Form reset — group-level coordination (bug-A fix). Each child radio is its OWN `UIFormElement`
   * participant with its OWN `formResetCallback` (now fixed, indicator-element.ts) that silently restores
   * ITS `checked` to ITS `defaultChecked` — but the GROUP owns a SEPARATE `#selectedValue` signal
   * (`formValue()`/`formValidity()` above), which no radio's own reset can reach. Recompute it here from
   * every child's `defaultChecked` (a stable, native-parity PUBLIC getter — see UIIndicatorElement) rather
   * than each child's live `checked`: the platform resets the group and its radios as INDEPENDENT
   * `UIFormElement`s, in an order this class must not assume (tree order suggests ancestor-first, i.e.
   * this runs BEFORE the radios' own resets — reading live `checked` here would see PRE-reset values).
   * `defaultChecked` sidesteps the ordering question entirely: it is a fixed snapshot from each radio's
   * first connect, unaffected by reset order on either side. Silent — no `change` emitted (a reset is not
   * a user commit; matches `#commit`'s own emit-on-user-action-only discipline).
   *
   * Bug fix (component-reviewer B4, blocking): a reset must ALSO refresh the ADR-0086 state seam
   * (`--ui-radio-group-index`/`-count`). The seam was previously written only at connect and in
   * `#commit` — but a radio's own reset (`indicator-element.ts`) restores its `checked` OUTSIDE
   * `#commit`, so without this the seam desyncs: the CSS `:not(:has(ui-radio[checked]))` gate correctly
   * re-shows the indicator (the DOM `[checked]` is genuinely restored), but the STALE
   * `--ui-radio-group-index` still parks the moving `::before` on the pre-reset selection — a visible
   * indicator/ink mismatch. Recomputed from `defaultChecked` for the same reset-order-independence
   * reason as `#selectedValue` above (not live `checked`, which may not have reset yet on this radio's
   * siblings). `findIndex` returns `-1` when no radio was ever default-checked; `#writeIndexCount`
   * clamps that to `0` — harmless, since the CSS hides the indicator whenever nothing is `[checked]`.
   */
  protected override formReset(): void {
    const radios = this.#radios()
    const defaultIndex = radios.findIndex((r) => r.defaultChecked)
    const defaultRadio = defaultIndex >= 0 ? radios[defaultIndex] : undefined
    this.#selectedValue.value = defaultRadio ? defaultRadio.value : null
    this.#writeIndexCount(radios, defaultIndex)
  }
}

if (!customElements.get('ui-radio-group')) customElements.define('ui-radio-group', UIRadioGroupElement)

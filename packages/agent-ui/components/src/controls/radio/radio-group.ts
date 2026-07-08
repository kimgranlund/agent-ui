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
//   · #commit(index): the ONE user-driven commit path — checks radios[index], clears all others, updates
//     #selectedValue, emits `change` on the group when the selection is new. Built on #applySelection,
//     the shared (silent, non-emitting) selection-transition primitive it shares with the public `value`
//     accessor below (a programmatic value write selects/clears without emitting `change` — the
//     `UICheckboxElement.checked` / `UISelectElement.value` fleet convention for programmatic sets).
//
// Form value: #selectedValue (a signal) drives the UIFormElement effects for setFormValue + setValidity.
// The signal is updated inside #applySelection, which every path (Arrow key via onMove, click via change
// delegation, AND the public `value` setter) converges on. Reading this.#selectedValue.value inside
// formValue() + formValidity() keeps the effects reactive — they re-publish to internals automatically
// when the signal changes. The public `value` GETTER is the same signal read, exposed for external
// callers (e.g. the A2UI catalog's two-way `value:{prop:'value',event:'change'}` bind).
//
// ADR-0095 (supersedes ADR-0086's `variant="segmented"`): the segmented presentation is now the standalone
// `UISegmentedControlElement` (controls/segmented-control/), NOT a variant of this class. `variant` does not
// exist here — the group is back to its dot-only, layout-neutral presentation surface. Two PROTECTED seams
// exist purely so that subclass can reuse this class's exclusivity/roving/value/validity machinery without
// forking it:
//   · `defaultOrientation()` — the class-derived roving-axis default (this base returns 'vertical'; the
//     resolve-once-and-reflect-at-connect mechanism below calls it only when no explicit `orientation`
//     attribute is authored). ADR-0095 clause 1.
//   · `selectionChanged(radios, index)` — a no-op hook fired on every selection-defining event (connect
//     seed, every `#applySelection`, and `formReset()`) — the SAME three call sites ADR-0086 wired its
//     (now-retired) `#writeIndexCount` state seam to. `UISegmentedControlElement` overrides it to write its
//     own `--ui-segmented-control-index`/`-count` moving-indicator state. ADR-0095 clause 2.
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
  // ADR-0086 clause 1 (orientation SURVIVES the ADR-0095 supersession — clause 1 there: "orientation stays
  // on the group"). The roving axis. Default 'vertical' (today's shipped roving). The EFFECTIVE orientation
  // (author-set vs the class-derived default, `defaultOrientation()` below) is resolved once at connect —
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

    // ADR-0095 clause 1 (was ADR-0086 clause 1, variant-derived) — resolve the EFFECTIVE orientation
    // ONCE, here, BEFORE the rovingFocus call below. `rovingFocus` captures `orientation` as a static
    // value at call time (roving-focus.ts:148 reads the closed-over param directly, not a callback like
    // `items`/`syncIndex`), so resolving this AFTER the call would silently keep the trait on the
    // default. Precedence: an author-set `orientation` attribute wins; otherwise `defaultOrientation()`
    // supplies the CLASS-derived default (this base: `'vertical'`, today's shipped roving, unchanged;
    // `UISegmentedControlElement` overrides it to `'horizontal'`). Reflecting the resolved value back to
    // the host attribute gives CSS (`[orientation]`) and the roving trait one single source of truth.
    const resolvedOrientation: RovingOrientation = this.hasAttribute('orientation')
      ? this.orientation
      : this.defaultOrientation()
    this.orientation = resolvedOrientation

    // ADR-0095 clause 2 (was ADR-0086 clauses 2/3, `#writeIndexCount`) — the protected post-selection
    // hook, seeded here at connect. A no-op in this base; `UISegmentedControlElement` overrides it to
    // write its own moving-indicator state.
    this.selectionChanged(radios, this.#checkedIndex())

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

  // ── public value accessor ───────────────────────────────────────────────────────────────────────

  /**
   * The group's selected value — the checked `ui-radio` child's `value`, or `null` when none is
   * selected. A public getter/setter pair delegating to the private `#selectedValue` signal (the
   * `UICheckboxElement.indeterminate` precedent, checkbox.ts:39 — a plain accessor over a private
   * signal, not a `prop.*`-declared attribute: the value is DERIVED from child radio state, so it
   * has nothing of its own to reflect).
   *
   * The getter reads the signal directly — a reactive caller (e.g. inside `this.effect`) tracks it
   * exactly like any other signal read.
   *
   * The setter is the PROGRAMMATIC path (e.g. a two-way data-bind write): it selects the child
   * `ui-radio` whose `value` matches (unchecking all others) via `#applySelection` — the SAME state
   * transition `#commit` drives for a user click/keyboard commit — but it does NOT emit `change`.
   * This matches the fleet convention for a programmatic prop write on a value-bearing control
   * (`UICheckboxElement.checked` / `UISelectElement.value` are directly settable and never
   * self-emit on assignment; only the interaction-driven commit path — `#commit` here — emits).
   *
   * `null` clears the selection (unchecks every radio). A value matching NO child radio also CLEARS
   * the selection, rather than a silent no-op — the native `HTMLSelectElement.value` precedent:
   * assigning a `<select>`'s `.value` to a string with no matching `<option>` resolves
   * `selectedIndex` to `-1` (the value reads back as `''`) instead of leaving the prior selection
   * in place.
   */
  get value(): string | null {
    return this.#selectedValue.value
  }

  set value(v: string | null) {
    const radios = this.#radios()
    const index = v === null ? -1 : radios.findIndex((r) => r.value === v)
    this.#applySelection(radios, index)
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
   * ADR-0095 clause 1 — the CLASS-derived default roving-axis orientation, consulted by `connected()`'s
   * resolve-once-and-reflect ONLY when no explicit `orientation` attribute is authored. This base returns
   * `'vertical'` (today's shipped roving, unchanged). `UISegmentedControlElement` overrides this to
   * `'horizontal'` — the ADR-0086 "variant=segmented ⇒ horizontal" default, now class-derived instead of
   * variant-derived.
   */
  protected defaultOrientation(): RovingOrientation {
    return 'vertical'
  }

  /**
   * ADR-0095 clause 2 — a protected, no-op-in-the-base post-selection hook, fired from every
   * selection-DEFINING event: the connect-time seed, every `#applySelection` (both `#commit`'s user-driven
   * path AND the public `value` setter's programmatic path), and `formReset()`. This is the SAME seam
   * ADR-0086's (now-retired) private `#writeIndexCount` fired from — moved here, as a protected hook,
   * so `UISegmentedControlElement` can write its own `--ui-segmented-control-index`/`-count` moving-
   * indicator state WITHOUT this base class knowing anything about segments or indicators. A no-op here
   * costs nothing for the plain dot-group presentation.
   */
  protected selectionChanged(_radios: UIRadioElement[], _index: number): void {}

  /**
   * The shared selection-transition path: checks `radios[index]`, unchecks all others (direct prop
   * writes — no click events, no change events on siblings, avoids re-entrancy into the group's own
   * change listener via the UIRadioElement guard), updates `#selectedValue`, and fires the
   * `selectionChanged` hook. `index === -1` clears the selection (no radio checked, `#selectedValue` →
   * `null`) — the public `value` setter's "no match" path. Does NOT emit `change`; that is exclusively
   * `#commit`'s concern (the user-driven path) — this is the silent primitive both `#commit` and the
   * public `value` setter build on. Returns whether the selection actually changed.
   */
  #applySelection(radios: UIRadioElement[], index: number): boolean {
    const radio = index >= 0 ? radios[index] : undefined
    const newValue = radio ? radio.value : null
    const changed = newValue !== this.#selectedValue.value

    // Exclusivity: check the target (if any), uncheck all others (direct writes — no click, no re-entrancy).
    radios.forEach((r, i) => {
      r.checked = i === index
    })

    // ADR-0095 clause 2 — fire the post-selection hook on every transition (both the Arrow-key/click/Space
    // commit paths AND the public value setter converge here); a no-op in this base.
    this.selectionChanged(radios, index)

    if (changed) this.#selectedValue.value = newValue
    return changed
  }

  /**
   * The ONE user-driven commit path — invoked from both the rovingFocus `onMove` callback (Arrow keys)
   * and the delegated change listener (click/Space). Applies the transition via `#applySelection` and
   * emits `change` on the group when the selection is new. An out-of-range `index` (no radio at that
   * position) is a no-op — unlike the public `value` setter's "no match" path, this never clears an
   * existing selection (there is no user gesture that should silently blank the group).
   */
  #commit(index: number): void {
    const radios = this.#radios()
    if (!radios[index]) return
    if (this.#applySelection(radios, index)) this.emit('change')
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
   * Bug fix (component-reviewer B4, blocking; ADR-0086, preserved verbatim by ADR-0095 clause 2): a reset
   * must ALSO fire the post-selection hook (`selectionChanged`). The hook was previously (ADR-0086) a
   * private `#writeIndexCount` written only at connect and in `#commit` — but a radio's own reset
   * (`indicator-element.ts`) restores its `checked` OUTSIDE `#commit`, so without this the seam desyncs
   * in a subclass that consumes it (e.g. `UISegmentedControlElement`'s moving indicator): the CSS
   * `:not(:has(ui-radio[checked]))`-style gate correctly re-shows the indicator (the DOM `[checked]` is
   * genuinely restored), but a STALE index would still park the moving fill on the pre-reset selection —
   * a visible indicator/ink mismatch. Recomputed from `defaultChecked` for the same reset-order-
   * independence reason as `#selectedValue` above (not live `checked`, which may not have reset yet on
   * this radio's siblings). `findIndex` returns `-1` when no radio was ever default-checked; a consuming
   * subclass's hook is expected to clamp that to `0` the same way ADR-0086's seam did — harmless, since a
   * segmented indicator hides itself whenever nothing is `[checked]`.
   */
  protected override formReset(): void {
    const radios = this.#radios()
    const defaultIndex = radios.findIndex((r) => r.defaultChecked)
    const defaultRadio = defaultIndex >= 0 ? radios[defaultIndex] : undefined
    this.#selectedValue.value = defaultRadio ? defaultRadio.value : null
    this.selectionChanged(radios, defaultIndex)
  }
}

if (!customElements.get('ui-radio-group')) customElements.define('ui-radio-group', UIRadioGroupElement)

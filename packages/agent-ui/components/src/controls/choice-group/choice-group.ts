// choice-group.ts — UIChoiceGroupElement, the rich-card selection container of the `choice` family
// (ADR-0220, GH #1368). A committed choice over agent-composed `ui-choice-card` option cards, single
// or multi.
//
// Composition (ADR-0220 clause 1): `UIFormElement` directly, composing `rovingFocus` +
// `selectionCommit` from `connected()` — the `ui-select`/`ui-multi-select` idiom (traits on the
// control, never via extending `UIListboxElement`; `_base/listbox-element.ts` has no production
// subclass, ADR-0042). The group's option unit (`ui-choice-card`) is a FACE host carrying
// `role=option`/`aria-selected` through `ElementInternals` (never a host attribute) — resolved
// through the two additive `selectionCommit` seams this ADR adds (`itemFromTarget`/`reflectSelected`,
// traits/selection-commit.ts), rather than growing a host `role` attribute to satisfy the trait's own
// default attribute-keyed lookup (the role-carriage ruling, clause 1).
//
// One control, two modes (clause 2): `multiple` (structural, reflected, read ONCE at connect — the
// `radio-group.ts` `orientation` precedent) selects `selectionCommit` mode `'single'` (exclusive) vs
// `'multi-toggle'` (multi-select-field LLD-C4 — every commit path toggles, no modifier keys ever
// consulted; never the modifier-keyed `'multi'`).
//
// The wire value mark (clause 3): `value` (string, single mode) / `values` (string[], multi mode) —
// distinct props, ADR-0161's array form, mode-gated per-slot opt-in (the `Calendar` precedent). The
// `values` codec mirrors `multi-select.ts`'s co-located `cleanValue`/`valueType` exactly (never
// null/undefined; malformed JSON → `[]`, never throws).
//
// Keyboard/ARIA (clause 5): `role=listbox` (+ `aria-multiselectable` in multi) via internals; arrow-key
// roving in tree order over OWNED cards (disabled cards skipped — `rovingFocus`'s own backstop); commit
// by click or Enter — never selection-follows-focus. `selectionCommit` wires no Space leg (its header
// says so); this control synthesizes Space→click on the focused card (`.click()` rides the SAME
// selectionCommit click handler unchanged — the `multi-select.ts` LLD §5 precedent).
//
// Layout (clause 6): the group owns interior layout (ADR-0103, adopted at birth) — a responsive
// auto-fit grid, `min` (CSS length floor) + `gap` (the `--md-sys-space` ladder enum), the `ui-grid`
// `min`/`gap` mechanism (grid.ts/grid.css) ported directly. No `orientation`, no wrapper type.
//
// Discovery (clause 7): nearest-group-scoped descendants from birth — `items()` filters
// `querySelectorAll('ui-choice-card')` to cards whose nearest `ui-choice-group` ancestor IS this
// group (an inner group is the ownership boundary). The SAME filter backs `itemFromTarget` and
// `keyOf()`.
//
// Disabled cascade (clause 8): the group's OWN `effectiveDisabled()` (own `disabled` prop OR ancestor
// fieldset/form-disabled) is cascaded onto every card NOT individually disabled (`#groupDisabledCards`,
// the `multi-select.ts` `#hostDisabledOptions` precedent) — `disabled` reflects as a real attribute
// (choice-card.ts), so `rovingFocus`/`selectionCommit`'s own item-level `isDisabled()` backstops catch
// it for free; `itemFromTarget` ALSO short-circuits on `effectiveDisabled()` directly (neither trait has
// a group-level disabled concept of its own — the `radio-group.ts` `onMove`/`change`-listener guard
// precedent, applied here since `selectionCommit` has no `onMove`-equivalent gate to hook).
//
// Form: formValue() = the committed value (single: the string or null; multi: a FormData, one entry
// per selected value — the `multi-select.ts` LLD-C6 precedent). formValidity() = required + empty →
// valueMissing. formReset() restores value/values to their connect-time attribute baselines.
//
// Import layers: controls/ → dom + traits (inward-only ✓). erasableSyntaxOnly ✓ (no enum/namespace/
// decorators). verbatimModuleSyntax ✓ (import type).

import {
  prop, type PropConfig, type PropType, type PropsSchema, type ReactiveProps,
} from '../../dom/index.ts'
import { UIFormElement } from '../../dom/index.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { selectionCommit } from '../../traits/selection-commit.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'
import { UIChoiceCardElement } from '../choice-card/choice-card.ts'

// ── the `values: string[]` codec (the multi-select.ts `cleanValue`/`valueType` precedent, co-located
// per that file's own "control-owned codec, not exported shared infra" convention) ─────────────────

/** Harden an arbitrary `values` input into a string array — never null/undefined (ADR-0175's floor). */
function cleanValues(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((v): v is string => typeof v === 'string')
}

/** The safe JSON-array codec: `from(null) → []`; malformed JSON also → `[]`, never throws. */
const valuesType: PropType<string[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanValues(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

/** NOT reflected — bindable multi-mode selection state, not an authored dimension (the `multi-select.ts`
 *  `valueProp` precedent). The attribute is still inbound-parsed, so a declarative `values='["a"]'`
 *  still seeds the initial value. */
const valuesProp: PropConfig<string[]> = {
  type: valuesType,
  default: [],
}

// ── Props ────────────────────────────────────────────────────────────────────────────────────────────

const props = {
  // Universal form attributes from the spreadable formProps (name/disabled/required).
  ...UIFormElement.formProps,

  // `multiple` — structural mode flip (clause 2). Reflected; read ONCE at connect (the `radio-group.ts`
  // `orientation`-resolution precedent) — a live post-connect toggle is not a supported dynamic contract.
  multiple: { ...prop.boolean(false), reflect: true },

  // `value` — the single-mode committed key. Reflects (the `ui-select` `value` precedent) so
  // `<ui-choice-group value="…">` seeds declaratively and the catalog two-way-binds it.
  value: { ...prop.string(''), reflect: true },

  // `values` — the multi-mode committed set. NOT reflected (the `multi-select.ts` precedent) —
  // bindable selection state, not an authored dimension.
  values: valuesProp,

  // `min` — the auto-fit grid's minmax() track floor (clause 6, the `ui-grid` `min` precedent —
  // grid.ts). An arbitrary CSS `<length>`, threaded into `--ui-choice-group-min` inline at connect.
  min: { ...prop.string(), reflect: true },

  // `gap` — the `--md-sys-space` ladder enum, the SAME member set as `UIContainerElement.flexProps.gap`
  // (clause 6, the `ui-grid` precedent) — authored directly via `prop.enum` (not a spread-then-override
  // of `flexProps.gap`: overriding just `default` on a spread loses the literal-union narrowing `reflect`/
  // `ReactiveProps` need, widening `gap`'s accessor type to plain `string`) so the `const` type parameter
  // preserves the literal union. Default `md` (a card gallery reads as intentionally spaced out of the
  // box, unlike a bare layout primitive's `none` default — a build choice, not a contract deviation).
  gap: { ...prop.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const, 'md'), reflect: true },

  // `label` — the bare-usage accessible-name source (the `Toolbar.label`/ADR-0085 precedent).
  label: { ...prop.string(), reflect: true },
} satisfies PropsSchema

// ── Element ──────────────────────────────────────────────────────────────────────────────────────────

export interface UIChoiceGroupElement extends ReactiveProps<typeof props> {}
export class UIChoiceGroupElement extends UIFormElement {
  static props = props

  // Native-parity reset baselines — seeded ONCE from the initial attributes (the `multi-select.ts`
  // `#defaultValue`/`#defaultCaptured` precedent).
  #defaultValue = ''
  #defaultValues: string[] = []
  #defaultCaptured = false

  // The user-invalid TIMING controller (ADR-0051), created per connection.
  #userInvalid: TrackUserInvalidController | null = null

  // Cards this group itself forced disabled (its own `effectiveDisabled()` cascade) — tracked so
  // re-enabling only clears OUR marks, never an author-set per-card `disabled` (the `multi-select.ts`
  // `#hostDisabledOptions` precedent).
  #groupDisabledCards = new WeakSet<HTMLElement>()

  // ── Form seams (UIFormElement hooks) ──────────────────────────────────────────────────────────────

  protected override formValue(): FormValue {
    if (this.multiple) {
      // The `multi-select.ts` LLD-C6 precedent: one FormData entry per selected value; zero
      // selections → an empty FormData() (submits nothing).
      const fd = new FormData()
      for (const v of this.values) fd.append(this.name, v)
      return fd
    }
    return this.value || null
  }

  protected override formValidity(): ValidityResult {
    const empty = this.multiple ? this.values.length === 0 : this.value === ''
    if (this.required && empty) {
      return { valid: false, flags: { valueMissing: true }, message: 'Please select an option.' }
    }
    return { valid: true }
  }

  protected override formReset(): void {
    this.value = this.#defaultValue
    this.values = this.#defaultValues
    // ADR-0051 — a reset must not leave a required-empty control showing :state(user-invalid) until
    // the user re-interacts (the text-field/select/multi-select formReset() precedent).
    this.#userInvalid?.reset()
  }

  protected override disconnected(): void {
    this.#userInvalid?.release() // idempotent — the listeners already die with the connection scope
    this.#userInvalid = null
  }

  /** Feeds `FormConnectDetail.userInvalid` (ADR-0050) — the `trackUserInvalid` tracker IS the one
   *  timing source; this override just exposes its gate. */
  protected override formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────────────────────────────

  protected override connected(): void {
    // Capture the reset baselines ONCE from the initial attributes (see the multi-select.ts pattern).
    if (!this.#defaultCaptured) {
      this.#defaultValue = this.getAttribute('value') ?? ''
      this.#defaultValues = valuesType.from(this.getAttribute('values'))
      this.#defaultCaptured = true
    }

    // Clause 5 — role=listbox (+ aria-multiselectable in multi) via ElementInternals, never a host
    // attribute. `multiple` is resolved ONCE here (the file header's `radio-group.ts` precedent).
    this.internals.role = 'listbox'
    if (this.multiple) this.internals.ariaMultiSelectable = 'true'

    // Well-known data attribute marker (the `radio-group.ts`/`radio.ts` `data-radio-group` precedent,
    // documented there as working "with any subclass … including probe subclasses in tests"): clause 7's
    // ownership-boundary check below resolves against THIS marker, never a hardcoded `ui-choice-group`
    // TAG-NAME selector — a tag selector would silently miss any subclass registered under a different
    // tag (the same generality `data-radio-group` buys `ui-radio-group`).
    this.dataset['choiceGroup'] = ''

    // ADR-0051 — the user-invalid TIMING controller. This control never emits a native `change` event
    // (only `select`), so blur is the sole interaction signal (the `ui-select`/`multi-select` precedent).
    // GH #554 — MERGED validity, not `formValidity()` alone.
    const invalidController = trackUserInvalid(this, { invalid: () => !this.mergedValidity().valid })
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

    // ADR-0085 — the bare-usage accessible-name seam. The host carries `internals.role`, so the base
    // `applyFieldLabelling` default already wires the FIELDED case for free (`ariaLabelledByElements`,
    // guarded on `internals.role != null`) — this effect owns ONLY the bare/unfielded case (the
    // `multi-select.ts` split-ownership discipline).
    this.effect(() => {
      if (this.fieldLabelling !== null) return
      this.internals.ariaLabel = this.label || null
    })

    // Clause 6 — thread the `min` CSS-length floor into the role-pure `--ui-choice-group-min` token
    // seam (the `ui-grid` `min` mechanism, grid.ts). Unset ⇒ removeProperty ⇒ the CSS default applies.
    this.effect(() => {
      const min = this.min
      if (min) this.style.setProperty('--ui-choice-group-min', min)
      else this.style.removeProperty('--ui-choice-group-min')
    })

    // Clause 7 — nearest-group-scoped descendant discovery: a card belongs to THIS group only when its
    // nearest `[data-choice-group]`-marked ancestor IS this group (an inner group is the ownership
    // boundary — the inner-group negative control). Live re-read on every event (dynamic option sets).
    const items = (): HTMLElement[] =>
      [...this.querySelectorAll<HTMLElement>('ui-choice-card')].filter(
        (card) => card.closest('[data-choice-group]') === this,
      )
    const keyOf = (el: HTMLElement): string => el.getAttribute('value') ?? ''

    // Clause 1 — the itemFromTarget seam, scoped identically to items() (the SAME filter backs both
    // discovery paths). Also the effective-disabled short-circuit (neither trait has a group-level
    // disabled concept of its own — the `radio-group.ts` onMove/change-listener guard precedent).
    const itemFromTarget = (target: EventTarget | null): HTMLElement | null => {
      if (this.effectiveDisabled()) return null
      if (!(target instanceof HTMLElement)) return null
      const card = target.closest('ui-choice-card') as HTMLElement | null
      if (!card || !this.contains(card)) return null
      return card.closest('[data-choice-group]') === this ? card : null
    }

    // Clause 1 — the reflectSelected seam: route the trait's commit-time paint through the card's own
    // ElementInternals (never a host attribute — the fleet ARIA law).
    const reflectSelected = (el: HTMLElement, selected: boolean): void => {
      if (el instanceof UIChoiceCardElement) el.setSelected(selected)
    }

    // GH #908/#905 — the trait's own reflect is commit-time only; a host whose selection is ALSO
    // externally-settable (a declarative attribute, a programmatic `value`/`values` write, a two-way
    // data bind) must layer its OWN value-keyed reflect on top (the `multi-select.ts` `syncOptionState`
    // precedent). Also cascades the group's own `effectiveDisabled()` onto every non-individually-
    // disabled card (clause 8; the `multi-select.ts` `#hostDisabledOptions` precedent, adapted to the
    // card's own reflecting `disabled` prop instead of a raw `aria-disabled` attribute mutation).
    const syncCardState = (): void => {
      const selectedKeys = this.multiple ? new Set(this.values) : new Set(this.value ? [this.value] : [])
      const disabled = this.effectiveDisabled()
      for (const card of items()) {
        const k = keyOf(card)
        if (!(card instanceof UIChoiceCardElement)) continue
        card.setSelected(k !== '' && selectedKeys.has(k))
        if (disabled) {
          // Only a card that is NOT already disabled is one WE are forcing — an already
          // author-disabled card is never claimed into `#groupDisabledCards` (the multi-select.ts
          // `!opt.hasAttribute('aria-disabled')` guard, ported to the reflecting `disabled` prop).
          if (!card.disabled) {
            this.#groupDisabledCards.add(card)
            card.disabled = true
          }
        } else if (this.#groupDisabledCards.has(card)) {
          this.#groupDisabledCards.delete(card)
          card.disabled = false
        }
      }
    }
    this.effect(syncCardState) // tracks this.value/this.values + effectiveDisabled() reactively

    // rovingFocus — keyboard navigation over the owned card set. typeAhead OFF (rich-card content has
    // no single reliable label text to search — the `multi-select.ts` "small, already-loaded set"
    // rationale does not hold here; a mis-focus from a false type-ahead match is worse than none).
    rovingFocus(this, { items, typeAhead: false })

    // selectionCommit — clause 2's mode flip; clause 1's two seams; clause 3's onSelect → value/values.
    selectionCommit(this, {
      mode: this.multiple ? 'multi-toggle' : 'single',
      items,
      keyOf,
      itemFromTarget,
      reflectSelected,
      syncSelection: this.multiple ? () => new Set(this.values) : undefined,
      onSelect: (selection) => {
        if (this.multiple) this.values = [...(selection as ReadonlySet<string>)]
        else this.value = selection as string
      },
    })

    // Clause 5 — Space toggles/commits the roving-focused card (selectionCommit itself wires click +
    // Enter only). `.click()` rides selectionCommit's OWN click handler unchanged (the `multi-select.ts`
    // LLD §5 precedent) — no separate commit logic to keep in sync, and the disabled/effectiveDisabled
    // guards already inside `itemFromTarget`/`isDisabled` apply for free.
    this.listen(this, 'keydown', (event) => {
      const e = event as KeyboardEvent
      if (e.key !== ' ') return
      const active = document.activeElement
      if (!(active instanceof UIChoiceCardElement) || !this.contains(active)) return
      e.preventDefault() // no page scroll
      active.click()
    })
  }
}

if (!customElements.get('ui-choice-group')) customElements.define('ui-choice-group', UIChoiceGroupElement)

// listbox-element.ts — UIListboxElement, the form-associated listbox base
// (ui-listbox · ui-select options popup · ui-combo-box options popup). listbox-roving LLD-C3.
//
// Owns: `role=listbox` (via internals), the form value (the selected option's `value` string, or
// a `\n`-joined list for multi), `required` → `valueMissing`, and the wiring of `rovingFocus` +
// `selectionCommit` over its `[role=option]` children.
//
// The options are light-DOM children (`ui-option` or `<li role=option>`); the host carries no role
// attribute (FACE internals). ui-menu is NOT this class — it is a plain UIElement + rovingFocus
// (no form value; role=menu; LLD-C4 in listbox-roving.lld.md).
//
// Layer: controls/_base/ — imports dom + traits (inward-only ✓).
// Inward-only ✓ (controls ← traits ← dom ← reactive).

import { signal } from '../../reactive/index.ts'
import { UIFormElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { selectionCommit } from '../../traits/selection-commit.ts'

const listboxProps = {
  ...UIFormElement.formProps,
  // multi-select: a Set of selected keys vs. at most one. Reflected so `[multiple]` drives CSS.
  multiple: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UIListboxElement extends ReactiveProps<typeof listboxProps> {}
export class UIListboxElement extends UIFormElement {
  static props = listboxProps

  // LLD-C3: the committed selection, updated by selectionCommit's `onSelect` callback.
  // Single mode: a string key ('' = nothing selected).
  // Multi mode: a ReadonlySet<string> (empty Set = nothing selected).
  // Both empty cases return null from formValue(). The codec is value-agnostic — formValue() /
  // formValidity() handle both union arms uniformly.
  #selection = signal<string | ReadonlySet<string>>('')

  /**
   * LLD-C3: the selected option's `value` attribute (single mode), or a newline-joined list
   * (multi mode), or `null` when nothing is selected.
   */
  protected override formValue(): FormValue {
    const sel = this.#selection.value
    if (typeof sel === 'string') return sel === '' ? null : sel
    if (sel.size === 0) return null
    return [...sel].join('\n')
  }

  /**
   * LLD-C3: `required` + nothing selected → `{ valid: false, flags: { valueMissing: true } }`.
   */
  protected override formValidity(): ValidityResult {
    const sel = this.#selection.value
    const empty = typeof sel === 'string' ? sel === '' : sel.size === 0
    if (this.required && empty) {
      return { valid: false, flags: { valueMissing: true }, message: 'Please select an option.' }
    }
    return { valid: true }
  }

  protected override connected(): void {
    // LLD-C3: set ARIA role via internals — never a host attribute (FACE).
    this.internals.role = 'listbox'

    // LLD-C3: live accessor for [role=option] children (re-read per event for dynamic item sets).
    const items = (): HTMLElement[] =>
      [...this.querySelectorAll<HTMLElement>('[role=option]')]

    // LLD-C3: key extractor — the option's `value` attribute ('' = no key, skipped by selectionCommit).
    const keyOf = (el: HTMLElement): string => el.getAttribute('value') ?? ''

    // LLD-C3: roving-focus over the option set (vertical orientation, looping, type-ahead on by default).
    rovingFocus(this, { items })

    // LLD-C3: selection-commit — mode from the `multiple` prop at connect time; onSelect updates
    // #selection, which drives formValue() + formValidity() reactively via the UIFormElement effects.
    selectionCommit(this, {
      mode: this.multiple ? 'multi' : 'single',
      items,
      keyOf,
      onSelect: (selection) => {
        this.#selection.value = selection
      },
    })
  }
}

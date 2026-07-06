// select.ts — UISelectElement, the Wave-4 S4 single-select form control
// (control-suite-wave4-overlay.decomp.md S4 · ADR-0043 · listbox-roving.lld).
//
// Composition: a UIFormElement host + overlay controller (Popover API + JS positioning +
// light-dismiss) + rovingFocus (keyboard navigation within the panel's [role=option] items) +
// selectionCommit (single-select; aria-selected + `select` event). The trigger is a
// Control-class <button> showing the selected option's label (or placeholder) + a caret
// glyph sized = font (the §4.1 caret law: --ui-select-glyph = font). The panel is a
// Container/surface `<div>` with `role=listbox` (set on the panel element itself, NOT on
// the host — the host has no ARIA role: it is a logical select wrapper). Options are
// light-DOM children ([role=option]) moved into the panel at first connect (idempotent).
//
// Two-way `open` (ADR-0019): a scope-owned effect drives model→overlay (open/close the
// handle); a `close` listener on the host drives overlay→model (light-dismiss syncs the
// prop back). Mirrors the ui-popover S1 pattern exactly.
//
// Anatomy (parts created ONCE — idempotent across disconnect/reconnect):
//   <ui-select>
//     <button data-part="trigger" type="button" aria-haspopup="listbox"
//             aria-expanded="…" aria-controls="ui-select-listbox-N">
//       <span data-part="label">…selected label or placeholder…</span>
//       <span data-part="caret" aria-hidden="true"><svg>…caret-down (@agent-ui/icons)…</svg></span>
//     </button>
//     <span data-part="aria-label">…visually-hidden `label` prop text…</span>
//     <div data-part="listbox" role="listbox" id="ui-select-listbox-N"
//          popover="auto" tabindex="-1">
//       <!-- author's [role=option] children, moved here at first connect -->
//     </div>
//   </ui-select>
//
// ADR-0085 — the labelling seam: the trigger is a <button> (name-from-content = the value span), so a
// bare aria-label would ERASE the value (accname precedence). Instead the trigger's aria-labelledby
// CONCATENATES a name source with the [data-part=label] value span, which recomputes live as the
// selection changes: bare usage (unfielded) points at the control-created, visually-hidden
// [data-part=aria-label] span holding the `label` prop text; fielded usage (inside a ui-field) points
// at the field's own visible label part instead (applyFieldLabelling override, merge-not-clobber). No
// label + no field ⇒ no aria-labelledby ⇒ content-only name (today's default, zero drift).
//
// Closed-trigger keyboard (platform parity): ArrowDown/ArrowUp on the CLOSED trigger
// opens the panel; focus lands on the current selection via the overlay controller's
// moveFocusIn() (which uses the tabindex=0 set by rovingFocus on the selected/first
// option). Within the open panel, rovingFocus (container: listbox) handles Arrow/Home/End
// and type-ahead; Enter (and click on an option) commits via selectionCommit. Escape is
// handled by the Popover API (popover=auto light-dismiss) + the overlay controller's
// toggle listener, which emits `close` → our listener → open=false.
//
// ARIA: the host carries no explicit role (a logical select wrapper; internals.role stays
// unset). The trigger button has aria-haspopup="listbox" + aria-expanded (synced via a
// scope-owned effect) + aria-controls pointing to the panel's stable id. The panel carries
// role="listbox" as a direct child attribute (never on the host — the listbox is the PANEL
// part, not the host). [role=option] children carry aria-selected (driven by selectionCommit).
//
// Form: formValue() = the selected key string (null when nothing is selected); formValidity()
// = required && nothing selected → { valid: false, flags: { valueMissing: true } }.
// formReset() restores value to '' (the default / unselected state).
//
// Import layers: controls/ → dom + traits + reactive (inward-only ✓).
// erasableSyntaxOnly ✓ (no enum/namespace/decorators). verbatimModuleSyntax ✓ (import type).

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIFormElement } from '../../dom/index.ts'
import type { FormValue, ValidityResult, FieldLabelling } from '../../dom/index.ts'
import { overlay, type OverlayHandle } from '../../traits/overlay.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { selectionCommit } from '../../traits/selection-commit.ts'
import { scrollFade } from '../../traits/scroll-fade.ts'
import { setIcon } from '@agent-ui/icons'

// ── Module-level stable-id counter (one per listbox panel, never reused across instances) ──────

let _nextListboxId = 0

// ── Props ────────────────────────────────────────────────────────────────────────────────────────

const props = {
  // Universal form attributes from the spreadable formProps (name/disabled/required).
  // Each reflects — name for submission keying, disabled/required for attribute-selector styling.
  ...UIFormElement.formProps,

  // `value` — the selected option key (the matched `value` attribute of the [role=option] child).
  // '' = nothing selected. Reflected so `<ui-select value="apple">` works declaratively AND the
  // renderer two-way-binds it (value:{prop:'value',event:'select'} — the catalog's binding pair).
  value: { ...prop.string(''), reflect: true },

  // `label` — the bare-usage accessible-name source (ADR-0085; the text-field `label` precedent).
  // NOT reflected — an accessibility hint, not a styling hook. '' = no label → the trigger keeps its
  // content-only accessible name (back-compat). A host `aria-label` attribute stays inert (the host is
  // role-less) — this prop, not an attribute passthrough, is the seam.
  label: prop.string(),

  // `open` — whether the listbox panel is currently shown. Reflected + BINDABLE (ADR-0019).
  // Drives the overlay handle via a scope-owned effect (model→overlay). Overlay→model sync via
  // the `close` listener (platform light-dismiss writes open=false).
  open: { ...prop.boolean(false), reflect: true },

  // `placeholder` — the label shown on the trigger when nothing is selected. Not submitted.
  placeholder: { ...prop.string('') },

  // `size` — the dimensional-ramp step (text-field.ts:130 precedent). Reflects so the [size]
  // attribute-selector repoint in select.css (trigger height/font/icon/gap, sm/lg blocks) applies
  // to JS-set values too, not only author-set attributes — the T7 coherence fix (ADR-0081 doc-tail:
  // select shipped the [size] CSS ramp with no declaring prop/attribute, an API-drift blind spot).
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
} satisfies PropsSchema

// ── Element ──────────────────────────────────────────────────────────────────────────────────────

export interface UISelectElement extends ReactiveProps<typeof props> {}
export class UISelectElement extends UIFormElement {
  static props = props

  // The control-created listbox panel PART — created ONCE (idempotent guard in #ensureParts()).
  // Persists through disconnect/reconnect (like the modal dialog / popover panel).
  #listbox: HTMLElement | null = null
  #trigger: HTMLElement | null = null
  #labelSpan: HTMLElement | null = null
  #ariaLabelSpan: HTMLElement | null = null

  /**
   * Protected overlay handle — accessible to test probes (C10 idempotent-cleanup DoD).
   * Replaced on each reconnect (connected() re-runs); the old handle's cleanup fires via the
   * scope effect disposer at disconnect before this is re-assigned.
   */
  protected _overlayHandle: OverlayHandle | null = null

  // ── Form seams (UIFormElement hooks) ──────────────────────────────────────────────────────────

  protected override formValue(): FormValue {
    // '' = nothing selected → no form entry (null). Non-empty = the selected option key.
    return this.value === '' ? null : this.value
  }

  protected override formValidity(): ValidityResult {
    if (this.required && this.value === '') {
      return { valid: false, flags: { valueMissing: true }, message: 'Please select an option.' }
    }
    return { valid: true }
  }

  protected override formReset(): void {
    // Restore to the default (nothing selected) on form reset.
    this.value = ''
  }

  // ── ADR-0085 — the field-labelling seam wire (the button-vs-editor MERGE override) ──────────────

  /**
   * The part-role override (ADR-0085 cl.4) — the trigger carries no `internals.role` (a logical select
   * wrapper), so the base's guarded internals-reflection default (dom/form.ts) never fires; wire the
   * trigger's `aria-labelledby`/`aria-describedby` content attributes directly instead (the text-field
   * `applyFieldLabelling` precedent, ADR-0051 cl.2/LLD-C2).
   *
   * `aria-labelledby` is the BARE-mode effect's (connected(), below) exclusive concern whenever
   * `fieldLabelling === null` — this override never touches it on dissociation (`refs === null`), so the
   * two effects can never race to write the SAME attribute in the same flush wave (the F3 dual-writer
   * discipline text-field's own override documents). While fielded (`refs !== null`), THIS method is the
   * exclusive writer: MERGE, never clobber — `<refs.label.id> <value-span-id>` (field label + value),
   * the same two-id shape as the bare path, only the name source swaps.
   *
   * `aria-describedby` has NO other owner for this control (the trigger carries no internal
   * validity-message node, unlike text-field's editor) — so unlike text-field's override, THIS one is the
   * describedby's exclusive owner in BOTH directions: written from `[refs.description, refs.error]` when
   * fielded, cleared on dissociation.
   *
   * Guards a not-yet-created trigger (the LLD-C2 override contract) — cannot happen in practice
   * (`#ensureParts()` runs synchronously at the top of `connected()`, before the base's forwarding effect
   * installs), but the guard costs nothing and documents the contract.
   */
  protected override applyFieldLabelling(refs: FieldLabelling | null): void {
    const trigger = this.#trigger
    const labelSpan = this.#labelSpan
    if (!trigger || !labelSpan) return
    if (refs === null) {
      // aria-labelledby is NOT this branch's concern — the bare-mode effect below recomputes the full
      // unfielded state in the SAME flush wave. aria-describedby IS this method's exclusive concern in
      // both directions (no bare-mode owner exists for it), so it clears here.
      trigger.removeAttribute('aria-describedby')
      return
    }
    if (refs.label) trigger.setAttribute('aria-labelledby', `${refs.label.id} ${labelSpan.id}`)
    else trigger.removeAttribute('aria-labelledby')
    const described = [refs.description, refs.error].filter((el): el is HTMLElement => el !== null)
    if (described.length > 0) trigger.setAttribute('aria-describedby', described.map((el) => el.id).join(' '))
    else trigger.removeAttribute('aria-describedby')
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────────────────────────

  protected override connected(): void {
    const { trigger, listbox, labelSpan, ariaLabelSpan } = this.#ensureParts()

    // Wire the overlay controller (LLD-C1..C4) — proves overlay + listbox together (ADR-0043 S4).
    // placement='bottom-start' matches a standard select dropdown. auto=true → light-dismiss.
    // focusOnOpen=true → focus moves into the listbox on open (focus lands on the tabindex=0 option
    // set by rovingFocus, which is the current selection or the first option).
    const handle = overlay(this, {
      popup: listbox,
      anchor: trigger,
      placement: 'bottom-start',
      auto: true,
      focusOnOpen: true,
    })
    this._overlayHandle = handle

    // overlay→model: when the Popover API light-dismisses (Escape / outside-click), the overlay
    // controller emits `close` on the host. Sync the prop back so the two-way bind stays consistent.
    this.listen(this, 'close', () => {
      this.open = false
    })

    // model→overlay: a scope-owned effect drives open/close from the prop + keeps aria-expanded in
    // sync. Runs immediately on creation (open=false → handle.close() no-op + aria-expanded='false').
    // B1 fix: measure the trigger width in JS and stamp it as a minInlineSize on the panel BEFORE
    // showPopover() is called. In the Popover API top layer `100%` CSS resolves to 100vw (the viewport
    // width), NOT the trigger width — so matching the trigger width must come from JS, not CSS.
    this.effect(() => {
      const isOpen = this.open
      if (isOpen) {
        const tw = trigger.getBoundingClientRect().width
        if (tw > 0) listbox.style.minInlineSize = `${tw}px`
        handle.open()
      } else {
        handle.close()
      }
      trigger.setAttribute('aria-expanded', String(isOpen))
    })

    // Trigger label effect: update the visible label whenever `value` or `placeholder` changes.
    // Reads both signals reactively — re-runs on either change. Searches for the matching option
    // by its `value` attribute (options are in the listbox, still within host.contains()).
    this.effect(() => {
      const val = this.value
      const ph = this.placeholder
      if (val !== '') {
        const options = listbox.querySelectorAll<HTMLElement>('[role=option]')
        let found: HTMLElement | null = null
        for (const opt of options) {
          if (opt.getAttribute('value') === val) {
            found = opt
            break
          }
        }
        labelSpan.textContent = found ? (found.textContent?.trim() ?? val) : val
      } else {
        labelSpan.textContent = ph
      }
    })

    // ADR-0085 — the trigger's accessible-name seam (bare/unfielded path). Split ownership of
    // `aria-labelledby` with applyFieldLabelling above (the F3 dual-writer discipline): this effect owns
    // it EXCLUSIVELY while unfielded and never touches it while fielded (the early return below) — the
    // override is the exclusive writer in that state, so the two can never race in the same flush wave.
    // `label` set → the hidden aria-label span + the value span (axis + value, e.g. "Scheme light");
    // `label` empty → no aria-labelledby → content-only accessible name (today's default, zero drift).
    this.effect(() => {
      if (this.fieldLabelling !== null) return // fielded — applyFieldLabelling owns aria-labelledby exclusively
      const lbl = this.label
      if (lbl) {
        ariaLabelSpan.textContent = lbl
        trigger.setAttribute('aria-labelledby', `${ariaLabelSpan.id} ${labelSpan.id}`)
      } else {
        trigger.removeAttribute('aria-labelledby')
      }
    })

    // B3 fix: a scope-owned effect keeps the trigger button's disabled state in sync with the
    // effective-disabled signal (own `disabled` prop OR ancestor <fieldset disabled>). This
    // makes the trigger pointer-inert and prevents AT from activating it while disabled.
    // aria-disabled is NOT set additionally — the button's `disabled` attribute is sufficient
    // (it carries the a11y semantics natively for <button>; a dual aria-disabled would be redundant).
    this.effect(() => {
      if (this.effectiveDisabled()) trigger.setAttribute('disabled', '')
      else trigger.removeAttribute('disabled')
    })

    // Trigger click → toggle the panel (the disclosure interaction).
    // B3 fix: guard with effectiveDisabled() — a disabled select must not open via click.
    this.listen(trigger, 'click', () => {
      if (!this.effectiveDisabled()) handle.toggle()
    })

    // Closed-trigger keyboard (platform parity): ArrowDown/ArrowUp on the CLOSED trigger opens
    // the panel. Focus is moved to the current selection (or first option) by the overlay
    // controller's moveFocusIn() via the tabindex=0 option that rovingFocus maintains.
    // B3 fix: guard with effectiveDisabled() — a disabled select must not open via keyboard.
    this.listen(trigger, 'keydown', (event) => {
      if (this.effectiveDisabled()) return
      const e = event as KeyboardEvent
      if (!this.open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        this.open = true
      }
    })

    // Live option accessor (re-reads the DOM on each event for dynamic option sets).
    const items = (): HTMLElement[] =>
      [...listbox.querySelectorAll<HTMLElement>('[role=option]')]

    // Key extractor — the option's `value` attribute ('' = no key, skipped by selectionCommit).
    const keyOf = (el: HTMLElement): string => el.getAttribute('value') ?? ''

    // rovingFocus on the listbox panel (container: listbox) — the keydown listener attaches to
    // the listbox so arrow-key navigation is scoped to the panel and does NOT intercept arrows
    // in other regions. initialIndex seeds from the current selection so reconnect lands on the
    // previously-selected option.
    rovingFocus(this, {
      items,
      orientation: 'vertical',
      container: listbox,
      initialIndex: () => {
        const list = items()
        const idx = list.findIndex((el) => keyOf(el) === this.value && this.value !== '')
        return idx >= 0 ? idx : 0
      },
    })

    // selectionCommit — single mode. onSelect updates `value` (which drives formValue() via the
    // UIFormElement effect) and closes the overlay. selectionCommit also emits `select` on the
    // host and sets aria-selected on each option.
    selectionCommit(this, {
      mode: 'single',
      items,
      keyOf,
      onSelect: (selection) => {
        // Single mode: selection is a string key.
        this.value = selection as string
        // Close the overlay (model-drives the effect → handle.close() → focus restored to trigger).
        this.open = false
      },
    })

    // Edge-aware scroll fade (the gutter-exposure fix, 2026-07-04) — always on, no opt-in prop. The listbox
    // panel is the scroll viewport (`overflow-y: auto` in select.css); a sticky [data-part="group-label"] is
    // already full-bleed (not affected by the inset-region gutter bug), but a long OPTION LIST still benefits
    // from the same edge affordance the rest of the family gets.
    scrollFade(this, { viewport: listbox })
  }

  // ── Part creation (idempotent across disconnect/reconnect) ─────────────────────────────────────

  /**
   * Create the control's THREE light-DOM parts ONCE (idempotent across disconnect/reconnect):
   *   - trigger: a `<button data-part="trigger">` with the label span + caret span.
   *   - ariaLabelSpan: a visually-hidden `<span data-part="aria-label">` (ADR-0085) — the bare-usage
   *     name source the trigger's `aria-labelledby` references alongside the value span.
   *   - listbox: a `<div data-part="listbox" role="listbox">` panel; author's [role=option]
   *     children are moved here at first connect.
   * The overlay controller sets `popover="auto"` on the listbox. `render()` stays the inherited VOID.
   */
  #ensureParts(): { trigger: HTMLElement; listbox: HTMLElement; labelSpan: HTMLElement; ariaLabelSpan: HTMLElement } {
    if (this.#listbox && this.#trigger && this.#labelSpan && this.#ariaLabelSpan) {
      // Parts persist through disconnect/reconnect — return the existing ones.
      return { trigger: this.#trigger, listbox: this.#listbox, labelSpan: this.#labelSpan, ariaLabelSpan: this.#ariaLabelSpan }
    }

    // One shared per-instance sequence number for every part id minted below (the ui-field precedent —
    // `ui-select-value-N` / `-aria-label-N` / `-listbox-N` read as a set at a glance).
    const seq = ++_nextListboxId

    // ── Build the trigger button ──

    const trigger = document.createElement('button')
    trigger.setAttribute('data-part', 'trigger')
    trigger.setAttribute('type', 'button') // prevent unintentional form submission
    trigger.setAttribute('aria-haspopup', 'listbox')

    // The label span shows the selected option's text (or placeholder). It also doubles as the
    // SECOND id in the trigger's aria-labelledby concatenation (ADR-0085) — it needs a stable id even
    // when unlabelled, since a later `label` write can arm the seam without recreating parts. The
    // caret span is an inline affordance glyph sized = font (the §4.1 caret law; CSS handles centering
    // in the icon cell via `padding: calc((icon - glyph) / 2)` — the `--ui-select-glyph = font` chain).
    const labelSpan = document.createElement('span')
    labelSpan.setAttribute('data-part', 'label')
    labelSpan.id = `ui-select-value-${seq}`
    labelSpan.textContent = this.placeholder || ''

    const caretSpan = document.createElement('span')
    caretSpan.setAttribute('data-part', 'caret')
    caretSpan.setAttribute('aria-hidden', 'true')
    setIcon(caretSpan, 'caret-down') // Phosphor, via @agent-ui/icons — sized = font by the caret span's own CSS (§4.1)

    trigger.appendChild(labelSpan)
    trigger.appendChild(caretSpan)

    // ── Build the visually-hidden aria-label span (ADR-0085 — the bare-usage name source) ──
    // Always created (idempotent-parts precedent, text-field's `message` node) so the connected()
    // effect never has to conditionally mint DOM; inert (unreferenced) when `label` is empty or the
    // control is fielded. select.css clips it — NOT `hidden`/`display:none`, which some AT/engine
    // combinations can fail to fold into the accessible-name computation for a labelledby reference.
    const ariaLabelSpan = document.createElement('span')
    ariaLabelSpan.setAttribute('data-part', 'aria-label')
    ariaLabelSpan.id = `ui-select-aria-label-${seq}`

    // ── Build the listbox panel ──

    const listbox = document.createElement('div')
    listbox.setAttribute('data-part', 'listbox')
    listbox.setAttribute('data-box', '') // adopt the shared container box-model (inset margins + sticky headers)
    // role="listbox" on the panel element (NOT on the host — the listbox is the PANEL, not the
    // select wrapper). The host carries no explicit role (a logical select wrapper).
    listbox.setAttribute('role', 'listbox')
    // tabindex="-1" lets the overlay's moveFocusIn() fall back to panel.focus() when no option
    // has tabindex=0 yet (empty select or before rovingFocus seeds). rovingFocus subsequently
    // sets the selected/first option to tabindex=0.
    listbox.setAttribute('tabindex', '-1')
    // Stable id for the trigger's aria-controls (created once, never reused across instances).
    listbox.id = `ui-select-listbox-${seq}`

    // Wire the trigger's ARIA affordances (aria-expanded is set reactively by the scope-owned
    // effect in connected(); aria-controls is stable and set here once at part creation).
    trigger.setAttribute('aria-controls', listbox.id)

    // Move author [role=option] AND [role=group] light-DOM children into the listbox panel at first
    // connect (one-time; the idempotent guard prevents re-moving on reconnect). The overlay controller
    // sets popover="auto" on the listbox — not here (single-ownership).
    //
    // GROUPS (optgroup parity): a `<div role="group" label="…">` renders a NON-interactive header from
    // its `label` (or `aria-label`) and moves with its nested `[role=option]` children. rovingFocus +
    // selectionCommit operate on `[role=option]` (found nested via querySelectorAll), so they traverse
    // groups transparently and never land on a header. The group is named for AT via aria-labelledby.
    let child = this.firstElementChild
    let groupSeq = 0
    while (child) {
      const next = child.nextElementSibling
      const role = child.getAttribute('role')
      if (role === 'option') {
        listbox.appendChild(child)
      } else if (role === 'group') {
        const label = child.getAttribute('label') ?? child.getAttribute('aria-label') ?? ''
        if (label && !child.querySelector(':scope > [data-part="group-label"]')) {
          const header = document.createElement('div')
          header.setAttribute('data-part', 'group-label')
          header.id = `${listbox.id}-grp-${++groupSeq}`
          header.textContent = label
          child.removeAttribute('label') // consumed — the visible header + aria-labelledby replace it
          child.setAttribute('aria-labelledby', header.id) // AT names the group from the header
          child.insertBefore(header, child.firstChild)
        }
        listbox.appendChild(child)
      }
      child = next
    }

    this.appendChild(trigger)
    this.appendChild(ariaLabelSpan)
    this.appendChild(listbox)

    this.#trigger = trigger
    this.#listbox = listbox
    this.#labelSpan = labelSpan
    this.#ariaLabelSpan = ariaLabelSpan

    return { trigger, listbox, labelSpan, ariaLabelSpan }
  }
}

if (!customElements.get('ui-select')) customElements.define('ui-select', UISelectElement)

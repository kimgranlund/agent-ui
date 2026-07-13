// combo-box.ts — UIComboBoxElement, the Wave-4 S5 combo-box overlay control
// (control-suite-wave4-overlay.decomp.md S5 · ADR-0043 · overlay-controller.lld.md).
//
// A FACE form-associated combo-box: a contenteditable editor part + a Popover-API listbox panel.
// Active-descendant pattern (focus STAYS on the editor; Arrow moves the highlighted option via
// aria-activedescendant WITHOUT moving DOM focus — the key distinction from ui-select/ui-menu).
// Filter-on-type opens the list and hides non-matching options; Enter/click commits;
// strict=false (default) allows free-text commit when no highlighted option exists.
//
// Architecture (settled):
//   - Extends UIFormElement; self-defines ui-combo-box. Tier: pattern.
//   - Editor part: control-created <div data-part="editor" contenteditable="plaintext-only"
//     role="combobox"> — NOT imported from ui-text-field (concurrent build; active-descendant
//     aria-activedescendant wiring differs from a plain text box). Caret guard mirrors
//     text-field's model→surface write discipline: the model→surface effect only writes
//     editor.textContent when this.value changes (not on every keystroke), so the user's caret
//     is never reset mid-typing.
//   - Listbox panel: control-created <div data-part="listbox" role="listbox" popover="auto">.
//     Author-provided [role=option] children are adopted in at connect time AND on every later
//     light-DOM mutation (TKT-0026: a MutationObserver on the host's own childList — the select.ts
//     precedent; see #syncOptions), the child-move pattern, ADR-0017. Stable per-option ids
//     assigned lazily (#setActive) so a late-adopted option gets one too.
//   - overlay(this, { popup: listbox, anchor: editor, focusOnOpen: false }) — focus NEVER
//     leaves the editor. Two-way `open` (ADR-0019): scope-owned effect drives model→overlay;
//     the overlay's `close` event drives overlay→model.
//   - form: formValue() = value || null; formValidity() enforces required + strict.
//   - Labelling (ADR-0085, text-field ADR-0014 parity): a `label` prop → the editor's `aria-label`
//     (bare usage — the editor has a DISTINCT accessible value, so aria-label does not erase it, unlike
//     ui-select's button trigger); yields to `applyFieldLabelling`'s aria-labelledby the moment the
//     control associates with a `ui-field`.
//   - User-invalid (ADR-0051, text-field precedent): a `trackUserInvalid` controller gates the danger
//     treatment until the first blur/change, reflecting :state(user-invalid) + aria-invalid on the editor.
//
// Layer: controls → dom + traits (inward-only ✓).

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIFormElement, type FormValue, type ValidityResult, type FieldLabelling } from '../../dom/form.ts'
import { overlay, type OverlayHandle } from '../../traits/overlay.ts'
import { scrollFade } from '../../traits/scroll-fade.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'

// ── Module-level stable-id counters ─────────────────────────────────────────────────────────────

let _nextPanelId = 0
let _nextOptionId = 0

// ── Props ────────────────────────────────────────────────────────────────────────────────────────

const props = {
  // Universal form attributes (name / disabled / required — all reflected; UIFormElement.formProps
  // spreadable bag, per the no-static-props-inheritance contract ADR-0013).
  ...UIFormElement.formProps,

  // `value` — the COMMITTED value: an option's `value` attribute key (on option-commit), a
  // free-text string (on free-text commit when strict=false), or '' (nothing committed yet).
  // NOT reflected — the live value is the editor surface; the attribute seeds the reset baseline.
  value: prop.string(),

  // `label` — the bare-usage accessible-name source (ADR-0085; text-field ADR-0014 parity — the
  // editor has a DISTINCT accessible value, so aria-label does not erase it, unlike ui-select's
  // button trigger). NOT reflected — an accessibility hint, not a styling hook.
  label: prop.string(),

  // `open` — whether the listbox panel is shown. Reflected (bindable two-way, ADR-0019).
  // Drives the overlay handle via a scope-owned effect; synced back on light-dismiss.
  open: { ...prop.boolean(false), reflect: true },

  // `strict` — when true, the committed value MUST match a [role=option] child (select-with-
  // filter semantics). Default false = free text allowed (the general combo-box baseline).
  strict: { ...prop.boolean(false), reflect: true },

  // `placeholder` — displayed via [data-empty]::before { content: attr(data-placeholder) }
  // when the editor is visually empty (no text). The CSS placeholder read-back pattern (matches
  // text-field's approach so the fleet is consistent).
  placeholder: prop.string(),
} satisfies PropsSchema

// ── Element ──────────────────────────────────────────────────────────────────────────────────────

export interface UIComboBoxElement extends ReactiveProps<typeof props> {}
export class UIComboBoxElement extends UIFormElement {
  static props = props

  // The control-created editor part — created ONCE (#ensureParts idempotent guard).
  // Persists through disconnect/reconnect (light-DOM child).
  #editor: HTMLElement | null = null

  // The control-created listbox panel part — created ONCE. Children with [role=option] are
  // adopted into it at connect time AND on every later light-DOM mutation (TKT-0026 — see
  // #syncOptions) and stay there. The overlay controller sets popover="auto".
  #listbox: HTMLElement | null = null

  // The control-created "no matches" row — created ONCE, appended AFTER the moved-in options so it
  // always renders last. Toggled `hidden` by `#syncEmptyState()` (2026-07-07 fix): without it, a
  // filter that hides every option leaves the listbox panel open with ZERO visible children — the
  // panel then collapses to its own 1px border top+bottom (no content, no min-block-size), painting
  // as a stray ~2px horizontal line below the editor instead of a real panel or nothing at all.
  #emptyRow: HTMLElement | null = null

  /** Protected overlay handle — used for the C10 cleanup probe. */
  protected _overlayHandle: OverlayHandle | null = null

  // Index of the currently highlighted (active-descendant) option within the VISIBLE option set.
  // -1 = no option highlighted. Resets on every filter change and on commit.
  #activeIdx = -1

  // IME composition guard — mirrors text-field: never update model or filter during composition.
  #composing = false

  // Native-parity reset baseline — seeded ONCE from the initial `value` attribute
  // (property-wins: upgradeProps runs first, attribute is the declarative default value).
  #defaultValue = ''
  #defaultCaptured = false

  // The user-invalid TIMING controller (ADR-0051), created per connection (re-arms on reconnect;
  // released on disconnect) — the text-field precedent.
  #userInvalid: TrackUserInvalidController | null = null

  // TKT-0026 — the select.ts precedent: watches the HOST's own light-DOM childList so an Option
  // added AFTER first connect still adopts into the panel (see #syncOptions below). Created fresh on
  // every connect; disconnected + nulled in disconnected().
  #optionObserver: MutationObserver | null = null

  // ── Override `focus()` to forward to the editor part ────────────────────────────────────────

  override focus(options?: FocusOptions): void {
    if (this.#editor) this.#editor.focus(options)
    else super.focus(options)
  }

  // ── Connect / disconnect lifecycle ──────────────────────────────────────────────────────────

  protected override connected(): void {
    // Capture the reset baseline ONCE from the initial `value` attribute (see text-field pattern).
    if (!this.#defaultCaptured) {
      this.#defaultValue = this.getAttribute('value') ?? ''
      this.#defaultCaptured = true
    }

    const { editor, listbox } = this.#ensureParts()

    // TKT-0026 — adopt any light-DOM children sitting as direct children of the host RIGHT NOW
    // (catches anything appended while disconnected — no observer runs during that gap) and arm the
    // observer for everything after. See #syncOptions for why this never double-moves on reconnect.
    this.#syncOptions()
    this.#optionObserver = new MutationObserver(() => this.#syncOptions())
    this.#optionObserver.observe(this, { childList: true })

    // ── ADR-0051 — the user-invalid TIMING controller ────────────────────────────────────────
    // `blur` (capture) + `change` (emitted by #commitOption/#commitFreeText) — the text-field
    // precedent. Reflects :state(user-invalid) + aria-invalid on the editor (the role-carrying
    // part — role='combobox' rides the part, not internals.role, so the base's guarded default
    // never fires).
    const invalidController = trackUserInvalid(this, { invalid: () => !this.formValidity().valid })
    this.#userInvalid = invalidController
    this.effect(() => {
      if (invalidController.userInvalid()) {
        this.internals.states?.add('user-invalid')
        editor.setAttribute('aria-invalid', 'true')
      } else {
        this.internals.states?.delete('user-invalid')
        editor.removeAttribute('aria-invalid')
      }
    })

    // ── Wire the overlay controller ──────────────────────────────────────────────────────────
    // focusOnOpen: false is the CRITICAL combo-box difference: focus stays on the editor.
    // The overlay controller still handles positioning, light-dismiss (Escape / outside-click),
    // and emits `close` + `toggle` on light-dismiss (two-way bind, ADR-0019).
    const handle = overlay(this, {
      popup: listbox,
      anchor: editor,
      placement: 'bottom-start',
      auto: true,
      focusOnOpen: false,
    })
    this._overlayHandle = handle

    // ── Two-way `open` ───────────────────────────────────────────────────────────────────────

    // overlay → model: the platform light-dismissed the panel (Escape / outside-click).
    // The overlay controller already emitted `close` on the host; sync the prop back.
    this.listen(this, 'close', () => {
      this.open = false
    })

    // model → overlay: a scope-owned effect drives open/close from the prop + keeps aria-expanded
    // in sync. Eager first run (default open=false → handle.close() is a no-op, aria-expanded='false').
    this.effect(() => {
      const isOpen = this.open
      if (isOpen) handle.open()
      else handle.close()
      editor.setAttribute('aria-expanded', String(isOpen))
    })

    // ── Editor input → filter + open on type ─────────────────────────────────────────────────

    this.listen(editor, 'input', () => {
      if (this.#composing) return
      const text = editor.textContent ?? ''
      this.#filterOptions(text)
      editor.toggleAttribute('data-empty', text === '')
      // Open the panel on the first keystroke (the "open on type" behaviour).
      if (!this.open && text.length > 0) this.open = true
    })

    // IME composition guard (prevent mid-composition filter churn / model writes).
    this.listen(editor, 'compositionstart', () => {
      this.#composing = true
    })
    this.listen(editor, 'compositionend', () => {
      this.#composing = false
      const text = editor.textContent ?? ''
      this.#filterOptions(text)
      editor.toggleAttribute('data-empty', text === '')
    })

    // ── Keyboard: Arrow / Enter / Escape ─────────────────────────────────────────────────────

    this.listen(editor, 'keydown', (event) => {
      if (this.#composing) return
      const e = event as KeyboardEvent
      const { key } = e

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        // Open the panel first (mirrors native select-box convention).
        e.preventDefault()
        if (!this.open) this.open = true
        this.#moveActive(key === 'ArrowDown' ? 1 : -1)
        return
      }

      if (key === 'Enter') {
        e.preventDefault()
        if (this.open && this.#activeIdx >= 0) {
          // Enter commits the highlighted option.
          const opt = this.#getVisibleOptions()[this.#activeIdx]
          if (opt) this.#commitOption(editor, opt)
        } else if (!this.strict) {
          // strict=false: Enter with no active option commits the typed text (free text).
          const text = editor.textContent ?? ''
          this.#commitFreeText(editor, text)
        }
        return
      }

      // Escape is NOT handled here — it is a PLATFORM light-dismiss (the Popover API `popover=auto`
      // close-signal is document-level, so it fires even though focus stays on the editor). Letting
      // the platform close it (rather than a control-owned `this.open=false` here, which would race
      // the platform's own dismiss) keeps a single close path per Escape press — the cross-engine bug
      // the combo-box Escape smoke caught. The overlay trait announces `close`+`toggle` from that one
      // path either way (ADR-0101 — every real hide announces, platform- or component-driven alike).
    })

    // ── Option click (listbox is in the top layer — listen on the panel itself) ──────────────

    this.listen(listbox, 'click', (event) => {
      const e = event as MouseEvent
      const opt = (e.target as HTMLElement).closest<HTMLElement>('[role=option]')
      // Guard: hidden OR disabled (aria-disabled='true' or the disabled HTML attribute) → no-op (M2).
      if (!opt || opt.hidden
        || opt.getAttribute('aria-disabled') === 'true'
        || opt.hasAttribute('disabled')) return
      this.#commitOption(editor, opt)
    })

    // ── model → surface: the caret guard (mirrors text-field's discipline) ────────────────────
    //
    // This effect tracks `this.value` (a prop signal) and runs ONLY when the committed value
    // changes — NOT on every keystroke. The user's caret is never disturbed during typing because
    // typing does NOT update `this.value` (only commit does).
    //
    // On commit: we call `editor.textContent = label` FIRST, then `this.value = key`. When the
    // effect fires, editor.textContent already equals `#labelForValue(value)` → caret guard skips.
    // On programmatic `el.value = 'x'`: the effect runs and writes the matching option's label
    // (or `x` itself for free-text / unknown option) into the editor.
    this.effect(() => {
      const v = this.value
      if (this.#composing) return
      const label = this.#labelForValue(v)
      if (editor.textContent !== label) editor.textContent = label
      editor.toggleAttribute('data-empty', editor.textContent === '')
    })

    // ── Placeholder text + the label seam + disabled channel ─────────────────────────────────

    this.effect(() => {
      editor.setAttribute('data-placeholder', this.placeholder)
    })

    // ADR-0085 — the label seam (bare usage): `label` prop → editor aria-label (text-field ADR-0014
    // parity — the editor's text content IS a distinct accessible value, so aria-label does not erase
    // it, unlike ui-select's button trigger). Yields to the fielded aria-labelledby the moment the
    // combo-box associates with a ui-field (applyFieldLabelling below) — accname precedence, the
    // ADR-0051 pattern (text-field.ts:425 is the identical guard).
    this.effect(() => {
      if (this.label && this.fieldLabelling === null) editor.setAttribute('aria-label', this.label)
      else editor.removeAttribute('aria-label')
    })

    this.effect(() => {
      if (this.effectiveDisabled()) {
        editor.setAttribute('contenteditable', 'false')
        editor.setAttribute('aria-disabled', 'true')
        editor.removeAttribute('tabindex')
      } else {
        editor.setAttribute('contenteditable', 'plaintext-only')
        editor.removeAttribute('aria-disabled')
        // contenteditable is intrinsically focusable; no explicit tabindex needed.
      }
    })

    // Edge-aware scroll fade (the gutter-exposure fix, 2026-07-04) — always on, no opt-in prop. The panel
    // is now a bounded scroll viewport (combo-box.css: max-block-size: 40vh + overflow-y: auto, matching
    // ui-select/ui-menu; it used to be overflow: hidden, unbounded and unscrollable).
    scrollFade(this, { viewport: listbox })
  }

  // ── Parts creation (idempotent) ───────────────────────────────────────────────────────────────

  /**
   * Create the editor + listbox parts ONCE, persisting them across disconnect/reconnect.
   *
   * Editor:   `<div data-part="editor" contenteditable="plaintext-only" role="combobox">`.
   * Listbox:  `<div data-part="listbox" role="listbox" popover="auto" id="...">`.
   *           The overlay controller sets popover="auto" on the listbox.
   *           Author-provided [role=option] children are moved into the listbox here;
   *           each option gets a stable id for aria-activedescendant.
   */
  #ensureParts(): { editor: HTMLElement; listbox: HTMLElement } {
    if (this.#editor && this.#listbox) {
      return { editor: this.#editor, listbox: this.#listbox }
    }

    // ── Editor part ──────────────────────────────────────────────────────────────────────────
    const editor = document.createElement('div')
    editor.setAttribute('data-part', 'editor')
    editor.setAttribute('contenteditable', 'plaintext-only')
    // ARIA: the editor carries the combobox role (NOT the host, per FACE internals pattern).
    // aria-haspopup="listbox" tells AT the popup type.
    // aria-autocomplete="list" — filter mode (options shown + filtered by input, not completed).
    // aria-expanded and aria-controls are wired below / by the scope-owned effect.
    editor.setAttribute('role', 'combobox')
    editor.setAttribute('aria-haspopup', 'listbox')
    editor.setAttribute('aria-autocomplete', 'list')
    editor.setAttribute('aria-expanded', 'false')
    // Suppress the browser's OWN native text-assist UI (autocorrect/spell suggestion chip, autofill,
    // autocapitalise). Without these the platform renders a second floating suggestion (e.g. macOS's
    // "Banana ×" autocorrect chip) OVER the control's listbox — the "two dropdowns" bug. A combo-box
    // filter picks from a fixed list; native word-completion/spellcheck is never wanted here.
    editor.setAttribute('autocorrect', 'off')
    editor.setAttribute('autocapitalize', 'off')
    editor.setAttribute('autocomplete', 'off')
    editor.setAttribute('spellcheck', 'false')
    editor.toggleAttribute('data-empty', true) // placeholder visible on connect (empty by default)
    this.#editor = editor

    // ── Listbox panel part ───────────────────────────────────────────────────────────────────
    const panelId = ++_nextPanelId
    const listbox = document.createElement('div')
    listbox.setAttribute('data-part', 'listbox')
    listbox.setAttribute('data-box', '') // adopt the shared container box-model (inset margins)
    // role="listbox" on the part (NOT the host; FACE pattern).
    listbox.setAttribute('role', 'listbox')
    // tabindex="-1": the overlay controller's moveFocusIn() can land here if needed; in practice
    // focusOnOpen=false means it never calls moveFocusIn() — but the attribute is harmless.
    listbox.setAttribute('tabindex', '-1')
    listbox.id = `ui-combo-listbox-${panelId}`
    this.#listbox = listbox

    // aria-controls on the editor links it to the listbox (the AT association).
    editor.setAttribute('aria-controls', listbox.id)

    // Adopt author-provided children (and other children) into the listbox — the child-move pattern
    // (ADR-0017): the options live in the top-layer panel. #syncOptions (TKT-0026) is the single,
    // reusable adopt pass shared with `connected()`'s first-connect call AND every later light-DOM
    // mutation via `#optionObserver` — at this point `#emptyRow` is still null, so its own
    // `insertBefore(node, null)` degrades to a plain append (the emptyRow-stays-last invariant below
    // only matters once emptyRow exists).
    this.#syncOptions()

    // Assign stable ids to options for aria-activedescendant (done ONCE per connection).
    let optSeq = 0
    for (const opt of listbox.querySelectorAll<HTMLElement>('[role=option]')) {
      if (!opt.id) opt.id = `ui-cb${panelId}-opt-${++optSeq}`
    }

    // ── "No matches" row (2026-07-07 fix) — appended LAST so it always renders below any real
    // options. `role="presentation"` (not an option — never navigable, never commit-able; the
    // click/keyboard/active-descendant paths all key off `[role=option]` and skip it for free).
    // Starts hidden; `#syncEmptyState()` reveals it exactly when zero options are visible (see the
    // `#emptyRow` field comment for why this exists — the empty-panel collapse-to-a-line bug).
    const emptyRow = document.createElement('div')
    emptyRow.setAttribute('data-part', 'empty')
    emptyRow.setAttribute('role', 'presentation')
    emptyRow.textContent = 'No matches'
    emptyRow.hidden = true
    listbox.append(emptyRow)
    this.#emptyRow = emptyRow
    this.#syncEmptyState()

    this.append(editor, listbox)
    return { editor, listbox }
  }

  // ── Dynamic-options adoption (TKT-0026) ─────────────────────────────────────────────────────

  /**
   * Adopt every light-DOM node CURRENTLY sitting as a DIRECT child of the host — other than the
   * control-created `editor`/`listbox` parts themselves — into the listbox panel, immediately
   * BEFORE `#emptyRow` (so the "no matches" row stays the panel's last child regardless of how much
   * gets adopted over time; `insertBefore(node, null)` degrades to a plain append when `#emptyRow`
   * does not exist yet, i.e. the very first call from inside `#ensureParts()`). Runs once per connect
   * (first-connect AND reconnect — the reconnect call catches anything appended while disconnected,
   * when no observer was running) and again on every subsequent host `childList` mutation via
   * `#optionObserver` (armed in connected()).
   *
   * Idempotent + self-terminating, no re-entrancy guard needed: an already-adopted node lives inside
   * `#listbox`, not as a direct child of `this` — so `this.firstChild`/`nextSibling` traversal never
   * re-visits it (the relocation law: no double-move on reconnect). `editor`/`listbox` are excluded
   * by reference (they DO become direct children of `this` at the end of `#ensureParts()`, and must
   * never be adopted into themselves).
   *
   * A late adoption re-runs the CURRENT filter (`#filterOptions`, which also refreshes the empty-state
   * row) against the whole option set — a freshly-adopted option must obey whatever the user has
   * already typed, not bypass it by arriving after the fact.
   */
  #syncOptions(): void {
    const listbox = this.#listbox
    if (!listbox) return
    const editor = this.#editor
    const emptyRow = this.#emptyRow
    let adopted = false
    let node = this.firstChild
    while (node) {
      const next = node.nextSibling
      if (node !== editor && node !== listbox) {
        listbox.insertBefore(node, emptyRow)
        adopted = true
      }
      node = next
    }
    if (adopted && editor) this.#filterOptions(editor.textContent ?? '')
  }

  // ── Active-descendant helpers ──────────────────────────────────────────────────────────────

  /** All [role=option] children in the listbox panel. */
  #getOptions(): HTMLElement[] {
    if (!this.#listbox) return []
    return [...this.#listbox.querySelectorAll<HTMLElement>('[role=option]')]
  }

  /**
   * The currently-navigable option set: visible (not hidden) AND not disabled.
   * `aria-disabled='true'` and the `disabled` HTML attribute both opt out: such options
   * are skipped by Arrow navigation AND rejected by the click + Enter commit path (M2).
   */
  #getVisibleOptions(): HTMLElement[] {
    return this.#getOptions().filter(
      o => !o.hidden
        && o.getAttribute('aria-disabled') !== 'true'
        && !o.hasAttribute('disabled'),
    )
  }

  /**
   * Set the active-descendant index. Paints [data-active] on the target option, sets
   * aria-activedescendant on the editor (or removes it at idx=-1), and assigns a stable id
   * to the option if it lacks one (for late-added options).
   *
   * DOM focus NEVER moves — the active option is highlighted only via ARIA + CSS [data-active].
   */
  #setActive(idx: number): void {
    const opts = this.#getVisibleOptions()
    // Clear [data-active] from every visible option.
    for (const opt of opts) opt.removeAttribute('data-active')

    if (idx < 0 || idx >= opts.length) {
      this.#activeIdx = -1
      this.#editor?.removeAttribute('aria-activedescendant')
      return
    }

    this.#activeIdx = idx
    const opt = opts[idx]!
    opt.setAttribute('data-active', '')

    // Lazily ensure a stable id (handles dynamically-added options not present at connect).
    if (!opt.id) opt.id = `ui-combo-opt-${++_nextOptionId}`
    this.#editor?.setAttribute('aria-activedescendant', opt.id)
  }

  /**
   * Move the active-descendant index by `delta` (+1 = down, -1 = up), wrapping at the ends.
   * When nothing is highlighted, ArrowDown starts at the first option; ArrowUp at the last.
   */
  #moveActive(delta: 1 | -1): void {
    const opts = this.#getVisibleOptions()
    if (opts.length === 0) return
    let next: number
    if (this.#activeIdx < 0) {
      next = delta === 1 ? 0 : opts.length - 1
    } else {
      next = (this.#activeIdx + delta + opts.length) % opts.length
    }
    this.#setActive(next)
  }

  // ── Filter helpers ────────────────────────────────────────────────────────────────────────

  /**
   * Filter visible options to those whose textContent includes `text` (case-insensitive).
   * Clears active-descendant because the visible set has changed.
   * An empty `text` reveals all options (the initial state when first opened by Arrow).
   */
  #filterOptions(text: string): void {
    const lower = text.toLowerCase()
    for (const opt of this.#getOptions()) {
      opt.hidden = lower !== '' && !(opt.textContent ?? '').toLowerCase().includes(lower)
    }
    // Reset active since visible set changed (any stale index is now meaningless).
    this.#setActive(-1)
    this.#syncEmptyState()
  }

  /** Reveal all options (clear the filter). Called after commit so the next open shows all. */
  #clearFilter(): void {
    for (const opt of this.#getOptions()) {
      opt.hidden = false
    }
    this.#syncEmptyState()
  }

  /**
   * Toggle the "no matches" row (2026-07-07 fix) so it is visible exactly when ZERO options are
   * visible (either the filter matched nothing, or the author provided no options at all) — the
   * root-cause fix for the empty-panel collapsing to a stray border-only line: an always-present,
   * real content row gives the panel genuine height instead of nothing. Deliberately keys off
   * "not hidden" rather than `#getVisibleOptions()` (which ALSO excludes disabled options) — a
   * disabled-but-matching option should still suppress the "no matches" row; only the FILTER
   * (hidden) outcome should.
   */
  #syncEmptyState(): void {
    if (!this.#emptyRow) return
    const anyVisible = this.#getOptions().some((opt) => !opt.hidden)
    this.#emptyRow.hidden = anyVisible
  }

  // ── Value / label helpers ─────────────────────────────────────────────────────────────────

  /**
   * The display label for the given committed value `v`.
   * Looks for a [role=option] child whose `value` attribute equals `v`; returns its textContent.
   * Falls back to `v` itself (free-text commit, or option not found — programmatic set before
   * options are added). Returns '' when `v` is ''.
   */
  #labelForValue(v: string): string {
    if (v === '') return ''
    if (this.#listbox) {
      for (const opt of this.#listbox.querySelectorAll<HTMLElement>('[role=option]')) {
        if ((opt.getAttribute('value') ?? '') === v) return opt.textContent ?? v
      }
    }
    return v // free-text or no matching option
  }

  // ── Commit ────────────────────────────────────────────────────────────────────────────────

  /**
   * Commit the selected option `opt`.
   * Sets editor text first (so the caret-guard in the model→surface effect sees a match → no-op),
   * then updates `this.value`, closes the panel, clears the active-descendant + filter, and emits
   * `select` (option-specific) then `change` (form-value change).
   *
   * aria-selected sweep (M1): marks the committed option as `aria-selected="true"` and all others
   * as `aria-selected="false"`. This satisfies the WAI-ARIA combobox pattern requirement (the AT
   * identifies the selected option when the listbox reopens) and activates the CSS selected-highlight
   * rule (`[role='option'][aria-selected='true']`).
   */
  #commitOption(editor: HTMLElement, opt: HTMLElement): void {
    const key = opt.getAttribute('value') ?? opt.textContent ?? ''
    const label = opt.textContent ?? key
    // Sweep aria-selected across ALL options (not just visible — the full set must be consistent).
    for (const o of this.#getOptions()) {
      o.setAttribute('aria-selected', o === opt ? 'true' : 'false')
    }
    // Write the label first so the caret guard in the model→surface effect is a no-op.
    editor.textContent = label
    this.value = key
    this.open = false
    this.#setActive(-1)
    this.#clearFilter()
    editor.toggleAttribute('data-empty', label === '')
    this.emit('select', key)
    this.emit('change')
  }

  /**
   * Commit the typed free text (strict=false, no active option on Enter).
   * The text is already in editor.textContent (the user typed it), so no editor write is needed.
   */
  #commitFreeText(editor: HTMLElement, text: string): void {
    this.value = text
    this.open = false
    this.#setActive(-1)
    this.#clearFilter()
    editor.toggleAttribute('data-empty', text === '')
    this.emit('change')
  }

  // ── Form hooks ────────────────────────────────────────────────────────────────────────────

  /**
   * The value this combo-box contributes to its form.
   * '' (nothing committed) → null (no form entry submitted, matching the native <select> convention).
   */
  protected override formValue(): FormValue {
    return this.value === '' ? null : this.value
  }

  /**
   * The validity verdict:
   * - disabled → always valid (native parity: disabled controls bypass constraint validation).
   * - required && value==='' → valueMissing.
   * - strict && value!=='' && no matching option → typeMismatch (the typed value is not in the set).
   */
  protected override formValidity(): ValidityResult {
    if (this.effectiveDisabled()) return { valid: true }
    if (this.required && this.value === '') {
      return {
        valid: false,
        flags: { valueMissing: true },
        message: 'Please select an option.',
        anchor: this.#editor ?? undefined,
      }
    }
    if (this.strict && this.value !== '') {
      const opts = this.#getOptions()
      const hasMatch = opts.some(o => (o.getAttribute('value') ?? '') === this.value)
      if (!hasMatch) {
        return {
          valid: false,
          flags: { typeMismatch: true },
          message: 'Please select a valid option.',
          anchor: this.#editor ?? undefined,
        }
      }
    }
    return { valid: true }
  }

  /** Form reset → restore value ← defaultValue, clear the editor, reset filter + active. */
  protected override formReset(): void {
    this.#clearFilter()
    const v = this.#defaultValue
    const label = this.#labelForValue(v)
    // Write editor first (caret guard will see the match when the effect fires → no-op).
    if (this.#editor) {
      this.#editor.textContent = label
      this.#editor.toggleAttribute('data-empty', label === '')
    }
    this.value = v
    this.open = false
    this.#setActive(-1)
    // ADR-0051 — a reset must not leave a required-empty combo-box showing :state(user-invalid)
    // until the user re-interacts (the text-field formReset() precedent).
    this.#userInvalid?.reset()
  }

  protected override disconnected(): void {
    this.#userInvalid?.release() // idempotent — the listeners already die with the connection scope
    this.#userInvalid = null
    this.#optionObserver?.disconnect() // TKT-0026 — the observer does not outlive the connection
    this.#optionObserver = null
  }

  /** Feeds `FormConnectDetail.userInvalid` (ADR-0050) — the `trackUserInvalid` tracker IS the one
   *  timing source; this override just exposes its gate. */
  protected override formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }

  /** Restore value after navigation / autofill. */
  protected override formStateRestore(state: File | string | FormData | null): void {
    if (typeof state === 'string') {
      this.value = state
      // model→surface effect will fire on the next flush and update the editor.
    }
  }

  // ── ADR-0085 — the field-labelling seam wire (text-field parity) ────────────────────────────

  /**
   * The part-role override (ADR-0085 cl.3 · text-field.ts:662 precedent) — the combobox role rides the
   * light-DOM editor PART, not `internals.role`, so the base's guarded internals-reflection default
   * (dom/form.ts) never fires; id-reference the editor directly instead.
   *
   * `aria-labelledby` is this method's own, exclusive concern in both directions: set from `refs.label`
   * when present, removed when `null` (matching text-field exactly).
   *
   * `aria-describedby` is ALSO this method's exclusive concern in both directions here — UNLIKE
   * text-field, this control has no internal validity-MESSAGE node/effect competing for the
   * attribute (the ADR-0051 user-invalid leg below writes only `:state(user-invalid)` +
   * `aria-invalid`, never `aria-describedby`), so there is no dual-writer race to avoid by leaving
   * it untouched on dissociation; it is written from `[refs.description, refs.error]` when fielded
   * and cleared when not, in both branches below.
   *
   * Guards a not-yet-created editor (the LLD-C2 override contract) — cannot happen in practice
   * (`#ensureParts()` runs synchronously at the top of `connected()`, before the base's forwarding effect
   * installs), but the guard costs nothing and documents the contract.
   */
  protected override applyFieldLabelling(refs: FieldLabelling | null): void {
    const editor = this.#editor
    if (!editor) return
    if (refs === null) {
      editor.removeAttribute('aria-labelledby')
      editor.removeAttribute('aria-describedby')
      return
    }
    if (refs.label) editor.setAttribute('aria-labelledby', refs.label.id)
    else editor.removeAttribute('aria-labelledby')
    const described = [refs.description, refs.error].filter((el): el is HTMLElement => el !== null)
    if (described.length > 0) editor.setAttribute('aria-describedby', described.map((el) => el.id).join(' '))
    else editor.removeAttribute('aria-describedby')
  }
}

if (!customElements.get('ui-combo-box')) customElements.define('ui-combo-box', UIComboBoxElement)

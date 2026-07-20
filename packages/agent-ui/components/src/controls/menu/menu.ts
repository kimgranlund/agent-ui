// menu.ts — UIMenuElement, the Wave-4 S3 menu overlay control
// (control-suite-wave4-overlay.decomp.md S3 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// Composition: a `UIElement` host + `overlay()` (Popover API + JS positioning + two-way `open`) +
// `rovingFocus()` over [role=menuitem]/[role=menuitemradio]/[role=menuitemcheckbox] items (Arrow
// roves focus; type-ahead; Enter/click commits). NOT form-associated — ui-menu emits an action
// (`select` with {value,index}), carrying NO form value. Like ui-tabs (non-value commit→select),
// but in an overlay. A trigger (first element child, marked `data-part="trigger"`) opens the
// panel; commit closes it.
//
// SELECTABLE-ITEM VARIANT (GH #55): an item PRE-MARKED by the author with `role="menuitemradio"`
// or `role="menuitemcheckbox"` (before it is handed to `<ui-menu>`) is a per-item opt-in — NOT a
// menu-level prop. Design call: per-item role-sniffing was chosen over a menu-level `selectable`
// prop because (a) it matches the control's existing per-item conventions (`data-value`, the
// roleless→menuitem auto-stamp) rather than adding a new attribute surface, and (b) it lets ONE
// menu mix plain command rows with a selectable group (e.g. a "Sort by ▸" radio block beside plain
// action rows) — a menu-level prop could only describe an all-or-nothing menu. Selectable items
// are included in roving focus / type-ahead / click+Enter/Space commit exactly like plain
// `menuitem` (`#itemsIn` below reads all three roles as one ordered set). The control itself
// manages `aria-checked` ON COMMIT (`#commit`): a `menuitemcheckbox` item toggles its own
// aria-checked; a `menuitemradio` item sets itself `true` and every OTHER `menuitemradio` item
// sharing its `data-group` (default: the ungrouped '' bucket, so all ungrouped radio items in one
// panel form a single group) `false` — one-true-at-a-time. Items missing `aria-checked` get a
// default `false` stamped at connect (ARIA validity — the role requires it always be present);
// an author-pre-set `aria-checked="true"` (declaring the initial choice) is left untouched at
// connect and only changes on a subsequent commit.
//
// Anatomy (light-DOM, created once — idempotent across reconnect):
//   <ui-menu>
//     <button data-part="trigger" aria-expanded="…" aria-controls="ui-menu-panel-N"
//             aria-haspopup="menu">…</button>
//     <div data-part="panel" role="menu" popover="auto" id="ui-menu-panel-N" tabindex="-1">
//       <!-- author-provided item children moved in at connect; auto-get role=menuitem if absent -->
//       <div role="menuitem" tabindex="-1">Item 1</div>
//       <div role="menuitem" tabindex="-1">Item 2</div>
//     </div>
//   </ui-menu>
//
// Two-way `open` (ADR-0019): a scope-owned effect drives model→overlay; the overlay controller's
// `close` event listener drives overlay→model (light-dismiss syncs the prop back). The overlay
// trait emits `close` + `toggle` on EVERY real open-state transition — platform dismiss (Escape /
// outside-click), a commit's programmatic close, or a model-driven `open=false` alike (ADR-0101 —
// native ToggleEvent timing fidelity; the trait is the sole, uniform announcer for the family).
//
// Events: `select` ({value, index}) on commit; `toggle` + `close` on every real close, including a
// commit's programmatic close (ADR-0101 — see traits/overlay.ts).
//
// ARIA: host has no explicit role (logical wrapper); panel has `role=menu` set on the div part
// directly (a created part, not the host — the FACE rule "internals.role, never host attributes"
// applies to the HOST element; direct parts use setAttribute). The trigger gets `aria-expanded`,
// `aria-controls`, `aria-haspopup="menu"`. Item children auto-get `role=menuitem` if absent — an
// item that already carries a role (author pre-marked `menuitemradio`/`menuitemcheckbox`) is left
// alone. `aria-checked` remains invalid on plain `menuitem` (action semantics, no selected state);
// it is valid — and control-managed on commit — on the two selectable roles only (GH #55).
//
// `controls → dom → traits` is the one allowed import direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIElement } from '../../dom/index.ts'
import { overlay, type OverlayHandle, type OverlayPlacement } from '../../traits/overlay.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { scrollFade } from '../../traits/scroll-fade.ts'

// ── Placement enum values (mirrors the OverlayPlacement union from overlay.ts) ─────────────────

const PLACEMENTS = [
  'bottom-start',
  'bottom-end',
  'top-start',
  'top-end',
  'left-start',
  'left-end',
  'right-start',
  'right-end',
] as const satisfies readonly OverlayPlacement[]

// ── Props ────────────────────────────────────────────────────────────────────────────────────────

const props = {
  // `open` — whether the menu panel is shown. Reflected + BINDABLE: the catalog declares
  // value:{prop:'open',event:'toggle'} so the renderer two-way-binds it (ADR-0019). Drives the
  // overlay handle via a scope-owned effect.
  open: { ...prop.boolean(false), reflect: true },
  // `placement` — the preferred panel placement relative to the trigger (captured once per
  // connection; changing it after connect takes effect on the next reconnect).
  placement: { ...prop.enum(PLACEMENTS, 'bottom-start'), reflect: true },
} satisfies PropsSchema

// ── Module-level stable-id counter (one per panel, never reused) ─────────────────────────────────

let _nextPanelId = 0

// ── Element ──────────────────────────────────────────────────────────────────────────────────────

export interface UIMenuElement extends ReactiveProps<typeof props> {}
export class UIMenuElement extends UIElement {
  static props = props

  // The control-created panel PART — created ONCE (idempotent guard in #ensureParts()) and
  // NEVER re-created. Persists through disconnect/reconnect (like the modal/popover panel parts).
  #panel: HTMLElement | null = null

  /**
   * Protected overlay handle — accessible to test probes (C10 idempotent-cleanup DoD).
   * Replaced on each reconnect (connected() re-runs); the old handle's cleanup fires via the
   * scope effect disposer at disconnect before this is re-assigned.
   */
  protected _overlayHandle: OverlayHandle | null = null

  protected connected(): void {
    const { panel, trigger, items } = this.#ensureParts()

    // Wire the overlay controller (LLD-C1..C4) — popover=auto (Escape + outside-click
    // light-dismiss), focusOnOpen=true (focus moves INTO the menu on open, restored to trigger
    // on close by the overlay handle).
    const handle = overlay(this, {
      popup: panel,
      anchor: trigger,
      placement: this.placement,
      auto: true,
      focusOnOpen: true,
    })
    this._overlayHandle = handle

    // Trigger click → toggle the panel.
    //
    // ADR-0101 erratum fix: flip the PROP (`this.open`), not `handle.toggle()` directly — see
    // select.ts's click handler for the full race trace (identical mechanics here: a raw
    // `handle.toggle()` never writes `this.open`, so `#commit`'s later `this.open = false` was a
    // same-value no-op and the panel stuck open after picking a menu item — ticket #28's residual).
    // The prop is the single source of truth; the model→overlay effect below drives
    // `handle.open()`/`handle.close()` and the trait announces (ADR-0101) — the combo-box pattern.
    this.listen(trigger, 'click', () => {
      this.open = !this.open
    })

    // overlay→model: when the Popover API light-dismisses (Escape / outside-click), the overlay
    // controller emits `close` on the host. Sync the prop back so the two-way bind stays
    // consistent (ADR-0019 — the renderer reads `toggle`, but `open` must be false by then).
    this.listen(this, 'close', () => {
      this.open = false
    })

    // model→overlay: a scope-owned effect drives open/close from the prop and keeps aria-expanded
    // in sync. Runs immediately on creation (eager first run): open=false → handle.close() (no-op,
    // not yet open) + aria-expanded='false'. Re-runs whenever this.open changes.
    this.effect(() => {
      const isOpen = this.open
      if (isOpen) handle.open()
      else handle.close()
      trigger.setAttribute('aria-expanded', String(isOpen))
    })

    // Delegated click on the panel → commit the clicked menuitem. Handles mouse clicks AND
    // keyboard-activated button items (Enter/Space on a <button> fires a native click event).
    this.listen(panel, 'click', (ev) => {
      const target = ev.target as Node
      const list = items()
      const index = list.findIndex((item) => item === target || item.contains(target))
      if (index === -1) return
      const item = list[index]
      if (item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true') return
      this.#commit(index, item)
    })

    // Keydown on the panel → Enter/Space on focused menuitems that are NOT native buttons or
    // links (those convert Enter/Space → click natively, which our click listener then commits).
    // For non-interactive elements (`<div role=menuitem>`), we must commit on keydown.
    // DELIBERATE selectionCommit bypass (ratified, TKT-0065 lateral review): that trait reflects
    // `aria-selected` on items — invalid on `role=menuitem` (action semantics, no selected state) —
    // and carries no Space leg; this hand-rolled click+Enter/Space path IS the menu commit contract.
    this.listen(panel, 'keydown', (ev) => {
      const e = ev as KeyboardEvent
      if (e.key !== 'Enter' && e.key !== ' ') return
      const focused = document.activeElement as HTMLElement | null
      if (!focused) return
      // Buttons and links fire click on Enter/Space natively — the click listener handles them.
      if (focused instanceof HTMLButtonElement || focused.tagName === 'A') return
      const list = items()
      const index = list.findIndex((item) => item === focused || item.contains(focused))
      if (index === -1) return
      const item = list[index]
      if (item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true') return
      e.preventDefault()
      this.#commit(index, item)
    })

    // Roving keyboard focus — vertical (Arrow Up/Down), loop, type-ahead. Container = panel so
    // only Arrow keys inside the panel are intercepted (not the trigger's own keyboard events).
    rovingFocus(this, {
      container: panel,
      items,
      orientation: 'vertical',
      loop: true,
      typeAhead: true,
    })

    // Edge-aware scroll fade (the gutter-exposure fix, 2026-07-04) — always on, no opt-in prop. The panel
    // is now a bounded scroll viewport (menu.css: max-block-size: 40vh + overflow-y: auto, matching ui-select).
    scrollFade(this, { viewport: panel })
  }

  /**
   * Create the control's two light-DOM parts ONCE (idempotent across disconnect/reconnect):
   *   - trigger: the first element child, marked with `data-part="trigger"` + ARIA affordances.
   *   - panel: a `<div data-part="panel" role="menu">` appended to the host; non-trigger children
   *     are moved in and auto-assigned `role=menuitem` + `tabindex=-1` if they lack a role.
   *
   * The overlay controller sets `popover="auto"` on the panel. `render()` stays the inherited
   * VOID — the parts are created once and never re-created.
   */
  #ensureParts(): { panel: HTMLElement; trigger: HTMLElement; items: () => HTMLElement[] } {
    if (this.#panel) {
      // Parts persist through disconnect/reconnect — return the existing ones.
      const trigger = this.querySelector<HTMLElement>('[data-part="trigger"]')
      if (!trigger) throw new Error('ui-menu: trigger part lost on reconnect')
      const panel = this.#panel
      return { panel, trigger, items: () => this.#itemsIn(panel) }
    }

    // Identify the menu trigger — the first element child provided by the author.
    const trigger = this.firstElementChild as HTMLElement | null
    if (!trigger) {
      throw new Error(
        'ui-menu: provide a trigger as the first child (e.g. <button>) before the menu items',
      )
    }
    trigger.setAttribute('data-part', 'trigger')

    // Create the menu panel. The overlay controller sets popover="auto" via setAttribute
    // (single-ownership, ADR-0017 pattern — we do NOT set it here).
    // `role=menu` is set on the div part directly (a created element, NOT the host — the FACE
    // internals.role rule applies to the host element only).
    const panel = document.createElement('div')
    panel.setAttribute('data-part', 'panel')
    panel.setAttribute('data-box', '') // adopt the shared container box-model (inset margins)
    panel.setAttribute('role', 'menu')
    // tabindex="-1" lets moveFocusIn() (overlay LLD-C4) land on the panel itself when there
    // are no enabled menuitems — the fallback panel.focus() requires the element to be focusable.
    panel.setAttribute('tabindex', '-1')
    // Stable id for aria-controls (created once, never reused).
    panel.id = `ui-menu-panel-${++_nextPanelId}`

    // Move all non-trigger children into the panel (the menu items live in the top-layer surface,
    // not beside the trigger in the document flow — the modal/popover child-move pattern).
    let node = trigger.nextSibling
    while (node) {
      const next = node.nextSibling
      panel.appendChild(node)
      node = next
    }

    // Auto-assign role=menuitem + tabindex=-1 to direct element children that do not already
    // carry a role. The roving-focus trait then manages the tabindexes from this base state.
    // An item pre-marked role=menuitemradio|menuitemcheckbox (GH #55 selectable-item variant) is
    // left with its author-given role — only the aria-checked default below applies to it.
    for (const child of panel.children) {
      if (child instanceof HTMLElement) {
        if (!child.hasAttribute('role')) child.setAttribute('role', 'menuitem')
        if (!child.hasAttribute('tabindex')) child.setAttribute('tabindex', '-1')
        const role = child.getAttribute('role')
        // ARIA validity: menuitemradio/menuitemcheckbox must always carry aria-checked. Stamp the
        // default `false` only when absent — an author-pre-set value (declaring the initial
        // choice, e.g. the currently-active radio row) is left untouched.
        if ((role === 'menuitemradio' || role === 'menuitemcheckbox') && !child.hasAttribute('aria-checked')) {
          child.setAttribute('aria-checked', 'false')
        }
      }
    }

    this.appendChild(panel)
    this.#panel = panel

    // Wire the trigger's ARIA affordances.
    trigger.setAttribute('aria-controls', panel.id)
    trigger.setAttribute('aria-haspopup', 'menu')

    return { panel, trigger, items: () => this.#itemsIn(panel) }
  }

  /**
   * Return the live ordered set of item elements within the panel — plain `[role=menuitem]` rows
   * PLUS the selectable-item variant roles (`menuitemradio`/`menuitemcheckbox`, GH #55), as ONE
   * ordered set: roving focus, type-ahead, and commit all operate over whatever this returns, so a
   * selectable item is included exactly like a plain menuitem with no separate code path.
   */
  #itemsIn(panel: HTMLElement): HTMLElement[] {
    return [
      ...panel.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'),
    ]
  }

  /**
   * Commit a user-driven item selection: update aria-checked for a selectable item (GH #55), emit
   * `select` with {value, index}, then close the panel. The value is the item's `data-value`
   * attribute, falling back to trimmed text content. Close is driven programmatically (open=false
   * → effect → handle.close()); the overlay trait announces exactly one close+toggle pair for this
   * transition too (ADR-0101), with `el.open` already `false` by the time a listener observes
   * either event (the ordering invariant).
   */
  #commit(index: number, item: HTMLElement): void {
    const value = item.dataset['value'] ?? item.textContent?.trim() ?? String(index)
    const role = item.getAttribute('role')
    if (role === 'menuitemcheckbox') {
      // Independent toggle — this item's own aria-checked flips, no effect on any other item.
      const checked = item.getAttribute('aria-checked') === 'true'
      item.setAttribute('aria-checked', String(!checked))
    } else if (role === 'menuitemradio') {
      this.#commitRadio(item)
    }
    this.emit('select', { value, index })
    this.open = false
  }

  /**
   * One-true-at-a-time: set `item` checked and every OTHER menuitemradio sharing its `data-group`
   * unchecked. Ungrouped radio items (no `data-group`) share the default '' group — so a panel
   * with no explicit grouping still behaves as ONE radio group, the common case (e.g. the
   * agent-admin canvas-header's single agent-switcher group).
   */
  #commitRadio(item: HTMLElement): void {
    if (!this.#panel) return
    const group = item.dataset['group'] ?? ''
    for (const sibling of this.#panel.querySelectorAll<HTMLElement>('[role="menuitemradio"]')) {
      if ((sibling.dataset['group'] ?? '') !== group) continue
      sibling.setAttribute('aria-checked', sibling === item ? 'true' : 'false')
    }
  }
}

if (!customElements.get('ui-menu')) customElements.define('ui-menu', UIMenuElement)

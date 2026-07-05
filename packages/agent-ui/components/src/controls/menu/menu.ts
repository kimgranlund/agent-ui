// menu.ts — UIMenuElement, the Wave-4 S3 menu overlay control
// (control-suite-wave4-overlay.decomp.md S3 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// Composition: a `UIElement` host + `overlay()` (Popover API + JS positioning + two-way `open`) +
// `rovingFocus()` over [role=menuitem] items (Arrow roves focus; type-ahead; Enter/click commits).
// NOT form-associated — ui-menu emits an action (`select` with {value,index}), carrying NO form
// value. Like ui-tabs (non-value commit→select), but in an overlay. A trigger (first element child,
// marked `data-part="trigger"`) opens the panel; commit closes it.
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
// controller emits `close` + `toggle` on platform dismiss (Escape / outside-click only — the
// discriminator suppresses both on programmatic close, matching the overlay family contract).
//
// Events: `select` ({value, index}) on commit; `toggle` + `close` on platform light-dismiss only
// (overlay controller; NOT emitted after a commit or on a programmatic open=false).
//
// ARIA: host has no explicit role (logical wrapper); panel has `role=menu` set on the div part
// directly (a created part, not the host — the FACE rule "internals.role, never host attributes"
// applies to the HOST element; direct parts use setAttribute). The trigger gets `aria-expanded`,
// `aria-controls`, `aria-haspopup="menu"`. Item children auto-get `role=menuitem` if absent.
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
    this.listen(trigger, 'click', () => handle.toggle())

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
    for (const child of panel.children) {
      if (child instanceof HTMLElement) {
        if (!child.hasAttribute('role')) child.setAttribute('role', 'menuitem')
        if (!child.hasAttribute('tabindex')) child.setAttribute('tabindex', '-1')
      }
    }

    this.appendChild(panel)
    this.#panel = panel

    // Wire the trigger's ARIA affordances.
    trigger.setAttribute('aria-controls', panel.id)
    trigger.setAttribute('aria-haspopup', 'menu')

    return { panel, trigger, items: () => this.#itemsIn(panel) }
  }

  /** Return the live ordered set of [role=menuitem] elements within the panel. */
  #itemsIn(panel: HTMLElement): HTMLElement[] {
    return [...panel.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  }

  /**
   * Commit a user-driven item selection: emit `select` with {value, index}, then close the panel.
   * The value is the item's `data-value` attribute, falling back to trimmed text content.
   * Close is driven programmatically (open=false → effect → handle.close()) — the overlay
   * controller's discriminator ensures no redundant close/toggle event is emitted on this path.
   */
  #commit(index: number, item: HTMLElement): void {
    const value = item.dataset['value'] ?? item.textContent?.trim() ?? String(index)
    this.emit('select', { value, index })
    this.open = false
  }
}

if (!customElements.get('ui-menu')) customElements.define('ui-menu', UIMenuElement)

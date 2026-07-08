// popover.ts — UIPopoverElement, the Wave-4 S1 disclosure-popover overlay control
// (control-suite-wave4-overlay.decomp.md S1 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// Composition: a `UIElement` host + `overlay(this, { popup, anchor, placement })` — the direct trait-call
// pattern (there is no `host.use()`; traits are invoked directly, like `trackUserInvalid`/`rovingFocus`) — the BARE
// overlay (Popover API surface + JS positioning + light-dismiss + two-way `open`, ADR-0019). NOT
// form-associated — no value/validity. A disclosure trigger (first element child, default slot)
// toggles a control-created surface panel part (`[popover]`).
//
// Two-way `open` (ADR-0019): a scope-owned effect drives model→overlay (open/close the handle);
// a `close` event listener on the host drives overlay→model (light-dismiss syncs the prop back).
// The overlay trait emits `close` + `toggle` on the host for EVERY real transition — platform
// dismiss, a trigger-click close, or a model-driven `open=false` alike (ADR-0101); this control
// listens for `close` and sets `this.open = false` so the prop stays consistent on the light-dismiss
// path (the commit/model paths already set the prop first).
//
// Anatomy (light-DOM, created once — idempotent across reconnect):
//   <ui-popover>
//     <button data-part="trigger" aria-expanded="…" aria-controls="ui-popover-panel-N">…</button>
//     <div data-part="panel" popover="auto" id="ui-popover-panel-N" tabindex="-1">…</div>
//   </ui-popover>
//
// The trigger is the first element child provided by the author. Remaining children are moved
// into the panel at connect time (like the modal's child-move pattern, ADR-0017). The overlay
// controller sets `popover="auto"` on the panel. `render()` stays the inherited VOID — the parts
// are created once and never re-created (re-creating would drop top-layer / focus state).
//
// Placement is fixed per connection: the overlay controller captures `prefPlacement` at call time.
// Changing `placement` after connect takes effect on the NEXT reconnect (documented limitation).
//
// ARIA: minimal via internals — the host has no explicit role (a logical disclosure wrapper); the
// trigger gets `aria-expanded` + `aria-controls` set directly (child attributes, not host internals).
// The panel gets `tabindex="-1"` so `moveFocusIn()` can land on it when there are no interactive
// descendants. `controls → dom → traits` is the one allowed import direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIElement } from '../../dom/index.ts'
import { overlay, type OverlayHandle, type OverlayPlacement } from '../../traits/overlay.ts'

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
  // `open` — whether the popover panel is currently shown. Reflected (the [open] attribute keeps the
  // host's declared state inspectable) and BINDABLE: the catalog declares value:{prop:'open',
  // event:'toggle'} so the renderer two-way-binds it (ADR-0019). Drives the overlay handle.
  open: { ...prop.boolean(false), reflect: true },
  // `placement` — the preferred popup placement (flip + shift at viewport edges — LLD-C3). Captured
  // once per connection; changing it after connect takes effect on the next reconnect. Reflected so
  // `<ui-popover placement="top-end">` works declaratively.
  placement: { ...prop.enum(PLACEMENTS, 'bottom-start'), reflect: true },
} satisfies PropsSchema

// ── Module-level stable-id counter (one per panel, never reused across instances) ──────────────

let _nextPanelId = 0

// ── Element ──────────────────────────────────────────────────────────────────────────────────────

export interface UIPopoverElement extends ReactiveProps<typeof props> {}
export class UIPopoverElement extends UIElement {
  static props = props

  // The control-created popover panel PART — created ONCE (idempotent guard in #ensureParts()) and
  // NEVER re-created. Persists through disconnect/reconnect just like the modal dialog part.
  #panel: HTMLElement | null = null

  /**
   * Protected overlay handle — accessible to test probes (C10 idempotent-cleanup DoD).
   * Replaced on each reconnect (connected() re-runs); the old handle's cleanup fires via the scope
   * effect disposer at disconnect before this is re-assigned.
   */
  protected _overlayHandle: OverlayHandle | null = null

  protected connected(): void {
    const { panel, trigger } = this.#ensureParts()

    // Wire the overlay controller (LLD-C1..C4) — this is the PROOF of the overlay controller.
    // placement is read ONCE per connection (the controller captures prefPlacement at call time).
    const handle = overlay(this, {
      popup: panel,
      anchor: trigger,
      placement: this.placement,
      auto: true,       // popover=auto → Escape + outside-click light-dismiss (LLD-C2)
      focusOnOpen: true, // disclosure popover: focus moves into the panel on open (LLD-C4)
    })
    this._overlayHandle = handle

    // Trigger click → toggle the panel (the disclosure interaction).
    this.listen(trigger, 'click', () => handle.toggle())

    // overlay→model: when the Popover API light-dismisses (Escape / outside-click), the overlay
    // controller emits `close` on the host. Sync the prop back so the two-way bind stays consistent
    // (ADR-0019 — the renderer reads `toggle`, but we need `open` to already be false by then).
    // At the time this listener fires, the overlay's internal `isOpen` is already false (the toggle
    // listener in overlay.ts ran first), so the subsequent effect re-run calls `handle.close()` as
    // a no-op (the idempotent guard in overlay.ts: `if (cleaned || !isOpen) return`).
    this.listen(this, 'close', () => {
      this.open = false
    })

    // model→overlay: a scope-owned effect drives open/close from the prop and keeps aria-expanded in
    // sync. Runs immediately on creation (eager first run): open=false → handle.close() (no-op, not
    // yet open) + aria-expanded='false'. Re-runs whenever this.open changes.
    this.effect(() => {
      const isOpen = this.open
      if (isOpen) handle.open()
      else handle.close()
      trigger.setAttribute('aria-expanded', String(isOpen))
    })
  }

  /**
   * Create the control's two light-DOM parts ONCE (idempotent across disconnect/reconnect):
   *   - trigger: the first element child, marked with `data-part="trigger"` + ARIA affordances.
   *   - panel: a `<div data-part="panel">` appended to the host; non-trigger children are moved in.
   * The overlay controller sets `popover="auto"` on the panel. `render()` stays the inherited VOID.
   */
  #ensureParts(): { panel: HTMLElement; trigger: HTMLElement } {
    if (this.#panel) {
      // Parts persist through disconnect/reconnect — return the existing ones.
      const trigger = this.querySelector<HTMLElement>('[data-part="trigger"]')
      // The trigger must still be present (it's a light-DOM child, so it travels with the host).
      if (!trigger) throw new Error('ui-popover: trigger part lost on reconnect')
      return { panel: this.#panel, trigger }
    }

    // Identify the disclosure trigger — the first element child provided by the author.
    const trigger = this.firstElementChild as HTMLElement | null
    if (!trigger) {
      throw new Error(
        'ui-popover: provide a trigger as the first child (e.g. <button>) before the panel content',
      )
    }
    trigger.setAttribute('data-part', 'trigger')

    // Create the surface panel. The overlay controller sets popover="auto" via
    // `popup.setAttribute('popover', 'auto')` — we do NOT set it here (single-ownership, ADR-0017).
    const panel = document.createElement('div')
    panel.setAttribute('data-part', 'panel')
    // tabindex="-1" lets `moveFocusIn()` (overlay LLD-C4) land on the panel itself when there are
    // no interactive descendants — the fallback `popup.focus()` requires the element to be focusable.
    panel.setAttribute('tabindex', '-1')
    // Stable id for the trigger's `aria-controls` (created once, never reused).
    panel.id = `ui-popover-panel-${++_nextPanelId}`

    // Move all non-trigger children into the panel (the disclosure content lives in the top-layer
    // surface, not beside the trigger in the document flow — mirrors the modal child-move pattern).
    let node = trigger.nextSibling
    while (node) {
      const next = node.nextSibling
      panel.appendChild(node)
      node = next
    }

    this.appendChild(panel)
    this.#panel = panel

    // Wire the trigger's ARIA affordances (present from the first render — the effect wires
    // aria-expanded after connect, but aria-controls is stable and set here once).
    trigger.setAttribute('aria-controls', panel.id)

    return { panel, trigger }
  }
}

if (!customElements.get('ui-popover')) customElements.define('ui-popover', UIPopoverElement)

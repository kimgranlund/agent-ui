// tooltip.ts — UITooltipElement, the Wave-4 S2 tooltip overlay control
// (control-suite-wave4-overlay.decomp.md S2 · overlay-controller.lld.md LLD-C1..C4 · ADR-0043).
//
// Composition: a UIElement host + overlay({ popup: panel, anchor, auto: false,
// focusOnOpen: false }). auto=false → popover=manual (no Popover API light-dismiss —
// the tooltip owns its own dismissal). focusOnOpen=false → the tooltip NEVER moves focus.
// Triggers: pointer hover (with a configurable show-delay) AND keyboard focusin on the
// anchor (not hover-only — a11y). Dismisses on mouseleave, focusout, and Escape.
//
// Anatomy (light-DOM, created once — idempotent across disconnect/reconnect):
//   <ui-tooltip>
//     <button data-part="anchor" aria-describedby="ui-tooltip-panel-N">…</button>
//     <div data-part="panel" role="tooltip" popover="manual" id="ui-tooltip-panel-N">…</div>
//   </ui-tooltip>
//
// The anchor is the first element child. Remaining children are moved into the panel at
// connect time (the modal/popover child-move pattern). render() stays the inherited VOID —
// parts are created once and never re-created (re-creating drops top-layer / popover state).
//
// Two-way `open` (ADR-0019): a scope-owned effect drives model→overlay (open/close the
// handle). User-driven closes (mouseleave/focusout/Escape) emit close+toggle BEFORE setting
// open=false so the renderer's bind sees the events while the prop transitions. External
// programmatic close (open=false) does NOT emit — the overlay handle's discriminator (isOpen
// set false before hidePopover fires the echo toggle) suppresses the re-emit from overlay.ts.
//
// Changing `placement` after connect takes effect on the next reconnect (captured once per
// connection — same limitation as popover).
//
// `controls → dom → traits` is the one allowed import direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIElement } from '../../dom/index.ts'
import { overlay, type OverlayHandle, type OverlayPlacement } from '../../traits/overlay.ts'

// ── Placement values (mirrors the OverlayPlacement union from overlay.ts) ───────────────────

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

// ── Props ────────────────────────────────────────────────────────────────────────────────────

const props = {
  // `open` — whether the tooltip panel is currently shown. Reflected (the [open] attribute
  // keeps the host's declared state inspectable) and BINDABLE: the catalog declares
  // value:{prop:'open',event:'toggle'} so the renderer two-way-binds it (ADR-0019).
  // Drives the overlay handle via a scope-owned effect.
  open: { ...prop.boolean(false), reflect: true },
  // `placement` — the preferred popup placement (flip + shift at viewport edges — LLD-C3).
  // Captured once per connection; a reconnect picks up a new value. Reflected so
  // <ui-tooltip placement="top-start"> works declaratively.
  placement: { ...prop.enum(PLACEMENTS, 'bottom-start'), reflect: true },
  // `delay` — milliseconds to wait before showing on mouseenter. Keyboard focus shows
  // immediately regardless of this value (a11y: keyboard users cannot afford a hover delay).
  // Default: 600 ms (WCAG 1.4.13 — hoverable content must persist ≥ 5 000 ms or be
  // dismissable; 600 ms is a sensible show latency). Setting the attribute removes it (null)
  // → falls back to 600 ms in the handler via `?? 600`.
  delay: { ...prop.number(600) },
} satisfies PropsSchema

// ── Module-level stable-id counter (one per panel, never reused across instances) ──────────

let _nextPanelId = 0

// ── Element ──────────────────────────────────────────────────────────────────────────────────

export interface UITooltipElement extends ReactiveProps<typeof props> {}
export class UITooltipElement extends UIElement {
  static props = props

  // The control-created tooltip panel PART — created ONCE (idempotent guard in #ensureParts)
  // and NEVER re-created. Persists through disconnect/reconnect just like the popover panel.
  #panel: HTMLElement | null = null

  // Pending show-delay timer (returned by setTimeout). Cleared on any hide path and in
  // disconnected() to prevent stale opens after removal.
  #delayId: ReturnType<typeof setTimeout> | null = null

  /**
   * Protected overlay handle — accessible to test probes (C10 idempotent-cleanup DoD).
   * Replaced on each reconnect; the old handle's cleanup fires via the scope effect disposer
   * at disconnect before this is re-assigned.
   */
  protected _overlayHandle: OverlayHandle | null = null

  protected connected(): void {
    const { panel, anchor } = this.#ensureParts()

    const handle = overlay(this, {
      popup: panel,
      anchor,
      placement: this.placement,
      auto: false,        // popover=manual — NO Escape/outside-click light-dismiss (the tooltip
                          // owns its own trigger-based dismissal via blur/leave/Escape listeners)
      focusOnOpen: false, // a tooltip NEVER takes focus (a focus-steal would break the a11y model)
    })
    this._overlayHandle = handle

    // ── User-driven close helper ──────────────────────────────────────────────────────────
    //
    // Sets open=false FIRST so el.open is already false when close/toggle listeners run.
    // A renderer that reads el.open inside its toggle handler will see false — the correct
    // committed state. The two-way bind signal (toggle) is emitted after setting the prop
    // so the model write lands on the correct value, not the stale open=true.
    //
    // The overlay handle's discriminator (isOpen already true at this point → effect has not
    // yet run → handle.close() fires later via the scheduled effect, at which point the
    // discriminator sees isOpen=false before hidePopover echoes → no re-emit) guarantees
    // exactly ONE close+toggle pair per user dismiss.
    const userClose = (): void => {
      this.#clearDelay()
      if (!this.open) return // idempotent — nothing to close
      this.open = false      // SET FIRST — el.open is false at event-handler time
      this.emit('close')
      this.emit('toggle') // value:{prop:'open',event:'toggle'} two-way signal (ADR-0019)
    }

    // ── Hover trigger (show after delay) ─────────────────────────────────────────────────
    this.listen(anchor, 'mouseenter', () => {
      this.#clearDelay() // cancel any already-pending timer before re-scheduling
      const ms = this.delay ?? 600
      this.#delayId = setTimeout(() => {
        this.#delayId = null
        this.open = true
      }, ms)
    })
    this.listen(anchor, 'mouseleave', () => {
      userClose()
    })

    // ── Keyboard-focus trigger (immediate — no delay — a11y) ─────────────────────────────
    this.listen(anchor, 'focusin', () => {
      this.#clearDelay() // cancel hover delay so keyboard wins (no double-open, idempotent)
      this.open = true
    })
    this.listen(anchor, 'focusout', () => {
      userClose()
    })

    // ── Escape to dismiss ─────────────────────────────────────────────────────────────────
    //
    // Rides the connection AbortSignal via host.listen — auto-removed on disconnect. Only
    // acts when the tooltip is currently open (WCAG 1.4.13: "pointer can hover … dismiss").
    this.listen(document, 'keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') userClose()
    })

    // ── model→overlay: scope-owned effect drives open/close from the prop ────────────────
    //
    // Runs immediately on creation (eager first run): open=false → handle.close() (no-op, not
    // yet open). Re-runs whenever this.open changes. Keeps the overlay handle in sync with
    // any external programmatic write to the prop (e.g. a renderer two-way bind).
    this.effect(() => {
      const isOpen = this.open
      if (isOpen) handle.open()
      else handle.close()
    })
  }

  protected disconnected(): void {
    // Clear any pending show-delay timer so a stale open cannot fire after removal.
    this.#clearDelay()
  }

  #clearDelay(): void {
    if (this.#delayId !== null) {
      clearTimeout(this.#delayId)
      this.#delayId = null
    }
  }

  /**
   * Create the tooltip's two light-DOM parts ONCE (idempotent across disconnect/reconnect):
   *   - anchor: the first element child, marked data-part="anchor" + aria-describedby.
   *   - panel: a <div data-part="panel" role="tooltip"> appended to the host; non-anchor
   *     children are moved into it (the modal/popover child-move pattern, ADR-0017).
   * The overlay controller sets popover="manual" on the panel. render() stays the inherited VOID.
   */
  #ensureParts(): { panel: HTMLElement; anchor: HTMLElement } {
    if (this.#panel) {
      // Parts persist through disconnect/reconnect — return the existing ones.
      const anchor = this.querySelector<HTMLElement>('[data-part="anchor"]')
      // The anchor must still be present (it is a light-DOM child that travels with the host).
      if (!anchor) throw new Error('ui-tooltip: anchor part lost on reconnect')
      return { panel: this.#panel, anchor }
    }

    // The anchor is the first element child — the element being described by the tooltip.
    const anchor = this.firstElementChild as HTMLElement | null
    if (!anchor) {
      throw new Error(
        'ui-tooltip: provide an anchor as the first child (e.g. <button>) before the tooltip content',
      )
    }
    anchor.setAttribute('data-part', 'anchor')

    // Create the tooltip panel surface.
    // The overlay controller sets popover="manual" via popup.setAttribute('popover', 'manual').
    // We do NOT set it here (single-ownership, ADR-0017 pattern — one owner sets popover).
    const panel = document.createElement('div')
    panel.setAttribute('data-part', 'panel')
    // role=tooltip on the panel (the panel IS the tooltip surface — the ARIA tooltip pattern).
    // The panel is a child element, not the custom-element host, so role is set via attribute
    // directly. The host's ARIA (via this.internals) stays unset (a logical wrapper, no role).
    panel.setAttribute('role', 'tooltip')
    // Stable id for the anchor's aria-describedby (created once, never reused across instances).
    panel.id = `ui-tooltip-panel-${++_nextPanelId}`

    // Move all non-anchor children into the panel (the tooltip text lives in the top-layer
    // surface, not beside the anchor — mirrors the modal/popover child-move pattern).
    let node = anchor.nextSibling
    while (node) {
      const next = node.nextSibling
      panel.appendChild(node)
      node = next
    }

    this.appendChild(panel)
    this.#panel = panel

    // Wire the anchor's ARIA relationship: aria-describedby points at the tooltip surface.
    // Set once — the panel id is stable (never changes across reconnect).
    anchor.setAttribute('aria-describedby', panel.id)

    return { panel, anchor }
  }
}

if (!customElements.get('ui-tooltip')) customElements.define('ui-tooltip', UITooltipElement)

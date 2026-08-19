// form-popover.ts — UIFormPopoverElement, the F4-ruled pattern-tier control (GH #294)
// (form-popover.spec.md SPEC-R1..R11 · form-popover.lld.md LLD-C1..C7 · ADR-0043/0045/0019/0101/0017).
//
// Composition: a `UIElement` host + the overlay controller trait (direct call, ADR-0043/0045) —
// the BARE overlay (Popover API surface + JS positioning + light-dismiss + two-way `open`, ADR-0019)
// — plus a select-style CONTROL-CREATED trigger (label span + caret span, select.ts precedent). NOT
// form-associated — the panel's own children (real FACE form controls) each own their value/validity;
// live-apply (F2) means there is no aggregate draft value for the host to hold.
//
// Unlike ui-popover, the trigger is NOT an author-provided first child — it is minted by the control
// itself, so ALL author light-DOM children move into the panel (there is no author trigger to skip).
// Deliberately does NOT nest a literal <ui-popover> (the nested child-move footgun the patterns table
// records) and does NOT use rovingFocus (SPEC-R5 — native Tab order inside the panel; the anti-ui-menu
// constraint the first intake proved: roving/type-ahead is hostile to an embedded text field).
//
// Two-way `open` (ADR-0019): a scope-owned effect drives model→overlay (open/close the handle); a
// `close` event listener on the host drives overlay→model (light-dismiss syncs the prop back). The
// overlay trait emits `close` + `toggle` on the host for EVERY real transition (ADR-0101) — this
// control listens for `close` and sets `this.open = false`, the popover.ts precedent.
//
// Anatomy (light-DOM, created once — idempotent across reconnect):
//   <ui-form-popover>
//     <button data-part="trigger" type="button" aria-expanded="…" aria-controls="ui-form-popover-panel-N">
//       <span data-part="label">…the `label` prop text…</span>
//       <span data-part="caret" aria-hidden="true"><svg>…caret-down…</svg></span>
//     </button>
//     <div data-part="panel" data-box tabindex="-1" id="ui-form-popover-panel-N">
//       <!-- ALL author children, moved here at connect time -->
//     </div>
//   </ui-form-popover>
//
// `render()` stays the inherited VOID — the parts are created once and never re-created (re-creating
// would drop top-layer / focus state, the popover precedent).
//
// ARIA: the host carries no explicit role (a logical disclosure wrapper, matching ui-popover). The
// trigger gets aria-expanded (effect-synced) + aria-controls (stable, set once) — NO aria-haspopup
// (a generic disclosure surface, not a menu/listbox/dialog, SPEC-R6). The trigger's accessible name is
// its visible content (the `label` text) — no hidden-span concatenation needed (unlike select, there
// is no separate selection-value text to preserve).
//
// `controls → dom → traits` is the one allowed import direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIElement } from '../../dom/index.ts'
import { overlay, type OverlayHandle, type OverlayPlacement } from '../../traits/overlay.ts'
import { setIcon } from '@agent-ui/icons'

// ── Placement enum values (mirrors the OverlayPlacement union from overlay.ts — popover.ts precedent) ──

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
  // `open` — whether the panel is currently shown. Reflected + BINDABLE via `toggle` (ADR-0019).
  // Drives the overlay handle via a scope-owned effect (model→overlay).
  open: { ...prop.boolean(false), reflect: true },
  // `placement` — the preferred panel placement. Captured once per connection (the popover
  // limitation, restated) — changing it after connect takes effect on the next reconnect.
  placement: { ...prop.enum(PLACEMENTS, 'bottom-start'), reflect: true },
  // `label` — the trigger's VISIBLE text AND accessible name; the consumer/agent-authored summary
  // state carrier (e.g. "Options · 3 selected", F1). The control never computes it itself — the
  // content model is general form content, not a fixed anatomy the control could count. Reflects
  // per the fleet label-reflects law (TKT-0069).
  label: { ...prop.string(), reflect: true },
  // `size` — the trigger's dimensional-ramp step (select.ts precedent, the same [size] axis).
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
  // ADR-0223 (Fill by Default, slice 1 — the Appendix §E trigger ruling): the ONE sizing opt-out,
  // fleet-shared name. The host generates no box (display: contents), so the reflected attribute drives
  // the `:scope[inline] > [data-part='trigger']` CSS leg (inline-grid + the 10ch hug floor).
  inline: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

// ── Module-level stable-id counter (one per panel, never reused across instances) ──────────────

let _nextPanelId = 0

// ── Element ──────────────────────────────────────────────────────────────────────────────────────

export interface UIFormPopoverElement extends ReactiveProps<typeof props> {}
export class UIFormPopoverElement extends UIElement {
  static props = props

  // The control-created panel PART — created ONCE (idempotent guard in #ensureParts()) and NEVER
  // re-created. Persists through disconnect/reconnect just like the popover/select panel.
  #panel: HTMLElement | null = null
  #trigger: HTMLElement | null = null
  #labelSpan: HTMLElement | null = null

  /**
   * Protected overlay handle — accessible to test probes (the C10 idempotent-cleanup precedent).
   * Replaced on each reconnect (connected() re-runs); the old handle's cleanup fires via the scope
   * effect disposer at disconnect before this is re-assigned.
   */
  protected _overlayHandle: OverlayHandle | null = null

  protected connected(): void {
    const { panel, trigger, labelSpan } = this.#ensureParts()

    // Wire the overlay controller (SPEC-R3) — placement is read ONCE per connection.
    const handle = overlay(this, {
      popup: panel,
      anchor: trigger,
      placement: this.placement,
      auto: true,       // popover=auto → Escape + outside-click light-dismiss
      focusOnOpen: true, // focus moves into the panel on open
    })
    this._overlayHandle = handle

    // Trigger click → toggle the panel (the disclosure interaction).
    //
    // ADR-0101 erratum: flip the PROP (`this.open`), never `handle.toggle()` directly — the prop is
    // the single source of truth; the model→overlay effect below drives handle.open()/handle.close()
    // and the trait announces (ADR-0101) — byte-for-byte the popover.ts mechanics.
    this.listen(trigger, 'click', () => {
      this.open = !this.open
    })

    // overlay→model: a platform light-dismiss emits `close` on the host — sync the prop back so the
    // two-way bind stays consistent (ADR-0019).
    this.listen(this, 'close', () => {
      this.open = false
    })

    // model→overlay: a scope-owned effect drives open/close from the prop and keeps aria-expanded in
    // sync. Runs immediately on creation (eager first run).
    this.effect(() => {
      const isOpen = this.open
      if (isOpen) handle.open()
      else handle.close()
      trigger.setAttribute('aria-expanded', String(isOpen))
    })

    // Trigger label effect (SPEC-R2/LLD-C3): writes `label` into [data-part=label]'s textContent —
    // the visible text AND (content-only) accessible name.
    this.effect(() => {
      labelSpan.textContent = this.label
    })

    // No other listeners: child change/input/select bubble untouched (SPEC-R4); no keydown handling
    // beyond the native button (SPEC-R5 — native Tab order inside the panel, no roving focus).

    // Motion gate (interaction-states standard, button.ts precedent) — flip the `ready` custom
    // state ONE FRAME PAST first paint, so the upgrade/first-render styling SNAPS in and only
    // SUBSEQUENT hover/active/focus changes animate (the form-popover.css :state(ready) gate).
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  /**
   * Create the control's TWO light-DOM parts ONCE (idempotent across disconnect/reconnect):
   *   - trigger: a CONTROL-CREATED `<button data-part="trigger">` (label span + caret span).
   *   - panel: a `<div data-part="panel" data-box tabindex="-1">`; ALL author children (there is no
   *     author trigger, unlike ui-popover) are moved here at first connect.
   * The overlay controller sets `popover="auto"` on the panel — NOT here (single-ownership,
   * ADR-0017). `render()` stays the inherited VOID.
   */
  #ensureParts(): { trigger: HTMLElement; panel: HTMLElement; labelSpan: HTMLElement } {
    if (this.#panel && this.#trigger && this.#labelSpan) {
      // Parts persist through disconnect/reconnect — return the existing ones.
      return { trigger: this.#trigger, panel: this.#panel, labelSpan: this.#labelSpan }
    }

    // ── Build the trigger button (control-created — select's trigger anatomy) ──

    const trigger = document.createElement('button')
    trigger.setAttribute('data-part', 'trigger')
    trigger.setAttribute('type', 'button') // prevent unintentional form submission

    const labelSpan = document.createElement('span')
    labelSpan.setAttribute('data-part', 'label')
    labelSpan.textContent = this.label

    const caretSpan = document.createElement('span')
    caretSpan.setAttribute('data-part', 'caret')
    caretSpan.setAttribute('aria-hidden', 'true')
    setIcon(caretSpan, 'caret-down') // Phosphor, via @agent-ui/icons — sized = font (§4.1 caret law)

    trigger.appendChild(labelSpan)
    trigger.appendChild(caretSpan)

    // ── Build the panel ──

    const panel = document.createElement('div')
    panel.setAttribute('data-part', 'panel')
    panel.setAttribute('data-box', '') // the shared container box-model (ADR-0046 — SPEC-R8)
    // tabindex="-1" lets moveFocusIn() land on the panel itself when there are no interactive
    // descendants — the fallback popup.focus() requires the element to be focusable.
    panel.setAttribute('tabindex', '-1')
    // Stable id for the trigger's aria-controls (created once, never reused).
    panel.id = `ui-form-popover-panel-${++_nextPanelId}`

    // Move EVERY author child into the panel — there is no author trigger to skip (unlike
    // ui-popover, whose first child IS the trigger). One default slot, general form content (F1).
    let node = this.firstChild
    while (node) {
      const next = node.nextSibling
      panel.appendChild(node)
      node = next
    }

    this.appendChild(trigger)
    this.appendChild(panel)

    this.#trigger = trigger
    this.#panel = panel
    this.#labelSpan = labelSpan

    // Trigger's ARIA affordances: aria-controls is stable and set here once; aria-expanded is
    // effect-owned (connected()). No aria-haspopup (SPEC-R6 — a generic disclosure surface).
    trigger.setAttribute('aria-controls', panel.id)

    return { trigger, panel, labelSpan }
  }
}

if (!customElements.get('ui-form-popover')) customElements.define('ui-form-popover', UIFormPopoverElement)

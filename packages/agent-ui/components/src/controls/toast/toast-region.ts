// toast-region.ts — UIToastRegionElement, the top-layer host `ui-toast` instances stack inside
// (feed-family.lld.md LLD-C8 · SPEC-R12/R13/R17 · ADR-0112 fork F1/F2). BEHAVIOUR + the `show()`
// convenience + self-define ONLY; stacking geometry lives in toast-region.css, the public contract in
// toast-region.md. Same folder as toast.ts (the radio/radio-group same-folder precedent) — NOT its own
// package. NOT catalogued (ADR-0112 cl.6).
//
// Surface (fork F1): a platform `popover="manual"` attribute (set on the HOST at connect if absent —
// a platform attribute, never ARIA) rides the top layer above ANY page stacking context — a completion
// arriving while a modal is open must still show — while toasts stack inside via plain CSS flex/gap,
// zero JS positioning (unlike the overlay-controller's anchored popups, this region has no anchor to
// measure against). A childList `MutationObserver` drives visibility off child COUNT: ≥1 ⇒
// showPopover() (guarded by a local `#isOpen` flag — the overlay.ts open()/close() idiom, jsdom-safe
// since `:popover-open` matching is unavailable there); 0 ⇒ hidePopover() (SPEC-R12 AC1).
//
// Ownership (fork F2, "the ownership ruling" — feed-family.lld.md §5, resolved not left open): v1
// ownership is CONSUMER-mounted — a page/app-shell declares `<ui-toast-region>` and holds the reference
// it calls `show()` on. NO static singleton exists anywhere (ADR-0082's per-instance isolation); the
// app-shell does NOT compose a default region this wave (a scope allocation inside F2's ratified
// architecture, not a new fork — no ADR owed).
//
// `show()` (SPEC-R13): normalizes a string shorthand to `{ message }`, creates a `<ui-toast>`, assigns
// urgent/duration/action, sets its message text BEFORE append (announcement-correct — SPEC-R15 AC2's
// pre-insertion role covers the live-region HALF; this covers the CONTENT half), re-asserts top-layer
// order (SPEC-R12 AC2 — a completion arriving while a LATER modal is open still paints above it:
// hidePopover();showPopover() back-to-back, synchronous, one frame, no focus implications — manual
// popovers never hold focus), appends, and returns the element. Throws on a disconnected region (a dev
// error, never a silent queue — ledger #10).
//
// `controls → dom + controls/toast/toast.ts` — the allowed import direction (same-folder sibling).

import { UIElement } from '../../dom/index.ts'
import type { PropsSchema } from '../../dom/index.ts'
import { UIToastElement } from './toast.ts'

/** The `show()` input — a bare string shorthand normalizes to `{ message }`. */
export interface ToastOptions {
  message: string
  urgent?: boolean
  duration?: number
  action?: string
}

export class UIToastRegionElement extends UIElement {
  // EMPTY by design — placement is tokens in v1 (a `placement` prop is the named foreseen extension,
  // LLD-C8). Present (not omitted) for the fleet convention + the descriptor trip-wire's empty
  // bijection (the ui-form-provider precedent).
  static props = {} satisfies PropsSchema

  #isOpen = false
  #observer: MutationObserver | null = null

  protected connected(): void {
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual') // a platform attribute, never ARIA

    this.#observer = new MutationObserver(() => this.#syncVisibility())
    this.#observer.observe(this, { childList: true })
    this.#syncVisibility() // seed from any children already present (declarative markup)
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
    this.#isOpen = false
  }

  /**
   * Create and show a toast (SPEC-R13). See the class doc for the full sequence. Throws if the region
   * is not connected — a dev error, never a silent queue (ledger #10).
   */
  show(options: ToastOptions | string): UIToastElement {
    if (!this.isConnected) throw new Error('ui-toast-region: show() called while disconnected')
    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options

    const toast = document.createElement('ui-toast') as UIToastElement
    if (opts.urgent !== undefined) toast.urgent = opts.urgent
    if (opts.duration !== undefined) toast.duration = opts.duration
    if (opts.action !== undefined) toast.action = opts.action
    toast.textContent = opts.message // BEFORE append — announcement-correct (SPEC-R13)

    this.#reassertTopLayer()
    this.appendChild(toast)
    return toast
  }

  #syncVisibility(): void {
    if (this.childElementCount > 0) this.#show()
    else this.#hide()
  }

  #show(): void {
    if (this.#isOpen) return
    this.#isOpen = true
    this.showPopover()
  }

  #hide(): void {
    if (!this.#isOpen) return
    this.#isOpen = false
    try {
      this.hidePopover()
    } catch {
      // already hidden — nothing more to do (a platform-drift guard, the overlay.ts idiom)
    }
  }

  /**
   * SPEC-R12 AC2 — when already open, re-enter the top layer so a completion arriving while a LATER
   * modal is open still paints above it. A no-op when not currently open (the first-ever show path,
   * where the childList observer's own showPopover() call — triggered by the append below — is the
   * one that actually opens the region).
   */
  #reassertTopLayer(): void {
    if (!this.#isOpen) return
    try {
      this.hidePopover()
    } catch {
      // already hidden — proceed to re-show regardless
    }
    this.showPopover()
  }
}

if (!customElements.get('ui-toast-region')) customElements.define('ui-toast-region', UIToastRegionElement)

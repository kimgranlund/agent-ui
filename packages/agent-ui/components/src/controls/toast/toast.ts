// toast.ts — UIToastElement, the fleet's first transient notification surface (feed-family.lld.md
// LLD-C7 · SPEC-R14/R15/R16/R19 · ADR-0112 cl.5). BEHAVIOUR + props + the control-built message/
// action/close parts + self-define ONLY. Anatomy/geometry per the LLD; styling lives in toast.css,
// the public contract in toast.md. Region ownership + the `show()` convenience live beside it in
// toast-region.ts (the radio/radio-group same-folder precedent — ADR-0112's Decision cl.1). NOT
// catalogued (ADR-0112 cl.6) — the app-surface consumption story is region-hosted, never direct markup
// an agent emits.
//
// role=status is set in the CONSTRUCTOR (SPEC-R15 AC2), not connected() — the live-region semantics
// must exist BEFORE the element is inserted (construction strictly precedes any append call — e.g.
// UIToastRegionElement.show() creates the element, assigns props, sets textContent, THEN appends), so
// content present at append announces. connected()'s `urgent` effect flips status↔alert afterwards —
// a role CHANGE on an already-live region, a lesser concern than "was it live from the start."
//
// Anatomy (connected(), ONCE — an idempotent guard, the modal.ts/disclosure.ts part-persistence
// precedent): light-DOM children present at connect (typically the message text, set by a caller
// BEFORE append) are adopted (moved, ADR-0022) into a component-built `<span data-part="message">`;
// late-added children are out of scope v1 (ledger #7, documented in toast.md). `action` non-empty ⇒ an
// `<ui-button data-part="action">` is appended; a `<ui-button data-part="close">` icon-only
// (`<ui-icon name="x">`, `aria-label="Dismiss"`) is ALWAYS appended. Both affordances are reachable in
// normal tab order (ui-button's own `tabbable` trait) — no tabindex games, no autofocus (SPEC-R15
// AC3). Native `<button>` is banned (fleet law); the `<ui-button>`/`<ui-icon>` sibling imports are the
// sanctioned cross-control edge (the segmented-control → radio precedent).
//
// The timer (SPEC-R16) — remaining-time accounting, all element-local state (no separate trait; the
// LLD keeps this element-owned, not a reusable behaviour). Armed iff `action === '' &&
// Number.isFinite(duration) && duration > 0` — an actionable toast NEVER auto-dismisses (WCAG 2.2.1).
// Pause predicate = hovered ∨ focusWithin, tracked via four host listeners; `focusout` treats a null
// `relatedTarget` (window blur) as focus-left ⇒ resume (ledger #5 — a timer running in a blurred tab
// is the platform norm; the hover flag still pauses independently). `close()` is idempotent (a
// `closed` latch): clears the timer, dispatches exactly ONE `close`, `this.remove()` (ledger #11).
//
// `controls → dom + controls/button + controls/icon` — the allowed import direction (cross-control,
// the segmented-control/radio precedent).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIButtonElement } from '../button/button.ts'
import '../icon/icon.ts'

const props = {
  urgent: prop.boolean(false), // role=alert opt-in (SPEC-R15)
  duration: prop.number(6000), // ms; ≤0/non-finite ⇒ never auto-dismiss (SPEC-R14)
  action: prop.string(''), // non-empty ⇒ actionable ⇒ NEVER auto-dismisses (SPEC-R16, WCAG 2.2.1)
} satisfies PropsSchema

export interface UIToastElement extends ReactiveProps<typeof props> {}
export class UIToastElement extends UIElement {
  static props = props

  // The control-built message part — created ONCE (idempotent guard in #ensureParts); persists
  // through disconnect/reconnect (the modal.ts/disclosure.ts precedent).
  #message: HTMLElement | null = null

  // Timer state (SPEC-R16) — all local/imperative (never reactively read; the eligibility effect below
  // is the ONE reactive entry point, everything else — hover/focus/expiry — mutates it directly).
  #remaining = 0
  #startedAt = 0
  #timerId: ReturnType<typeof setTimeout> | null = null
  #hovered = false
  #focusWithin = false
  #closed = false

  constructor() {
    super()
    // SPEC-R15 AC2 — the live-region role exists BEFORE insertion (construction strictly precedes any
    // append call), so content present at append announces. connected()'s urgent effect flips this to
    // 'alert' when appropriate — a role CHANGE on an already-live region, not a first-insertion race.
    this.internals.role = 'status'
  }

  protected connected(): void {
    this.#ensureParts()

    // urgent ⇒ role flips status↔alert (SPEC-R15).
    this.effect(() => {
      this.internals.role = this.urgent ? 'alert' : 'status'
    })

    // The timer (SPEC-R16) — (re)computes eligibility + remaining time on every action/duration change;
    // an actionable toast never has a live timer. Pause/resume (hover/focus, below) are imperative,
    // driven off the SAME #remaining/#timerId state this effect seeds.
    this.effect(() => {
      const eligible = this.#eligible()
      this.#pauseTimer()
      this.#remaining = eligible ? (this.duration as number) : 0
      if (eligible && !this.#paused()) this.#armTimer()
    })

    // Pause predicate = hovered ∨ focusWithin (SPEC-R16) — four host listeners.
    this.listen(this, 'pointerenter', () => {
      this.#hovered = true
      this.#pauseTimer()
    })
    this.listen(this, 'pointerleave', () => {
      this.#hovered = false
      this.#resumeIfEligible()
    })
    this.listen(this, 'focusin', () => {
      this.#focusWithin = true
      this.#pauseTimer()
    })
    this.listen(this, 'focusout', (event) => {
      const related = (event as FocusEvent).relatedTarget as Node | null
      if (related && this.contains(related)) return // focus moved WITHIN the toast — still focusWithin
      this.#focusWithin = false // null relatedTarget (window blur) is treated as focus-left ⇒ resume (ledger #5)
      this.#resumeIfEligible()
    })
  }

  protected disconnected(): void {
    this.#pauseTimer()
  }

  /**
   * Close the toast (SPEC-R14 AC1/AC2). Idempotent (a `closed` latch): clears any running timer,
   * dispatches exactly ONE `close`, then removes the host from the DOM. Invoked by the close
   * affordance, timer expiry, AND an actionable commit (which emits `select` first) — the ledger #11
   * duplicate-path race is closed by the latch, not by the caller.
   */
  close(): void {
    if (this.#closed) return
    this.#closed = true
    this.#pauseTimer()
    this.emit('close')
    this.remove()
  }

  /** Armable iff not actionable and `duration` is a positive finite number (SPEC-R16). */
  #eligible(): boolean {
    return this.action === '' && Number.isFinite(this.duration) && (this.duration as number) > 0
  }

  #paused(): boolean {
    return this.#hovered || this.#focusWithin
  }

  #resumeIfEligible(): void {
    if (this.#eligible() && !this.#paused()) this.#armTimer()
  }

  #armTimer(): void {
    if (this.#timerId !== null || this.#remaining <= 0) return
    this.#startedAt = performance.now()
    this.#timerId = setTimeout(() => this.close(), this.#remaining)
  }

  /** clearTimeout + fold the elapsed time into `#remaining` (a no-op when no timer is running). */
  #pauseTimer(): void {
    if (this.#timerId === null) return
    clearTimeout(this.#timerId)
    this.#timerId = null
    this.#remaining -= performance.now() - this.#startedAt
  }

  /**
   * Build the light-DOM anatomy ONCE (idempotent guard; the part persists across reconnect — the
   * modal.ts/disclosure.ts precedent). Pre-existing host children (the message, set by a caller BEFORE
   * append — e.g. `UIToastRegionElement.show()`) are adopted (moved, ADR-0022) into the message part;
   * children added later are out of scope v1 (ledger #7, documented in toast.md). `action` is read
   * ONCE here — the affordance cluster is fixed at connect, matching the v1 usage pattern (`show()`
   * assigns every prop BEFORE the element ever connects).
   */
  #ensureParts(): void {
    if (this.#message) return

    const message = document.createElement('span')
    message.setAttribute('data-part', 'message')
    while (this.firstChild) message.appendChild(this.firstChild)
    this.appendChild(message)
    this.#message = message

    if (this.action !== '') {
      const actionBtn = document.createElement('ui-button') as UIButtonElement
      actionBtn.setAttribute('data-part', 'action')
      actionBtn.textContent = this.action
      this.appendChild(actionBtn)
      this.listen(actionBtn, 'click', () => {
        this.emit('select')
        this.close()
      })
    }

    // Always present, icon-only — a real accessible name via aria-label (button.md's textContent
    // source has nothing to read here), the fleet's icon-only-button idiom. `icon-only` opts into
    // button.css's fifth (square) structure — WITHOUT this attribute the button itself would render
    // non-square (the slotted icon + empty label reserving a dead 1fr label track); WITH it (as
    // shipped here) the button is a genuine square, proven by button-geometry.browser.test.ts's s14
    // suite. The card-level grid placement of this part is a SEPARATE concern — see toast.css's
    // `[data-part='close']` grid-column pin (TKT-0014).
    const closeBtn = document.createElement('ui-button') as UIButtonElement
    closeBtn.setAttribute('data-part', 'close')
    closeBtn.setAttribute('variant', 'ghost') // a subtle dismiss — never competes with an actionable CTA
    closeBtn.setAttribute('icon-only', '')
    closeBtn.setAttribute('aria-label', 'Dismiss')
    const icon = document.createElement('ui-icon')
    icon.setAttribute('slot', 'leading')
    icon.setAttribute('data-role', 'icon')
    icon.setAttribute('name', 'x')
    closeBtn.appendChild(icon)
    this.appendChild(closeBtn)
    this.listen(closeBtn, 'click', () => this.close())
  }
}

if (!customElements.get('ui-toast')) customElements.define('ui-toast', UIToastElement)

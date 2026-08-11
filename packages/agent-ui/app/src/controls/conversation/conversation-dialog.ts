// conversation-dialog.ts — UIConversationDialogElement, the scrolling message-thread's mechanical role
// promoted to its OWN element (ADR-0180 clauses 1/2 · GH #688 ·
// conversation-declarative-composition.lld.md §3). BEHAVIOUR + the public isNearBottom()/followTail()
// scroll-follow seam + self-define ONLY; the turn-stacking layout lives in conversation-dialog.css, the
// public contract in conversation-dialog.md.
//
// `ui-conversation` seats ONE instance as its own `#log` — an author-supplied `:scope > ui-conversation-
// dialog` if present (ADOPTED, never a second imperative surface), else JS-created — and drives EVERY
// turn/bubble append directly onto it (`this.#log.append(...)`, conversation.ts's connected()). This
// element owns only the log's MECHANICAL role: the scroll region, the live-region semantics, and the
// stick-to-bottom pair, moved VERBATIM off `ui-conversation` (ADR-0180 clause 2 — "adoption, not a
// parallel imperative surface"). It grows NO turn/registry/AgentTurnHandle API of its own; that whole
// engine — both surface registries, narration, the busy counter — stays solely on `UIConversationElement`.
// Legal standalone too (an inert scrollable live region with nothing routed into it) — `ui-conversation`
// is what drives content into it, this element never throws or warns outside one.
//
// ARIA: `internals.role = 'log'` (a POLITE live region — the SAME `role=log` choice ui-status-stream
// already makes, status-stream.ts) PLUS an explicit `internals.ariaLive = 'polite'` belt (ADR-0180 clause
// 1b) — STRICTLY better than the pre-ADR-0180 shape (a bare `aria-live` HOST ATTRIBUTE `ui-conversation`
// used to write directly onto the internal `div`) and fleet-law compliant (ARIA via internals, never host
// attributes — dom/element.ts). Both set in the CONSTRUCTOR, before insertion (the status-stream.ts
// precedent) — role=log carries an implicit aria-relevant="additions" default, so a genuinely NEW turn/
// bubble announces while this element carries nothing that would re-announce on an unrelated mutation.
//
// `controls → dom` only (no traits) — a leaf with no reactive behaviour of its own, the toast-region.ts /
// card-header.ts precedent for a mechanically-thin element.

import { UIElement, type PropsSchema } from '@agent-ui/components'

// The stick-to-bottom guard's own constants (SPEC-R4 AC2) — moved verbatim off conversation.ts, values
// unchanged (LLD §3).
const LOG_STICK_THRESHOLD_PX = 24
const TAIL_FOLLOW_STABLE_CHECKS = 3
const TAIL_FOLLOW_CHECK_MS = 40
const TAIL_FOLLOW_MAX_CHECKS = 25

export class UIConversationDialogElement extends UIElement {
  // EMPTY by design (v1, LLD §3 "Props: none") — the engine (ui-conversation) drives this element's
  // content; nothing here is author-configurable. Present (not omitted) for the fleet convention + the
  // descriptor trip-wire's empty bijection (the ui-toast-region/ui-form-provider precedent).
  static props = {} satisfies PropsSchema

  constructor() {
    super()
    this.internals.role = 'log' // a POLITE live region via internals.role (the ui-status-stream precedent)
    this.internals.ariaLive = 'polite' // the explicit belt (ADR-0180 cl.1b) — implicit from role=log already, stated anyway
  }

  /** ADR-0023 public-method seam — moved verbatim off conversation.ts's `#isNearLogBottom` (`this.#log!` →
   *  `this`). `ui-conversation` samples this ONCE per turn, before that turn's own content starts growing
   *  (SPEC-R4 AC2) — never re-sampled reactively mid-turn (a naive reactive-scroll-listener regresses
   *  this — the a2ui-chat.ts banner's own documented failure mode; promoted unchanged). */
  isNearBottom(): boolean {
    return this.scrollHeight - this.scrollTop - this.clientHeight <= LOG_STICK_THRESHOLD_PX
  }

  /** ADR-0023 public-method seam — moved verbatim off conversation.ts's `#tailFollowLog` (`this.#log!` →
   *  `this`). Scrolls to this dialog's newest content IFF `wasNear` held — never re-samples reactively.
   *  Promoted from a2ui-chat.ts's `tailFollowLog` (the biting negative control this guard exists to
   *  survive).
   *
   *  Resolves `'skipped'` when the stick-to-bottom guard said don't follow, `'settled'` once this
   *  element's own scroll extent has held still for TAIL_FOLLOW_STABLE_CHECKS consecutive checks, or
   *  `'exhausted'` when the ~1s ceiling is hit first. GH #365 — all three used to resolve one
   *  indistinguishable `void`, so a caller could not tell a followed-and-settled wait from a timed-out one
   *  from a wait that never scrolled at all. It resolves either way and NEVER rejects: every call site is
   *  fire-and-forget (`void`), and a rejection on a discarded promise is an unhandled rejection in
   *  production, not a signal anyone reads.
   *
   *  Timer-paced ON PURPOSE — do NOT port GH #364's per-`requestAnimationFrame` sampling here. That fix is
   *  for an OBSERVER of a smooth `scrollIntoView`, whose position only reaches `scrollTop` when the browser
   *  paints. This loop is a WRITER: this element declares no `scroll-behavior`, so the assignment below is
   *  an instant scroll and the read-back is its synchronously-clamped result — what it samples is really
   *  `scrollHeight - clientHeight`, layout-derived, current at any sampling instant, unrelated to paint.
   *  Frame pacing would also shrink the stability window from 120ms to ~50ms, making it worse at its
   *  actual job (waiting out content that is still growing), and would stall the loop outright on a hidden
   *  tab, where rAF does not fire but the log should still stay pinned. */
  followTail(wasNear: boolean): Promise<'skipped' | 'settled' | 'exhausted'> {
    if (!wasNear) return Promise.resolve('skipped')
    return new Promise((resolve) => {
      let prevTop = -1
      let stableStreak = 0
      let checks = 0
      const tick = (): void => {
        this.scrollTop = this.scrollHeight
        const top = this.scrollTop
        stableStreak = top === prevTop ? stableStreak + 1 : 0
        prevTop = top
        checks += 1
        if (stableStreak >= TAIL_FOLLOW_STABLE_CHECKS) {
          resolve('settled')
          return
        }
        if (checks >= TAIL_FOLLOW_MAX_CHECKS) {
          resolve('exhausted')
          return
        }
        setTimeout(tick, TAIL_FOLLOW_CHECK_MS)
      }
      tick()
    })
  }
}

if (!customElements.get('ui-conversation-dialog')) customElements.define('ui-conversation-dialog', UIConversationDialogElement)

// disclosure.ts — UIDisclosureElement, the content-family M1-a `ui-disclosure` (content-family.lld.md
// LLD-C8 · SPEC-R14…R18 · ADR-0113 cl.4). BEHAVIOUR + props + the control-owned <details> part + self-
// define ONLY. Anatomy/geometry per the LLD; styling lives in disclosure.css, the public contract in
// disclosure.md.
//
// The no-native-form-elements law does not bind: a <details> participates in no form (the ADR-0017
// <dialog> precedent, applied here per ADR-0113's Context). Native <details>/<summary> supplies the
// toggle behaviour, the summary's button semantics + expanded/collapsed announcement, find-in-page
// auto-expand of folded content, and the `name` exclusive-accordion substrate — all platform-free; a
// bespoke button+region reimplements every one against internals-ARIA limits and loses the searchability
// story (ADR-0113 fork F3). `ui-disclosure` extends UIElement (NOT form-associated).
//
// Anatomy (a component-owned part, created ONCE — idempotent across disconnect/reconnect, the
// modal.ts/select.ts precedent):
//   <ui-disclosure>
//     <details data-part="details">
//       <summary data-part="summary">
//         <span data-part="chevron" aria-hidden="true"><svg>…caret-right (@agent-ui/icons)…</svg></span>
//         <span data-part="summary-text">…the `summary` prop…</span>
//       </summary>
//       <div data-part="body"><!-- the host's light-DOM children, adopted --></div>
//     </details>
//   </ui-disclosure>
//
// The anatomy invariant (SPEC-R16): the host's light-DOM children converge into the body part. Children
// present at connect are adopted in #ensureParts(); parser-streamed children landing on the host AFTER
// connect, and a destructive `host.textContent` write that detaches the details part, are healed by a
// childList MutationObserver — the ADR-0078 cl.4 stamp/heal lineage (ui-select's options-move / ui-text's
// stamp-heal precedent, `text.ts`).
//
// `open` is prop-as-source-of-truth under the ADR-0101 always-announce law (the ui-modal/ui-select `open`
// precedent): a scope-owned effect drives model→platform (`details.open = this.open` — a same-value
// assignment is a native no-op, no `toggle` event, the loop-breaker's first half); the platform's `toggle`
// event (fired on a user click, a model-driven write reaching the platform, OR a find-in-page auto-
// expand) is the SOLE announcer — it settles the prop (if the platform led) and always emits the host
// `toggle`, with `this.open` already settled at listener time (ADR-0101 mechanic 3).
//
// The toggle LISTENER is wired explicitly wherever a `details` part becomes current — once in connected()
// (covers the initial connect AND every reconnect, since parts persist across disconnect/reconnect but a
// fresh AbortController is minted each connect — the modal.ts/select.ts discipline) and once more inside
// the heal observer's rebuild branch (covers a MID-CONNECTION clobber-rebuild, which connected() never
// reruns for). The OLD part's listener dies with it — abort-owned, freed at the next disconnect regardless
// (a bounded, non-functional residual across a rare clobber, never a live double-fire).
//
// No internals role, no host ARIA (SPEC-R17): the details/summary part IS the semantic element (ADR-0017
// cl.5 lineage). No focus machinery: the summary is natively focusable. `render()` stays the inherited
// no-op (the part is imperative DOM, not a template commit). `controls → dom + @agent-ui/icons` — the
// allowed import direction (icons is a zero-dep sibling package, like select.ts's own caret glyph).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { setIcon } from '@agent-ui/icons'

const props = {
  // The fold's two-way state (ADR-0101 + ADR-0019) — prop-as-source-of-truth. Reflected so the [open]
  // attribute mirrors the declared state (inspectable/serializable), the ui-modal/ui-select precedent.
  open: { ...prop.boolean(false), reflect: true },
  // The fold's one-line label — a bindable string prop (NOT a slot, SPEC-R14): keeps the heal invariant
  // "children = body" simple (a rich `slot=summary` child is the named foreseen extension). Reflected so
  // a JS-set value applies identically to an author-set attribute (the fleet reflect precedent).
  summary: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

export interface UIDisclosureElement extends ReactiveProps<typeof props> {}
export class UIDisclosureElement extends UIElement {
  static props = props

  // The control-owned parts — created ONCE (idempotent guard in #ensureParts); persist through
  // disconnect/reconnect. `#`-private: nothing outside the host can observe or hold them.
  #details: HTMLDetailsElement | null = null
  #summary: HTMLElement | null = null
  #chevron: HTMLElement | null = null
  #summaryText: HTMLElement | null = null
  #body: HTMLElement | null = null

  // The childList observer that heals the anatomy invariant (parser streaming / a host.textContent
  // clobber). Disconnected in `disconnected()` — the ui-text `#observer` discipline (a raw platform
  // observer isn't scope-owned, so teardown is by hand).
  #observer: MutationObserver | null = null

  protected connected(): void {
    const { details } = this.#ensureParts()

    // Summary effect — prop-driven, markup-free (SPEC-R16 AC2); never touches `open`. Reads the CURRENT
    // `#summaryText` field (not a closed-over local) so it stays correct even after a heal rebuild
    // replaces the part — though the rebuild itself re-syncs immediately (see #heal), without waiting for
    // this effect to next fire.
    this.effect(() => this.#syncSummary(this.summary))

    // model→platform — `open` drives the platform. A same-value assignment is a native no-op (no `toggle`
    // event fires) — the loop-breaker's first half (SPEC-R15 AC2). Reads `#details` fresh, same reason.
    this.effect(() => this.#syncOpen(this.open))

    // platform→prop→announce — wired for the CURRENT details part; re-wired on every connected() call
    // (the reconnect case: parts persist but the AbortController is fresh) and again from the heal
    // rebuild branch (the mid-connection clobber case, which connected() itself never reruns for).
    this.#wireToggle(details)

    // The heal observer — installed AFTER the initial part creation/effects above (the text.ts
    // discipline: it never observes its own synchronous setup; it only fires for LATER host mutations).
    this.#observer = new MutationObserver(() => this.#heal())
    this.#observer.observe(this, { childList: true })
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  /**
   * Wire the platform `toggle` listener onto `details` (the SOLE announcer, SPEC-R15). Hears a user click
   * on the summary, a find-in-page auto-expand, AND the open-effect's own platform write:
   *   - user/platform-led: `details.open` has ALREADY flipped by the time `toggle` fires, so `now` differs
   *     from the (still-stale) prop — sync `this.open = now` (which reflects the attribute synchronously,
   *     ADR-0101 mechanic 3), then announce. The open effect's own later re-run assigns the SAME value —
   *     a native no-op, no second event.
   *   - model-led: the open effect already set `this.open` (and `details.open`) BEFORE the platform's
   *     `toggle` fires, so `now === this.open` here — no re-write, no second wake — just the one announce.
   *   - a re-assert (`open` written to its current value): the open effect's assignment is a same-value
   *     platform no-op — no `toggle` ever fires, so this listener never runs and nothing announces
   *     (the loop-breaker's other half).
   */
  #wireToggle(details: HTMLDetailsElement): void {
    this.listen(details, 'toggle', () => {
      const now = details.open
      if (now !== this.open) this.open = now
      this.emit('toggle')
    })
  }

  /** Apply `text` to the CURRENT summary-text part, if any (a no-op before the part exists). */
  #syncSummary(text: string): void {
    const summaryText = this.#summaryText
    if (summaryText) summaryText.textContent = text
  }

  /** Apply `open` to the CURRENT details part, if any (a no-op before the part exists). */
  #syncOpen(open: boolean): void {
    const details = this.#details
    if (details) details.open = open
  }

  /**
   * Restore the anatomy invariant after a childList mutation lands directly on the host (SPEC-R16). A
   * DETACHED details part (a `host.textContent` clobber — every child, details part included, replaced)
   * is never reused (it holds stale content, the ADR-0106/text.ts lineage): null every part ref, rebuild
   * fresh via #ensureParts, re-wire the toggle listener onto the NEW part, and re-run the summary/open
   * sync immediately (not waiting for the reactive effects to next fire — they read the CURRENT field but
   * only re-run on a future prop CHANGE). Otherwise every stray host child (parser-streamed content
   * arriving after connect) is adopted into the body part, append order. Both branches mutate the host and
   * so re-fire this very observer, but the next delivery finds the invariant satisfied — a no-op — so this
   * self-converges within ≤2 passes; it can never loop forever (SPEC-R16 AC1/AC3).
   */
  #heal(): void {
    const details = this.#details
    if (!details) return
    if (details.parentNode !== this) {
      this.#details = null
      this.#summary = null
      this.#chevron = null
      this.#summaryText = null
      this.#body = null
      const fresh = this.#ensureParts()
      this.#wireToggle(fresh.details)
      this.#syncSummary(this.summary)
      this.#syncOpen(this.open)
      return
    }
    const body = this.#body
    if (!body) return
    for (const node of Array.from(this.childNodes)) {
      if (node !== details) body.appendChild(node)
    }
  }

  /**
   * Create the control's FIVE light-DOM parts ONCE (idempotent across disconnect/reconnect — parts
   * persist, the modal.ts/select.ts precedent): the `<details data-part="details">` wrapping a
   * `<summary data-part="summary">` (a `[data-part="chevron"]` glyph + `[data-part="summary-text"]` label)
   * and a `<div data-part="body">`. Pre-existing host children are adopted into the body — MOVED, never
   * cloned (ADR-0022) — before the details part is appended as the host's only element child. Does NOT
   * wire the toggle listener (that is connected()'s / #heal's job — see the class doc) so this helper
   * stays a pure "ensure the DOM shape" primitive, callable from either site. `render()` stays the
   * inherited no-op.
   */
  #ensureParts(): { details: HTMLDetailsElement } {
    if (this.#details && this.#summary && this.#chevron && this.#summaryText && this.#body) {
      return { details: this.#details }
    }

    const details = document.createElement('details')
    details.setAttribute('data-part', 'details')

    const summary = document.createElement('summary')
    summary.setAttribute('data-part', 'summary')

    const chevron = document.createElement('span')
    chevron.setAttribute('data-part', 'chevron')
    chevron.setAttribute('aria-hidden', 'true') // decorative — disclosure meaning rides the native summary/details, never the glyph (anatomy.md §5)
    setIcon(chevron, 'caret-right') // Phosphor, via @agent-ui/icons; rotated 90deg under [open] in disclosure.css

    const summaryText = document.createElement('span')
    summaryText.setAttribute('data-part', 'summary-text')

    summary.appendChild(chevron)
    summary.appendChild(summaryText)

    const body = document.createElement('div')
    body.setAttribute('data-part', 'body')

    // Adopt every pre-existing host child into the body — moved, never cloned (ADR-0022).
    while (this.firstChild) body.appendChild(this.firstChild)

    details.appendChild(summary)
    details.appendChild(body)
    this.appendChild(details)

    this.#details = details
    this.#summary = summary
    this.#chevron = chevron
    this.#summaryText = summaryText
    this.#body = body

    return { details }
  }
}

if (!customElements.get('ui-disclosure')) customElements.define('ui-disclosure', UIDisclosureElement)

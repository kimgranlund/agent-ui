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
//       <summary data-part="summary" aria-labelledby="…the summary-text id…">
//         <span data-part="chevron" aria-hidden="true"><svg>…caret-right (@agent-ui/icons)…</svg></span>
//         <span data-part="summary-text" id="ui-disclosure-label-N">…the `summary` prop…</span>
//         <!-- the host's `slot="summary"` children, adopted (ADR-0158 — the realized foreseen extension) -->
//       </summary>
//       <div data-part="body"><!-- the host's OTHER light-DOM children, adopted --></div>
//     </details>
//   </ui-disclosure>
//
// The anatomy invariant (SPEC-R16 + ADR-0158): the host's light-DOM children converge into the body part —
// EXCEPT children marked `slot="summary"` (the fleet's `[slot=…]` position-slot grammar, the button
// leading/trailing lineage), which join the summary row after the label. Children present at connect are
// adopted in #ensureParts(); parser-streamed children landing on the host AFTER connect, and a destructive
// `host.textContent` write that detaches the details part, are healed by a childList MutationObserver — the
// ADR-0078 cl.4 stamp/heal lineage (ui-select's options-move / ui-text's stamp-heal precedent, `text.ts`).
// Across a clobber rebuild the summary row's COMPOSITION re-converges: the slotted children still living in
// the detached old part are rescued (moved, same identity — ADR-0022) into the fresh summary part, exactly
// as the `summary`/`open` props re-sync — a destructive children write replaces the BODY content only
// (ADR-0158 cl.2; GH #226's silent-drop hazard, closed by construction).
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

// The one authored position slot (ADR-0158): a light-DOM child marked `slot="summary"` rides the summary
// row (adopted after the label) instead of the body — the fleet's `[slot=…]` grammar (button ADR-0006/0012),
// NOT the app-shell `data-slot` vocabulary.
const SUMMARY_SLOT = 'summary'
const isSummarySlotted = (node: Node): node is Element =>
  node instanceof Element && node.getAttribute('slot') === SUMMARY_SLOT

// Elements whose click carries a NATIVE activation behavior of their own (the HTML spec's activation-target
// set, tight): when one sits on the path from the click target up to (exclusive) the summary part, IT — not
// the summary — is the click's single activation target (the dispatch resolves the NEAREST activatable
// ancestor), so (a) the summary cannot toggle from that click anyway, and (b) a `preventDefault()` would
// cancel the INNER element's own behavior (a nested fold's toggle, a link's navigation, a button's
// submit/popover) — the review-proven hazard the guard's scope check exists for (ADR-0158 cl.3 as shipped).
const NATIVE_ACTIVATABLE = 'a[href], area[href], button, input, summary'

// The summary-text id sequence (accessible-name scoping, ADR-0158 cl.4) — the tabs.ts `ui-tabs-${seq}`
// precedent. Minted per part CREATION (a clobber rebuild mints fresh, consistently with its fresh part).
let labelSeq = 0

const props = {
  // The fold's two-way state (ADR-0101 + ADR-0019) — prop-as-source-of-truth. Reflected so the [open]
  // attribute mirrors the declared state (inspectable/serializable), the ui-modal/ui-select precedent.
  open: { ...prop.boolean(false), reflect: true },
  // The fold's one-line label — a bindable string prop (NOT slot content, SPEC-R14): the label stays
  // textContent-only and prop-driven; the once-foreseen `slot=summary` extension is now REALIZED (ADR-0158)
  // as a sibling POSITION slot for summary-hosted controls, never a replacement for this label. Reflected so
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
    const { details, summary } = this.#ensureParts()

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

    // The summary-slot activation guard (ADR-0158 cl.3) — same wiring discipline as the toggle listener:
    // once per connect for the CURRENT summary part, once more from the heal rebuild branch.
    this.#wireSummaryGuard(summary)

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
    this.listen(details, 'toggle', (event) => {
      // Scope to THIS part's own platform toggle (ADR-0158 review find): the native <details> `toggle`
      // never bubbles (its target is always this details part), but a NESTED ui-disclosure's host
      // `toggle` (this.emit — bubbles: true) rides the same event name straight through this listener on
      // its way up. Without this cutoff the outer fold re-announces a `toggle` whose `open` never
      // changed — an ADR-0101 "actual transitions only" violation the nested summary-slot probe
      // surfaced (latent for nested-in-BODY compositions too, the ADR-0143 composed-disclosure lineage).
      if (event.target !== details) return
      const now = details.open
      if (now !== this.open) this.open = now
      this.emit('toggle')
    })
  }

  /**
   * Wire the summary-slot ACTIVATION GUARD onto the CURRENT summary part (ADR-0158 cl.3 — the GH #225
   * `placeSummaryControl` guard, moved into the component so every consumer gets it). The DOM activation
   * model this is built on: a click has ONE activation target — the NEAREST activatable ancestor of the
   * event target — and `preventDefault()` cancels THAT target's activation behavior, whichever it is.
   * So the guard is SCOPED (the independent review's empirically-proven fix):
   *
   *   - A LISTENER-DRIVEN slotted control (ui-switch — no native activation behavior of its own): nothing
   *     activatable sits between the click target and the summary, so the SUMMARY is the activation
   *     target — `preventDefault()` cancels exactly the fold toggle, while the control's own click
   *     listener (indicator-element.ts's checked-flip) is untouched, for real pointer clicks AND the
   *     synthetic `host.click()` press-activation fires for Space/Enter on the focused control.
   *   - ACTIVATION-CARRYING slotted content (a nested ui-disclosure's summary, `a[href]`, a native
   *     `<button>`/`<input>`): that inner element IS the click's single activation target — the outer
   *     summary cannot toggle from this click at all, so the guard STANDS DOWN (no `preventDefault`);
   *     cancelling here would kill the INNER behavior instead (the nested fold's own toggle, the link's
   *     navigation — the reviewer proved `inner.open` stayed false under the unscoped guard).
   *
   * The scope check walks target → (exclusive) summary looking for NATIVE_ACTIVATABLE. The summary's own
   * keyboard activation needs no guard: a summary only key-activates while ITSELF focused, and then the
   * target carries no `[slot="summary"]` ancestor inside this summary. Abort-owned via `this.listen`.
   */
  #wireSummaryGuard(summary: HTMLElement): void {
    this.listen(summary, 'click', (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const hit = target.closest(`[slot="${SUMMARY_SLOT}"]`)
      if (hit === null || !summary.contains(hit)) return
      // Stand down when an activatable element owns the click (it, not the summary, is the activation
      // target — see the doc comment). The walk is bounded by the summary part itself.
      for (let el: Element | null = target; el !== null && el !== summary; el = el.parentElement) {
        if (el.matches(NATIVE_ACTIVATABLE)) return
      }
      event.preventDefault()
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
   * only re-run on a future prop CHANGE) — and RESCUE the old part's summary-slotted children into the
   * fresh summary part (ADR-0158 cl.2, the inline comment below). Otherwise every stray host child
   * (parser-streamed content arriving after connect) is adopted by the slot partition: `slot="summary"`
   * children join the summary row, everything else the body part, append order. Both branches mutate the host and
   * so re-fire this very observer, but the next delivery finds the invariant satisfied — a no-op — so this
   * self-converges within ≤2 passes; it can never loop forever (SPEC-R16 AC1/AC3).
   */
  #heal(): void {
    const details = this.#details
    if (!details) return
    if (details.parentNode !== this) {
      // Rescue the summary-slotted children still living in the DETACHED old part (ADR-0158 cl.2): the
      // part itself is never reused (stale content, the ADR-0106/text.ts lineage), but its adopted
      // `slot="summary"` children are AUTHOR nodes, not component furniture — the summary row's
      // composition is declarative state that re-converges across a body-content clobber, exactly like
      // the `summary`/`open` props below. The detached part IS the record (no tracking field): a control
      // the author explicitly removed before the clobber is not in it and stays gone. Re-appended AFTER
      // #ensureParts, so a clobber write's own new `slot="summary"` children land first, rescued ones after.
      const oldSummary = details.querySelector(':scope > [data-part="summary"]')
      const rescued = oldSummary === null ? [] : Array.from(oldSummary.children).filter(isSummarySlotted)
      this.#details = null
      this.#summary = null
      this.#chevron = null
      this.#summaryText = null
      this.#body = null
      const fresh = this.#ensureParts()
      for (const child of rescued) fresh.summary.appendChild(child)
      this.#wireToggle(fresh.details)
      this.#wireSummaryGuard(fresh.summary)
      this.#syncSummary(this.summary)
      this.#syncOpen(this.open)
      return
    }
    const body = this.#body
    const summary = this.#summary
    if (!body || !summary) return
    for (const node of Array.from(this.childNodes)) {
      if (node === details) continue
      if (isSummarySlotted(node)) summary.appendChild(node)
      else body.appendChild(node)
    }
  }

  /**
   * Create the control's FIVE light-DOM parts ONCE (idempotent across disconnect/reconnect — parts
   * persist, the modal.ts/select.ts precedent): the `<details data-part="details">` wrapping a
   * `<summary data-part="summary">` (a `[data-part="chevron"]` glyph + `[data-part="summary-text"]` label)
   * and a `<div data-part="body">`. The summary part carries `aria-labelledby` → the summary-text span's
   * generated id (ADR-0158 cl.4): the fold's accessible name IS the `summary` prop, always — a slotted
   * control's text is never absorbed into it (with no slot content this computes the identical name the
   * old name-from-content path gave: the chevron is aria-hidden, the label was the only other content).
   * Pre-existing host children are adopted by the slot partition — `slot="summary"` children into the
   * summary row (after the label), everything else into the body — MOVED, never cloned (ADR-0022) —
   * before the details part is appended as the host's only element child. Does NOT wire the toggle or
   * guard listeners (that is connected()'s / #heal's job — see the class doc) so this helper stays a
   * pure "ensure the DOM shape" primitive, callable from either site. `render()` stays the inherited no-op.
   */
  #ensureParts(): { details: HTMLDetailsElement; summary: HTMLElement } {
    if (this.#details && this.#summary && this.#chevron && this.#summaryText && this.#body) {
      return { details: this.#details, summary: this.#summary }
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
    // Accessible-name scoping (ADR-0158 cl.4): the summary's name comes from the LABEL span, never
    // name-from-content — a summary-hosted control's own text ("Agent active") can't muddy the fold's name.
    summaryText.id = `ui-disclosure-label-${++labelSeq}`
    summary.setAttribute('aria-labelledby', summaryText.id)

    summary.appendChild(chevron)
    summary.appendChild(summaryText)

    const body = document.createElement('div')
    body.setAttribute('data-part', 'body')

    // Adopt every pre-existing host child — moved, never cloned (ADR-0022): the slot partition (ADR-0158
    // cl.1) sends `slot="summary"` children onto the summary row (after the label), everything else into
    // the body (SPEC-R16's invariant, with its one ruled exception).
    while (this.firstChild) {
      const child = this.firstChild
      if (isSummarySlotted(child)) summary.appendChild(child)
      else body.appendChild(child)
    }

    details.appendChild(summary)
    details.appendChild(body)
    this.appendChild(details)

    this.#details = details
    this.#summary = summary
    this.#chevron = chevron
    this.#summaryText = summaryText
    this.#body = body

    return { details, summary }
  }
}

if (!customElements.get('ui-disclosure')) customElements.define('ui-disclosure', UIDisclosureElement)

// timeline-item.ts — UITimelineItemElement, the timeline family's shared INERT visual atom
// (timeline-family.lld.md §2 · SPEC-R1…R5 · ADR-0122 F1/F2/F3/F6; recursive nesting + the
// collapsed-summary preview — ADR-0143 F1-F3/F7, TKT-0091). BEHAVIOUR + props + the control-built
// marker/content/detail/nested anatomy + self-define ONLY. Anatomy/geometry per the LLD; styling lives
// in timeline-item.css, the public contract in timeline-item.md.
//
// `ensureNestedSlot(factory)` — a narrow, additive exception ratified on ADR-0143 (2026-07-18 amendment,
// TKT-0083's grouping leg, ADR-0146 F5): the ONE public method that composes the SAME nested-slot/shared-
// disclosure/collapsed-summary-preview mechanism LAZILY (on first call) rather than eagerly at connect —
// for ui-status-stream's live-mounted groups, whose parent item is already connected before a group
// exists. Dead code on the durable authored-markup path (an item authored WITH a `[data-role="nested"]`
// child never calls it — `connected()`'s own `#ensureAnatomy` already wired it eagerly).
//
// One rail row = a marker (dot/ring/pulse via CSS, OR a built-in check/x glyph, OR a consumer-slotted
// marker) + the content roles (label · description · timestamp · trailing) + an optional collapsible
// detail/nested pair. Inert: holds no transport, no live-region role, emits ONLY `toggle` (the composed
// detail's own event — never a bespoke one). `internals.role = 'listitem'` is set in the CONSTRUCTOR
// (the toast role precedent — semantics before insertion), extends `UIElement` (NOT form-associated).
// Hosted by BOTH `ui-timeline` (durable) and `ui-status-stream` (live) — authored once, shared everywhere.
//
// Anatomy (#ensureAnatomy(), idempotent — ONCE, persists across reconnect, the toast/disclosure part-
// persistence precedent): a `<span data-part="marker">` (dot/connector painted by timeline-item.css;
// suppressed and replaced by a real glyph child when `icon` is set, a `[data-role="marker"]` consumer
// child is present, or `status` is `done`/`error` — SPEC-R3/R4) + four content cells keyed by
// `data-role` (`label`/`description`/`timestamp`/`trailing`). A pre-existing light-DOM child carrying one
// of those `[data-role]`s is ADOPTED (kept, never cloned — ADR-0022) and marked consumer-owned so
// `#renderContent()` never stamps over it (the adia wrapper-trap regression this build guards against);
// otherwise a fresh cell is created and the reactive effect stamps it from the matching prop. `trailing`
// has no prop source by default — it is consumer-content-only UNLESS the collapsed-summary preview
// auto-fills it (ADR-0143 F3, below), which backs off the instant a consumer adopts it themselves.
//
// A pre-existing `[data-role="detail"]` AND/OR `[data-role="nested"]` child are moved into ONE shared
// composed `ui-disclosure` (§2.3, ADR-0143 F1/F2) — NOT a bespoke caret+hidden reimplementation, and NOT
// two independent disclosures: `detail` (free consumer content) is appended first, `nested` (a genuine
// `<ui-timeline>` child — ADR-0143 F1, reusing `ui-timeline` itself rather than inventing a second
// nesting primitive) second, into the SAME disclosure host, which materializes only when either exists.
// Recursion is authored-markup depth, not runtime-generated: a nested item can carry its OWN
// `[data-role="nested"]` child, arbitrary levels deep, with zero extra code — `ui-timeline`'s own
// `#markLastItem()` is already `:scope > ui-timeline-item`-scoped (verified against source, ADR-0143's
// own finding), so a nested timeline's terminal-connector marking self-scopes per level with NO change
// here; likewise `size` never cascades into a nested `<ui-timeline>` (ADR-0143 F7) — each level reads
// its OWN `[size]` attribute, no forwarding mechanism exists or is added.
// `this.append(marker, ...cells, [disclosure])` re-parents every node (fresh or adopted) into anatomy
// order in one call — `Node.append` on an already-connected child simply repositions it, so adoption and
// creation are handled uniformly by one assembly line.
//
// The marker glyph (#renderMarkerGlyph(), a SEPARATE effect from content — status/icon changes should
// never re-stamp label/description/timestamp, and vice versa): a consumer-adopted `[data-role="marker"]`
// child is NEVER touched. Otherwise: `icon` non-empty wins (F3, "a free marker coexists with status,
// orthogonal") — `resolveIcon(icon)` is injected and tagged `data-role="marker"` so the SAME CSS
// suppression rule fires; else a resolved-outcome `status` (`done`/`error`/`warning`, ADR-0146 F7) injects
// its built-in glyph (`check`/`x`/`warning` — @agent-ui/icons, already fleet-adopted; disclosure's chevron
// / toast's close-x precedent) tagged the same way, each a DISTINCT shape (ADR-0057: warning's triangle is
// never error's `x` recoloured); else (`''`/`pending`/`active`) the marker is cleared and CSS
// `::before`/`::after` paint the dot/ring/pulse — the non-color SHAPE signifier (ADR-0057, SPEC-R4).
//
// The collapsed-summary preview (#renderTrailingPreview(), ADR-0143 F3): when `[data-role="nested"]`
// content exists, a `MutationObserver` on that nested subtree tracks the LAST `<ui-timeline-item>` in
// DOM order — recursing to the deepest leaf when THAT item itself nests further (last child wins, no
// status-priority, matching the ticket's own resolved rule) — and a reactive effect reads the shared
// disclosure's own `open` prop (a DIFFERENT element's reactive signal; reading it inside `this.effect()`
// still tracks it — signals are not scoped to their declaring element) to gate whether the resolved
// label+status is PAINTED into the item's own EXISTING `trailing` cell (closed) or left untouched
// (open, where the real nested content is already visible — no duplicate). `trailing` remains
// `#consumerOwned`-gated exactly as today: a consumer-authored `[data-role="trailing"]` child is NEVER
// overwritten by this effect, at any open/closed state.
//
// `controls → dom + controls/disclosure/disclosure.ts + @agent-ui/icons` — the allowed import direction
// (cross-control, the segmented-control/radio + disclosure/icons precedents). The nested slot's content
// is treated as generic `Element`/DOM (querySelector/MutationObserver/attributes only) — never importing
// `ui-timeline`'s own module or type, so no `timeline-item → timeline → timeline-item` cycle is created
// (timeline.ts already imports timeline-item.ts for registration).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import '../disclosure/disclosure.ts' // the collapse mechanism (F6) — composed, not reinvented
import type { UIDisclosureElement } from '../disclosure/disclosure.ts'
import { resolveIcon } from '@agent-ui/icons'
import type { IconName } from '@agent-ui/icons'

const STATUS = ['', 'pending', 'active', 'done', 'error', 'warning'] as const
const SIZE = ['sm', 'md', 'lg'] as const

// The resolved-outcome states that inject a built-in marker glyph (the in-progress '' / pending / active
// states paint a pure-CSS dot/ring/pulse instead). `warning` (ADR-0146 F7) joins done/error here with its
// OWN distinct triangle-exclamation glyph — shape-coded, never hue-alone (ADR-0057): the shape alone,
// never the colour, distinguishes warning from error's `x`.
const STATUS_GLYPH = { done: 'check', error: 'x', warning: 'warning' } as const satisfies Partial<
  Record<(typeof STATUS)[number], IconName>
>

const props = {
  // reflected (SPEC-R2 AC2: a JS-set status/size round-trips through getAttribute) — the LLD's frozen
  // interface names the constructors; the CSS [status]/[size] repoint (and the AC2 round-trip itself)
  // requires `reflect: true`, the container.ts/disclosure.ts convention for every attribute-selector-driven prop.
  status: { ...prop.enum(STATUS, ''), reflect: true }, // '' = neutral marker (F3)
  label: { ...prop.string(''), reflect: true },
  description: prop.string(''),
  timestamp: prop.string(''), // the consumer's string — NO codec (F6)
  icon: prop.string(''), // a marker glyph name replacing the dot (adia icon-mode)
  size: { ...prop.enum(SIZE, 'md'), reflect: true }, // first-class geometry (F2)
} satisfies PropsSchema

const CONTENT_ROLES = ['label', 'description', 'timestamp', 'trailing'] as const
type ContentRole = (typeof CONTENT_ROLES)[number]
// `trailing` carries no prop — consumer-content-only, so it is never a stamp target. Narrowly typed (NOT
// Set<ContentRole>) so `this[role]` below type-checks — UITimelineItemElement has no `trailing` property.
type StampedRole = 'label' | 'description' | 'timestamp'
const STAMPED_ROLES = new Set<StampedRole>(['label', 'description', 'timestamp'])

export interface UITimelineItemElement extends ReactiveProps<typeof props> {}
export class UITimelineItemElement extends UIElement {
  static props = props

  // The control-built parts — created ONCE (idempotent guard in #ensureAnatomy); persist through
  // disconnect/reconnect (the toast/disclosure precedent). `#`-private: nothing outside can observe them.
  #marker: HTMLElement | null = null
  #cells = new Map<ContentRole, HTMLElement>()
  #consumerOwned = new Set<ContentRole>() // roles adopted from a pre-existing consumer child — never stamped
  #consumerMarker = false // a consumer supplied a [data-role="marker"] child at connect — the item's own glyph logic backs off entirely
  #disclosure: UIDisclosureElement | null = null
  #nested: HTMLElement | null = null // the adopted [data-role="nested"] child (ADR-0143 F1 — a genuine <ui-timeline>, treated as generic DOM)
  #nestedObserver: MutationObserver | null = null // recomputes the collapsed-summary preview on any change to #nested's subtree

  constructor() {
    super()
    this.internals.role = 'listitem' // set in the CONSTRUCTOR (the toast role precedent) — semantics before insertion
  }

  protected connected(): void {
    this.#ensureAnatomy() // idempotent, ONCE (the toast/modal/disclosure part-persistence guard)
    this.effect(() => this.#renderContent()) // re-stamps label/description/timestamp on prop change
    this.effect(() => this.#renderMarkerGlyph()) // re-paints the marker glyph on status/icon change — a SEPARATE effect
    if (this.#nested) {
      this.#nestedObserver = new MutationObserver(() => this.#renderTrailingPreview())
      this.#nestedObserver.observe(this.#nested, { subtree: true, childList: true, attributes: true, attributeFilter: ['status', 'label'], characterData: true })
      // Reads `this.#disclosure!.open` — a DIFFERENT element's reactive prop — so this effect re-runs on
      // every open/close (ADR-0143 F3's paint gate) in addition to every observer-triggered recompute above.
      this.effect(() => this.#renderTrailingPreview())
    }
  }

  protected disconnected(): void {
    this.#nestedObserver?.disconnect()
    this.#nestedObserver = null
  }

  /** Reveal/collapse the detail region (used by ui-status-stream's update({detail})); no-op if no detail. */
  toggleDetail(open?: boolean): void {
    const disclosure = this.#disclosure
    if (!disclosure) return
    disclosure.open = open ?? !disclosure.open
  }

  /**
   * ADR-0143 amendment (2026-07-18, TKT-0083's grouping leg) — lazily ensure a nested-timeline slot
   * exists, for ui-status-stream's GROUPED entries (ADR-0146 F5). Returns the `[data-role="nested"]`
   * host, composing it into the SAME shared `ui-disclosure` `#ensureAnatomy` uses at connect (ADR-0143
   * F1/F2) when the item was authored WITHOUT one — never a second nesting mechanism (the family-
   * coherence law F5 preserves). The collapsed-summary preview + its `MutationObserver` (ADR-0143 F3)
   * are armed here exactly as `connected()` arms them for an authored nested slot, so a live-mounted
   * group's collapse + preview work with ZERO bespoke nesting code. `factory` mints the host
   * (ui-status-stream passes a `<ui-timeline>`) so THIS file stays import-free of `ui-timeline` (the
   * cycle guard, file header). Idempotent: a second call returns the existing slot untouched. Must run
   * while connected (it registers a scope-owned effect) — ui-status-stream only calls it on an item
   * already appended to the live strip, i.e. already connected.
   */
  ensureNestedSlot(factory: () => HTMLElement): HTMLElement {
    if (this.#nested) return this.#nested
    const nested = factory()
    nested.setAttribute('data-role', 'nested')
    if (this.#disclosure) {
      // The item already composed a disclosure (it was authored with `detail`) — append nested after
      // it; disclosure.ts's own childList heal observer relocates it into the body part.
      this.#disclosure.appendChild(nested)
    } else {
      // No disclosure yet — compose one, adopting `nested` BEFORE connect so #ensureParts moves it into
      // the body SYNCHRONOUSLY (the exact composition #ensureAnatomy runs, just deferred to first-group time).
      const disclosure = document.createElement('ui-disclosure') as UIDisclosureElement
      disclosure.setAttribute('data-part', 'detail')
      disclosure.appendChild(nested)
      this.#disclosure = disclosure
      this.append(disclosure)
    }
    this.#nested = nested
    this.#nestedObserver = new MutationObserver(() => this.#renderTrailingPreview())
    this.#nestedObserver.observe(nested, { subtree: true, childList: true, attributes: true, attributeFilter: ['status', 'label'], characterData: true })
    this.effect(() => this.#renderTrailingPreview())
    return nested
  }

  /** Mark/unmark this item TRUNCATED — ui-status-stream's completion invariant (SPEC-R11): a distinct,
   *  non-color-only interrupted affordance via a real custom state (`:state(truncated)` in CSS), never a
   *  silent forever-spinner. `internals.states` is optional-chained (absent in jsdom, the fleet convention —
   *  button.ts/checkbox.ts/text-field.ts). Imperative/CSS-state, not a `static props` field (LLD §7/§8). */
  markTruncated(truncated: boolean): void {
    if (truncated) this.internals.states?.add('truncated')
    else this.internals.states?.delete('truncated')
  }

  /**
   * Build the light-DOM anatomy ONCE (idempotent — the toast/disclosure part-persistence precedent).
   * Pre-existing `[data-role]` children are ADOPTED (kept in place, marked consumer-owned); everything
   * else is created fresh. `this.append(...)` re-parents every node — adopted or fresh — into the final
   * anatomy order in one call (a no-op reposition for an already-connected child, ADR-0022's move
   * semantics via the platform's own `Node.append`).
   */
  #ensureAnatomy(): void {
    if (this.#marker) return

    const marker = document.createElement('span')
    marker.setAttribute('data-part', 'marker')
    const consumerMarker = this.querySelector(':scope > [data-role="marker"]')
    if (consumerMarker) {
      marker.appendChild(consumerMarker) // adopted, moved (ADR-0022)
      this.#consumerMarker = true
    }

    for (const role of CONTENT_ROLES) {
      const existing = this.querySelector(`:scope > [data-role="${role}"]`)
      if (existing instanceof HTMLElement) {
        this.#cells.set(role, existing) // adopted in place — the wrapper-trap guard: never re-stamped
        this.#consumerOwned.add(role)
      } else {
        const cell = document.createElement('span')
        cell.setAttribute('data-role', role)
        this.#cells.set(role, cell)
      }
    }

    // ONE shared disclosure adopts detail THEN nested, in that order (ADR-0143 F1/F2) — materializes
    // only when either exists; an item with neither composes no disclosure at all (unchanged from today).
    const detailContent = this.querySelector(':scope > [data-role="detail"]')
    const nestedContent = this.querySelector(':scope > [data-role="nested"]')
    if (detailContent || nestedContent) {
      const disclosure = document.createElement('ui-disclosure') as UIDisclosureElement
      disclosure.setAttribute('data-part', 'detail')
      if (detailContent) disclosure.appendChild(detailContent) // moved (ADR-0022)
      if (nestedContent instanceof HTMLElement) {
        disclosure.appendChild(nestedContent) // moved (ADR-0022) — the SAME two-hop adoption `detail` already used
        this.#nested = nestedContent
      }
      this.#disclosure = disclosure
      // NO re-emit — the composed ui-disclosure's own `toggle` (bubbles+composed, element.ts's `emit()`)
      // already surfaces on the item host via natural light-DOM bubbling (the SAME event object, not a
      // second one); an explicit re-emit here would double-fire. Allowlisted, no new event name (F6).
    }

    this.append(marker, ...CONTENT_ROLES.map((r) => this.#cells.get(r)!), ...(this.#disclosure ? [this.#disclosure] : []))
    this.#marker = marker
  }

  /**
   * ADR-0143 F3 — resolve the LAST `<ui-timeline-item>` in DOM order under `#nested`, recursing to the
   * deepest leaf when that item itself carries a further `[data-role="nested"]` child (last child wins,
   * no status-priority — the ticket's own resolved rule). Returns `null` when `#nested` has no items yet
   * (a plain no-op source, never an error). Pure DOM traversal — `#nested`'s content is never assumed to
   * be a real `<ui-timeline>` beyond "an element whose direct children may be `ui-timeline-item`s."
   */
  #resolveLastDescendant(root: HTMLElement): HTMLElement | null {
    const items = root.querySelectorAll(':scope > ui-timeline-item')
    const last = items[items.length - 1]
    if (!(last instanceof HTMLElement)) return null
    // NOT :scope-restricted to a DIRECT child: by the time this runs, `last`'s OWN connected() may already
    // have moved its [data-role="nested"] child into its composed <ui-disclosure data-part="detail"> body
    // (connectedCallback fires parent-before-child on a bulk insert, but this resolution runs from a
    // deferred effect, which fires after the whole subtree's synchronous connect pass — so a deeper item can
    // already be relocated). The second branch below still finds it as a direct child of the disclosure's
    // OWN `[data-part="body"]` — narrower than a bare subtree query, so a consumer who (misusing the
    // reserved `nested` role) plants `[data-role="nested"]` somewhere inside free-form `detail` prose is
    // never mistaken for `last`'s real nested slot.
    const deeper = last.querySelector(':scope > [data-role="nested"], :scope > [data-part="detail"] [data-part="body"] > [data-role="nested"]')
    if (deeper instanceof HTMLElement) {
      const recursed = this.#resolveLastDescendant(deeper)
      if (recursed) return recursed
    }
    return last
  }

  /** The SAME text-based, non-color status-shape glyph the fleet already uses elsewhere for a compact
   *  inline status echo (the agent-admin client-message-echo precedent) — a distinct SHAPE per status,
   *  never color alone (ADR-0057), with no new CSS/icon-injection machinery for a one-line preview cell. */
  #previewGlyph(status: string): string {
    if (status === 'done') return '✓ '
    if (status === 'error') return '✕ '
    if (status === 'active') return '● '
    if (status === 'pending') return '○ '
    return ''
  }

  /**
   * ADR-0143 F3 — the collapsed-summary paint gate: while the shared disclosure is CLOSED (or absent —
   * a no-op then, since there is nothing to summarize), paint the resolved last-descendant's status-shape
   * glyph + label into the item's OWN `trailing` cell, unless a consumer has adopted `trailing`
   * themselves (`#consumerOwned`, checked exactly as `#renderContent()` already does — never overwritten).
   * While OPEN, clear the auto-fill (the real nested content is already visible; no duplicate). A no-op
   * entirely when `#nested` is absent.
   */
  #renderTrailingPreview(): void {
    const nested = this.#nested
    if (!nested) return
    const trailing = this.#cells.get('trailing')
    if (!trailing || this.#consumerOwned.has('trailing')) return
    const isOpen = this.#disclosure?.open ?? false
    if (isOpen) {
      trailing.textContent = ''
      return
    }
    const last = this.#resolveLastDescendant(nested)
    trailing.textContent = last ? `${this.#previewGlyph(last.getAttribute('status') ?? '')}${last.getAttribute('label') ?? ''}` : ''
  }

  /** Stamp label/description/timestamp from props onto their cells — SKIPPING any consumer-owned cell
   *  (the wrapper-trap regression: a wrapped consumer child must suppress the default stamp, not duplicate). */
  #renderContent(): void {
    for (const role of STAMPED_ROLES) {
      if (this.#consumerOwned.has(role)) continue
      this.#cells.get(role)!.textContent = this[role]
    }
  }

  /** Paint the marker glyph: a consumer-adopted marker is untouched; `icon` wins over `status`; `done`/
   *  `error` get a built-in glyph; everything else clears to let CSS `::before`/`::after` paint the
   *  dot/ring/pulse (SPEC-R4). Every injected glyph is tagged `data-role="marker"` so ONE CSS suppression
   *  rule (`:has([data-role="marker"])`) fires uniformly for consumer/icon/status-glyph markers alike. */
  #renderMarkerGlyph(): void {
    const marker = this.#marker
    if (!marker || this.#consumerMarker) return
    if (this.icon !== '') {
      const svg = resolveIcon(this.icon as IconName)
      svg.setAttribute('data-role', 'marker')
      marker.replaceChildren(svg)
      return
    }
    const glyph = (STATUS_GLYPH as Record<string, IconName | undefined>)[this.status]
    if (glyph !== undefined) {
      const svg = resolveIcon(glyph)
      svg.setAttribute('data-role', 'marker')
      marker.replaceChildren(svg)
      return
    }
    marker.replaceChildren() // '' / pending / active — pure CSS paints the dot/ring/pulse
  }
}

if (!customElements.get('ui-timeline-item')) customElements.define('ui-timeline-item', UITimelineItemElement)

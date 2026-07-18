// timeline-item.ts — UITimelineItemElement, the timeline family's shared INERT visual atom
// (timeline-family.lld.md §2 · SPEC-R1…R5 · ADR-0122 F1/F2/F3/F6; recursive nesting + the shared
// accordion + the collapsed-summary preview per ADR-0143 F1/F2/F3/F7). BEHAVIOUR + props + the
// control-built marker/content/detail/nested anatomy + self-define ONLY. Anatomy/geometry per the LLD;
// styling lives in timeline-item.css, the public contract in timeline-item.md.
//
// One rail row = a marker (dot/ring/pulse via CSS, OR a built-in check/x glyph, OR a consumer-slotted
// marker) + the content roles (label · description · timestamp · trailing) + an optional collapsible
// detail/nested pair. Inert: holds no transport, no live-region role, emits ONLY `toggle` (the composed
// detail's own event — never a bespoke one). `internals.role = 'listitem'` is set in the CONSTRUCTOR (the
// toast role precedent — semantics before insertion), extends `UIElement` (NOT form-associated). Hosted by
// BOTH `ui-timeline` (durable) and `ui-status-stream` (live) — authored once, shared everywhere.
//
// Anatomy (#ensureAnatomy(), idempotent — ONCE, persists across reconnect, the toast/disclosure part-
// persistence precedent): a `<span data-part="marker">` (dot/connector painted by timeline-item.css;
// suppressed and replaced by a real glyph child when `icon` is set, a `[data-role="marker"]` consumer
// child is present, or `status` is `done`/`error` — SPEC-R3/R4) + four content cells keyed by
// `data-role` (`label`/`description`/`timestamp`/`trailing`). A pre-existing light-DOM child carrying one
// of those `[data-role]`s is ADOPTED (kept, never cloned — ADR-0022) and marked consumer-owned so
// `#renderContent()` never stamps over it (the adia wrapper-trap regression this build guards against);
// otherwise a fresh cell is created and the reactive effect stamps it from the matching prop. `trailing`
// has no prop source — it is consumer-content-only, stamped never, UNLESS this item hosts nested content
// and is collapsed (the collapsed-summary preview below). A pre-existing `[data-role="detail"]` child AND
// a pre-existing `[data-role="nested"]` child (ADR-0143 F1 — a genuine nested `<ui-timeline>`, reusing the
// family's own durable host rather than a bespoke recursive template) are moved into ONE composed
// `ui-disclosure` (§2.3), detail first then nested (ADR-0143 F2 — a single shared accordion, not two) —
// NOT a bespoke caret+hidden reimplementation. `this.append(marker, ...cells, [disclosure])` re-parents
// every node (fresh or adopted) into anatomy order in one call — `Node.append` on an already-connected
// child simply repositions it, so adoption and creation are handled uniformly by one assembly line.
// Recursion is arbitrary-depth for free: a nested `<ui-timeline>`'s own `ui-timeline-item` children run
// this SAME anatomy independently at their own DOM position — no depth cap, no new per-level mechanism
// (ADR-0143's "confirmed no-op" — `ui-timeline`'s own terminal-connector marking is already per-level
// scoped, `:scope > ui-timeline-item`). `size` does NOT cascade into a nested `<ui-timeline>` (ADR-0143
// F7) — an unauthored nested timeline/item simply reads its OWN `[size]` default, since nothing here
// forwards or reads the ANCESTOR's `size`.
//
// The marker glyph (#renderMarkerGlyph(), a SEPARATE effect from content — status/icon changes should
// never re-stamp label/description/timestamp, and vice versa): a consumer-adopted `[data-role="marker"]`
// child is NEVER touched. Otherwise: `icon` non-empty wins (F3, "a free marker coexists with status,
// orthogonal") — `resolveIcon(icon)` is injected and tagged `data-role="marker"` so the SAME CSS
// suppression rule fires; else `status==='done'`/`'error'` inject the built-in `check`/`x` glyph
// (@agent-ui/icons, already fleet-adopted — disclosure's chevron / toast's close-x precedent) tagged the
// same way; else (`''`/`pending`/`active`) the marker is cleared and CSS `::before`/`::after` paint the
// dot/ring/pulse — the non-color SHAPE signifier (ADR-0057, SPEC-R4).
//
// The collapsed-summary preview (ADR-0143 F3 — #recomputePreview()/#paintPreview()): when a `nested`
// child is adopted, the item resolves the DEEPEST LAST descendant in DOM order (recursing through each
// nested `<ui-timeline>`'s own last `ui-timeline-item`'s own `[data-role="nested"]`, if any, until a leaf
// with none is reached — "last child wins", never a status-priority) and paints its label + a non-color
// status-shape glyph into the item's EXISTING `trailing` cell (no new CSS/anatomy — the same
// wrapper-trap-guarded cell `#renderContent()` already owns; the wrapper-trap guard itself, "never
// touch a consumer-owned cell," extends unmodified to this new writer). A `MutationObserver` on the
// nested subtree (`{subtree, childList, attributes: ['status','label'], characterData}` — the
// toast-region/disclosure heal-observer class) keeps the resolved source current at ALL times, whether
// the item is open or closed (cheap: a DOM read, no reflow); the composed disclosure's OWN `open` prop
// (read reactively, cross-element signal read) gates only whether the already-current value is PAINTED
// into `trailing` or cleared — so there is never a stale-then-flicker moment on collapse. The nested
// observer is installed once (only when a `nested` child was adopted) and disconnected in
// `disconnected()` (a raw platform observer, not scope-owned — the disclosure/ui-text discipline).
//
// `controls → dom + controls/disclosure/disclosure.ts + @agent-ui/icons` — the allowed import direction
// (cross-control, the segmented-control/radio + disclosure/icons precedents). The `import type` of
// `UITimelineElement` below is a type-only reference (erased under `verbatimModuleSyntax` — zero runtime
// import), avoiding the `timeline-item → timeline → timeline-item` runtime cycle that a VALUE import would
// create (`timeline.ts` already imports `timeline-item.ts` at module scope).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import '../disclosure/disclosure.ts' // the collapse mechanism (F6) — composed, not reinvented
import type { UIDisclosureElement } from '../disclosure/disclosure.ts'
import type { UITimelineElement } from '../timeline/timeline.ts' // type-only (ADR-0143 F1) — see header note
import { resolveIcon } from '@agent-ui/icons'
import type { IconName } from '@agent-ui/icons'

const STATUS = ['', 'pending', 'active', 'done', 'error'] as const
const SIZE = ['sm', 'md', 'lg'] as const

// The collapsed-summary preview's non-color status-shape mirror (ADR-0057 — shape, never hue alone; a
// plain glyph, no new CSS/anatomy). Keyed by the SAME `STATUS` enum the previewed descendant's own
// `status` prop reads from — '' has no glyph (a bare label preview).
const PREVIEW_GLYPH: Record<(typeof STATUS)[number], string> = {
  '': '',
  pending: '○',
  active: '●',
  done: '✓',
  error: '✕',
}

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
  #nested: UITimelineElement | null = null // a pre-existing [data-role="nested"] child, adopted into the SAME disclosure (ADR-0143 F1/F2)
  #previewSource: UITimelineItemElement | null = null // the resolved deepest-last descendant (ADR-0143 F3), cached between recomputes
  #nestedObserver: MutationObserver | null = null // observes #nested's subtree; installed only when #nested exists, disconnected() teardown

  constructor() {
    super()
    this.internals.role = 'listitem' // set in the CONSTRUCTOR (the toast role precedent) — semantics before insertion
  }

  protected connected(): void {
    this.#ensureAnatomy() // idempotent, ONCE (the toast/modal/disclosure part-persistence guard)
    this.effect(() => this.#renderContent()) // re-stamps label/description/timestamp on prop change
    this.effect(() => this.#renderMarkerGlyph()) // re-paints the marker glyph on status/icon change — a SEPARATE effect

    if (this.#nested) {
      this.#recomputePreview() // seed the preview source from the authored markup already in the DOM
      this.effect(() => this.#paintPreview()) // repaints on the composed disclosure's open/close (ADR-0143 F3) — a cross-element signal read
      this.#nestedObserver = new MutationObserver(() => this.#recomputePreview())
      this.#nestedObserver.observe(this.#nested, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['status', 'label'],
        characterData: true,
      })
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

    const detailContent = this.querySelector(':scope > [data-role="detail"]')
    // ADR-0143 F1 — a genuine nested <ui-timeline>, unenforced at runtime (trusting authored markup, the
    // same posture as `detail`); typed via the type-only import above, never a value import (no cycle).
    const nestedContent = this.querySelector(':scope > [data-role="nested"]') as UITimelineElement | null
    if (detailContent || nestedContent) {
      // ONE shared disclosure adopts detail THEN nested, in that order (ADR-0143 F2 — a single whole-step
      // accordion, not two independent ones); it materializes only when either exists, unchanged from
      // today's detail-only behavior when nested is absent.
      const disclosure = document.createElement('ui-disclosure') as UIDisclosureElement
      disclosure.setAttribute('data-part', 'detail')
      if (detailContent) disclosure.appendChild(detailContent) // moved (ADR-0022)
      if (nestedContent) disclosure.appendChild(nestedContent) // moved (ADR-0022)
      this.#disclosure = disclosure
      this.#nested = nestedContent
      // NO re-emit — the composed ui-disclosure's own `toggle` (bubbles+composed, element.ts's `emit()`)
      // already surfaces on the item host via natural light-DOM bubbling (the SAME event object, not a
      // second one); an explicit re-emit here would double-fire. Allowlisted, no new event name (F6).
    }

    this.append(marker, ...CONTENT_ROLES.map((r) => this.#cells.get(r)!), ...(this.#disclosure ? [this.#disclosure] : []))
    this.#marker = marker
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
    if (this.status === 'done' || this.status === 'error') {
      const svg = resolveIcon(this.status === 'done' ? 'check' : 'x')
      svg.setAttribute('data-role', 'marker')
      marker.replaceChildren(svg)
      return
    }
    marker.replaceChildren() // '' / pending / active — pure CSS paints the dot/ring/pulse
  }

  /** Recurse to the DEEPEST LAST `ui-timeline-item` in DOM order — the last direct child of the last
   *  nested `<ui-timeline>`, drilling through ITS OWN `[data-role="nested"]` slot if present, until a leaf
   *  item with no further nested child is reached (ADR-0143 F3 — "last child wins", never a status-
   *  priority). A no-op (returns null) when there is no `nested` slot at all, or when a nested timeline is
   *  authored with zero items.
   *
   *  By the time this walk runs, EVERY descendant item's own `#ensureAnatomy()` has already completed
   *  (custom-element upgrade/connect fires depth-first as this item's own `this.append(...)` synchronously
   *  drains the whole nested subtree's connect reactions — verified against real jsdom/browser behavior,
   *  not assumed) — so a deeper item's OWN `[data-role="nested"]` child is NO LONGER a direct child of
   *  that item; it has already been adopted into THAT item's own composed `[data-part="detail"]`
   *  disclosure (possibly inside disclosure's own `body` part, ADR-0022's plain-`appendChild` adoption).
   *  The walk therefore looks for `nested` scoped to the ITEM's own disclosure part, not a raw direct
   *  child of the item. */
  #resolvePreviewSource(): UITimelineItemElement | null {
    let host: UITimelineElement | null = this.#nested
    let leaf: UITimelineItemElement | null = null
    while (host) {
      const items = host.querySelectorAll(':scope > ui-timeline-item')
      const last = items.item(items.length - 1) as UITimelineItemElement | null
      if (!last) break
      leaf = last
      const detailPart = last.querySelector(':scope > [data-part="detail"]')
      host = (detailPart?.querySelector('[data-role="nested"]') ?? null) as UITimelineElement | null
    }
    return leaf
  }

  /** Re-resolve the preview source (a cheap DOM read, no reflow) and immediately re-apply the paint gate —
   *  wired to the nested subtree's MutationObserver (childList/status/label/characterData) so a late-
   *  appended, relabeled, or re-statused descendant stays current whether the item is open or closed
   *  (ADR-0143 F3). */
  #recomputePreview(): void {
    this.#previewSource = this.#resolvePreviewSource()
    this.#paintPreview()
  }

  /** Paint the resolved preview source's label + a non-color status-shape glyph into the EXISTING
   *  `trailing` cell — ONLY while the composed disclosure is CLOSED (the real nested content is directly
   *  visible instead while open — no duplicate) and ONLY when `trailing` is not consumer-owned (the SAME
   *  wrapper-trap guard `#renderContent()` already honors, extended unmodified to this writer). Reads
   *  `this.#disclosure.open` — a cross-element reactive signal read — so the caller effect re-runs on
   *  every toggle, user- or model-driven. */
  #paintPreview(): void {
    if (this.#consumerOwned.has('trailing')) return
    const trailing = this.#cells.get('trailing')
    const disclosure = this.#disclosure
    if (!trailing || !disclosure) return
    const open = disclosure.open // read UNCONDITIONALLY — establishes the reactive dependency regardless of source state (never short-circuited away)
    const source = this.#previewSource
    if (!source || open) {
      trailing.textContent = ''
      return
    }
    const glyph = PREVIEW_GLYPH[source.status]
    trailing.textContent = glyph ? `${glyph} ${source.label}` : source.label
  }
}

if (!customElements.get('ui-timeline-item')) customElements.define('ui-timeline-item', UITimelineItemElement)

// timeline-item.ts — UITimelineItemElement, the timeline family's shared INERT visual atom
// (timeline-family.lld.md §2 · SPEC-R1…R5 · ADR-0122 F1/F2/F3/F6). BEHAVIOUR + props + the control-built
// marker/content/detail anatomy + self-define ONLY. Anatomy/geometry per the LLD; styling lives in
// timeline-item.css, the public contract in timeline-item.md.
//
// One rail row = a marker (dot/ring/pulse via CSS, OR a built-in check/x glyph, OR a consumer-slotted
// marker) + the content roles (label · description · timestamp · trailing) + an optional collapsible
// detail. Inert: holds no transport, no live-region role, emits ONLY `toggle` (the composed detail's own
// event — never a bespoke one). `internals.role = 'listitem'` is set in the CONSTRUCTOR (the toast role
// precedent — semantics before insertion), extends `UIElement` (NOT form-associated). Hosted by BOTH
// `ui-timeline` (durable) and `ui-status-stream` (live) — authored once, shared everywhere.
//
// Anatomy (#ensureAnatomy(), idempotent — ONCE, persists across reconnect, the toast/disclosure part-
// persistence precedent): a `<span data-part="marker">` (dot/connector painted by timeline-item.css;
// suppressed and replaced by a real glyph child when `icon` is set, a `[data-role="marker"]` consumer
// child is present, or `status` is `done`/`error` — SPEC-R3/R4) + four content cells keyed by
// `data-role` (`label`/`description`/`timestamp`/`trailing`). A pre-existing light-DOM child carrying one
// of those `[data-role]`s is ADOPTED (kept, never cloned — ADR-0022) and marked consumer-owned so
// `#renderContent()` never stamps over it (the adia wrapper-trap regression this build guards against);
// otherwise a fresh cell is created and the reactive effect stamps it from the matching prop. `trailing`
// has no prop source — it is consumer-content-only, stamped never. A pre-existing `[data-role="detail"]`
// child is moved into a composed `ui-disclosure` (§2.3) — NOT a bespoke caret+hidden reimplementation.
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
// `controls → dom + controls/disclosure/disclosure.ts + @agent-ui/icons` — the allowed import direction
// (cross-control, the segmented-control/radio + disclosure/icons precedents).

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

  constructor() {
    super()
    this.internals.role = 'listitem' // set in the CONSTRUCTOR (the toast role precedent) — semantics before insertion
  }

  protected connected(): void {
    this.#ensureAnatomy() // idempotent, ONCE (the toast/modal/disclosure part-persistence guard)
    this.effect(() => this.#renderContent()) // re-stamps label/description/timestamp on prop change
    this.effect(() => this.#renderMarkerGlyph()) // re-paints the marker glyph on status/icon change — a SEPARATE effect
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
    if (detailContent) {
      const disclosure = document.createElement('ui-disclosure') as UIDisclosureElement
      disclosure.setAttribute('data-part', 'detail')
      disclosure.appendChild(detailContent) // moved (ADR-0022)
      this.#disclosure = disclosure
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

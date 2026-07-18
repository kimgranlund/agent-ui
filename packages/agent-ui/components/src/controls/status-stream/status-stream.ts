// status-stream.ts — UIStatusStreamElement, the timeline family's LIVE host (timeline-family.lld.md §4 ·
// SPEC-R8…R12 · ADR-0122 F1/F2/F4/F6 · ADR-0146 F6/F7/F8). BEHAVIOUR + the imperative appendEntry/update/
// finalize/fail API + the tail-follow guard + the completion invariant + the opt-in streaming header +
// self-define ONLY. Anatomy/geometry per the LLD; styling lives in status-stream.css, the public contract
// in status-stream.md.
//
// NAMED LLD DEVIATION (build-time, mechanical, flagged for the design seat's amendment): the LLD/SPEC-R9
// name this method `append(entry): UITimelineItemElement`. That name is UNBUILDABLE as specified — every
// element (via Node.prototype) already has a native, INCOMPATIBLE `append(...nodes: (string|Node)[])`, and
// `UIStatusStreamElement extends UIContainerElement extends UIElement extends HTMLElement`, so a same-name
// override with an incompatible signature fails `tsc` outright (TS2416/TS2430 — verified, not a maybe).
// Renamed to `appendEntry` — IDENTICAL signature/behaviour/return, name only; zero other contract change.
// LLD-C-timeline-family.lld.md §4/§7 and SPEC-R9 need the same rename before ratification.
//
// The live "what the system is doing now" strip: entries arrive imperatively (`appendEntry`), transition
// state in place (`update`, keyed by string identity), and the stream's own scroll region tail-follows the
// newest arrival unless the user has scrolled up to read history (the stick-to-bottom guard). Hosts the
// SAME `ui-timeline-item` children `ui-timeline` does — created by THIS host's own API, never authored by
// the consumer. `internals.role = 'log'` (a POLITE live region — ARIA's role=log carries an implicit
// aria-relevant="additions" default, which is exactly the discipline this control needs: a genuinely NEW
// entry (`appendEntry`, a real DOM addition) announces, while a `text` patch that MUTATES an existing
// node's textContent does NOT re-trigger the addition-relevant announcement — state transitions announce,
// token spam does not, for free, by choosing role=log's own default semantics rather than a bespoke
// aria-live wiring). `internals.role` is set in the CONSTRUCTOR (the toast role precedent) — before insertion.
//
// The opt-in streaming header (ADR-0146 F8): a reflected boolean `header` prop, default false — every
// shipped consumer renders byte-identically (NO header DOM at all). When set, a `[data-part="header"]` row
// renders the `label` VISIBLY (today it is aria-only) plus a live overall-status glyph. The header is
// PINNED (position: sticky, status-stream.css) so it never scrolls away as entries overflow — the "chrome
// outside the scroll region" F8 rejects a faked first-entry for (a faked entry would scroll away). The
// overall status follows ONE rule (F8): while un-finalized, the F6 escalation over the strip's TOP-LEVEL
// entries whenever that escalation OUTRANKS `active` (a mid-turn error/warning child flips the header
// immediately), and `active` otherwise — so an EMPTY un-finalized stream reads WORKING from construction
// (the blank-bubble ROOT fix: a header shows "working" the instant a consumer sets header, before any entry
// or wire signal). `finalize()` settles it to the escalated final status (still-active/pending entries, now
// truncated by the completion invariant, contribute `warning` — matching the warning-coloured truncated
// ring); `fail()` settles it `error`. Because THIS host owns every mutation of its top-level entries
// (appendEntry/update/finalize/fail), the header is recomputed imperatively at each — no MutationObserver
// is needed for the stream level.
//
// GROUPED entries (ADR-0146 F5, via the ADR-0143 2026-07-18 amendment): a `StatusEntry.parent?: string` (an
// existing entry's key) nests the child UNDER that group instead of as a top-level sibling — the host lazily
// mounts a nested `<ui-timeline>` into the parent item's `[data-role="nested"]` slot through
// `ui-timeline-item.ensureNestedSlot()`, REUSING ADR-0143's shared `ui-disclosure` + collapsed-summary
// preview (never a second nesting primitive — the family-coherence law). The keyed registry stays FLAT:
// keys are unique across the whole strip, so `update(childKey, patch)` reaches a nested entry identically,
// and `finalize()`/`fail()` truncation already walk every entry (`#byKey.values()`), nested included. The
// nested `<ui-timeline>` is `role=list` (durable) inside the outer `role=log` — ONE live region, one
// addition-announcement path, no bespoke aria-live on the nested host (the F6/aria discipline).
//
// GROUP-LEVEL escalation (ADR-0146 F6): a group parent's status = the WORST of its children over the SAME
// closed ladder `error > warning > active > pending > done` (the exported `escalateStatus` reduce). It is
// recomputed the SAME mediated way the stream-level header is — imperatively, from THIS host's own
// `appendEntry`/`update` calls (every grouped entry's status change flows through `update`), bubbling up any
// enclosing groups — NOT via a MutationObserver. The nested-slot observer `ensureNestedSlot` installs serves
// ONLY the collapsed-summary preview (ADR-0143 F3), never escalation; adding a second, observer-driven
// escalation path would be redundant and would leave durable-timeline nesting byte-changed for no reason.
//
// The completion invariant (#markTruncated/finalize, SPEC-R11, the B7 tracked-completion doctrine applied
// to display): `finalize()` marks every still-`pending`/`active` entry TRUNCATED via the item's own
// `markTruncated()` escape hatch (a `:state(truncated)` custom state, timeline-item.ts) — fail-closed, a
// torn stream never shows "still working."
//
// `controls → dom + controls/timeline-item/timeline-item.ts + @agent-ui/icons` — the allowed import
// direction (cross-folder sibling + the zero-dep icons pack, the timeline-item precedent). Holds NO
// transport of its own (a standing negative-control grep — SPEC-R9 AC3): no fetch/ReadableStream/
// readNdjsonLines reference anywhere in this file.

import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UITimelineItemElement } from '../timeline-item/timeline-item.ts' // constructs items via its own API (F4)
import '../timeline/timeline.ts' // registers <ui-timeline> — the nested group host (ADR-0146 F5, ADR-0143's mechanism)
import { resolveIcon } from '@agent-ui/icons' // the header's overall-status glyph (done/error/warning) — the timeline-item glyph precedent
import type { IconName } from '@agent-ui/icons'

/** The closed lifecycle-status vocabulary (ADR-0122 F3 + ADR-0146 F7's `warning`). Mirrors
 *  ui-timeline-item's own `status` enum exactly — the entry projects 1:1 onto the item's typed prop. */
export type ItemStatus = '' | 'pending' | 'active' | 'done' | 'error' | 'warning'

/** The structured entry a consumer pushes as its stream yields (F4). NOT parsed — a plain record. */
export interface StatusEntry {
  key: string
  status?: ItemStatus
  label?: string
  description?: string
  timestamp?: string
  icon?: string
  /** Streamed chain-of-thought text — appended/replaced in place, NEVER tokenized/parsed. */
  text?: string
  /** ADR-0146 F5 — an existing entry's key: when set (and known), this entry NESTS under that group (a
   *  nested `<ui-timeline>` in the parent item's `[data-role="nested"]` slot) instead of as a top-level
   *  sibling. A routing fact consumed by `appendEntry`, NEVER a timeline-item prop; an unknown parent key
   *  degrades to a flat top-level append (never a throw). Set once at append time — `update` does not re-parent. */
  parent?: string
}

// The total severity order (ADR-0146 F6): error > warning > active > pending > done; neutral '' contributes
// nothing (rank 0 — a group/strip of only-neutral entries escalates to '' itself). One closed ladder, the
// SAME order the group-header and the stream-header both reduce over.
const STATUS_RANK: Record<ItemStatus, number> = { '': 0, done: 1, pending: 2, active: 3, warning: 4, error: 5 }

/** The resolved-outcome header glyphs (mirrors timeline-item's STATUS_GLYPH) — the in-progress '' /
 *  pending / active states paint a pure-CSS dot/ring/pulse in status-stream.css instead. */
const HEADER_STATUS_GLYPH = { done: 'check', error: 'x', warning: 'warning' } as const satisfies Partial<
  Record<ItemStatus, IconName>
>

/**
 * Worst-child-wins over the closed ADR-0146 F6 ladder — the single reduce both the (future) group header
 * and the stream header use. Monotone-truthful: the result never reads calmer than the worst contributor
 * (a group with one `error` child and one still-`active` child reads `error`, the truth that something
 * already failed outranking "still working"). Neutral '' entries contribute nothing. Pure + exported so
 * it is directly unit-tested (the ladder's `error`-beats-`active` and `done`+`warning`→`warning` cases).
 */
export function escalateStatus(statuses: readonly ItemStatus[]): ItemStatus {
  let worst: ItemStatus = ''
  for (const s of statuses) if (STATUS_RANK[s] > STATUS_RANK[worst]) worst = s
  return worst
}

const SIZE = ['sm', 'md', 'lg'] as const
const props = {
  size: { ...prop.enum(SIZE, 'md'), reflect: true },
  label: { ...prop.string(''), reflect: true },
  // ADR-0146 F8 — the opt-in visible streaming header. Reflected, default false: every shipped consumer
  // renders byte-identically (no header DOM) until it opts in. When true, the header shows the label + the
  // live escalated overall status, pinned outside the scroll region.
  header: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

// The stick-to-bottom threshold (px) — "at/near the bottom" tolerates sub-pixel/rounding scroll noise
// without falsely dropping the follow guard.
const STICK_THRESHOLD_PX = 24

export interface UIStatusStreamElement extends ReactiveProps<typeof props> {}
export class UIStatusStreamElement extends UIContainerElement {
  static props = props

  #byKey = new Map<string, UITimelineItemElement>()
  #stuckToBottom = true // the tail-follow guard (§4.3)

  // ── grouping (ADR-0146 F5) — the FLAT registry: keys stay unique across the whole strip ─────────────────
  #parentOf = new Map<string, string>() // childKey → parentKey
  #childrenOf = new Map<string, string[]>() // parentKey → ordered childKeys
  #nestedByParent = new Map<string, HTMLElement>() // parentKey → its once-per-parent nested <ui-timeline> host

  // ── the opt-in streaming header (ADR-0146 F8) ────────────────────────────────────────────────────────
  #header: HTMLElement | null = null
  #headerMarker: HTMLElement | null = null
  #headerLabel: HTMLElement | null = null
  // The turn's completion state — drives the header's F8 rule (working-floor while un-finalized; the
  // settled escalation once finalized; forced `error` once failed).
  #finalized = false
  #failed = false
  // Entries the completion invariant truncated — they contribute `warning` to the settled header (the
  // warning-coloured truncated ring's header-level face). A WeakSet: no key bookkeeping, GC-friendly.
  #truncated = new WeakSet<UITimelineItemElement>()

  constructor() {
    super()
    this.internals.role = 'log' // a POLITE live region via internals.role (the toast role='status' precedent)
  }

  protected connected(): void {
    this.effect(() => {
      this.internals.ariaLabel = this.label === '' ? null : this.label
      this.#syncHeaderLabel() // the header shows the SAME label VISIBLY when opted in (F8)
    })
    // Create/remove the header as `header` toggles — default false renders byte-identically to a headerless
    // strip (no header DOM at all, the F8 zero-regression guarantee).
    this.effect(() => {
      if (this.header) this.#ensureHeader()
      else this.#removeHeader()
    })
    this.listen(this, 'scroll', () => this.#trackStickToBottom())
  }

  /** Append a new entry, tail-follow to it, return the created item (the toast-region.show() return
   *  precedent). Named `appendEntry`, NOT `append` — the native Node.prototype.append() every element
   *  inherits is incompatible; see the file-header NAMED LLD DEVIATION note. ADR-0146 F5: an entry carrying
   *  a KNOWN `parent` nests under that group's `[data-role="nested"]` slot instead of as a flat sibling. */
  appendEntry(entry: StatusEntry): UITimelineItemElement {
    const item = document.createElement('ui-timeline-item') as UITimelineItemElement
    item.dataset.key = entry.key
    this.#assign(item, entry)

    // Resolve the parent BEFORE registering `entry.key` in `#byKey` — a self-referencing `parent`
    // (entry.key === entry.parent) must resolve to "unknown parent", never to this not-yet-connected
    // item itself (which would route it into #ensureNested and throw: no connection scope).
    const parentKey = entry.parent
    const parentItem = parentKey !== undefined ? this.#byKey.get(parentKey) : undefined
    this.#byKey.set(entry.key, item)

    if (parentKey !== undefined && parentItem !== undefined) {
      // GROUPED (F5) — mount the child into the parent's nested <ui-timeline> (created lazily, once per parent
      // via ADR-0143's shared disclosure/preview composition). The registry stays FLAT (keyed by `key`).
      this.#ensureNested(parentKey, parentItem).appendChild(item)
      this.#parentOf.set(entry.key, parentKey)
      const kids = this.#childrenOf.get(parentKey) ?? []
      kids.push(entry.key)
      this.#childrenOf.set(parentKey, kids)
      this.#recomputeGroups(entry.key) // F6 — escalate the new child's group chain (mediated, no observer)
    } else {
      // TOP-LEVEL (or an unknown parent — a graceful flat fallback, never a throw): append into the strip,
      // after the pinned header when present (appendChild lands at the end, past the first-child header).
      this.appendChild(item)
    }

    this.#refreshHeader() // the escalation may have changed (a mid-turn error/warning flips the header)
    this.#tailFollow(item)
    return item
  }

  /** Keyed, in-place mutation — transition status / grow text / reveal detail. No-op if the key is unknown.
   *  Reaches a NESTED entry identically (the flat registry), and a status transition re-escalates its
   *  enclosing group chain + the header (ADR-0146 F6, mediated — every child status change flows through here). */
  update(key: string, patch: Partial<StatusEntry>): void {
    const item = this.#byKey.get(key)
    if (item === undefined) return // a late update after truncation is tolerated (never a throw) — SPEC-R9 AC2
    this.#assign(item, patch)
    if (patch.status !== undefined) {
      this.#recomputeGroups(key) // F6 — a child's status change re-escalates its group chain (mediated, no observer)
      this.#refreshHeader() // a status transition may re-escalate the header
    }
    if (this.#growsTail(patch)) this.#tailFollow(item)
  }

  /** The completion invariant — mark every still-pending/active entry TRUNCATED (SPEC-R11), then settle the
   *  header to the escalated FINAL status (ADR-0146 F8). */
  finalize(): void {
    this.#settle(false)
  }

  /** A failed stream (ADR-0146 F8): the completion invariant PLUS a header forced to `error` — the
   *  completion invariant now has a header-level face. Marks still-pending/active entries truncated exactly
   *  as `finalize()` does (a failed turn is also torn), then paints the header `error` regardless of the
   *  entries' own escalation. */
  fail(): void {
    this.#settle(true)
  }

  /** Shared settle path for finalize()/fail(): truncate the unresolved entries, flip the completion state,
   *  repaint the header to its settled (or forced-error) face. */
  #settle(failed: boolean): void {
    for (const item of this.#byKey.values()) {
      if (item.status === 'active' || item.status === 'pending') {
        this.#markTruncated(item)
        this.#truncated.add(item)
      }
    }
    this.#finalized = true
    this.#failed = failed
    this.#refreshHeader()
  }

  /** The entry → item projection — sets only the provided fields onto the item's typed props; `text`
   *  grows/replaces the item's streamed-text cell in place (a `[data-role="text"]` content-column cell,
   *  never re-parsed — the item's own residual imperative fact, timeline-item.md). `parent` is deliberately
   *  NOT projected — it is a routing fact consumed by `appendEntry`, never a timeline-item prop. */
  #assign(item: UITimelineItemElement, patch: Partial<StatusEntry>): void {
    if (patch.status !== undefined) item.status = patch.status
    if (patch.label !== undefined) item.label = patch.label
    if (patch.description !== undefined) item.description = patch.description
    if (patch.timestamp !== undefined) item.timestamp = patch.timestamp
    if (patch.icon !== undefined) item.icon = patch.icon
    if (patch.text !== undefined) this.#growText(item, patch.text)
  }

  /** ADR-0146 F5 — the once-per-parent nested `<ui-timeline>` host, composed into the parent item's shared
   *  `ui-disclosure` via `ensureNestedSlot` (ADR-0143's mechanism, reused — never a second nesting primitive).
   *  Cached per parent key so every grouped child mounts into the SAME nested timeline. */
  #ensureNested(parentKey: string, parentItem: UITimelineItemElement): HTMLElement {
    const existing = this.#nestedByParent.get(parentKey)
    if (existing !== undefined) return existing
    const nested = parentItem.ensureNestedSlot(() => document.createElement('ui-timeline'))
    this.#nestedByParent.set(parentKey, nested)
    return nested
  }

  /** ADR-0146 F6 — worst-child-wins escalation, driven the SAME mediated way the stream header is: walk the
   *  changed key's ANCESTOR group chain and set each group parent's status to `escalateStatus` over its own
   *  children (bubbling if the group is itself nested). NO MutationObserver — every grouped entry's status
   *  change flows through `appendEntry`/`update`, so a mediated recompute is complete, and the nested-slot
   *  observer `ensureNestedSlot` installs is left to serve ONLY the collapsed-summary preview (ADR-0143 F3).
   *  A top-level key (no parent) walks zero steps — the header repaint stays the caller's own #refreshHeader. */
  #recomputeGroups(key: string): void {
    let cursor = this.#parentOf.get(key)
    while (cursor !== undefined) {
      const parent = this.#byKey.get(cursor)
      const kids = this.#childrenOf.get(cursor)
      if (parent !== undefined && kids !== undefined) {
        parent.status = escalateStatus(kids.map((k) => this.#byKey.get(k)?.status ?? ''))
      }
      cursor = this.#parentOf.get(cursor) // keep bubbling if the group is itself nested
    }
  }

  /** Find-or-create the item's `[data-role="text"]` cell and set its text (plain assignment — the
   *  consumer sends the cumulative text each call; the host never concatenates/tokenizes it). */
  #growText(item: UITimelineItemElement, text: string): void {
    let cell = item.querySelector(':scope > [data-role="text"]') as HTMLElement | null
    if (!cell) {
      cell = document.createElement('span')
      cell.setAttribute('data-role', 'text')
      item.appendChild(cell)
    }
    cell.textContent = text
  }

  /** Whether a patch grew visible tail content — gates a re-scroll so a metadata-only update (icon alone)
   *  does not needlessly re-trigger tail-follow. */
  #growsTail(patch: Partial<StatusEntry>): boolean {
    return patch.text !== undefined || patch.description !== undefined || patch.label !== undefined
  }

  /** Mark an item TRUNCATED via its own escape hatch (SPEC-R11) — a distinct, non-color-only interrupted
   *  affordance, fail-closed: an unresolved-at-end entry is truncated, never left silently "still working." */
  #markTruncated(item: UITimelineItemElement): void {
    item.markTruncated(true)
  }

  // ── the streaming header (ADR-0146 F8) + escalation (F6) ─────────────────────────────────────────────

  /** Build the header anatomy ONCE (idempotent — the part-persistence precedent) and prepend it so it is
   *  the strip's FIRST child (appendEntry always appends AFTER, so entries never displace it). Sticky
   *  positioning (status-stream.css) pins it outside the visual scroll region. */
  #ensureHeader(): void {
    if (this.#header) return
    const header = document.createElement('div')
    header.dataset.part = 'header'
    const marker = document.createElement('span')
    marker.dataset.part = 'header-marker'
    const label = document.createElement('span')
    label.dataset.part = 'header-label'
    header.append(marker, label)
    this.#header = header
    this.#headerMarker = marker
    this.#headerLabel = label
    this.insertBefore(header, this.firstChild) // FIRST child — before any already-appended entry
    this.#syncHeaderLabel()
    this.#refreshHeader()
  }

  /** Remove the header entirely (the `header=false` path) — no header DOM lingers, the byte-identical
   *  headerless rendering the F8 default guarantees. */
  #removeHeader(): void {
    this.#header?.remove()
    this.#header = null
    this.#headerMarker = null
    this.#headerLabel = null
  }

  /** Paint the CURRENT label into the header (a no-op before the header exists / when not opted in). */
  #syncHeaderLabel(): void {
    if (this.#headerLabel) this.#headerLabel.textContent = this.label
  }

  /** Recompute + paint the header's overall status (a no-op before the header exists). Called at every
   *  mutation the host owns (appendEntry/update-status/finalize/fail) — no observer needed at the stream
   *  level since the host is the sole mutator of its top-level entries. */
  #refreshHeader(): void {
    const header = this.#header
    const marker = this.#headerMarker
    if (!header || !marker) return
    const status = this.#overallStatus()
    header.dataset.status = status
    const glyph = (HEADER_STATUS_GLYPH as Record<string, IconName | undefined>)[status]
    if (glyph !== undefined) {
      const svg = resolveIcon(glyph)
      svg.setAttribute('data-role', 'marker')
      marker.replaceChildren(svg)
    } else {
      marker.replaceChildren() // '' / pending / active — pure CSS paints the dot/ring/pulse
    }
  }

  /** The header's overall status under the F8 rule: forced `error` on fail(); the settled escalation once
   *  finalized; otherwise the working-floored escalation (the F6 reduce when it OUTRANKS `active`, else
   *  `active` — so an empty un-finalized strip reads WORKING from construction). */
  #overallStatus(): ItemStatus {
    if (this.#failed) return 'error'
    const escalated = escalateStatus(this.#topLevelStatuses())
    if (this.#finalized) return escalated // settled — no working floor
    return STATUS_RANK[escalated] > STATUS_RANK['active'] ? escalated : 'active'
  }

  /** The escalation domain (F6/F8): the strip's TOP-LEVEL entries only — direct `ui-timeline-item`
   *  children of the host, so a future nested (grouped) entry never double-counts at the stream level. A
   *  truncated entry contributes `warning` (its settled, torn-outcome face), not its frozen `active`. */
  #topLevelStatuses(): ItemStatus[] {
    const items = this.querySelectorAll(':scope > ui-timeline-item')
    return Array.from(items).map((el) => this.#effectiveStatus(el as UITimelineItemElement))
  }

  #effectiveStatus(item: UITimelineItemElement): ItemStatus {
    return this.#truncated.has(item) ? 'warning' : item.status
  }

  /** Scroll the item's END into view IFF the guard holds — smooth by default, instant under reduced-
   *  motion (the a2a-artifact-feed `revealScroll` mechanism, TKT-0004, promoted to component behaviour).
   *  Deferred past a second rAF so a lazily-laid-out entry has settled layout before the target is read.
   *  `scrollIntoView` is guarded (absent in jsdom, the test environment's own gap — a real browser always
   *  has it) so the imperative API stays jsdom-safe without changing browser behaviour at all. */
  #tailFollow(item: UITimelineItemElement): void {
    if (!this.#stuckToBottom) return
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (typeof item.scrollIntoView !== 'function') return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        item.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' })
      }),
    )
  }

  /** Recompute the stick-to-bottom guard on user scroll — scrolling UP (away from the bottom) pins the
   *  viewport against new arrivals; scrolling back down within the threshold resumes follow (SPEC-R10 AC2). */
  #trackStickToBottom(): void {
    this.#stuckToBottom = this.scrollHeight - this.scrollTop - this.clientHeight <= STICK_THRESHOLD_PX
  }
}

if (!customElements.get('ui-status-stream')) customElements.define('ui-status-stream', UIStatusStreamElement)

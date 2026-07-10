// status-stream.ts — UIStatusStreamElement, the timeline family's LIVE host (timeline-family.lld.md §4 ·
// SPEC-R8…R12 · ADR-0122 F1/F2/F4/F6). BEHAVIOUR + the imperative appendEntry/update/finalize API + the
// tail-follow guard + the completion invariant + self-define ONLY. Anatomy/geometry per the LLD; styling
// lives in status-stream.css, the public contract in status-stream.md.
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
// The host owns its own scroll region (`overflow-y: auto`, status-stream.css) — the one-owned-scroll-
// region law. Tail-follow (#tailFollow, SPEC-R10) is the `revealScroll` mechanism (site/pages/a2a-artifact-feed.ts,
// TKT-0004) promoted to component behaviour: `scrollIntoView({behavior, block:'end'})`, reduced-motion
// collapsing to an instant jump, deferred past TWO requestAnimationFrame passes so a lazily-laid-out
// entry (e.g. one revealing detail) has measured before the scroll target is read. The stick-to-bottom
// guard (#trackStickToBottom) recomputes on every user 'scroll' — so a user reading history is never
// yanked, and returning to the bottom resumes follow.
//
// The completion invariant (#markTruncated/finalize, SPEC-R11, the B7 tracked-completion doctrine applied
// to display): `finalize()` marks every still-`pending`/`active` entry TRUNCATED via the item's own
// `markTruncated()` escape hatch (a `:state(truncated)` custom state, timeline-item.ts) — fail-closed, a
// torn stream never shows "still working."
//
// `controls → dom + controls/timeline-item/timeline-item.ts` — the allowed import direction (cross-folder
// sibling, the toast→button precedent direction). Holds NO transport of its own (a standing negative-
// control grep — SPEC-R9 AC3): no fetch/ReadableStream/readNdjsonLines reference anywhere in this file.

import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UITimelineItemElement } from '../timeline-item/timeline-item.ts' // constructs items via its own API (F4)

/** The structured entry a consumer pushes as its stream yields (F4). NOT parsed — a plain record. */
export interface StatusEntry {
  key: string
  status?: '' | 'pending' | 'active' | 'done' | 'error'
  label?: string
  description?: string
  timestamp?: string
  icon?: string
  /** Streamed chain-of-thought text — appended/replaced in place, NEVER tokenized/parsed. */
  text?: string
}

const SIZE = ['sm', 'md', 'lg'] as const
const props = {
  size: { ...prop.enum(SIZE, 'md'), reflect: true },
  label: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

// The stick-to-bottom threshold (px) — "at/near the bottom" tolerates sub-pixel/rounding scroll noise
// without falsely dropping the follow guard.
const STICK_THRESHOLD_PX = 24

export interface UIStatusStreamElement extends ReactiveProps<typeof props> {}
export class UIStatusStreamElement extends UIContainerElement {
  static props = props

  #byKey = new Map<string, UITimelineItemElement>()
  #stuckToBottom = true // the tail-follow guard (§4.3)

  constructor() {
    super()
    this.internals.role = 'log' // a POLITE live region via internals.role (the toast role='status' precedent)
  }

  protected connected(): void {
    this.effect(() => {
      this.internals.ariaLabel = this.label === '' ? null : this.label
    })
    this.listen(this, 'scroll', () => this.#trackStickToBottom())
  }

  /** Append a new entry, tail-follow to it, return the created item (the toast-region.show() return
   *  precedent). Named `appendEntry`, NOT `append` — the native Node.prototype.append() every element
   *  inherits is incompatible; see the file-header NAMED LLD DEVIATION note. */
  appendEntry(entry: StatusEntry): UITimelineItemElement {
    const item = document.createElement('ui-timeline-item') as UITimelineItemElement
    item.dataset.key = entry.key
    this.#assign(item, entry)
    this.#byKey.set(entry.key, item)
    this.appendChild(item)
    this.#tailFollow(item)
    return item
  }

  /** Keyed, in-place mutation — transition status / grow text / reveal detail. No-op if the key is unknown. */
  update(key: string, patch: Partial<StatusEntry>): void {
    const item = this.#byKey.get(key)
    if (item === undefined) return // a late update after truncation is tolerated (never a throw) — SPEC-R9 AC2
    this.#assign(item, patch)
    if (this.#growsTail(patch)) this.#tailFollow(item)
  }

  /** The completion invariant — mark every still-pending/active entry TRUNCATED (SPEC-R11). */
  finalize(): void {
    for (const item of this.#byKey.values()) {
      if (item.status === 'active' || item.status === 'pending') this.#markTruncated(item)
    }
  }

  /** The entry → item projection — sets only the provided fields onto the item's typed props; `text`
   *  grows/replaces the item's streamed-text cell in place (a `[data-role="text"]` content-column cell,
   *  never re-parsed — the item's own residual imperative fact, timeline-item.md). */
  #assign(item: UITimelineItemElement, patch: Partial<StatusEntry>): void {
    if (patch.status !== undefined) item.status = patch.status
    if (patch.label !== undefined) item.label = patch.label
    if (patch.description !== undefined) item.description = patch.description
    if (patch.timestamp !== undefined) item.timestamp = patch.timestamp
    if (patch.icon !== undefined) item.icon = patch.icon
    if (patch.text !== undefined) this.#growText(item, patch.text)
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

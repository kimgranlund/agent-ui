// status-stream.ts — UIStatusStreamElement, the timeline family's LIVE host (timeline-family.lld.md §4 ·
// SPEC-R8…R12 · ADR-0122 F1/F2/F4/F6; the live-turn extensions ADR-0146 F5/F6/F8). BEHAVIOUR + the
// imperative appendEntry/update/finalize API + the tail-follow guard + the completion invariant + the
// opt-in header + grouped entries + worst-child escalation + self-define ONLY. Anatomy/geometry per the
// LLD; styling lives in status-stream.css, the public contract in status-stream.md.
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
// ADR-0146 F5 — GROUPED entries: `StatusEntry.parent?: string` (an existing entry's key) mounts the child
// under the parent item's `[data-role="nested"]` slot — REUSING ADR-0143's shared `ui-disclosure` +
// collapsed-summary preview via `ui-timeline-item.ensureNestedSlot()`, never a second nesting primitive
// (the family-coherence law). The keyed registry stays FLAT: `update(childKey, patch)` reaches a nested
// entry identically, and `finalize()` truncation walks every entry (nested included).
//
// ADR-0146 F6 — status ESCALATION: a group's status = the WORST of its children over the closed ladder
// `error > warning > active > pending > done` (neutral '' contributes nothing) — monotone-truthful (a
// group never reads calmer than its worst child, the fail-closed posture of the F4 completion invariant).
// Recomputed live on every append/update that touches a status (the SAME status-change discipline
// ADR-0143 F3's nested observer keeps for the preview — here the recompute is driven from THIS host's own
// mediated `update()`, since every grouped entry's status change flows through it, so no second observer is
// needed and durable-timeline nesting is left byte-unchanged).
//
// ADR-0146 F8 — the opt-in `header`: a reflected boolean; when set, a pinned `[data-part="header"]` row
// renders the `label` VISIBLY (today aria-only) plus a live overall-status shape-glyph. While un-finalized
// the header shows the escalation over TOP-LEVEL entries whenever it OUTRANKS `active`, else `active` — so
// an EMPTY un-finalized strip reads "working" from construction (the blank-bubble root fix); `finalize()`
// settles it to the escalated final status. The glyph is SHAPE-coded (ADR-0057), never hue alone.
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
// `controls → dom + controls/timeline-item/timeline-item.ts + controls/timeline/timeline.ts` — the allowed
// import direction (cross-folder sibling, the toast→button precedent direction). Holds NO transport of its
// own (a standing negative-control grep — SPEC-R9 AC3): no fetch/ReadableStream/readNdjsonLines reference
// anywhere in this file.

import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UITimelineItemElement } from '../timeline-item/timeline-item.ts' // constructs items via its own API (F4)
import '../timeline/timeline.ts' // registers <ui-timeline> — the nested group host (ADR-0146 F5, ADR-0143 mechanism)

/** The closed status vocabulary an entry can carry (ADR-0122 F3 + the ADR-0146 F7 `warning` member). */
export type EntryStatus = '' | 'pending' | 'active' | 'done' | 'error' | 'warning'

/** The structured entry a consumer pushes as its stream yields (F4). NOT parsed — a plain record. */
export interface StatusEntry {
  key: string
  status?: EntryStatus
  label?: string
  description?: string
  timestamp?: string
  icon?: string
  /** Streamed chain-of-thought text — appended/replaced in place, NEVER tokenized/parsed. */
  text?: string
  /** ADR-0146 F5 — an existing entry's key: when set, this entry nests UNDER that group (a nested
   *  ui-timeline in the parent item's [data-role="nested"] slot), rather than as a top-level sibling. */
  parent?: string
}

const SIZE = ['sm', 'md', 'lg'] as const
const props = {
  size: { ...prop.enum(SIZE, 'md'), reflect: true },
  label: { ...prop.string(''), reflect: true },
  // ADR-0146 F8 — the opt-in visible header. Reflected, default false: every shipped consumer renders
  // byte-identically (no header DOM created at all while false — the container.ts/disclosure.ts convention
  // for an attribute-selector-driven boolean).
  header: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

// The stick-to-bottom threshold (px) — "at/near the bottom" tolerates sub-pixel/rounding scroll noise
// without falsely dropping the follow guard.
const STICK_THRESHOLD_PX = 24

// ADR-0146 F6 — the closed severity ladder `error > warning > active > pending > done`; neutral ''
// contributes nothing (severity 0, never selected over a real status). Worst-child-wins = max severity.
const SEVERITY: Record<EntryStatus, number> = { '': 0, done: 1, pending: 2, active: 3, warning: 4, error: 5 }
function escalate(statuses: readonly string[]): EntryStatus {
  let worst: EntryStatus = ''
  let worstSeverity = 0
  for (const raw of statuses) {
    const severity = SEVERITY[raw as EntryStatus] ?? 0
    if (severity > worstSeverity) {
      worstSeverity = severity
      worst = raw as EntryStatus
    }
  }
  return worst
}

// The header's overall-status shape echo (ADR-0057: shape first — the SAME glyph vocabulary the collapsed-
// summary preview uses, timeline-item.#previewGlyph; the redundant hue is CSS `[data-status]`).
const HEADER_GLYPH: Record<EntryStatus, string> = { '': '', pending: '○', active: '●', done: '✓', error: '✕', warning: '▲' }

export interface UIStatusStreamElement extends ReactiveProps<typeof props> {}
export class UIStatusStreamElement extends UIContainerElement {
  static props = props

  #byKey = new Map<string, UITimelineItemElement>()
  #stuckToBottom = true // the tail-follow guard (§4.3)
  // ADR-0146 F5/F6 — the FLAT grouping registry: childKey → parentKey, parentKey → orderedChildKeys, and
  // the once-per-parent nested <ui-timeline> host.
  #parentOf = new Map<string, string>()
  #childrenOf = new Map<string, string[]>()
  #nestedByParent = new Map<string, HTMLElement>()
  // ADR-0146 F8 — the opt-in header (null while `header` is false — no DOM created at all).
  #headerEl: HTMLElement | null = null
  #headerStatusEl: HTMLElement | null = null
  #headerLabelEl: HTMLElement | null = null
  #finalized = false

  constructor() {
    super()
    this.internals.role = 'log' // a POLITE live region via internals.role (the toast role='status' precedent)
  }

  protected connected(): void {
    this.effect(() => {
      this.internals.ariaLabel = this.label === '' ? null : this.label
      if (this.#headerLabelEl) this.#headerLabelEl.textContent = this.label // the visible header mirror (F8)
    })
    // F8 — create/tear down the header purely from the `header` prop, so `header:false` keeps ZERO header DOM.
    this.effect(() => {
      if (this.header) this.#ensureHeader()
      else this.#teardownHeader()
    })
    this.listen(this, 'scroll', () => this.#trackStickToBottom())
  }

  /** Append a new entry, tail-follow to it, return the created item (the toast-region.show() return
   *  precedent). Named `appendEntry`, NOT `append` — the native Node.prototype.append() every element
   *  inherits is incompatible; see the file-header NAMED LLD DEVIATION note. ADR-0146 F5: an entry carrying
   *  a known `parent` nests under that group's [data-role="nested"] slot instead of as a flat sibling. */
  appendEntry(entry: StatusEntry): UITimelineItemElement {
    const item = document.createElement('ui-timeline-item') as UITimelineItemElement
    item.dataset.key = entry.key
    this.#assign(item, entry)
    this.#byKey.set(entry.key, item)

    const parentKey = entry.parent
    const parentItem = parentKey !== undefined ? this.#byKey.get(parentKey) : undefined
    if (parentKey !== undefined && parentItem !== undefined) {
      // GROUPED (F5) — mount the child into the parent's nested ui-timeline (created lazily, once per parent
      // via the shared ADR-0143 disclosure/preview composition). The registry stays FLAT (keyed by `key`).
      this.#ensureNested(parentKey, parentItem).appendChild(item)
      this.#parentOf.set(entry.key, parentKey)
      const kids = this.#childrenOf.get(parentKey) ?? []
      kids.push(entry.key)
      this.#childrenOf.set(parentKey, kids)
    } else {
      // TOP-LEVEL (or an unknown parent — a graceful flat fallback, never a throw): append into the strip,
      // after the pinned header when present (appendChild lands at the end, past the first-child header).
      this.appendChild(item)
    }

    this.#recomputeEscalation(entry.key)
    this.#tailFollow(item)
    return item
  }

  /** Keyed, in-place mutation — transition status / grow text / reveal detail. No-op if the key is unknown.
   *  Reaches a NESTED entry identically (the registry is flat), and re-escalates its group + the header. */
  update(key: string, patch: Partial<StatusEntry>): void {
    const item = this.#byKey.get(key)
    if (item === undefined) return // a late update after truncation is tolerated (never a throw) — SPEC-R9 AC2
    this.#assign(item, patch)
    if (patch.status !== undefined) this.#recomputeEscalation(key) // F6 — a child's status change re-escalates its group + header
    if (this.#growsTail(patch)) this.#tailFollow(item)
  }

  /** The completion invariant — mark every still-pending/active entry TRUNCATED (SPEC-R11), reaching
   *  nested entries too (the flat registry). Settles the header to the escalated FINAL status (F8). */
  finalize(): void {
    for (const item of this.#byKey.values()) {
      if (item.status === 'active' || item.status === 'pending') this.#markTruncated(item)
    }
    this.#finalized = true
    this.#repaintHeader()
  }

  /** The entry → item projection — sets only the provided fields onto the item's typed props; `text`
   *  grows/replaces the item's streamed-text cell in place (a `[data-role="text"]` content-column cell,
   *  never re-parsed — the item's own residual imperative fact, timeline-item.md). `parent` is a routing
   *  fact consumed by appendEntry, never a timeline-item prop. */
  #assign(item: UITimelineItemElement, patch: Partial<StatusEntry>): void {
    if (patch.status !== undefined) item.status = patch.status
    if (patch.label !== undefined) item.label = patch.label
    if (patch.description !== undefined) item.description = patch.description
    if (patch.timestamp !== undefined) item.timestamp = patch.timestamp
    if (patch.icon !== undefined) item.icon = patch.icon
    if (patch.text !== undefined) this.#growText(item, patch.text)
  }

  /** ADR-0146 F5 — the once-per-parent nested ui-timeline host, adopted into the parent item's shared
   *  ui-disclosure via `ensureNestedSlot` (ADR-0143's mechanism, reused — never a second nesting primitive). */
  #ensureNested(parentKey: string, parentItem: UITimelineItemElement): HTMLElement {
    const existing = this.#nestedByParent.get(parentKey)
    if (existing !== undefined) return existing
    const nested = parentItem.ensureNestedSlot(() => document.createElement('ui-timeline'))
    this.#nestedByParent.set(parentKey, nested)
    return nested
  }

  /** ADR-0146 F6 — bubble the worst-child status up each ancestor group, then repaint the stream header.
   *  Only groups that actually have children are touched (a group's own status is derived, never authored). */
  #recomputeEscalation(key: string): void {
    let cursor = this.#parentOf.get(key)
    while (cursor !== undefined) {
      const parent = this.#byKey.get(cursor)
      if (parent !== undefined) {
        parent.status = escalate((this.#childrenOf.get(cursor) ?? []).map((childKey) => this.#byKey.get(childKey)?.status ?? ''))
      }
      cursor = this.#parentOf.get(cursor) // keep bubbling if the group is itself nested
    }
    this.#repaintHeader()
  }

  // ── the opt-in header (ADR-0146 F8) ────────────────────────────────────────────────────────────────────

  /** Build the pinned header row ONCE (idempotent) and repaint it. Inserted as the FIRST child so the CSS
   *  `position: sticky` pins it above the scrolling entries; the label renders VISIBLY, the glyph shows the
   *  live overall status. */
  #ensureHeader(): void {
    if (this.#headerEl) {
      this.#repaintHeader()
      return
    }
    const header = document.createElement('div')
    header.setAttribute('data-part', 'header')
    const glyph = document.createElement('span')
    glyph.setAttribute('data-part', 'header-status')
    glyph.setAttribute('aria-hidden', 'true') // decorative shape echo — the strip's entries carry the real live semantics
    const label = document.createElement('span')
    label.setAttribute('data-part', 'header-label')
    label.textContent = this.label
    header.append(glyph, label)
    this.insertBefore(header, this.firstChild) // FIRST child — pinned above the entries (sticky, status-stream.css)
    this.#headerEl = header
    this.#headerStatusEl = glyph
    this.#headerLabelEl = label
    this.#repaintHeader()
  }

  #teardownHeader(): void {
    this.#headerEl?.remove()
    this.#headerEl = null
    this.#headerStatusEl = null
    this.#headerLabelEl = null
  }

  /** Repaint the header's overall-status glyph (F8's one rule): while un-finalized show the escalation over
   *  TOP-LEVEL entries when it OUTRANKS `active` (a mid-turn error/warning flips it immediately, F6's
   *  monotone truth), else `active` (an empty un-finalized strip reads "working" from t=0); once finalized
   *  show the escalated final status. */
  #repaintHeader(): void {
    const header = this.#headerEl
    const glyph = this.#headerStatusEl
    if (!header || !glyph) return
    const topLevel: string[] = []
    for (const [key, item] of this.#byKey) if (!this.#parentOf.has(key)) topLevel.push(item.status)
    const esc = escalate(topLevel)
    const shown: EntryStatus = this.#finalized ? esc : esc === 'error' || esc === 'warning' ? esc : 'active'
    header.setAttribute('data-status', shown === '' ? 'none' : shown)
    glyph.textContent = HEADER_GLYPH[shown]
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

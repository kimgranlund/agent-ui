---
# status-stream.md frontmatter — the attributes-as-API descriptor for ui-status-stream (ADR-0004;
# timeline-family.lld.md §4 · SPEC-R8…R12 · ADR-0122 F1/F2/F4/F6). The machine-checkable public surface
# lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block MUST
# mirror status-stream.ts `static props` (size/label) — the contract↔props trip-wire
# (status-stream-descriptor.test.ts) and the frontmatter schema both target this fence. NOT catalogued —
# ADR-0122 F5's EXCLUSION_ALLOWLIST entry (a consumer-owned imperative streaming host, the
# Toast/ToastRegion cl.6 precedent; the catalog slice is a separate a2ui-builder dispatch).
tag: ui-status-stream
description: A live status strip that streams work-in-progress entries and tail-follows the newest arrival.
tier: pattern            # mirrors ui-timeline's classification (the family's shared marker-system geometry)
extends: UIContainerElement  # NOT form-associated — a live display strip, no value/validity
# marginal: measured at the family barrel integration slice (npm run size, ADR-0040 §3)

attributes:               # attributes-as-API — mirrors status-stream.ts static props
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true        # first-class geometry (ADR-0122 F2); author matching item sizes for rail alignment
  - name: label
    type: string
    default: ''
    reflect: true        # author accessible name → internals.ariaLabel, cleared to null on ''; ALSO shown VISIBLY in the header when `header` is set (ADR-0146 F8)
  - name: header
    type: boolean
    default: false
    reflect: true        # ADR-0146 F8 — opt-in visible streaming header (label + live escalated overall status, pinned above the scroll region). Default false ⇒ byte-identical to a headerless strip

properties:               # IDL beyond attributes-as-API — the imperative streaming contract (ADR-0122 F4)
  - name: appendEntry
    description: 'Method — appendEntry(entry: StatusEntry) => UITimelineItemElement. NAMED appendEntry, not append — every element inherits a native, incompatible Node.prototype.append(); a same-name override fails tsc outright (a build-time LLD deviation, flagged for the SPEC-R9/LLD amendment). Creates a ui-timeline-item, assigns the entry''s fields, appends it, tail-follows to it (iff the stick-to-bottom guard holds), and returns the created element (the ui-toast-region.show() return precedent).'
  - name: update
    description: 'Method — update(key: string, patch: Partial<StatusEntry>) => void. A KEYED, in-place mutation to the already-rendered entry with that key: transitions status, grows/replaces streamed text, or reveals detail. A key with no matching entry is a silent no-op (never a throw — SPEC-R9 AC2).'
  - name: finalize
    description: 'Method — finalize() => void. The completion invariant (SPEC-R11): marks every still-pending/active entry TRUNCATED, then settles the header (when opted in) to the escalated FINAL status (ADR-0146 F8; a truncated entry contributes `warning`). Fail-closed — a torn stream never shows "still working."'
  - name: fail
    description: 'Method — fail() => void. A FAILED stream (ADR-0146 F8): the completion invariant (like finalize()) PLUS the header forced to `error` regardless of the entries'' own escalation — the completion invariant''s header-level face for a thrown turn. A no-op on the header when `header` is not set.'

events: []                # a display-first live host — streamed text/state ride the role=log live region, never a synthetic event (SPEC-R12)

slots: []                  # no consumer-authored light-DOM children — every ui-timeline-item child is created by this host's own imperative API (F4)

parts:                     # the appended ui-timeline-item children are the "entries"; the opt-in header IS a control-built part (ADR-0146 F8)
  - name: header
    description: The opt-in `<div data-part="header">` (present only when `header` is set) — chrome PINNED above the scroll region (position:sticky), carrying the visible label + the live overall-status marker. Its `[data-status]` reflects the escalated overall status.
  - name: header-marker
    description: The overall-status marker inside the header — a done/error/warning glyph (currentColor) or a CSS dot/ring/pulse for the in-progress statuses, mirroring ui-timeline-item's own SHAPE-first marker law (ADR-0057).
  - name: header-label
    description: The header's visible label cell — the SAME `label` prop that also sets `internals.ariaLabel` (ADR-0146 F8 makes it visible chrome, not aria-only).

customStates: []           # no :state() hooks of its own — the completion invariant rides the ITEM's own :state(truncated) (timeline-item.md)

face:
  formAssociated: false    # NOT a FACE form control — extends UIContainerElement, no value/validity

aria:
  role: log                 # set via ElementInternals in the CONSTRUCTOR (before insertion) — a POLITE live region (role=log's implicit aria-relevant="additions" default)
  roleSource: internals
  labelSource: label-prop   # a non-empty `label` sets internals.ariaLabel; cleared to null on ''
  liveDiscipline: 'role=log carries an implicit aria-relevant="additions" — a genuinely NEW entry (appendEntry) announces; a `text` patch that mutates an EXISTING node''s textContent does not re-trigger the additions-relevant announcement (state transitions announce, token spam does not, for free)'

keyboard: []               # no keyboard interaction of its own — a display strip; items handle their own (the composed detail's disclosure)

geometry:
  sizeClass: pattern
  minInlineSize: var(--ui-status-stream-min-inline-size)
  maxBlockSize: var(--ui-status-stream-max-block-size)  # the bounded viewport that makes the strip a genuine scroll region (SPEC-R10)
  note: A structural/live container — the marker/row-gap geometry belongs entirely to the ui-timeline-item children this host creates (ADR-0122 F1); this host owns only its scroll region.

forcedColors: The ui-timeline-item children carry their own forced-colors block for every entry-level signifier (marker shapes, truncated ring, connector). The opt-in header (ADR-0146 F8) adds a small forced-colors block of its OWN — the header separator, label ink, and the overall-status glyph/dot/ring resolve to CanvasText so the header stays legible by SHAPE when fills flatten.
---

# ui-status-stream

`ui-status-stream` is the timeline family's **live host** (ADR-0122 F1) — a "what the system is working
on right now" strip: entries appear as work starts, **transition state in place** (running → done/error),
and tail-follow the newest arrival. It extends `UIContainerElement`, is **not** form-associated, and is
**deliberately not catalogued** (ADR-0122 F5, an `EXCLUSION_ALLOWLIST` entry) — a consumer-owned
imperative streaming host, not one-shot emittable markup.

```ts
const stream = document.querySelector('ui-status-stream')!
const a = stream.appendEntry({ key: 't1', status: 'active', label: 'Searching the codebase…' })
// … the consumer's stream yields …
stream.update('t1', { status: 'done', description: '42 files matched' })
stream.appendEntry({ key: 't2', status: 'active', label: 'Generating the patch…' })
stream.update('t2', { text: 'Reasoning: the failure is in the reconcile…' }) // streamed text, never parsed
// stream ends mid-flight:
stream.finalize() // t2 (still active) renders TRUNCATED — never a forever-spinner (SPEC-R11)
```

## Props

- **`size`** (`sm`/`md`/`lg`, default `md`) — first-class geometry (ADR-0122 F2) for family/catalog
  symmetry; author matching sizes on appended entries (or rely on the default) for rail alignment.
- **`label`** (string, default `''`) — the strip's accessible name, set on `internals.ariaLabel`; also
  shown VISIBLY in the header when `header` is set.
- **`header`** (boolean, default `false`) — the opt-in visible streaming header (ADR-0146 F8). When set, a
  pinned `[data-part="header"]` row shows the `label` plus a live overall-status marker escalated over the
  strip's top-level entries. Default `false` renders byte-identically to a headerless strip (no header DOM).

## The streaming header (ADR-0146 F8)

Opt in with `header` and the strip grows a pinned chrome row that reads **working from construction** —
even an empty, un-finalized stream shows an `active` header the instant it is set, which is the structural
fix for the blank-agent-bubble symptom (a headerless empty strip renders zero pixels). The header's
overall status follows one rule: while the turn is un-finalized it shows the worst-child escalation over
the top-level entries **when that outranks `active`** (a mid-turn `error`/`warning` entry flips the header
immediately — the monotone-truth of ADR-0146 F6), and `active` otherwise. `finalize()` settles the header
to the escalated final status (a still-running entry, now truncated, contributes `warning`); `fail()`
forces it `error`. The header is `position: sticky` — pinned above the scroll region, never scrolling away
as entries overflow. The status marker is SHAPE-first (ADR-0057): a glyph for `done`/`error`/`warning`, a
dot/ring/pulse for the in-progress states.

## The imperative API (ADR-0122 F4)

- **`appendEntry(entry: StatusEntry): UITimelineItemElement`** — creates a `ui-timeline-item`, assigns the
  entry's fields (`key`, `status?`, `label?`, `description?`, `timestamp?`, `icon?`, `text?`), appends it,
  tail-follows to it, and returns the element. Named `appendEntry`, not `append` — every element already
  inherits a native, incompatible `Node.prototype.append()` (a build-time LLD deviation from SPEC-R9's
  literal name, flagged for amendment; behaviour/signature otherwise identical).
- **`update(key: string, patch: Partial<StatusEntry>): void`** — a **keyed** mutation to the
  already-rendered entry with that `key`: transitions `status`, grows/replaces streamed `text`, or reveals
  detail. A `key` with no matching entry is a silent no-op — never a throw (a late update after
  truncation is tolerated).
- **`finalize(): void`** — the completion invariant: every still-`pending`/`active` entry renders
  TRUNCATED (a distinct, non-color-only interrupted affordance on the item). Fail-closed.

This host holds **no transport** of its own — no `fetch`/`ReadableStream` reference anywhere in its
source. The consumer owns the stream and drives `appendEntry`/`update`/`finalize` as it yields.

## Tail-follow + the stick-to-bottom guard

Appending an entry (or an `update` that grows visible content) scrolls the newest entry's end into view
— smooth by default, an instant jump under `prefers-reduced-motion` — **unless** the user has scrolled up
to read history, in which case new arrivals do not yank the viewport. Scrolling back to the bottom resumes
follow. The stream owns its own scroll region (`overflow-y: auto`).

## Accessibility

`internals.role = 'log'` (a **polite** live region, never `assertive` by default), set in the constructor
— before insertion. `role="log"`'s implicit `aria-relevant="additions"` default means a genuinely new
entry (`appendEntry`) announces, while a `text` patch mutating an existing node's content does not re-trigger
an additions announcement — state transitions announce, token-by-token spam does not.

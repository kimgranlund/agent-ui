---
# status-stream.md frontmatter — the attributes-as-API descriptor for ui-status-stream (ADR-0004;
# timeline-family.lld.md §4 · SPEC-R8…R12 · ADR-0122 F1/F2/F4/F6). The machine-checkable public surface
# lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block MUST
# mirror status-stream.ts `static props` (size/label/header/oneline/receipt) — the contract↔props trip-wire
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
  - name: oneline
    type: boolean
    default: false
    reflect: true        # GH #239/ADR-0159 — opt-in LIVE one-line mode: while un-settled the strip collapses to one morphing line (current step's live label + ticking turn-elapsed + shimmer), expandable mid-turn (a real disclosure). Materializes the header row even when `header` is false. Default false ⇒ byte-identical always-expanded shape
  - name: receipt
    type: boolean
    default: false
    reflect: true        # GH #239/ADR-0159 — opt-in TERMINAL receipt: finalize()/fail() auto-collapses the strip to one line — label + "N steps · total-elapsed" + the settled outcome glyph (fail()'s forced error stays loud); click/Enter/Space re-expands the trace. Default false ⇒ a settled oneline strip auto-expands instead

properties:               # IDL beyond attributes-as-API — the imperative streaming contract (ADR-0122 F4)
  - name: appendEntry
    description: 'Method — appendEntry(entry: StatusEntry) => UITimelineItemElement. NAMED appendEntry, not append — every element inherits a native, incompatible Node.prototype.append(); a same-name override fails tsc outright (a build-time LLD deviation, flagged for the SPEC-R9/LLD amendment). A NEW key creates a ui-timeline-item, assigns the entry''s fields, appends it, tail-follows to it (iff the stick-to-bottom guard holds), and returns the created element (the ui-toast-region.show() return precedent). A DUPLICATE key is a silent no-op — returns the EXISTING element unchanged, never a second element or a throw (GH #37 — the registry/DOM-consistency guard; symmetric with update()''s own no-op-on-unknown-key). ADR-0146 F5: an entry carrying a KNOWN `parent` (another entry''s key) NESTS under that group''s `[data-role="nested"]` slot (a nested ui-timeline, mounted lazily once per parent) instead of as a top-level sibling; an unknown parent degrades to a flat append. The keyed registry stays FLAT — `update(childKey, patch)` reaches a nested entry identically. GH #147/ADR-0153: `entry.startedAt` (an ISO timestamp) arms a ticking elapsed-time display into the entry''s `timestamp` cell for as long as its status reads `active`; `entry.action` (`{ label }`) arms an inline retry `<ui-button>`, shown while its status reads `error`, that emits `action` on click — see StatusEntry''s own field docs.'
  - name: update
    description: 'Method — update(key: string, patch: Partial<StatusEntry>) => void. A KEYED, in-place mutation to the already-rendered entry with that key: transitions status, grows/replaces streamed text, or reveals detail. A key with no matching entry is a silent no-op (never a throw — SPEC-R9 AC2). `patch.startedAt`/`patch.action` re-arm the SAME Fork 1/2 ticking-timer/retry-button mechanism appendEntry does.'
  - name: finalize
    description: 'Method — finalize() => void. The completion invariant (SPEC-R11): marks every still-pending/active entry TRUNCATED, then settles the header (when opted in) to the escalated FINAL status (ADR-0146 F8; a truncated entry contributes `warning`). Fail-closed — a torn stream never shows "still working." Also stops every ticking elapsed-time display (GH #147/ADR-0153) — a settled stream never keeps a clock running.'
  - name: fail
    description: 'Method — fail() => void. A FAILED stream (ADR-0146 F8): the completion invariant (like finalize()) PLUS the header forced to `error` regardless of the entries'' own escalation — the completion invariant''s header-level face for a thrown turn. A no-op on the header when `header` is not set. Also stops every ticking elapsed-time display, exactly as finalize() does.'

events:                    # GH #147/ADR-0153 Fork 2 — the ONE new closed-vocabulary member; everything else (streamed text/state) still rides the role=log live region, never a synthetic event (SPEC-R12's original scope, unchanged)
  - name: action
    detail: '{ key: string }'
    description: Fired when the user clicks an entry's inline retry/action button (rendered when that entry carries `action` AND its effective status is `error`). `key` is the entry's own key — the SAME key passed to appendEntry/update. The component NEVER re-runs anything itself in response; the consumer's own listener owns the actual retry (or whatever the action's `label` names). A new closed-vocabulary member (naming.md §4) — none of change/input/select/open/close/toggle name "a user committed a per-entry action button," and `select`'s own commit semantics name a list selection, not this.

slots: []                  # no consumer-authored light-DOM children — every ui-timeline-item child is created by this host's own imperative API (F4)

parts:                     # the appended ui-timeline-item children are the "entries"; the opt-in header IS a control-built part (ADR-0146 F8)
  - name: header
    description: The opt-in `<div data-part="header">` (present only when `header` is set) — chrome PINNED above the scroll region (position:sticky), carrying the visible label + the live overall-status marker. Its `[data-status]` reflects the escalated overall status.
  - name: header-marker
    description: The overall-status marker inside the header — a done/error/warning/pending glyph (currentColor) or a CSS dot/ring/pulse for the in-progress statuses, mirroring ui-timeline-item's own SHAPE-first marker law (ADR-0057). (GH #147/ADR-0153: `pending`'s glyph closes the same named gap `ui-timeline-item`'s GROUP_STATUS_GLYPH closes — see status-stream.ts's own HEADER_STATUS_GLYPH comment for the reachability caveat at THIS stream-level header.)
  - name: header-label
    description: The header's visible label cell — the SAME `label` prop that also sets `internals.ariaLabel` (ADR-0146 F8 makes it visible chrome, not aria-only).
  - name: action
    description: 'GH #147/ADR-0153 Fork 2 — the `[data-role="action"]` cell the host appends onto an entry''s `ui-timeline-item` when that entry carries `action` and its effective status is `error`; hosts one `<ui-button>` (`variant="soft"`, `size="sm"`) labelled from `action.label`.'
  - name: header-meta
    description: 'GH #239/ADR-0159 — the header''s secondary cell, present only in an opted-in (`oneline`/`receipt`) mode: the ticking turn-elapsed ("12s") while the turn runs under `oneline`; the receipt summary ("5 steps · 3.2s") once settled. Tabular digits; secondary ink.'
  - name: header-caret
    description: 'GH #239/ADR-0159 — the disclosure caret (a `caret-down` glyph), present only in an opted-in mode; rotates open when the header row''s `aria-expanded` reads true.'

customStates:              # GH #239/ADR-0159 — the disclosure state; the completion invariant still rides the ITEM's own :state(truncated) (timeline-item.md)
  - collapsed              # set via internals.states (jsdom-optional-chained) while the strip renders as one line — the `oneline` live posture or the settled `receipt`; CSS hides the entry list through it; never set outside the opt-in modes

face:
  formAssociated: false    # NOT a FACE form control — extends UIContainerElement, no value/validity

aria:
  role: log                 # set via ElementInternals in the CONSTRUCTOR (before insertion) — a POLITE live region (role=log's implicit aria-relevant="additions" default)
  roleSource: internals
  labelSource: label-prop   # a non-empty `label` sets internals.ariaLabel; cleared to null on ''
  liveDiscipline: 'role=log — a genuinely NEW entry (appendEntry) rides the additions channel. Honestly stated (ADR-0159): the DEFAULT aria-relevant for role=log is "additions text", so a textContent mutation IS relevant in principle; the fleet''s discipline is that every in-place patch (streamed `text`, the ADR-0153 ticking timestamp, the ADR-0159 morphing line / done-label re-stamp) is a SAME-NODE mutation, never an insertion — so no label transition can ride the additions channel twice. A live screen-reader spot-check is ADR-0159''s named follow-up.'

keyboard:                  # GH #239/ADR-0159 — the header-row disclosure, only in an opted-in (`oneline`/`receipt`) mode; a default strip keeps zero keyboard interaction of its own (items handle their own — the composed detail's disclosure)
  - keys: Enter / Space
    action: Toggles the one-line collapse when the header row (role="button", tabindex="0" — present only when `oneline`/`receipt` is set) is focused. Space's page-scroll default is prevented. No keyboard surface exists at all outside the opt-in modes.

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
- **`oneline`** (boolean, default `false`) — the opt-in LIVE one-line mode (GH #239/ADR-0159): while the
  turn runs the strip collapses to one morphing line. Default `false` keeps the always-expanded shape.
- **`receipt`** (boolean, default `false`) — the opt-in TERMINAL receipt (GH #239/ADR-0159): a settled
  turn auto-collapses to a one-line summary. Default `false` keeps the always-expanded terminal shape.

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

## The receipt pattern (GH #238/#239/ADR-0159)

Kim's 2026-07-23 ruling adopts the claude.ai/ChatGPT activity UX as **two independent opt-ins** — both
default `false`, so every existing consumer keeps its always-expanded shape byte-identically:

- **`oneline`** — while un-settled, the strip renders as **one morphing line**: the header row (grown a
  `header-meta` elapsed cell + a `header-caret` affordance) shows the **current step's live label** plus a
  ticking turn-elapsed display (anchored at the first `appendEntry` — never fabricated), with a soft
  shimmer while active. The line is a **real disclosure**: `role="button"`, `tabindex="0"`,
  `aria-expanded` — click or Enter/Space expands the full step list mid-turn and collapses it back. A
  user's explicit expand is respected (the auto-collapse never yanks it shut mid-turn).
- **`receipt`** — at a terminal state (`finalize()`/`fail()`) the strip **auto-collapses to a one-line
  receipt**: the static `label` + `"N steps · total-elapsed"` (`5 steps · 3.2s`) in the meta cell + the
  settled outcome glyph. `fail()`'s forced `error` header stays loud (danger ink + the x glyph). Click
  re-expands the trace. Without `receipt`, a settled `oneline` strip auto-**expands** instead.

Both modes materialize the header row (it IS the one line) even when `header` is `false`; the collapse
state is a `collapsed` custom state (`:state(collapsed)` hides the entry list in CSS). Announcement
discipline (honestly stated): the morphing line and the done-label re-stamps (GH #238 — the consumer's
live/done pair table) are **same-node textContent mutations, never node insertions** — the fleet's
established `role=log` discipline (ADR-0153's ticking timestamps shipped the same bet), which is what
keeps a label transition from riding the additions channel twice. `role=log`'s default `aria-relevant`
is `additions text`, so a mutation is relevant in principle; a live screen-reader spot-check is
ADR-0159's named follow-up.

```html
<ui-status-stream label="Agent activity" oneline receipt></ui-status-stream>
```

## The imperative API (ADR-0122 F4)

- **`appendEntry(entry: StatusEntry): UITimelineItemElement`** — for a NEW `key`, creates a `ui-timeline-item`,
  assigns the entry's fields (`key`, `status?`, `label?`, `description?`, `timestamp?`, `icon?`, `text?`,
  `startedAt?`, `action?`), appends it, tail-follows to it, and returns the element. Named `appendEntry`, not `append` — every element
  already inherits a native, incompatible `Node.prototype.append()` (a build-time LLD deviation from
  SPEC-R9's literal name, flagged for amendment; behaviour/signature otherwise identical). A **duplicate**
  `key` is a silent no-op — returns the existing element unchanged, never creating a second element or
  throwing (GH #37); a consumer wanting to mutate an already-appended entry calls `update(key, patch)`.
- **`update(key: string, patch: Partial<StatusEntry>): void`** — a **keyed** mutation to the
  already-rendered entry with that `key`: transitions `status`, grows/replaces streamed `text`, or reveals
  detail. A `key` with no matching entry is a silent no-op — never a throw (a late update after
  truncation is tolerated).
- **`finalize(): void`** — the completion invariant: every still-`pending`/`active` entry renders
  TRUNCATED (a distinct, non-color-only interrupted affordance on the item). Fail-closed. Also stops every
  ticking elapsed-time display (GH #147/ADR-0153) — a settled stream never keeps a clock running.

This host holds **no transport** of its own — no `fetch`/`ReadableStream` reference anywhere in its
source. The consumer owns the stream and drives `appendEntry`/`update`/`finalize` as it yields.

## Grouping (ADR-0146 F5) + worst-child escalation (F6)

An entry can NEST under another by carrying that entry's key as `parent`:

```ts
stream.appendEntry({ key: 'reasoning', status: 'active', label: 'Reasoning…' })
stream.appendEntry({ key: 'r1', parent: 'reasoning', status: 'active', label: 'Considering the reconcile loop' })
stream.appendEntry({ key: 'r2', parent: 'reasoning', status: 'warning', label: 'A partial match — verifying' })
stream.update('r1', { status: 'done' }) // the group escalates live: reasoning now reads `warning` (worst child)
```

The host lazily mounts a nested `<ui-timeline>` into the parent item's `[data-role="nested"]` slot (via
`ui-timeline-item.ensureNestedSlot()`) — **reusing** ADR-0143's shared `ui-disclosure` + collapsed-summary
preview (never a second nesting primitive). The keyed registry stays **flat**: keys are unique across the
whole strip, so `update(childKey, patch)` reaches a nested entry identically, and `finalize()`/`fail()`
truncation reaches nested pending/active entries too. A group parent's status is **derived**, never
authored: it escalates **worst-child-wins** over the closed ladder `error > warning > active > pending >
done` (the exported `escalateStatus` reduce), recomputed live from the host's own `appendEntry`/`update`
calls — no MutationObserver. The nested `<ui-timeline>` is `role="list"` inside the outer `role="log"`: one
live region, one addition-announcement path, no bespoke `aria-live` on the nested host.

## Elapsed-timer ticking (GH #147/ADR-0153 Fork 1)

Set `startedAt` (an ISO 8601 timestamp) on an entry and the host itself ticks a live elapsed-time display
("32s", "1m 12s") into that entry's `timestamp` cell — one shared interval per stream instance, armed the
moment any tracked entry's status reads `active` and disarmed the instant none remain (including on
`finalize()`/`fail()`, which force-stop every ticking display — a settled turn never keeps a clock
running):

```ts
stream.appendEntry({ key: 'g', status: 'active', label: 'Task Group', startedAt: new Date().toISOString() })
// … the group ticks "0s", "1s", "2s"… while `active`; freezes the instant its escalated status resolves
```

For a GROUP parent, "while any entry in that group is active" falls out of the group's own already-
escalated `.status` (ADR-0146 F6) — no separate per-child check is needed. `startedAt` is a **routing
fact** consumed by `appendEntry`/`update`, never projected onto the item as a prop (the same treatment
`parent` already gets) — an unparsable or absent value is tolerated, never a throw.

## Inline retry/action (GH #147/ADR-0153 Fork 2)

Set `action: { label: string }` on an entry and, **while that entry's effective status reads `error`**,
the host renders a `<ui-button>` (in the entry's own `[data-role="action"]` cell) labelled `action.label`.
A click emits `action` (`{ key }`) on the **stream host** — a new closed-vocabulary member (`naming.md`
§4): the fleet's existing six (`change`/`input`/`select`/`open`/`close`/`toggle`) has no "a user committed
a per-entry action button" member, and `select`'s own commit semantics name a list selection, not this.
**The component never re-runs anything itself** — the consumer's own listener owns the actual retry:

```ts
stream.appendEntry({ key: 'r1', status: 'error', label: 'Patch step', description: 'Merge conflict', action: { label: 'Retry' } })
stream.addEventListener('action', (e) => {
  const { key } = (e as CustomEvent<{ key: string }>).detail
  stream.update(key, { status: 'active', description: 'Retrying…' }) // the consumer drives the retry, not the component
})
```

## "Planned" — the pending group glyph (GH #147/ADR-0153 Fork 3)

An all-`pending` group (every child still not-yet-started) escalates to `escalateStatus`'s `pending` rank
the moment its children are appended — before any of them starts. `ui-timeline-item`'s `GROUP_STATUS_GLYPH`
now paints this distinctly (a neutral outline `clock`), joining the existing spinning-ring/check-circle/
x-circle set. Pair it with a `label`/`description` reading `'Planned'` on the not-yet-started child steps
themselves (a freeform-text convention — no enforced field; see the doc page's own `g-progress-2`/
`g-error-3` specimens) for the full Figma "Planned" treatment.

## Step-count / score group-header summaries — a `description` convention, not `trailing`

The Figma frames' "3 Steps" / "94/100" group-header summaries ship as a **documented convention, zero
`StatusEntry` contract change** — but landing in the group entry's own **`description`** field, not the
`trailing` cell the issue's own intake first proposed. Found while building this: `trailing` on a GROUP
parent is **already live** — ADR-0143's collapsed-summary preview auto-fills it with the last nested
descendant's status+label whenever the group is closed (`timeline-item.ts`'s `#renderTrailingPreview()`),
and a consumer's own direct write there would be silently clobbered the next time any nested child
mutates (the SAME MutationObserver that drives the preview). `description` carries none of that
competition — it's a plain stamped prop cell, untouched by any auto-fill mechanism — so it is the
conflict-free home for this pattern:

```ts
stream.appendEntry({ key: 'g', status: 'active', label: 'Task Group', description: '3 Steps', startedAt: … })
// … later, on success:
stream.update('g', { status: 'done', description: '3 Steps · 94/100' })
```

The genuine `trailing`-slot **consumer-content** pattern (a light-DOM child a consumer authors and the
component's own status-glyph paint never overwrites, `timeline-item.ts:60-62,313-322`) still holds exactly
as documented — for a **non-grouped** (leaf, no nested children) entry, where no auto-fill effect
competes for the cell, a consumer can safely grab the item `appendEntry` returns and write into its
`trailing` cell directly:

```ts
const item = stream.appendEntry({ key: 'leaf', status: 'done', label: 'Fetched 42 files' })
item.querySelector('[data-role="trailing"]')!.textContent = 'v2' // safe — no nested content to compete with it
```

## Tail-follow + the stick-to-bottom guard

Appending an entry (or an `update` that grows visible content) scrolls the newest entry's end into view
— smooth by default, an instant jump under `prefers-reduced-motion` — **unless** the user has scrolled up
to read history, in which case new arrivals do not yank the viewport. Scrolling back to the bottom resumes
follow. The stream owns its own scroll region (`overflow-y: auto`).

## Accessibility

`internals.role = 'log'` (a **polite** live region, never `assertive` by default), set in the constructor
— before insertion. A genuinely new entry (`appendEntry`) rides the additions channel. Honestly stated
(ADR-0159): `role="log"`'s default `aria-relevant` is `additions text`, so an in-place text patch is
relevant in principle — the fleet's discipline is that every such patch is a **same-node mutation, never
an insertion**, so no transition can ride the additions channel twice; a live screen-reader spot-check
is ADR-0159's named follow-up.

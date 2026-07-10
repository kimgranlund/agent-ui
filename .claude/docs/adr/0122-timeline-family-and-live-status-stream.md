# ADR-0122 — `ui-timeline`: a shared event-rail family + `ui-status-stream`, its live sibling host

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-10
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-10 |
> | **Proposed by** | design intake (COMBINED TKT-0010 `ui-timeline` + TKT-0013 `ui-status-stream`, Kim's directives 2026-07-10: a `ui-timeline` event-sequence family that *"supports `size=\"…\"` patterns as first-class geometry"*, and a live surface that displays *"what the system is working on — chain of thought / reasoning / actions / tool-use as it is occurring"*). Both tickets flag the SAME first fork (own control vs one family, two postures); this ADR resolves it before either builds. Greenfield — no timeline/stream element, ADR, or PRD row exists; the fleet's own `a2a-artifact-feed` page hand-rolls a `.feed-timeline` chrome (`site/pages/a2a-artifact-feed.ts:63-66`), the standing evidence the primitive is missing (the `document-row-toolbar`/ADR-0121 gap-shape precedent). |
> | **Ratified by** | — (proposed; forks F1–F6 as recommended, none self-ratified — only Kim flips a status) |
> | **Repairs** | NEW [`../spec/timeline-family.spec.md`](../spec/timeline-family.spec.md) · NEW [`../lld/timeline-family.lld.md`](../lld/timeline-family.lld.md) · NEW [`../decompositions/timeline-family-ship.decomp.json`](../decompositions/timeline-family-ship.decomp.json) (coverage-clean, plan mode, exit 0). On ratification+build: NEW `packages/agent-ui/components/src/controls/{timeline,timeline-item,status-stream}/*` · `Timeline`+`TimelineItem` catalog rows in `packages/agent-ui/a2ui/src/catalog/default/*` (F5, emittable) + a `StatusStream` `EXCLUSION_ALLOWLIST` entry (F5) · NEW `--ui-timeline-*` marker-system token rows per `[size]`/`[scale]` (F2) · NEW `site/pages/timeline-{doc,demo}.ts` + `status-stream-{doc,demo}.ts` · a `<component-gallery>` specimen per host. Follow-up (NOT this scope): repoint `a2a-artifact-feed`'s hand-rolled `.feed-timeline` onto `ui-status-stream` (the ADR-0117/0121 dogfood-promotion pattern). |
> | **Supersedes / Superseded by** | relates ADR-0038 (the `(scale × size) → row` explicit-lookup law F2 extends with a marker-system table) · relates ADR-0048 (the calendar's bespoke 2D-grid geometry — the novelty-leg precedent F2 follows) · relates ADR-0035/0036 (the per-`[scale]` hoisted `--ui-font`/`--ui-icon` table pattern F2 mirrors) · relates ADR-0057 (the non-color-signifier rule F3 obeys) · relates ADR-0112 cl.6 (the Toast/ToastRegion catalog-exclusion test F5 applies to `StatusStream`; and the feed-family PRD this extends — activity vocabulary) · relates ADR-0087 (the catalog-or-allowlist gate F5 answers) · relates ADR-0022 (`moveBefore` node-identity — the item-adoption path) · relates ADR-0116 / TKT-0004 (the live-stream + tail-scroll `revealScroll` discipline F4 realizes as component behavior) · relates the `ui-toast`/`ui-toast-region` same-folder dumb-item+liveness-host pair (F1's structural precedent) · relates the `ui-list` `role="list"` + `ui-disclosure` `toggle` reuses |

## Context

Two tickets landed the same day asking for two surfaces that LOOK alike and are mechanically opposite:

- **TKT-0010 `ui-timeline`** — a **durable chronology**: authored events, read-back posture (an order-tracking
  card, an audit log, a version history). The consumer writes the items as light-DOM children; they are all
  resolved by construction; a screen reader navigates them as a list.
- **TKT-0013 `ui-status-stream`** — a **live "what the system is doing now" strip**: entries appear as work
  starts (thinking · tool X running · action Y), **transition state in place** (running → done/error), and
  collapse as they resolve; a tail-following "now" surface fed by a stream the consumer holds. This lands
  INSIDE recorded territory — the **feed-family PRD** (`prd/feed-family.prd.md`) owns "activity vocabulary —
  what agent work *looks like* while and after it happens"; this is the live, in-progress member that family
  does not yet have. It is finer-grained than the a2a artifact feed (WITHIN a turn's work, not turn-level).

Both tickets flag the fork FIRST, because it decides whether this is one component family or two:
**is the live status-stream its OWN control, or `ui-timeline`'s LIVE POSTURE (one family, two postures)?**

Two prior arts were studied per the tickets, and **promoted to this fleet's laws, never ported**:

- **The published `ui-kit.exe.xyz/site/components/timeline` docs page** — fetched once at intake; it returned
  only a client-side SPA shell ("Loading changelog…") with zero component content (the identical empty-shell
  the ADR-0121 toolbar intake hit). Per the repo-absence-vs-spec-absence rule, this ADR draws **nothing** from
  that source and fills no gap from memory.
- **The adia `gen-ui-kit` timeline family** (`/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/
  components/timeline/`, read in full — `timeline.class.js`, `timeline.css`, `timeline.yaml`,
  `timeline-item.yaml`, `timeline.test.js`) — a **two-tag** family: `<timeline-ui>` (props `orientation`
  vertical|horizontal, `size` md|sm) + `<timeline-item-ui>` (props `text`/`description`/`time`/`duration`/
  `icon`/`variant`/`status`/`spinner`; a JS-set `outcomes` string[] rendered as an expandable sub-list with a
  toggle caret emitting `timeline-toggle`). Its geometry is a three-column **subgrid** rail — `[marker] [content
  1fr] [aside auto]` — with the marker (a `::before` dot or a slotted icon) and connector (a `::after` line)
  absolutely positioned in the marker column, a `size="sm"` compact variant shrinking the marker box, and a
  horizontal mode that drops subgrid for flow. A capable design; its **marker-system geometry**, its
  `variant`+`status` split, its **prior-art drift** (`timeline.class.js` documents `status = idle|active|
  completed|error` while `timeline-item.yaml` declares `idle|pending|done|failed` — the two disagree), its
  host-attribute ARIA, and its "live" story (it has none — it is authored-children only, no streaming ingress)
  are all fleet-law questions this ADR resolves rather than copies.

Six forks decide the shape of the promotion. F1 (the posture fork) is the headline and gates the rest.

## Decision

Ship a **three-tag family** — one shared visual atom, two divergent hosts — plus a **new explicit
marker-system geometry**. `ui-timeline` and `ui-timeline-item` are **A2UI-emittable**; `ui-status-stream` is
**allowlisted, not emittable**. The two hosts share the item and the rail; they do NOT share their data
contract, their scroll ownership, their a11y role, or their motion — which is exactly why they are two hosts,
not one control with a flag.

### F1 — the posture fork: **THREE tags — one shared `ui-timeline-item`, two hosts (`ui-timeline` durable, `ui-status-stream` live) — NOT one control with a `live` posture, NOT two independent families**

Decomposed to first principles, "durable timeline" and "live status stream" diverge on **five mechanical
axes**, and overlap on exactly **one** — the visual rail. The overlap is a shared *anatomy*, not a shared
*control*:

| Axis | `ui-timeline` (durable) | `ui-status-stream` (live) |
|---|---|---|
| **Data ingress** | authored light-DOM children, DOM-order, present at parse (the adia model; `Order is DOM-order — no auto-sort`) | **imperative append + keyed update-in-place** — entries arrive over time and an existing entry *transitions* (running → done/error); identity persists across state changes (the A2A `TaskState` table is literally `working → completed/failed`) |
| **Completion** | every item resolved by construction | the **completion invariant** — a stream that ends without resolving an entry must be SHOWABLE as truncated (the B7 tracked-completion doctrine applied to display) |
| **Scroll** | page/container-scrolled; user-driven; no auto-follow | **tail-follow** — owns a scroll region, animates to the newest entry as it arrives (the `revealScroll`/TKT-0004 discipline), with a stick-to-bottom guard |
| **A11y role** | `internals.role = 'list'` — a static, navigable structure (the `ui-list` precedent) | `internals.role = 'log'` — a **polite live region**, announcing state transitions, never token-by-token |
| **Motion** | static | streaming: active-marker pulse/spinner, entry fade-in, tail-scroll — all reduced-motion-collapsing |

The `role="list"` ↔ `role="log"` divergence is the load-bearing proof. A single control with a `live` boolean
would have to **flip its ARIA role, its scroll ownership, its data contract, and its completion semantics on
one attribute** — that is two controls hiding in a trench coat, and it fails the family-coherence law
(one control = one honest contract). It also fails the tickets' own "do not let two overlapping components
ship" by shipping ONE overloaded one instead.

But the two surfaces DO share the visual atom: a vertical rail of `marker + connector + content`, with state
markers and their ADR-0057 signifiers, and the item's collapsible detail. Shipping that rail twice (two CSS
rails, two marker-system geometries, two signifier sets) is the same duplication at the stylesheet layer.

**The fleet has already solved this exact shape** — `ui-toast` + `ui-toast-region`: a *dumb item* the region
hosts, and a *liveness-owning host* (the region owns the `MutationObserver` childList watch, the top-layer
`showPopover`, and the `role="status"` live-region semantics; the item is inert). By the same mechanics:

- **`ui-timeline-item`** — the shared, inert visual atom: marker (dot/icon) + connector + content roles
  (label · description · timestamp · trailing) + `status` (with F3 signifiers) + the F2 marker-system geometry
  + an optional collapsible detail (F6). `internals.role = 'listitem'`. Extends `UIElement`. Authored ONCE,
  hosted by BOTH hosts.
- **`ui-timeline`** — the DURABLE host: authored `ui-timeline-item` children, DOM-order read-back,
  `internals.role = 'list'`, no tail-follow, static. Extends `UIContainerElement` (the `ui-list` precedent).
- **`ui-status-stream`** — the LIVE host: the F4 imperative append/keyed-update API, tail-follow scroll,
  `internals.role = 'log'` (polite live region), the completion invariant, streaming motion. Hosts the SAME
  `ui-timeline-item` children (created by its API). Extends `UIContainerElement`.

**Recommendation: three tags, ONE combined intake and record set** (this ADR + one family SPEC/LLD/decomp),
because the item + rail is shared and MUST be designed once to not drift. Both tickets close against it:
TKT-0010 owns `ui-timeline` + `ui-timeline-item`; TKT-0013 owns `ui-status-stream` (reusing the item).

**Rejected: one control, `live`/`follow` boolean** — cannot honestly flip `role=list`↔`log`, scroll
ownership, data contract, and completion on one attribute (five-axis divergence). **Rejected: two fully
independent families** — ships the marker rail, marker-system geometry, and signifier set twice, the exact
duplication the tickets warn against, one layer down.

### F2 — the marker-system geometry (the novelty leg): **first-class `size` + an explicit per-`(scale × size)` lookup table, NO multiplier**

No existing size-class row covers a `marker-dot + connector-line + gutter-column + row-gap` rail. `geometry.md`
classifies the family as **Pattern** (a structural multi-row family, kin to accordion/menu), but Pattern's
described lever — "interactive rows take the control height" — does NOT fit a NON-interactive display rail whose
distinctive quantities are the marker box, the connector hairline, the gutter (marker-column width), and the
row gap. The **novelty leg fires** (the ADR-0048 date/time-picker precedent — a bespoke geometry no ramp row
covered, ratified as an explicit table).

Kim's directive is explicit: `ui-timeline` *"supports `size=\"…\"` patterns as **first-class** geometry"* — the
marker/connector/gutter quantities *"join the fleet's explicit per-`[scale]` lookup dialect (no multipliers —
the ADR-0038 law)."* So:

- The family carries a **`size` PROP** (`enum ['sm','md','lg'], default 'md'`) — first-class, author-set — the
  **sized-entry precedent generalized** (`geometry.md`: *"`ui-select` joined the sized entry family — a `size`
  attribute (`sm/md/lg`)"*). This is unlike ADR-0121's toolbar (which owns NO `size` prop and borrows item
  height ambiently) precisely because Kim directed first-class `size` AND the rail is the control's OWN geometry
  (a marker dot, not a child's height).
- A **NEW `--ui-timeline-*` marker-system token set** — `marker-box`, `dot-size`, `icon-size`,
  `connector-width`, `gutter` (marker-column width), `row-gap` — realized as **explicit per-`[size]` × per-
  `[scale]` rows**, hoisted the way `--ui-font`/`--ui-icon` are (the ADR-0035/0036 §1-set pattern), with **NO
  multiplier** (ADR-0038). The resolution is Kim's `(scale × size) → row` LOOKUP: `[scale]` rides ambiently as
  the register, `size` picks the within-register row; each cell names explicit integers, not a `pow()`.
- The **content text** (label/description/timestamp) reads the ambient type scale (Display-class typography),
  unchanged; only the RAIL is sized by `(scale × size)`. The connector is a `connector-width` hairline (a NEW
  structural quantity, not `= font`); the marker dot is a compact-widget-scale glyph; a slotted marker icon
  reads the content-icon register (`--ui-icon-{size}`), matching the adia icon-replaces-dot mode.

**Recommendation: `size` is a first-class prop on all three tags; the marker system is a NEW explicit per-
`(scale × size)` `--ui-timeline-*` table (no multiplier); the connector-width is a new structural quantity.**
The exact integer rows are the SPEC/LLD's to fix (mechanized by a geometry-under-`[size]` probe asserting the
explicit values AND not assuming adjacent tiers are distinct — the ADR-0038 stepping lesson). **Rejected:
ambient-`[scale]`-only (no `size` prop)** — contradicts Kim's first-class directive and strands the durable
timeline (which has no interactive item height to borrow). **Rejected: a `pow()` multiplier off `size`** — the
ADR-0038 no-multiplier law; the fleet ships explicit tables.

### F3 — marker state vocabulary + non-color signifiers

The item carries a **`status` enum** — `['', 'pending', 'active', 'done', 'error']` (default `''` = neutral/
plain marker). This is ONE explicit set, chosen to reconcile the adia prior-art drift (its code said
`idle|active|completed|error`, its yaml said `idle|pending|done|failed` — the two disagreed, which is exactly
why the fleet declares the set explicitly): `pending` (queued, not started), `active` (in progress),
`done` (resolved OK), `error` (resolved failed). It maps cleanly onto the A2A `TaskState` machine as catalog
§guidance (never an import): `submitted→pending`, `working→active`, `completed→done`, `failed/canceled/
rejected→error`, `input-required/auth-required→active`, `unknown→active` (indeterminate — resolves on the next
concrete state; the mapping is TOTAL over the 9-member set) — a §guidance pairing, never a prop enum pinned to A2A
(the feed-family PRD's "no TaskState coupling in code" constraint).

Per **ADR-0057** (intent never travels by color alone — the L-matched intent ramps carry intent by hue, the
channel CVD removes), every `status` MUST carry a **non-color signifier**, not hue alone: the recommended
realization is a **marker SHAPE/glyph per state** — `pending` a hollow ring, `active` a filled dot + pulse (or
a spinner ring when the consumer opts in), `done` a check glyph, `error` a cross/`!` glyph — so the state
survives deuteranopia, achromatopsia, AND `forced-colors: active` (where the fill collapses and the shape is
the only channel left). The colored fill stays as the redundant, secondary channel. The exact glyphs are the
LLD's; the **rule** (a distinct shape per state, forced-colors-legible) is normative in the SPEC.

**Recommendation: `status = ['', pending, active, done, error]`, each with a distinct non-color marker shape
(ADR-0057); A2A `TaskState` mapping is catalog §guidance, never an import.** A free-form content-slot marker
(a consumer icon replacing the dot, the adia `slot="icon"` mode) coexists — it is the neutral/`''` path with a
richer glyph, orthogonal to `status`.

### F4 — the live data contract: **imperative append + keyed update-in-place + the completion invariant**

`ui-status-stream` exposes a **public imperative API** (the `ui-toast-region` `show()` precedent — a
liveness-owning host with an imperative method, not a bound reactive list). The ADR decides the *posture*
(imperative append + keyed update + a completion-invariant finalize); the LLD freezes the exact method
signatures and the `StatusEntry` shape (kept in one place to avoid an ADR↔LLD drift-pair):

- **`append(entry): UITimelineItemElement`** — the consumer pushes a structured entry record (`{ key, status?,
  label?, description?, timestamp?, icon? }`) AS its stream yields; the host creates a `ui-timeline-item`,
  assigns it, appends, and tail-follows to it. Returns the element (the `show()` return precedent).
- **`update(key, patch): void`** — a **keyed** mutation to an already-rendered entry: transition its `status`
  (running → done/error), replace/append its streamed text, or reveal its detail. Keyed identity is why this
  is imperative-append-with-update, NOT a bound reactive list — a bound list re-renders positionally and cannot
  express "the entry I appended is now in a new state" without the consumer owning a keyed diff anyway; the host
  owns the diff instead (the ADR-0024 positional-vs-keyed lesson: when identity is load-bearing, key it).
- **The completion invariant** — a `finalize()` / stream-ended signal marks any still-`active`/`pending` entry
  as **truncated** and SHOWABLE as such (a visible "interrupted" affordance), never silently stuck spinning
  (the B7 `feed-live-transport` tracked-completion doctrine — "a stream that ends without resolving must be
  showable as truncated" — applied to the DISPLAY layer). Fail-closed: a torn stream shows truncated, it does
  not lie "still working."

**Streaming TEXT within an entry** (chain-of-thought tokens) is supported v1 via `update(key, { text })` —
the host appends/replaces the entry's text; it **never parses prose, never tokenizes, never owns transport**
(the tickets' hard non-goal — "interpreting model output" and "owning the transport" are the consumer's). The
`aria-live="polite"` region announces on STATE transitions, not per-token (F1's role=log + a debounce/text-not-
announced discipline — token spam is the a11y failure to avoid).

**Recommendation: imperative `append` + keyed `update` + a `finalize`/completion-invariant truncation, a
string `key` identity; streamed text is an `update` patch, never parsed.** **Rejected: a bound reactive-list
data prop** — cannot express in-place transition or the completion invariant without the consumer re-owning
the keyed diff; the host is the honest owner of the reconcile (the `ui-toast-region` imperative-host precedent).

### F5 — catalog posture (SPLIT): **`Timeline`+`TimelineItem` emittable; `StatusStream` allowlisted**

Against the ADR-0087 catalog-or-allowlist gate and its ADR-0112 cl.6 exclusion test — *"is this page/app-owner
chrome an agent must never emit?"*:

- **`Timeline` + `TimelineItem` → EMITTABLE** (catalog rows land with the build). An agent-authored activity
  chronology (an order-tracking card, an audit log, a reasoning recap) is **core Gen-UI content-region
  vocabulary** — a durable snapshot of what happened, serializable as a one-shot component tree. The adia prior
  art HAS the catalog entry (`Timeline`/`TimelineItem`), the feed page hand-rolls exactly this, and it is
  unlike `ThemeProvider`/`Toast` (ambient page state). Catalog rows map the item attrs (`status`/`label`/
  `description`/`timestamp`/`icon`) + a `children` item list, the `Row`/adia model — an **a2ui-package build
  slice** (`a2ui-builder` seat); this ADR fixes the *posture*, the SPEC/LLD carry the rows as build deliverables.
- **`StatusStream` → NOT catalogued; an `EXCLUSION_ALLOWLIST` entry with reasons** (the `Toast`/`ToastRegion`
  cl.6 precedent). The live strip is driven by an **imperative streaming API the CONSUMER owns** (F4) — an
  agent emitting a Gen-UI payload emits a *durable `Timeline`* (a snapshot); the LIVE narration host is the
  app/shell narrating a stream it holds (imperative append/update, `role=log`, tail-follow, completion
  invariant) — none of which serialize into a one-shot A2UI component tree. It is app chrome, not emittable
  markup.

**Recommendation: `Timeline`+`TimelineItem` catalog rows (emittable); `StatusStream` allowlisted (reasoned).**
The coverage gate stays green with real rows for the two + one reasoned allowlist entry as the only residue —
the feed-family disposition pattern (ADR-0097) exactly.

### F6 — orientation, events, collapse

- **Orientation: vertical only in v1.** Horizontal is a **fenced, foreseen extension** — the adia prior art has
  it, but it drops the subgrid alignment rail (the family's whole geometry point) and has NO tail-follow meaning
  for the live host (a stream follows a vertical tail). A `horizontal` enum member is additive later
  (default-preserving), never a v1 rider.
- **Events.** `ui-timeline` is display-first — **no events** (`events: []`). The item's collapsible detail
  emits **`toggle`** (∈ the `change·input·select·open·close·toggle` allowlist), reusing the `ui-disclosure`
  `toggle` mechanism verbatim (the adia `timeline-toggle` custom event is renamed to the allowlisted `toggle` —
  a new event NAME is a fleet-contract fork the fleet does not take). `ui-status-stream` collapse of resolved
  entries emits `toggle` likewise. An interactive **"cancel this action"** affordance inside a live entry is a
  **fenced fork** (it would make an entry an interactive control, not a display row — a new intake).
- **Collapse/detail = reuse `ui-disclosure`.** The item's optional detail / one-level sub-steps (the adia
  `outcomes` expandable sub-list) is realized by composing a `ui-disclosure` (or its `open`/`toggle`
  mechanism), NOT a bespoke caret+`hidden` reimplementation. One nesting level v1 (flat + 1); deeper nesting is
  fenced. Timestamp is the **consumer's string** (the adia `time`/`duration` model), NOT a value-codec —
  formatting is the consumer's job (the ticket's lean).

**Recommendation: vertical-only v1; `events: []` on the hosts + `toggle` on the collapsible item detail
(disclosure reuse, no new event name); a "cancel action" affordance and horizontal orientation are fenced
additive extensions.**

## Consequences

- The fleet gains its **first event-rail family** and its **first live activity surface** — agents stop
  hand-composing chronologies from `Card+Row+Icon+Text`, the `a2a-artifact-feed` page's hand-rolled
  `.feed-timeline` gets a real primitive to promote onto (a named follow-up), and the feed-family PRD's
  activity vocabulary gains the live, in-progress member it lacked.
- **One shared `ui-timeline-item`** is authored once and hosted by both — the marker-system geometry (F2), the
  ADR-0057 signifiers (F3), and the collapsible detail (F6) exist in exactly one place. The two hosts diverge
  only where they mechanically must (ingress, scroll, role, motion), proving the toast/toast-region
  dumb-item + liveness-host pattern generalizes.
- **A new explicit `--ui-timeline-*` marker-system geometry** enters the geometry law (F2) — the second bespoke
  per-`(scale × size)` table after the calendar (ADR-0048), extending ADR-0038's dialect to a non-control,
  non-widget rail. `size` becomes a first-class prop on a Pattern-class family (the sized-entry precedent
  generalized), a deliberate divergence from the toolbar's ambient-only geometry, driven by Kim's directive.
- **`ui-status-stream` carries the fleet's first display-layer completion invariant** (F4) — the B7
  tracked-completion doctrine, previously a transport property, is now also a display guarantee (a torn stream
  shows truncated, never a forever-spinner). Its imperative `append`/`update`/`finalize` API is the second
  liveness-owning host after `ui-toast-region`.
- **Catalog splits** (F5): two emittable rows + one reasoned allowlist entry — the coverage gate stays green,
  the feed-family disposition pattern holds. The `Timeline`/`TimelineItem` rows are a2ui-builder slices.
- **Cost accepted:** three `controls/` folders, four site pages (`timeline-{doc,demo}`, `status-stream-{doc,
  demo}`) + two gallery specimens (the `tier: pattern` standing obligation), a new token-row set, and a live
  browser proof feeding a REAL NDJSON stream (the arena's is in-repo — F4's proof is runnable, not mocked).
  `npm run size` measured and pinned; the family budget re-bases by recorded amendment if material.

## Acceptance

The SPEC's requirements hold end to end: `npm run check`(+site) and `npm test` green including
`family-coherence.test.ts` and the new `timeline`/`timeline-item`/`status-stream` suites; the descriptor↔props
trip-wire green for all three; the **marker/connector/gutter geometry under `[size]`** proven cross-engine
(Chromium + WebKit) against the explicit F2 rows (asserting the integers AND not assuming adjacent tiers
distinct); the **whole-shape** proof per host (a populated timeline renders as a real rail with aligned markers;
a bare item is not a collapsed dot — the ui-slider whole-shape lesson); the `role="list"` (timeline) /
`role="log"` polite-live-region (status-stream) / `role="listitem"` (item) ARIA proven via internals; **a REAL
streamed proof** — `ui-status-stream` fed a live NDJSON source in a browser test (the arena stream, in-repo),
proving append + keyed transition + tail-follow + the completion-invariant truncation; the ADR-0057 signifiers
legible under `forced-colors: active`; the `Timeline`/`TimelineItem` catalog rows + the `StatusStream` allowlist
entry green under the a2ui coverage gate; `site-coverage.test.ts` green for the four new pages; independent
`component-reviewer` GO per host before the build commits.

## Alternatives considered

- **One `ui-timeline` with a `live`/`follow` boolean posture** — rejected (F1): cannot honestly flip
  `role=list`↔`role=log`, scroll ownership, the data contract, and the completion invariant on one attribute;
  two controls in a trench coat, against family-coherence.
- **Two fully independent families** (`ui-timeline`+item and `ui-status-stream`+its-own-item) — rejected (F1):
  ships the marker rail, the marker-system geometry, and the ADR-0057 signifier set twice — the tickets' "two
  overlapping components" duplication moved one layer down to CSS.
- **A `pow()` multiplier off `size` for the marker system** — rejected (F2): the ADR-0038 no-multiplier law;
  the fleet ships explicit per-`(scale × size)` tables.
- **Ambient-`[scale]`-only geometry, no `size` prop** (the toolbar F5 model) — rejected (F2): contradicts Kim's
  first-class `size` directive and strands the durable timeline, which has no interactive item height to borrow.
- **A bound reactive-list data prop for the live host** — rejected (F4): cannot express in-place status
  transition or the completion invariant without the consumer re-owning a keyed diff; the imperative host owns
  the reconcile (`ui-toast-region` precedent).
- **`StatusStream` as an emittable catalog type** — rejected (F5): a live imperative-API host narrating a
  consumer-held stream is app chrome, not a one-shot serializable tree (the `Toast`/`ToastRegion` cl.6 test).
- **Porting the adia `variant` + `status` dual axis and the `timeline-toggle` custom event** — rejected
  (F3/F6): `status` alone carries state (with ADR-0057 signifiers), a free `''` marker covers the `variant`
  cases, and the collapse event is the allowlisted `toggle` (disclosure reuse), never a new event name.
- **Horizontal orientation in v1** — rejected (F6): drops the alignment rail and has no tail-follow meaning; a
  fenced additive extension.

# ADR-0143 — `ui-timeline-item` gains recursive nesting, a shared accordion, and a collapsed-summary preview; unfences ADR-0122 F6

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-17
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-17 |
> | **Proposed by** | design seat ([TKT-0091](../tickets/tkt-0091-ui-timeline-nesting-accordion.md) intake — Kim's ask: `ui-timeline` items become nestable to arbitrary depth, a whole-step accordion, and a collapsed-step preview of its last nested descendant) |
> | **Ratified by** | — |
> | **Repairs** | on ratification+build: `packages/agent-ui/components/src/controls/timeline-item/timeline-item.ts` (+`.md`, +`.css`) gains the `[data-role="nested"]` adoption slot, extends the composed `ui-disclosure` to wrap it alongside `[data-role="detail"]`, and adds the collapsed-summary preview effect + observer · `.claude/docs/spec/timeline-family.spec.md` §3.1/§4 amended (append-only, this ADR's Decision is the delta) · `.claude/docs/lld/timeline-family.lld.md` §2 amended likewise · NO catalog change in this build (Fork F6 defers it, a named a2ui-builder follow-up) · [TKT-0091](../tickets/tkt-0091-ui-timeline-nesting-accordion.md) |
> | **Supersedes / Superseded by** | Extends [ADR-0122](./0122-timeline-family-and-live-status-stream.md) — unfences its F6 clause *"One nesting level v1 (flat + 1); deeper nesting is fenced"* to arbitrary recursion; ADR-0122's own body stays untouched (this is a new, append-only amendment record, not an edit to an accepted ADR). Reuses [ADR-0022](./0022-childpart-native-movebefore-reorder-focus.md) (adoption/move semantics), the `ui-disclosure` (ADR-0113 cl.4) composition ADR-0122 F6 already established, and the `data-last`/heal-observer `MutationObserver` class (`ui-toast-region`, `ui-disclosure`'s own heal observer). |

## Context

TKT-0091: `ui-timeline-item` steps should be **nestable** (a step hosts further sub-steps, recursively,
arbitrary depth) and **behave as a whole-step accordion** — not just today's flat "detail" slot. A
collapsed step with nested sub-steps should **preview the last nested item's content/status** rather than
hiding everything. Kim's own structural sketch:

```
[ico|title|note|trailing(also note/date)|caret]
[pipe|description-body               |trailing]
[pipe|nested-items                            ]
```

**Not greenfield.** `ui-timeline`/`ui-timeline-item` shipped 2026-07-10 (TKT-0010, ADR-0122). F6
explicitly fenced exactly this fork: *"Collapse/detail = reuse `ui-disclosure`... the item's optional
detail / one-level sub-steps (the adia `outcomes` expandable sub-list)... One nesting level v1 (flat +
1); deeper nesting is fenced."* Today's item composes a single flat `ui-disclosure` around a
`[data-role="detail"]` slot of free-form consumer content — not a recursive, typed nested `ui-timeline`.
This ADR is that fenced fork, unfenced.

**Verified against the real shipped source** (`timeline-item.ts`, `timeline.ts`, `disclosure.ts`, their
`.md` descriptors, `timeline-item.css`, and the a2ui `factories.ts` catalog rows — read in full, not
summarized) before any fork below was decided:

- `timeline.ts`'s `#markLastItem()` queries `:scope > ui-timeline-item` — **direct children only**. A
  nested `<ui-timeline>` composed inside an item therefore marks its OWN last child correctly, with
  ZERO code change, purely because the query is already scoped per-level.
- `disclosure.ts`'s `#ensureParts()` adopts **every** pre-existing light-DOM child into one `body` part —
  it does not distinguish content by `data-role`. Composing two adopted things (a `[data-role="detail"]`
  block AND a `[data-role="nested"]` `<ui-timeline>`) into the SAME disclosure therefore requires no
  change to `disclosure.ts` itself — only to `timeline-item.ts`'s own adoption order (append detail, then
  nested, into the disclosure host before disclosure's own `#ensureParts()` runs).
- `timeline-item.ts`'s existing `#ensureAnatomy()` already performs exactly this two-hop move for
  `detail` today (move into the disclosure host → disclosure's own connect adopts it into `body`) — the
  ADR-0022 move-semantics pattern this fork reuses is already proven in this exact file, not a new
  mechanism.
- The a2ui catalog's `timelineItemFactory` (`factories.ts:692-708`) is **deliberately** wired with NO
  `ChildList` key today — its own comment states why: *"a generic `ChildList` append has no mechanism to
  stamp that `data-role` onto emitted children, so wiring one here would silently misroute content."*
  Recursive nesting does not remove that gap; it adds a second slot (`nested`) the same gap applies to.

## Decision

Seven forks, each decided below with a firm recommendation (F5/F6 are the two contract-shaping ones):

### F1 — nesting mechanism: reuse `ui-timeline` itself, via a NEW `[data-role="nested"]` adoption slot

**Recommendation: a genuine nested `<ui-timeline>` child, adopted through a new `[data-role="nested"]`
slot on `ui-timeline-item` — not a bespoke recursive template.** Family-coherence bars a second nesting
primitive when one already exists and is directly reusable; `ui-timeline` already IS the durable,
authored-children-in-DOM-order host this needs, one level deeper. `nested` is a separate slot from
`detail` (not the same content, reinterpreted) — the sketch draws them as two distinct pipe-rows, and
keeping them as two distinct data-roles preserves `detail`'s existing "free consumer content" contract
untouched while giving `nested` a narrower, typed contract (its adopted child SHOULD be a
`<ui-timeline>` — unenforced at runtime, matching the fleet's convention of trusting authored markup,
same as `detail` today). **Naming the sketch mapping explicitly** (a doc-review finding): the sketch's
`description-body` pipe-row IS today's `[data-role="detail"]` slot, not the item's separate `description`
prop cell — that prop cell (`timeline-item.ts`'s `#renderContent()`, stamped, always-visible) stays a
header-area note OUTSIDE the disclosure, unchanged. `detail` does not get renamed or absorbed; the sketch
is simply illustrating today's existing detail content one row above the new nested-items row.

### F2 — whole-step accordion: ONE shared `ui-disclosure` wraps `detail` AND `nested` together

**Recommendation: extend the EXISTING composed disclosure (today scoped to `detail` alone) to also
adopt `nested`, in that order — not a second, independent disclosure.** The sketch's two pipe-prefixed
body rows sit under ONE caret; `disclosure.ts`'s body already adopts arbitrary children generically, so
this is a one-line anatomy change in `timeline-item.ts` (append both adopted parts to the disclosure
host before it self-assembles), not a `disclosure.ts` change. A disclosure materializes only when
`detail` and/or `nested` content exists at connect — an item with neither composes no disclosure at all,
exactly as today.

### F3 — collapsed-summary preview: reuse the existing `trailing` cell, live-updating via an observer

**Recommendation: when the item has `nested` content, is closed, and `trailing` is NOT consumer-owned,
auto-populate `trailing` with the last nested descendant's label + status-shape mirror; clear it while
open.** "Last nested descendant in DOM order" (the ticket's own resolved rule — no status-priority) means
recursing to the deepest last child: the last `ui-timeline-item` of the last nested `ui-timeline`,
drilling through ITS OWN `nested` slot if present, until a leaf item with no further `nested` child is
reached. A `MutationObserver` on the nested `ui-timeline`'s subtree (`{subtree:true, childList:true,
attributes:true, attributeFilter:['status','label'], characterData:true}` — the `data-last`/disclosure
heal-observer class already proven twice in this family) recomputes the preview on every relevant change,
regardless of open/closed state (cheap: a DOM read, no reflow); the disclosure's own `open` prop gates
whether the recomputed value is PAINTED into `trailing` or cleared — so the ticket's own open question
("does it live-update if the previewed descendant's status changes after the parent collapses") is
answered **yes**, and there is never a stale-then-flicker moment on collapse since the value was already
current. `trailing` remains the item's SAME existing cell (never a new prop, never a new slot) —
`#consumerOwned.has('trailing')` (already tracked today) is the exact gate that makes this auto-fill back
off the instant a consumer adopts `[data-role="trailing"]` themselves, no new mechanism needed there
either. The EXACT visual placement (trailing alone, vs. also mirroring into a header note cell) is left
to build time per the ticket's own Scope/Open — this Decision only fixes the MECHANISM and its data
source, not final pixels.

### F4 — connector/rail geometry through nesting: each level is a fully independent, self-contained rail

**Recommendation: NO cross-level visual connector continuity is attempted; a nested `<ui-timeline>`
paints its own complete rail (marker + connector) exactly as it does at the root, visually indented by
the disclosure body's own inline padding.** `timeline-item.css`'s connector (`[data-part='marker']::after`)
is a fixed-height segment bridging only `margin-block-end` between two SAME-LEVEL siblings — it has no
mechanism (and none is added) to span a disclosure's animatable open/closed height into a nested block. A
firm choice, not a punt, and an explicit OVERRULE of the sketch, named honestly: Kim's own wording says
the connector line "has to visually continue... per the sketch," and the sketch draws
`[pipe|nested-items]` as if the rail runs straight through. This Decision declines that reading —
attempting rail continuity THROUGH a collapsible region would require a JS-measured dynamic connector
height recomputed on every disclosure open/close, a real new geometry primitive the family's own
precedent (`timeline-family.lld.md §8`) already traded away once for the same reason ("alignment/rhythm
via inherited/local tokens, not subgrid"). Zero changes to `timeline-item.css`'s existing connector
rules; the nested `ui-timeline`'s own items are simply a complete, independently-railed list one
indentation level in, visually distinguished from the parent rail by indentation rather than continuity.
Ratification should weigh this overrule explicitly, not discover it only in the CSS diff.

### F5 — ARIA: reuse native `<details>` collapse semantics; zero new ARIA machinery

**Recommendation: no new ARIA work beyond what shipped code already provides.** The nested
`<ui-timeline>` keeps its own `internals.role = 'list'` (set unconditionally in `timeline.ts`'s
constructor today — unchanged) nested inside the outer item's `role="listitem"`, forming a legal
`list > listitem > list > listitem…` structure. Native `<details>` already removes closed content from
BOTH the accessibility tree and the tab order — the exact "a collapsed step must not expose its
collapsed descendants" requirement the ticket names, delivered for free by the platform, the same
guarantee `ui-disclosure.md`'s contract already documents for today's flat `detail` case. The
collapsed-summary preview text (F3) lives in `trailing`, OUTSIDE the disclosure, in the always-rendered
header row — it needs no ARIA treatment beyond being ordinary visible text, since making it visible
(never `aria-hidden`) while collapsed is precisely its job.

### F6 — catalog impact: deferred, a named follow-up build slice, not this ADR's build

**Recommendation: this Decision fixes the COMPONENT-level mechanism only; wiring `[data-role="nested"]`
into the A2UI catalog (`timelineItemFactory`) is an explicit, separate a2ui-builder slice, NOT part of
this ticket's decomposition.** `timelineItemFactory` already has zero `ChildList` wiring for the SAME
structural reason (`factories.ts`'s own comment) that would apply to `nested` — a generic `ChildList`
cannot stamp `data-role` onto emitted children today. Solving that is a real, separable catalog-mapping
problem (how an agent-composed payload authors a *typed* nested child, not free content) that deserves
its own intake once the component-level mechanism above has shipped and been used — mirroring ADR-0122
F5's own split ("this ADR fixes the posture, the SPEC/LLD carry the rows as build deliverables").
Recursive nesting is therefore native-authoring-only in this build, exactly as `detail`/`marker`/
`trailing` already are today.

### F7 — `size` at nested levels: does NOT cascade; each nesting level re-authors its own

**Recommendation: `size` does not propagate from a parent `ui-timeline-item`/`ui-timeline` into a nested
`<ui-timeline>` — an unauthored nested timeline defaults to `size="md"` exactly like a root one, and a
consumer who wants a smaller nested register sets `size="sm"` on the nested `<ui-timeline>` (and/or its
items) explicitly.** This closes the ticket's own open question (Scope/Open: "does `size` cascade… or
must each nesting level re-author?") left unresolved through the first review pass — flagged and fixed
here before ratification, not silently shipped as a gap. No cascade is the same "trust authored markup,
no implicit inheritance" posture the family already applies to `detail`/`nested` content generally (a
consumer's markup is never silently re-styled by a parent's props), and it needs ZERO new mechanism — no
prop-forwarding code, no CSS custom-property cascade beyond what already exists (each `ui-timeline-item`
already reads its OWN `[size]` attribute for its own marker-system row; a nested item simply does the
same at its own DOM position, independent of its ancestor's `size`). A visually-nested, unauthored-size
timeline will render at the SAME marker/dot/gutter scale as its parent by coincidence of shared default,
not by any inheritance mechanism — worth a one-line callout in the built doc page, not a behavior change.

### A confirmed no-op — terminal-connector marking needs no change

`timeline.ts`'s `#markLastItem()` is `:scope > ui-timeline-item`-scoped (direct children only, verified
above) — a nested `<ui-timeline>` automatically, correctly marks its OWN terminal item via the SAME
existing observer, at every nesting level, with zero code change. Named here so a builder does not
"fix" something that already works.

## Consequences

- `ui-timeline-item`'s anatomy grows one adoption slot (`nested`) and one new effect (the
  collapsed-summary observer); its composed-disclosure logic generalizes from "adopt `detail`" to "adopt
  `detail` then `nested`, if either exists."
- `timeline-family.spec.md` §4's *"Deep nesting (> 1 level of sub-steps)… fenced new intake"* non-goal
  and §3.1's anatomy section are amended (append-only blockquote note, this ADR is the delta record —
  the accepted body stays as shipped, per this repo's amendment discipline).
- No catalog change ships with this build (F6) — `Timeline`/`TimelineItem` stay native-authoring-only
  for the new slot until a follow-up a2ui-builder intake resolves the typed-child mapping.
- `ui-status-stream` (the live sibling) is explicitly untouched — the ticket's own non-goal, unchanged
  by this Decision.

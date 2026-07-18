---
doc-type: ticket
id: tkt-0091
status: done
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0091 — `ui-timeline`: recursive nesting, per-step accordion, and collapsed-summary preview

## Summary
Kim's ask (2026-07-17): `ui-timeline` items should be **nestable** — a step can host further
sub-steps, recursively (arbitrary depth) — and **each step should behave as an accordion**
(the whole step expands/collapses, not just today's flat "detail" slot). A collapsed step
that has nested sub-steps should **preview the last nested item's content/status** rather than
hiding everything. Kim's own structural sketch (verbatim):

```
[ico|title|note|trailing(also note/date)|caret]
[pipe|description-body               |trailing]
[pipe|nested-items                            ]
```

— a header row (marker/title/note/trailing/caret) plus two pipe-prefixed (rail-connector) body
rows: description, then a recursive nested-items row.

**Dedup: NOT greenfield.** `ui-timeline` / `ui-timeline-item` shipped 2026-07-10 (TKT-0010,
ADR-0122, commit `8cb316b`). ADR-0122's F6 explicitly fenced exactly this fork: *"Collapse/detail
= reuse `ui-disclosure`... One nesting level v1 (flat + 1); deeper nesting is fenced."* Today's
item composes a single flat `ui-disclosure` "detail" slot — not a recursive nested `ui-timeline`.
This ticket is that fenced fork, now being unfenced.

**Scope resolved (one batched clarifying round, 2026-07-17):**
- **Nesting depth:** arbitrary recursion — a nested `ui-timeline`'s items can themselves nest
  further. NOT capped at flat+1.
- **Family scope:** `ui-timeline` (durable) only. `ui-status-stream` (the live sibling sharing
  the `ui-timeline-item` atom, TKT-0013) is explicitly OUT of scope — a separate ticket if/when
  live nesting is needed.
- **Collapsed-preview rule:** the last nested descendant in DOM order (no status-priority
  logic — a plain "last child wins", matching the wording of the ask).

## Acceptance
- A design intake (`agent-ui-component-design` skill / `system-planner`, same pattern as TKT-0010's
  ADR-0122 intake) resolves before any build:
  - Whether recursive nesting is realized as a genuine nested `<ui-timeline>` child composed
    inside `ui-timeline-item`, vs a bespoke recursive slot — precedent leans toward reusing
    `ui-timeline` itself (family-coherence law: no second nesting primitive).
  - Whole-step accordion mechanics: does this **extend** the existing composed `ui-disclosure`
    (today scoped only to the "detail" slot) to also wrap the nested-items row, or is it a second,
    independent disclosure? The sketch's two pipe-prefixed rows (description, nested-items) under
    ONE caret suggests a single disclosure now wraps both.
  - The collapsed-summary behavior: when a step with nested items collapses, its own header row's
    trailing/note cell must surface the last nested descendant's status/content — genuinely new
    behavior with no current precedent; needs a mechanism (an observer akin to the existing
    `data-last` `MutationObserver` pattern) and an ARIA treatment (a collapsed list item
    summarizing hidden descendants without misrepresenting them as present in the accessibility
    tree).
  - Terminal-connector suppression (today's `data-last` marking) must extend sanely per nesting
    level — the pipe/connector line has to visually continue through a nested block per the
    sketch, and the "last child" rule now applies at every level, not just the root rail.
  - ARIA implications of recursion: nested items are themselves `role=listitem` inside a nested
    `role=list` — a legal nested-list structure for AT, but a collapsed step must not expose its
    collapsed descendants to the accessibility tree (matching `ui-disclosure`'s existing
    hidden-content contract).
  - Catalog impact: `Timeline`/`TimelineItem` are already emittable (ADR-0122 F5) — whether
    recursive nesting changes their A2UI catalog shape (a `ChildList`-style recursion in the
    emitted schema) is a question for the intake, not this ticket.
- The shipped extension meets the full per-control bar: descriptors updated, jsdom + cross-engine
  browser probes (incl. whole-shape recursion + collapsed-preview + connector geometry through
  nesting), independent review, barrels/exports/size, doc + demo pages updated.
- ADR-0122 is **amended**, not silently contradicted, to record the unfencing of F6 (the
  append-only/amendment discipline for an accepted ADR — `agent-ui-doc-standards`).

## Links
- TKT-0010 (`tkt-0010-ui-timeline.md`, done) — the family's original ticket.
- ADR-0122 (`../adr/0122-timeline-family-and-live-status-stream.md`) — F6's "deeper nesting is
  fenced" clause, being reopened here.
- `../spec/timeline-family.spec.md` · `../lld/timeline-family.lld.md` — the specs this extension
  amends.
- `packages/agent-ui/components/src/controls/timeline/timeline.ts` (+ `.md`) and
  `.../timeline-item/timeline-item.ts` (+ `.md`) — the current shipped source this extension
  modifies.
- `.claude/skills/agent-ui-component-design/` — the intake procedure that must run before build
  (same sequencing as TKT-0010).

## Scope / Open
- **Open:** the exact composed-disclosure structure (one disclosure wrapping
  description+nested-items vs today's single "detail" slot — does "detail" survive as a distinct
  third thing, or does "description" absorb it?); the collapsed-summary cell's exact placement
  (trailing? note? both?) and whether it live-updates if the previewed descendant's own status
  changes after the parent collapses; per-nesting-level `size`/geometry (does `size` cascade to
  nested items, or must each nesting level re-author `size`?).
- **Non-goal:** `ui-status-stream` (live family) nesting — explicitly deferred to a future ticket
  per this session's scope ruling.
- **Non-goal:** data-driven recursive generation — nested items remain authored children
  (consistent with TKT-0010's "no data array prop" ruling), same as the flat family today.
- **Sequencing:** design intake first (`system-planner` / `agent-ui-component-design`); no build
  from this ticket directly.

## Findings

**2026-07-17 — design intake complete, per this ticket's own Acceptance sequencing (design BEFORE any
build).** Ran the `agent-ui-component-design` procedure end to end against the real shipped source
(`timeline-item.ts`, `timeline.ts`, `disclosure.ts`, their `.md` descriptors, the a2ui
`timelineItemFactory`, ADR-0122, `timeline-family.spec.md`/`.lld.md` — read in full, not summarized).

- **[ADR-0143](../adr/0143-timeline-item-recursive-nesting-accordion.md)** (proposed — awaits Kim's
  ratification) resolves all seven named forks with firm recommendations: F1 a new
  `[data-role="nested"]` slot reusing `ui-timeline` itself (the sketch's `description-body` row maps
  to today's existing `detail` slot, not the item's separate `description` prop cell) · F2 ONE shared
  composed `ui-disclosure` wraps `detail` then `nested` · F3 the collapsed-summary preview reuses the
  EXISTING `trailing` cell (resolves this ticket's own open "does it live-update" question: yes, via a
  `MutationObserver`, painted only while collapsed) · F4 each nesting level paints its own independent
  rail, zero CSS connector changes — an explicit, honestly-named OVERRULE of the sketch's own
  continuing-pipe wording · F5 zero new ARIA — native `<details>` already excludes closed descendants ·
  F6 catalog wiring is an explicit, DEFERRED a2ui-builder follow-up, not this build · F7 `size` does
  NOT cascade into nested levels — each re-authors its own, resolving this ticket's own open
  size-cascade question. A genuinely useful negative finding: `timeline.ts`'s terminal-connector
  marking (`:scope > ui-timeline-item`) is ALREADY correctly per-level-scoped — confirmed no code
  change needed there at all.
- **Independent doc review ran a fix-then-ship pass** (`scribe:doc-reviewer`, generator ≠ critic):
  re-verified every technical claim above directly against the real shipped source (independently
  confirmed all TRUE — no fabricated citations, no strawmanned ADR-0122 quote) and caught one real
  gap before ratification — this ticket's own `size`-cascade question (Scope/Open) had gone
  unanswered in the ADR's first draft despite the Findings claiming completeness. Fixed as F7 above,
  plus two honesty-of-record wording fixes (F4's overrule now named explicitly rather than
  soft-pedaled; the §3.2→§2 mis-cite below fixed) before this ticket's own Findings were finalized —
  not shipped with the gap silently present.
- `timeline-family.spec.md` §4 and `timeline-family.lld.md` §2 amended (append-only blockquote
  notes, matching this repo's PRD-amendment discipline — the accepted bodies below stay untouched).
- **[timeline-item-nesting-accordion.decomp.json](../decompositions/timeline-item-nesting-accordion.decomp.json)**
  — plan-mode, `coverage_check.py --strict`: 16 nodes / 13 actions / 13 hosts / 11 edges, clean
  (grew by one leaf post-review, F7's size-non-cascade negative control). Scoped
  to `timeline-item.ts`/`.css`/`.md` only (timeline.ts/disclosure.ts/status-stream.ts confirmed
  untouched); every leaf carries a checkable jsdom or cross-engine accept predicate; the last node
  gates the whole build on an independent component-reviewer GO.
- **No build dispatched from this ticket** — per Acceptance, ADR-0143 needs Kim's ratification first;
  the decomposition above is the ready-to-dispatch build sequence once that lands.

**2026-07-18 — build shipped (commit `a726a8b`), closing the loop ADR-0143's ratified design opened.**
ADR-0143 was ratified (`status: accepted`) and the decomposition above dispatched: `timeline-item.ts`
gained the `[data-role="nested"]` slot (F1), the shared detail+nested `ui-disclosure` composition (F2),
the recursive `#resolveLastDescendant()` + `MutationObserver`-backed collapsed-summary preview painted
into the existing `trailing` cell (F3), and F7's size-non-cascade negative control — `timeline-item.css`
confirmed byte-unchanged (F4) and zero new ARIA added (F5), both verified directly, not assumed. `nested`
joined the `data-role` registry (`naming.md` §6) in the same change. Every decomposition leaf (n2-n19) has
jsdom and/or cross-engine browser coverage; `npm run check && npm test` green (6391/6391, incl.
family-coherence/barrels/layering/naming-gates); browser suite 34/34 across Chromium + WebKit; `timeline-item`'s
own `npm run size` marginal measured at 0 B gz (no measurable growth). An independent `ui:component-reviewer`
pass returned **GO** against ADR-0143's fork sheet, with a handful of low-severity, non-blocking findings —
one (an over-broad `#resolveLastDescendant` query risking a false match inside free-form `detail` prose) was
fixed before this commit; the rest are discretionary follow-up, not required for this ticket's own Acceptance.
Catalog wiring (F6) remains the deliberately deferred a2ui-builder follow-up named in the ADR — not this
ticket's scope. **Separately noted, not fixed here (pre-existing, unrelated):** `npm run size` also reports
`@agent-ui/app` over its marginal budget — confirmed present on `origin/main` with zero TKT-0091 changes
applied, so it is a standing regression this build did not cause and does not fix.


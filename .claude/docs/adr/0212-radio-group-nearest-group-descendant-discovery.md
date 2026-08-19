# ADR-0212 — `ui-radio-group` child discovery widens from direct-children to nearest-group-scoped descendants: one logical radio system across visual groups (GH #1365)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-19
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-19 |
> | **Proposed by** | planning-leader seat (design intake GH [#1365](https://github.com/kimgranlund/agent-ui/issues/1365), the 2026-08-18 preset-vs-catalog gap analysis's cross-group-selection item) — ruled ADR-earned, not teaching-gap, on the jsdom probe evidence in #1365's Findings: depth registration is HALF-connected today (the radio finds the group; the group never commits), a live silent-failure class the unconstrained `ChildList` wire already exposes |
> | **Ratified by** | *pending — Kim ratifies (`ratify ADR-0212` utterance, `scripts/adr_ratify.py` per ADR-0149)* |
> | **Repairs** | on ratification+build (not authored here): `controls/radio/radio-group.ts` (`#radios()` + the delegated-change commit filter + `resolvePendingValue`/`#applySelection` riders — all five consumers of the child set ride the ONE widened query) · `controls/radio/radio.ts` (`grouped()`'s sibling scan + tabindex correction adopt the same nearest-group rule) · `controls/radio/radio-group.md` (the "direct children" contract paragraphs) · `a2ui-catalog.spec.md` §5.2 RadioGroup row (children may sit at depth through layout containers) · radio-group jsdom + browser test legs named in §Acceptance · ADR-0103 gains the `Extended by ADR-0212` backlink · one node-idioms teaching card (the now-functional `RadioGroup > visual containers > Radio` idiom — routes to the a2ui-prompt-authoring backlog, the PR #1362 family) |
> | **Supersedes / Superseded by** | **Extends** [ADR-0103](./0103-radio-group-owns-layout-form-provider-teaches-wrap.md) (its layout decision stands byte-intact — the group still owns its interior flex layout on its DIRECT children; only its supporting premise "cannot be fixed by composition / the interposed wrap severs discovery" is retired by this widening, and its Alternatives' "teaching a destructive idiom" rejection becomes moot because the idiom stops being destructive) · relates [ADR-0095](./0095-ui-segmented-control-standalone-component.md) (`UISegmentedControlElement` inherits the widened discovery unchanged) · [ADR-0050](./0050-form-provider-context-registration.md) (the contrast case: event-bubbling registration already spans depth — this record brings the radio family to parity by query, not by a second registration mechanism) · PR [#1334](https://github.com/kimgranlund/agent-ui/pull/1334) (`#pendingValue`/`resolvePendingValue`, which this record's widened set makes depth-correct) · GH #1365 (the intake; probe evidence in its Findings) |

## Context

**The shape that cannot be expressed.** agent-admin's model-grid
(`packages/agent-ui/app/src/controls/agent-admin/agent-admin.md`, `model-grid` part) renders
provider-grouped rows — `[ label | include ui-switch | default ui-radio ]` per model — with **one
logical radio system spanning all provider groups** (rev.3: "one logical radio system across the
provider groups"). Today the app hand-rolls it: standalone `ui-radio` elements, no
`ui-radio-group` at all; checking a row writes `model` to the store and the grid re-renders
wholesale. On the A2UI wire the same shape has no clean expression: the catalog's `RadioGroup`
coordinates only its **direct** `Radio` children, so a cross-group single selection means one
giant flat RadioGroup fighting the visual grouping, or hand-rolled `Radio`+value wiring.

**The mechanics, verified empirically (GH #1365 Findings, jsdom probe against the real controls
at `5fd45a51` — the post-#1334 source).** Registration at depth is **half-connected**, an
asymmetry between the radio side and the group side:

- **Radio side reaches at depth.** `radio.ts`'s `grouped()` finds its group via
  `this.closest('[data-radio-group]')` — an interposed `Column`/`Card`/`div` is transparent to it.
  Probe B0: PASS. The capture-phase already-checked click guard therefore ALSO arms at depth.
- **Group side is direct-children-gated.** `radio-group.ts`'s `#radios()` is
  `[...this.children].filter(el instanceof UIRadioElement)`; roving items, the delegated-change
  commit, the `value` setter/`#applySelection`, `resolvePendingValue`, and validity all ride that
  set. Probes at depth, all FAIL:
  - **B1** nested click: the radio checks itself, `group.value` stays `null`.
  - **B2** exclusivity: clicking a second nested radio leaves **two radios checked** in one group.
  - **B3** the group's delegated listener `stopImmediatePropagation`s the nested radio's `change`
    BEFORE discovering `indexOf === -1` — outside listeners see **nothing**, and no commit runs.
    Silent state divergence, not graceful degradation.
  - **B4** arrow-key roving: no-op (`items` is empty).
  - **C1** programmatic `value` write: cannot select a nested radio.
  - **D1** `#pendingValue` (the fresh #1334 value-before-children fix): never resolves for a
    nested late child (`resolvePendingValue` bails on `indexOf === -1`).
- Flat-children baseline probes (A1/A2): PASS — the harness itself is sound.

**The wire already permits the broken shape.** The default catalog's RadioGroup row declares
`children: "ChildList"` — unconstrained; `renderer/validate.ts`/`checks.ts` carry no
RadioGroup-child rule; and the renderer mounts children by plain `el.appendChild(...)`
(`renderer/tree.ts:308/332/341`), so DOM ancestry is faithfully preserved. A producer can emit
`RadioGroup > Column > Radio` **today** and gets the half-connected state above — a live
correctness hazard, not merely an expressiveness gap.

**The precedent this extends.** ADR-0103 ratified that the group owns its interior layout
PRECISELY BECAUSE its discovery was direct-children ("a model that wraps the radios in a
`Column gap` inside the group severs discovery — grammatically expressible but functionally
destructive"). It decided layout ownership; it did not decide cross-group selection, and it left
the wire hazard open. ADR-0050 is the contrast case: `ui-form-provider`'s connect-time
registration EVENT bubbles, so it spans depth by construction — the radio family's query-based
discovery is the one registration idiom in the fleet that doesn't.

## Decision

**We widen `ui-radio-group`'s child discovery from direct children to nearest-group-scoped
descendants, keeping ONE association mechanism and changing zero wire surface.** Concretely:

1. **`#radios()` becomes the nearest-group-scoped descendant set, in tree order:** every
   `UIRadioElement` descendant whose nearest `[data-radio-group]` ancestor is THIS group
   (conceptually `[...this.querySelectorAll('*')].filter(el => el instanceof UIRadioElement &&
   el.closest('[data-radio-group]') === this)`; the build may realize it more cheaply). The
   nearest-group test is the SAME rule `radio.ts`'s `closest()` already applies from the child
   side — the two sides of the registration finally agree. A nested inner `ui-radio-group` is
   therefore an ownership BOUNDARY: its radios belong to it, never to the outer group.
2. **All five group-side consumers ride the one widened set** — roving-focus `items`, the
   delegated-change commit (its `#radios().indexOf(target)` filter now doubles as the
   nearest-group ownership check; an unowned radio's `change` passes through un-swallowed), the
   `value` setter/`#applySelection`, `resolvePendingValue`, and `formValidity`/`formReset`. No
   second mechanism, no new registration event.
3. **`radio.ts` adopts the same rule** in `grouped()`'s late-append tabindex correction (its
   sibling scan reads `group.children` today — same direct-children bug, same fix).
4. **ADR-0103's layout law stands unchanged.** The group's `@scope` flex + `--ui-radio-group-gap`
   applies to its DIRECT children, whatever they are: an interposed visual container becomes the
   layout unit — exactly the model-grid shape (provider cards as the group's flex children, radios
   inside rows inside them). The taught Column-gap-inside-the-group idiom ADR-0103 had to reject
   as destructive becomes the SUPPORTED idiom; a node-idioms teaching card records it (Repairs).
5. **Zero wire/catalog change.** The RadioGroup row's `ChildList`, its props, and its
   `value:{prop,event}` bind are byte-untouched; depth-nesting is a semantics repair under the
   existing grammar, not a widening of it.
6. **ARIA/keyboard stance, stated:** `role='radiogroup'` stays on the group; arrow-key roving
   spans the OWNED radios in tree order, skipping interleaved non-radio content (a Switch in the
   same row is tab-reachable on its own, exactly like native radios interleaved with other
   controls in one `<form>`). Selection-follows-focus (the APG contract) is unchanged.

`UISegmentedControlElement` (ADR-0095) inherits the widened discovery unchanged; segments at
depth become functional rather than half-connected — harmless, and no shipped surface composes
them that way.

## Acceptance

- The six failing probes from #1365's verification flip green as named jsdom legs
  (radio-group.test.ts): nested click commits the group value (B1) · cross-container exclusivity
  (B2) · exactly ONE group-re-emitted `change` escapes per nested commit (B3) · arrow roving
  spans nested radios in tree order (B4) · programmatic `value` selects a nested radio (C1) ·
  `#pendingValue` resolves for a nested late-appended child (D1).
- Ownership-boundary leg: an inner `ui-radio-group`'s radios never join the outer group's set
  (value, exclusivity, and roving all respect the boundary) — the anti-vacuous negative control.
- The existing flat-children suite passes byte-unchanged (direct children are the degenerate case
  of the widened query).
- Browser leg: exactly-one-tabindex=0 roving across an interposed container, incl. the
  late-append correction (`radio.ts` clause 3).
- `npm run check && npm test` + the radio browser shard green, judged by exit codes.

## Consequences

- **A behavior change only for shapes that were silently broken.** Measured reliance on the old
  behavior: none plausible — the half-connected state committed no value, emitted no observable
  `change`, and left two radios checked; no shipped seed, site page, or test composes radios at
  depth under a group (the app's model-grid deliberately avoids the group entirely).
- **The #1365 model-grid shape becomes wire-expressible** (`RadioGroup > provider containers >
  rows > Radio`) with the include-Switches riding the same rows — closing the gap-analysis item
  without a new catalog type. Whether agent-admin's own host-side grid migrates is a separate,
  unforced follow-up.
- **`radio-group.md` loses its "direct children" contract language**; ADR-0103's file gains the
  `Extended by` backlink; `a2ui-catalog.spec.md` §5.2's RadioGroup row gains the depth note
  (Repairs cell).
- **The teaching leg is real but SECONDARY:** the idiom card (Repairs) lands after the widening
  ships — teaching the idiom today would teach the destructive half-connected state ADR-0103
  already refused to teach.
- **Cost/risk:** `#radios()` moves from an O(children) scan to a scoped descendant query,
  re-read per interaction — the same re-read-on-each-call discipline the current code already
  states; group subtrees are small. The nearest-group filter guarantees no cross-group capture.

## Alternatives considered

- **Teaching gap — no change (the intake's own first hypothesis).** Rejected on the probe
  evidence: this is not an unknown idiom awaiting documentation; the mechanism genuinely cannot
  span the shape, and the half-connected failure is silent and destructive (two checked radios,
  swallowed events). There is nothing correct to teach.
- **`name`-based association (the native-radio model): standalone Radios sharing a `name`,
  coordinated by a form/provider scope.** Rejected: mints a SECOND association mechanism beside
  the group (who owns form value, validity, roving, and the `change` re-emit becomes ambiguous),
  needs new wire surface (a bindable coordinator or per-radio `name` semantics), and ADR-0050's
  provider is deliberately a pure coordination element with no value ownership (ADR-0103 clause
  4) — promoting it to radio-value owner reverses that ratified stance for a shape clause 1
  already covers.
- **WONTFIX — rule it host-chrome, add a validator guard against nested Radios.** Rejected: keeps
  the model-grid shape inexpressible on the wire, leaves agent-admin's hand-rolled wiring as the
  permanent answer, AND still requires new validator surface to patch the silent hazard — more
  machinery to keep the defect than clause 1 spends removing it.
- **Renderer-side repair (flatten/re-project nested Radios up to the group).** Rejected: invents
  DOM the model never composed — breaks payload↔DOM faithfulness, the same rejected
  renderer-injection class as ADR-0102/ADR-0103.
- **Catalog child-type restriction (RadioGroup accepts only Radio children).** Rejected: patches
  the hazard by foreclosing exactly the shape #1365 asks for, and narrows an already-shipped
  `ChildList` contract (a wire-compat break for any existing depth-composing payload, which would
  START failing validation instead of starting to work).

# ADR-0157 — the anatomy-attribute axis vocabulary: `data-part` = anatomy · `data-slot` = composition slot · `data-*` state/variant axes · `part` reserved for shadow DOM

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-23
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-23 *(authored)* |
> | **Proposed by** | GH #217 — Kim's `data-part` convention analysis (2026-07-23, autonomous fork) ruled the vocabulary; this record is the docs-only capture of that ruling, per the issue's own scope ("not a new convention — documentation of the existing one") |
> | **Ratified by** | *(pending — Kim's flip: the in-tree Status edit, or a `ratify ADR-0157` GitHub utterance executed by `scripts/adr_ratify.py`, ADR-0149)* |
> | **Repairs** | [`../references/naming.md`](../references/naming.md) §6 *(the per-axis registry home — on ratification it gains the `data-slot` + state/variant-axis + `part`-reserved lines cross-cited to this record; its existing `data-part`/`data-role` rows stand unchanged)* |
> | **Supersedes / Superseded by** | Relates [ADR-0012](./0012-button-anatomy-trailing-adornment-slot.md) *(the adjacent `data-role` content-kind axis — untouched, see the Decision's boundary note)* · [ADR-0151](./0151-named-shell-archetypes-m5.md) / [ADR-0154](./0154-shell-grammar-resizable-pane-tab-collapse.md) *(the shell grammar that is this vocabulary's densest use site)* · shell-archetypes SPEC-R12 + GH #197 *(the attribute-selector algebra this vocabulary underwrites)* |

The fleet's light-DOM anatomy attributes are fixed as four axes: **`data-part`** names which part of its
owner's built chrome a node is (anatomy); **`data-slot`** is the consumer-side composition-slot claim;
further **`data-*` attributes** (`data-side`, `data-active`, `data-segment`, …) carry a part's state or
variant as orthogonal single-attribute axes; and the native **`part`** attribute is RESERVED for any
future shadow-DOM surface — zero uses today, never repurposed for light-DOM anatomy. This documents the
settled convention; no code changes ride this record.

## Context

The fleet is light-DOM by default with ARIA routed through `ElementInternals` (CLAUDE.md's standing
convention), so the shadow-DOM part machinery (`part` / `::part()`) never applied — a repo-wide grep
(2026-07-23) finds zero `part="…"` / `::part` uses in `packages/` — and the anatomy vocabulary grew as
`data-*` attributes instead. By now that vocabulary is settled practice across two packages:

- **`data-part`** — a control stamps the chrome it builds and selects it in its own sheet:
  `components/src/controls/disclosure/disclosure.ts:16-21` (the anatomy comment) + `:191-197` (the
  `details`/`summary`/`chevron` stamps); `app/src/controls/super-shell/super-shell.ts:261-299` (`frame` ·
  `bar` · `bar-content` · `middle` · `scrim`), selected as `[data-part='…']` throughout
  `super-shell.css:77-123`. [`naming.md`](../references/naming.md) §6 already carries its row
  (control-CREATED anatomy; kebab NOUNS; every rendered part declared in the descriptor's `parts:`), and
  the truthfulness gate is live (`components/src/controls/naming-gates.test.ts:508` — every real
  `[data-part]` a live-constructed control renders must appear in the fleet's declared `parts[]` union).
- **`data-slot`** — the consumer-side axis: a composer marks which of the owner's slots a light-DOM child
  fills, and the owner reads it at adoption (`super-shell.ts:12` — `data-slot="header|global-nav|nav-pane|
  section-nav|…"` — and `:248`). Stamped by the child's AUTHOR, where `data-part` is stamped by the OWNER.
- **State/variant axes** — orthogonal `data-*` attributes alongside a node's part/slot identity:
  owner-stamped state such as `data-side` (`super-shell.ts:309`; selected as
  `[data-part='pane'][data-side='start']`, `super-shell.css:137-138`) and
  `data-segmented`/`data-segment`/`data-active` (`super-shell.css:235-241`, `agent-admin.ts:398`), plus
  consumer-declared variant overrides such as `data-landmark` (`super-shell.ts:85-89`, ADR-0083's
  role-override pattern per ADR-0156 cl.3).

GH #217's fork asked whether `data-part` should remain the anatomy channel at all, audited the
alternatives, and ruled it stays. Two realized precedents make the attribute algebra load-bearing rather
than cosmetic. First, uniform single-attribute selectors each weigh **(0,1,0)**, so anatomy/state selector
compositions have specificity arithmetic anyone can reason about — the GH #197 fix reasoned in exactly
that algebra (super-shell's `[data-segmented] > [data-segment][data-active]` at (0,3,0) silently
clobbering agent-admin's `[data-role='settings-content']` at (0,1,0); the repair and its rationale comment
live at `super-shell.css:224-241`). Second, shell SPEC-R12b (the dual-role ownership law,
[`shell-archetypes-m5.spec.md`](../spec/shell-archetypes-m5.spec.md) §10) presupposes that the shell's
mechanics live on shell-owned attributes the consumer never contests. The same attributes also realize the
fleet's ownership split — attributes are component anatomy, classes are consumer territory: component
sheets select only their own stamped attributes, while consumer sheets key off consumer classes
(`site/pages/a2ui-live.css`'s `.chat-pane`/`.canvas-pane` pane rules, ADR-0156 cl.4; SPEC-R12a's
tag-qualified class-override law).

## Decision

The anatomy-attribute vocabulary is fixed as **four axes**; future components follow this partition.

1. **`data-part` = anatomy** — which named role a node plays in its owner's built chrome. Stamped by the
   OWNER on chrome it creates; kebab nouns; descriptor-declared and gate-enforced (naming.md §6, the
   `naming-gates.test.ts` truthfulness gate). It stays: it is the de-facto industry convention for
   light-DOM anatomy (Ark/Zag use literally `data-part`; Radix/Base/Headless likewise ride data
   attributes — the GH #217 audit's finding), and every alternative is strictly worse (see Alternatives).
2. **`data-slot` = composition slot** — the CONSUMER's claim of which owner slot a light-DOM child fills.
   The complementary direction to `data-part`: author-stamped input, not owner-stamped output.
3. **`data-side` / `data-active` / `data-segment` / etc. = state/variant axes** — each state or variant
   is its own orthogonal single-attribute `data-*` axis alongside the node's part/slot identity, never
   encoded into a part name, a class, or a compound value. This is what keeps the selector algebra
   uniform: every axis contributes exactly (0,1,0).
4. **`part` = RESERVED** — the native attribute (and `::part()`) is shadow-boundary machinery; the fleet
   holds it unused for any FUTURE shadow-DOM surface. It is never repurposed as a light-DOM anatomy
   channel.

Boundary note: the adjacent **`data-role`** axis (ADR-0012; naming.md §6's registry) is a DIFFERENT axis —
the content-kind of authored light-DOM content and of consumer-owned content units, not which chrome part
a node is — and is untouched by this record.

## Consequences

- A new component's anatomy lands as `data-part` names declared in its descriptor's `parts:`; new state or
  variant lands as its own `data-*` attribute. No component mints a competing anatomy channel (classes,
  bespoke attributes, per-part elements, ARIA).
- The uniform (0,1,0) algebra stays load-bearing: SPEC-R12's cascade laws and the GH #197 fix reason in
  it, so a component that weights its anatomy selectors differently (compound identity values, ID or
  class hooks on its own chrome) breaks reasoning other records already depend on.
- Adopting a shadow-DOM surface anywhere in the fleet re-opens this record's axis 4 via a NEW ADR — the
  `part` reservation is the hook, not a license.
- One fact, one home: naming.md §6 remains the per-axis REGISTRY (the vocabularies themselves); this
  record holds the partition and the why. **Stale → re-verify at ratification:** naming.md §6 gains the
  `data-slot` + state/variant-axis + `part`-reserved lines citing this record (the Repairs cell); the
  README index row flips with the Status.

## Alternatives considered (the GH #217 audit)

- **BEM/utility classes as the anatomy channel** — rejected: erases the fleet's load-bearing
  class/attribute ownership split (attributes = component anatomy, classes = consumer territory) and
  loses the uniform (0,1,0) attribute algebra SPEC-R12 and the GH #197 fix build on.
- **Bespoke non-`data-` attributes** (e.g. `part-name="…"` inventions) — rejected: invalid HTML; `data-*`
  is the only conforming author-defined attribute namespace.
- **Per-part custom elements** — rejected: custom-elementing built-once wrapper parts re-opens the
  relocation-reconnect hazard class (the same fit evidence that sank ADR-0156's Option B).
- **ARIA roles as the anatomy channel** — rejected: the wrong layer — ARIA is the accessibility contract,
  which this fleet deliberately routes through `ElementInternals` (never host attributes, CLAUDE.md), so
  overloading it with styling anatomy would couple decoration to semantics (the same reasoning that made
  `data-role` a `data-*` attribute, anatomy.md §2).

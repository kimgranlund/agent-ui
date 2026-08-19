# ADR-0209 — A2UI Disclosure summary-row children ride the child-side `slot` prop: `summary` joins the catalog's position-slot vocabulary (no new child model, no wire vocabulary)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-18
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-18 |
> | **Proposed by** | planning seat (planning-leader dispatch on Kim's charter), on [GH #1351](https://github.com/kimgranlund/agent-ui/issues/1351) — the 2026-08-18 preset-vs-catalog gap analysis's single most-repeated inexpressible pattern |
> | **Ratified by** | *pending — the Status flip is Kim's (`scripts/adr_ratify.py`, ADR-0149)* |
> | **Repairs** | on ratification+build (design-only NOW — nothing below is applied by this ADR): `a2ui/src/catalog/default/catalog.json` (the Decision cl.2 adopter-row edits: `Switch`/`Tooltip` gain a `slot` PropDef, `Icon` widens its enum) · [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md) §5.2 (the row deltas drafted in the “SPEC §5.2 row deltas” section below) · `live-agent/prompt-equivalence.baseline.json` (`describePropType` renders every enum, so three row edits shift the baseline — recapture via the checked-in writer, `RECAPTURE_BASELINE=1`, the ADR-0207 precedent) · a corpus seed demonstrating a Switch on a fold's summary row (GH #729 coverage; row graded ≥4 vs `rubrics/a2ui-catalog.md`) · renderer/validator tests extending the GH #808 S1 `card-header-slot` pair to the Disclosure adoption path |
> | **Supersedes / Superseded by** | **Extends [ADR-0158](./0158-disclosure-summary-slot.md)** (the component side of this exact seam — `ui-disclosure`'s `slot="summary"` adoption, heal-rescue, scoped activation guard, and accessible-name scoping all shipped there; this ADR adds ONLY the wire's way to say it) and **[ADR-0113](./0113-content-family-v1-scope.md)** (the `Disclosure` catalog row, whose "children = body" anatomy ADR-0158 already gave its one ruled exception). Composes on the catalog's shipped child-side position-slot grammar (`Icon`/`Badge` `slot: leading\|trailing`, `Image` `slot: hero` — the GH #808 S1 CardHeader wave, proven wire→DOM end-to-end by `renderer/card-header-slot.test.ts` + its browser sibling) and on [ADR-0098](./0098-validator-enum-membership-enforcement.md) (generic enum-membership validation, `catalog/conformance.ts:119-124`). Method precedent: [ADR-0161](./0161-catalog-multi-slot-two-way-value-marks.md) (widen an existing catalog mark in place; every existing form stays legal, byte-unchanged). Relates [ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) (untouched — `a2ui-basic` declares no `Disclosure`; verified by inspection of `catalog/a2ui-basic/`) · GH #1351 · GH #729 |

## Context

**The gap.** The fleet's `ui-disclosure` has carried a real, component-owned `slot="summary"`
position slot since ADR-0158: light-DOM children marked `slot="summary"` are adopted onto the
fold's summary row (after the chevron and the `summary`-prop label, append order preserved), are
RESCUED across heal rebuilds with node identity intact, get a scoped activation guard (a click on
a summary-hosted control never toggles the fold), and never pollute the fold's accessible name
(the name is always the `summary` prop, `aria-labelledby` → the summary-text span). The catalog's
`Disclosure` row, however, still describes only the pre-ADR-0158 surface: `summary` is a plain
bindable STRING prop, `open` + a `value:{prop:'open',event:'toggle'}` mark, and one `ChildList`
whose members all become body content. **The wire has no way to place anything on the summary
row.** A payload that tries (`{ component: 'Switch', slot: 'summary', … }`) fails validation
today: `Switch` declares no `slot` PropDef, and an undeclared prop is a `CATALOG` error.

**The demand** (GH #1351, the 2026-08-18 preset-vs-catalog gap analysis — agent-admin-app presets
vs the default catalog: the single most-repeated inexpressible pattern, ~12 sites per
agent-admin instance; all verified against
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.md` + `agent-admin.ts`):

- **`kind-enabled` / the Agent master switch** — every Agent/kind settings fold carries its master
  `ui-switch` ON the summary row via `slot="summary"` (`agent-admin.ts:1131`, `:1546`; the
  `settings-item` part, GH #225/#226 lineage) — the Agent fold plus the entry-kind folds, seven
  kinds (the issue's own count).
- **`admin-help`** — every group/section heading row carries a `<ui-tooltip data-part="admin-help"
  slot="summary">` (question-mark anchor + help card), adopted onto the fold's heading row by
  `ui-disclosure` (`agent-admin.md:172`, GH #844/#866) — including every `context-item` and
  `context-turn` fold (`agent-admin.md:182/:187`).
- **The composed ordering ruling** — where a heading row carries both, the order is `[?] [switch]`,
  the switch outermost (Kim, 2026-08-14) — plain DOM/append order under ADR-0158.

None of this is expressible in an A2UI payload, so no agent-produced surface can reproduce the
app's own settings-fold grammar. GH #1351's Done-when: a payload renders a Disclosure with a
Switch on its summary row through the real renderer, row graded ≥4 vs `rubrics/a2ui-catalog.md`,
prompt baseline recaptured, a seed demonstrating it.

**Verified mechanics this decision stands on** (inspected 2026-08-18, not recalled):

1. The catalog already HAS a child-side placement grammar: `Icon`/`Badge` declare
   `slot: { enum: ['leading','trailing'], mapsTo: 'slot' }` and `Image` declares
   `slot: { enum: ['hero'], mapsTo: 'slot' }` (`catalog/default/catalog.json:230/:547/:599`).
   The wire→DOM path is proven end-to-end: an `Icon(slot:'leading')` payload child lands the
   native `slot` ATTRIBUTE on the light-DOM child the parent receives
   (`renderer/card-header-slot.test.ts`, GH #808 S1 — the full `createRenderer` + real factories
   path; `HTMLElement.slot` is a reflected accessor, so the generic `setProp` write IS the
   attribute write).
2. `ui-disclosure` adopts `slot="summary"` children at connect AND as late arrivals via its heal
   observer (ADR-0158 cl.1/cl.2) — so renderer append order vs. connect order is immaterial.
3. Enum validation is generic and shared: `conformance.ts:119-124` rejects any value outside a
   declared `enum` (ADR-0098), document-side `catalog.ts` parses PropDefs generically — an enum
   widening or a new `slot` PropDef is a DATA change; zero validator code moves, and
   renderer/corpus parity is free by construction (both read the same catalog document).
4. The descriptor-agreement machinery is untouched on both sides: `disclosure.md` already
   declares the `summary` entry under `slots:` (ADR-0158 realized SPEC-R14's foreseen extension),
   and on the child side the ADR-0173 agreement gate (`descriptor-agreement.test.ts`) skips
   `mapsTo` targets outside a descriptor's declared attributes by its own domain rule — `slot` is
   the NATIVE reflected attribute, not a descriptor attribute, which is exactly how `Icon.slot`/
   `Badge.slot` pass that gate today. A child type needs no descriptor change to be slottable.
5. The prompt baseline renders every prop's type and enum (`system-prompt.ts` `describePropType`,
   GH #288) — so ANY resolution of this gap that touches a row changes the baseline; recapture is
   owed by the build wave regardless of which alternative wins.

## Decision

### 1 · The grammar: summary-row placement is the child-side `slot` prop — `summary` joins the position-slot vocabulary

A `Disclosure` child that should sit on the fold's summary row carries `slot: 'summary'` in its
own component node — the exact grammar `Icon(slot:'leading')` already uses for CardHeader, mapped
by the existing `mapsTo:'slot'` path onto the native `slot` attribute, which ADR-0158's shipped
adoption then routes onto the summary part. Wire example (the GH #1351 Done-when shape):

```json
{ "id": "fold",   "component": "Disclosure", "summary": "Agent", "open": true,
  "children": ["master", "body1"] },
{ "id": "master", "component": "Switch", "slot": "summary",
  "checked": { "path": "/agent/enabled" }, "label": "Active" },
{ "id": "body1",  "component": "Text", "text": "…the folded body content…" }
```

**Nothing about the `Disclosure` row's own shape changes**: `summary` stays a plain bindable
string (it is load-bearing — the fold's accessible name, ADR-0158 cl.4), `open`/`value` stay as
shipped, `children` stays ONE `ChildList`. The summary/body partition is the CHILD's declaration,
resolved by the component — not a second child model, not a new wire field, not a union type.

### 2 · Initial adopter rows (demand-backed, smallest floor)

Three row edits in `catalog/default/catalog.json`, each cited to a named demand site:

- **`Switch`** gains `"slot": { "type": { "type": "string", "enum": ["summary"] }, "mapsTo": "slot" }`
  — the `kind-enabled`/Agent master-switch pattern, GH #1351's own Done-when control. Its
  `value:{prop:'checked',event:'change'}` mark is untouched and keeps working on the summary row:
  ADR-0158 cl.3's guard cancels only the FOLD toggle for a listener-driven control; the checked
  flip and its `change` commit are the control's own listeners, unaffected.
- **`Tooltip`** gains the same `"slot": { …enum: ["summary"]… }` — the `admin-help` pattern:
  `Tooltip(slot:'summary')` with its existing positional `ChildList` (first child = anchor, e.g.
  a `Button`), landing a help affordance on a heading row. Its `value:{prop:'open',event:'toggle'}`
  and positional-anchor contract (ADR-0087 Wave A) are untouched.
- **`Icon`** widens `["leading","trailing"]` → `["leading","trailing","summary"]` — the
  decorative heading-row glyph (the lighter sibling of the full admin-help composite).

`slot` stays **non-bindable, structural** in all three (the shipped `Badge.slot`/`Image.slot`
convention): where a child sits is authoring structure, not runtime state — a control migrating
between body and summary mid-session is not a demanded behavior, and keeping it static keeps
`#resetOmittedProps`/binding semantics out of scope.

### 3 · Further adopters are row-data-only — no new ADR per type

This ADR decides the GRAMMAR once. Adding `summary` to another type's `slot` enum (or adding a
`slot` PropDef to a type that lacks one) is thereafter an ordinary reviewed catalog-row edit —
schema, validator, and renderer are untouched by construction (Context §mechanics 1/3) — carrying
only its own prompt-baseline recapture, exactly like any other row change. The one standing bar:
each addition names its demand site in the row's doc note (`Badge` on a summary row is the
plausible next candidate but has NO cited demand today — deliberately left out; see Open
questions).

### 4 · Ordering and the accessible-name law (restated obligations, not new mechanics)

- **Order on the summary row = wire `children` order.** ADR-0158 appends adopted children in
  order after the chevron + label, and rescue preserves it — so the agent-admin `[?] [switch]`
  ruling (help icon first, switch outermost) is expressible as plain child order:
  `children: ["help", "master", …body]`.
- **The `summary` prop stays mandatory-in-practice when slotting controls.** The fold's
  accessible name IS the `summary` prop (ADR-0158 cl.4) — a Disclosure whose only summary content
  is slotted controls is a NAMELESS fold. This is producer guidance (the prompt's Disclosure line
  + the seed) and rubric substance (`rubrics/a2ui-catalog.md`), NOT a validator rule: the shared
  validator has no parent-context prop checks today, and inventing one for this (a conditional
  "summary required iff a child carries slot:'summary'") would be the first cross-node validation
  in the conformance layer — out of proportion to an authoring error the grade already catches.

### 5 · What the build wave owes (scope of the follow-up ticket; none of it applied here)

catalog.json's three row edits (§2) · the SPEC §5.2 deltas (§6) · a renderer test extending the
`card-header-slot` pair to the Disclosure path (jsdom: `slot` attribute lands + body/summary
partition; browser: the switch flips without folding — ADR-0158 cl.3's guard through the REAL
renderer) · prompt-baseline recapture · one corpus seed (a settings-fold card: Disclosure +
summary Switch + summary Tooltip-help + body content; GH #729 coverage) · row grade ≥4 vs
`rubrics/a2ui-catalog.md`.

## Alternatives considered

- **A. `summary: string | ChildList` union prop** (GH #1351's first-listed shape) — rejected.
  The PropDef grammar has no children-typed props: children are id-references flowing through the
  wire's `children` field and the tree walker, never through `applyProp`. A union would fork
  every PropDef consumer at once — the conformance type dispatch (ADR-0098), `tree.ts`'s
  omitted-prop reset, the prompt's `describePropType`, and `bindable` semantics (what does a
  `{path}` binding mean when the value may be a subtree?). Worse, it forks the accessible-name
  law: the moment the label can BE children, producers will move it there, and ADR-0158 cl.4's
  "the name is the prop, always" breaks by invitation. The string form also carries the whole
  existing corpus — a type-sniffed union on a load-bearing bindable prop is the most fragile
  possible seam.
- **B. A separate `summaryChildren` ChildList** — rejected: a NEW node-level wire field, i.e. a
  second parent→child edge kind. `ComponentDef.children` is a single `'child'|'children'|'ChildList'`
  string (`catalog.ts:25/:170`), and `children` is one of five RESERVED node keys
  (`renderer/widget.ts:42`); a second edge would have to be learned by every graph consumer — tree
  build/diff, the reveal-order streaming walk (ADR-0194), list reconcile, corpus export,
  conformance's graph checks, devtools capture — and by every downstream catalog (descriptor
  agreement, a2ui-basic partition reasoning). Maximal blast radius to express what a shipped
  one-attribute grammar already expresses; it also breaks the flat-graph "one children array per
  node" shape every existing walker assumes.
- **C. A `SummaryAction` mark** (a catalog-side mark on the Disclosure row describing one
  synthesized summary control, the `value`-mark shape) — rejected: it caps expressiveness at one
  hardcoded control shape, and the demand ALREADY needs two different shapes composed on one row
  with ruled ordering (`[?] [switch]`). A synthesized control is also outside the component
  graph — no node id, so no `{path}` binding, no action dispatch, no per-node checks without
  duplicating `Switch`'s whole prop surface inside a bespoke sub-schema. New vocabulary where the
  fleet (ADR-0006/0012 → ADR-0158) and the catalog (GH #808 S1) already share one.
- **D-variant: parent-validated slot legality** (make `slot:'summary'` a `CATALOG` error outside
  a `Disclosure` parent) — rejected for now: the conformance layer has no parent-context checks,
  and today's shipped enums already accept the same class of dead placement (`slot:'leading'`
  outside a CardHeader is legal wire that does nothing). Same failure class, same answer: rubric
  grading + producer teaching, not a first cross-node validator. Revisit only if graded corpus
  evidence shows producers actually misplace it.

## The SPEC §5.2 row deltas (drafted here, NOT applied — the build wave lands them)

**`Disclosure` row** — replace the trailing children clause; the rest of the row stands
byte-unchanged:

> …`value:{prop:'open',event:'toggle'}` (two-way, ADR-0101 always-announce law — a model-driven
> transition announces exactly once, same as a user click); `ChildList` children — the folded
> body content, EXCEPT a child carrying `slot:'summary'` (ADR-0209): the child-side position-slot
> grammar (the `Icon.slot` CardHeader precedent, GH #808 S1) lands the native `slot` attribute and
> `ui-disclosure` adopts it onto the summary row (ADR-0158 — append order after the label, rescue
> across rebuilds, the scoped activation guard, and the fold's accessible name staying the
> `summary` prop are ALL the component's shipped contract, not this catalog's). Summary-capable
> child types declare `summary` in their own `slot` enum (`Switch`/`Tooltip`/`Icon` at v1); order
> on the summary row is wire children order. The `summary` prop stays load-bearing — slotted
> controls never name the fold; a payload slotting controls under an empty `summary` is an
> authoring error the rubric grades (not a validator rule) |

**`Switch` row** — append:

> ; `slot` (`summary`, structural, NOT bindable — ADR-0209: places the switch on an ancestor
> `Disclosure`'s summary row; the `checked` commit still rides `change`, the fold toggle is
> guard-cancelled per ADR-0158 cl.3)

**`Tooltip` row** — append:

> ; `slot` (`summary`, structural, NOT bindable — ADR-0209: lands the tooltip (anchor-first
> positional children unchanged) on an ancestor `Disclosure`'s summary row — the agent-admin
> `admin-help` shape)

**`Icon` row** — append:

> ; `slot` (`leading`\|`trailing`\|`summary` — the CardHeader placement enum (GH #808 S1) widened
> by ADR-0209 with the Disclosure summary row)

*(The Icon/Badge rows do not currently mention their shipped `leading`/`trailing` slot props at
all — a pre-existing §5.2 under-description the build wave should repair in the same edit, per
the stale-context rule; noted here so the delta lands as repair + widening, not widening alone.)*

## Consequences

- The single most-repeated preset-vs-catalog inexpressible pattern closes with ZERO renderer,
  validator, or component code — three catalog-row data edits ride entirely on shipped
  machinery (ADR-0158 + the GH #808 S1 slot path + ADR-0098 enums).
- The prompt baseline changes (three rows gain/widen an enum `describePropType` renders) —
  recapture owed by the build wave, and every FUTURE adopter row re-owes it (§3).
- The position-slot vocabulary is now cross-family (`leading`/`trailing`/`hero`/`summary`) with a
  stated widening law (§3) — the next "child on a parent's named row" ask has a default answer
  and a one-row cost, instead of a design fork.
- Accepted risk: parent-blind placement legality (`slot:'summary'` outside a Disclosure is legal,
  inert wire) — precedented by every shipped slot enum, graded not validated (§Alternatives
  D-variant states the revisit trigger).
- `a2ui-basic` (ADR-0169) is untouched: it declares no `Disclosure` and none of the three adopter
  types carry `withBasicCommon` slot surface — verified against `catalog/a2ui-basic/`.

## Open questions (for ratification review)

1. **`Badge` on the summary row** — plausible (a status token beside a fold heading: "3 active"),
   but NO cited demand site today. Include in the v1 adopter set anyway, or hold to §3's
   demand-named bar? (Drafted OUT — smallest floor.)
2. **`Button` as a direct summary child** — the admin-help anchor is a button INSIDE a Tooltip
   (positional), so no direct demand; a bare summary-row Button (e.g. an inline "Edit" affordance
   on a fold heading) would also stress the activation guard's two arms harder. Held out pending
   demand; §3 covers it when it comes.
3. **Seed shape** — one composite settings-fold seed vs. two minimal seeds (switch-only,
   help-only). The build wave's call; the rubric row grade is the gate either way.

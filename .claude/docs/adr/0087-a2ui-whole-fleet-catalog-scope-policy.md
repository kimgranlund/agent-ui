# ADR-0087 — A2UI default catalog covers the whole shipped `ui-*` fleet (gate-encoded exclusion allowlist)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-06 *(authored)* ·
> 2026-07-06 *(forks resolved — Kim: Fork A INCLUDE w/ required usage guidance, Fork B INCLUDE, Fork C two
> types, Fork D INCLUDE all three; Status stays `proposed` — ratification lands at the wave-gate close per the
> `Ratified by` field below, not from the fork answers alone)*
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-06 *(authored)* |
> | **Proposed by** | planner (design seat — the robust-App-usage catalog-scope intake, Kim's directive) |
> | **Ratified by** | orchestration-coordinator (on the green wave gates; the per-control INCLUDE forks and the ui-list/ui-grid fork **now confirmed by Kim, 2026-07-06** — ratification itself still lands at the wave-gate close, not on this ADR directly) |
> | **Repairs** | `a2ui-catalog.spec.md` **SPEC-N2** (coverage rule: family-tracking → whole-fleet-or-allowlisted) · **SPEC-R3** AC1 (the "initial coverage tracks the family" wording) · **§5.2** (the row table + the ADR-0053 *Deferred* note + the ADR-0016 *List/Grid non-catalog* note) · `catalog/default/index.test.ts` (the hand-frozen key-list → the fleet-derived coverage gate) — **all five waves (0/A/B/C/D) have now LANDED** (built + gated green): the fleet-derived gate replaced the frozen key-list in Wave 0, all 12 ADR-0087 types + composites landed their `catalog.json`/`factories.ts` rows across Waves A/B/C, and Wave D confirmed the code `EXCLUSION_ALLOWLIST` is EMPTY (residue-free) and reconciled SPEC §5.2/§5.2.1 to landed-state language — this ADR is ready for Kim's ratification decision on that basis |
> | **Supersedes / Superseded by** | **Supersedes** the ui-list/ui-grid *non-catalog* exclusion recorded in **ADR-0016** (Decision cl.3 parenthetical + its §5.2 note) — **Fork A CONFIRMED INCLUDE (Kim, 2026-07-06)**; ADR-0016's `Superseded by` back-link lands at wave-gate ratification (coordinator housekeeping, cl. below); ADR-0016's Row/Column faithful-flex decision STANDS untouched. **Closes** the **ADR-0053** §5.2 *Deferred (RadioGroup/Slider/Calendar/ComboBox)* note. Relates **ADR-0019** (the one-`value`-mark two-way seam these rows depend on) · **ADR-0043/0048** (the overlay + calendar controls being exposed) · **ADR-0086** (the RadioGroup segmented variant) |

## Context

The default catalog is the **agent-emittable surface** of `@agent-ui/a2ui`: a component type absent from it
cannot appear in an agent payload at all (the SPEC-R9 security allowlist — *only components present in the
bound catalog may render*). Today that surface is a **subset** of what the fleet ships, frozen by two
policies:

1. **SPEC-N2** (`a2ui-catalog.spec.md`) reads: *"The default catalog declares a component for each shipped
   control; an unshipped control's type is either absent or explicitly marked `experimental`."* — coverage is
   pinned to *"track the family"* (SPEC-R3, Assumption A-2), a stance written when only Button/TextField/the G9
   containers had shipped.
2. **§5.2** froze two exclusion lists: the ADR-0053 *"Deferred (not this wave): … `RadioGroup`, `Slider`,
   `Calendar`, `ComboBox`"* note, and the ADR-0016 *"`ui-list` / `ui-grid` ship as direct `ui-*` layout
   primitives, NOT catalog types"* note.

Three discovered realities make that subset a defect for the **robust-App usage** Kim now wants A2UI to serve:

- **The fleet has outrun the catalog, silently.** The `ui-*` fleet is **25 descriptors** (`controls/*/*.md`);
  the default catalog declares **19 component types** (13 primary + 6 composite sub-types). **Four shipped
  controls are neither catalogued nor dispositioned by any ADR** — `ui-icon`, `ui-menu`, `ui-popover`,
  `ui-tooltip`. That is a live SPEC-N2 violation (a shipped control that is neither present nor marked absent).
- **The coverage gate cannot catch it.** `catalog/default/index.test.ts` asserts the catalog keys against a
  **hand-frozen 19-name list** — it is not derived from the fleet. A shipped-but-uncatalogued control (icon,
  menu, popover, tooltip today; any future control tomorrow) passes CI silently. The drift the gate exists to
  prevent is exactly the drift it cannot see.
- **The controls were built expecting inclusion.** `menu.md`, `popover.md`, `tooltip.md`, and `combo-box.md`
  each already carry the comment *"the catalog declares `value:{prop:'open',event:'toggle'}` so the renderer
  two-way-binds it (ADR-0019)"* — the descriptors anticipate a catalog row that was never written. The
  exclusion is an accident of build sequencing, not a design position.

Kim's directive (verbatim intent): *"Reconcile by adding them, yes. We want to use A2UI for more robust App
usage as well, so should try to keep EVERYTHING in the catalog."* This inverts the scope policy.

## Decision

**We will make the default catalog cover the whole shipped `ui-*` fleet: every shipped control has a catalog
component type, OR appears on an explicit, gate-encoded exclusion allowlist that records a reason.** This is
one decision — the scope-policy flip — realized by repairing SPEC-N2 (the coverage rule), SPEC-R3 AC1 (the
"tracks the family" wording), and §5.2 (the row table + the two frozen exclusion notes), and by replacing the
hand-frozen `index.test.ts` key-list with a **fleet-derived** gate that fails CI when a shipped control lacks
a catalog type and is not on the allowlist. SPEC §5.2 remains the owning doc for the per-row facts; this ADR
records *why* the policy changes.

The **new SPEC-N2** (owning doc holds the fact): *every shipped control (`controls/*/*.md`) resolves to a
catalog component type, OR sits on the exclusion allowlist — a code-level set where each entry carries a
recorded reason and a citation. The gate derives the expected type-set from the descriptor glob (the same
source `site-coverage.test.ts` walks), subtracts the allowlist, and asserts the remainder is catalogued and
factory-bound. The allowlist is the only sanctioned form of "absent"; there are no silent dead types and no
silent uncatalogued controls.*

**The default position is INCLUDE.** Kim's stated lean is "everything in," so the executing waves add a catalog
type for every currently-uncatalogued control unless a fork below resolves otherwise. **The following are
surfaced as ratification forks — each is a shape question this ADR does NOT decide unilaterally; each is framed
"include as type X unless you object," and the answer is an input the build waves consume:**

- **Fork A — `ui-list` / `ui-grid` (supersedes ADR-0016's exclusion). RESOLVED (Kim, 2026-07-06): INCLUDE —
  "yes, as long as these have specific guidelines of where and how to use."** ADR-0016 cl.3 made these
  *non-catalog* direct primitives, reasoning an agent composes the catalog `Row`/`Column`/`Card` set; Kim's
  "everything in" reverses that, on the condition the catalog itself teaches the distinction rather than
  leaving an agent to guess between four similar-looking container types. **`List` (a `Column` specialization
  carrying list semantics) + `Grid` (the auto-fit track model, `elevation`/`brightness`/`gap`/`min`) sit
  alongside — not instead of — `Row`/`Column`.** The required usage guidance, to be carried in the SPEC §5.2 row
  Notes (prompt-facing, not just this ADR's prose) as an ACCEPTANCE item for Wave C:
  - **`Row`/`Column`** — the general flex-grammar primitives. Use when the children are a deliberate,
    heterogeneous arrangement (a toolbar, a form's field stack, a card's internal sections) where no single
    semantic role unifies them.
  - **`List`** — a `Column` specialization. Use when the children are a **homogeneous, itemized collection**
    where list semantics matter to an assistive-tech user (search results, a feed, a to-do list) — `List`
    carries `role=list` for free; plain `Column` does not and should not fake it.
  - **`Grid`** — the auto-fit track model. Use when the children should **reflow their column count
    responsively** with available width (an image/card gallery, a dashboard of tiles) — i.e. the layout wants
    intrinsic wrapping, not an author-picked fixed arrangement. Prefer `Row`/`Column` (with an explicit `wrap`)
    when the arrangement should stay author-controlled rather than auto-fit.
  *Objection path (now moot — Kim confirmed INCLUDE):* had Kim objected, `List`/`Grid` would stay allowlisted
  with the ADR-0016 reason and ADR-0016 would not be superseded.
- **Fork B — `ui-radio-group` + `ui-radio`. RESOLVED (Kim, 2026-07-06): INCLUDE — "yes."** One `RadioGroup`
  type with `Radio` children — the Select/Option (and Tabs/Tab) adjacency pattern: `RadioGroup` carries
  `name`/`disabled`/`required` (+ the ADR-0086 `variant`/`orientation`) and a bindable group `value`; `Radio` is
  a child sub-type (`value` key + `label` + `checked`). *Open sub-question the wave still verifies against
  `radio-group.ts`:* whether the group exposes a `value` accessor + a commit event for the `value:{prop,event}`
  two-way mark, or whether the value is children-driven only (then the bind mirrors Select's `value`/`select`)
  — this is an implementation detail for the builder, not a re-opened fork.
- **Fork C — `ui-slider` vs `ui-slider-multi`. RESOLVED (Kim, 2026-07-06): TWO TYPES (option c1)** — `Slider`
  binds a single `value` two-way on `change`; `SliderMulti` carries `min`/`max`/`step` + `valueLo`/`valueHi`
  bound **one-way** (the ADR-0019 seam allows one `value:{prop,event}` two-way mark per component, and
  `SliderMulti` has two committed values — one-way keeps the capability visible without a seam extension;
  c2/c3 are no longer live options).
- **Fork D — `ui-menu` / `ui-popover` / `ui-tooltip` (the overlay family). RESOLVED (Kim, 2026-07-06): INCLUDE
  ALL THREE — "yes."** Agent-emittable types (`open` two-way on `toggle` + `placement`; Tooltip adds `delay`)
  — the descriptors already anticipate this. Kim's "yes" explicitly includes `Tooltip`, closing the one
  "keep app-side?" hedge this ADR had flagged — it is NOT allowlisted. Two sub-questions remain for the
  builder to resolve (implementation detail, not re-opened forks): (d1) **`Menu` item model** — a `MenuItem`
  sanctioned primitive (`[role=menuitem]` + `data-value` + label textContent, the Option precedent) vs arbitrary
  `ChildList`; default MenuItem. (d2) **`Popover`/`Tooltip` trigger/content model** — these controls use *named
  light-DOM slots* (`trigger` + default content), which the flat A2UI child model (`child`/`children`/`ChildList`)
  does not express; the wave must pick a named-region sub-type pair (the CardHeader/CardContent precedent) or a
  positional convention.

## Consequences

- **The catalog's agent-visible surface grows to the whole fleet.** **11 new primary types confirmed** (Icon,
  Menu, Popover, Tooltip, RadioGroup, Slider, SliderMulti, Calendar, ComboBox, List, Grid — all four forks
  resolved INCLUDE, Kim 2026-07-06) plus their composite sub-types (MenuItem, Radio) become promptable. **Corpus, eval, and the derived prompt
  inherit them** — the corpus repair loop (PRD-G5) re-validates against the widened catalog, and generation
  reliability work now spans the full surface. This is the point (robust App usage), and the cost.
- **The coverage gate stops being CI-silent.** Replacing the frozen key-list with the fleet-derived assertion
  means a future shipped control that is neither catalogued nor allowlisted **fails CI** — the drift SPEC-N2
  always intended to prevent becomes mechanically enforced (PRD-G6). The gate is FORWARD-ONLY (fleet primary
  types ⊆ catalog types, minus the allowlist); composite sub-types (Option/Tab/CardHeader/… , and new MenuItem/
  Radio) are parent-declared and exempt from the fleet derivation — the existing `factories.test.ts`
  catalog↔factory bijection already guards the reverse ("no extra type without a factory").
- **A sequencing hazard, resolved by the seeded allowlist.** A fleet-derived gate goes RED the instant it lands
  if the rows do not yet exist. **This ADR takes the seed-and-drain path** (the `site-coverage.test.ts`
  `KNOWN_UNDOCUMENTED` precedent): the gate lands FIRST (PREP) with the allowlist seeded to *every* not-yet-
  catalogued type — green from day one — and each subsequent wave **drains its types from the allowlist as it
  adds the rows**, so drift is CI-visible throughout the build, not only at the end. (The rejected alternative:
  land the gate LAST — leaves catalog drift CI-silent for the whole build.)
- **Two-way binds cost one seam slot each.** Every new bindable input consumes the single ADR-0019
  `value:{prop,event}` mark. Controls with two commit-worthy states surface the tension: `ComboBox` (committed
  `value` vs disclosure `open` — Fork D/combobox recommends `value`, the form value) and `SliderMulti` (Fork C).
  These are recorded, not silently resolved.
- **ADR-0016 is partially superseded.** Fork A is confirmed INCLUDE (Kim, 2026-07-06) — ADR-0016's List/Grid
  *non-catalog* clause flips (its Row/Column decision is untouched); the coordinator sets ADR-0016's
  `Superseded by` back-link at this ADR's wave-gate ratification. *(Housekeeping note for the coordinator, not
  decided here: ADR-0016's `Status` is still `proposed` in the index though its Row/Column decision shipped in
  G9 — a pre-existing inconsistency to reconcile at that same ratification.)*
- **Stale → re-verify:** `a2ui-catalog.spec.md` §5.2 + SPEC-N2 + SPEC-R3 AC1 (repaired by this ADR now) ·
  `catalog/default/{catalog.json,factories.ts}` + `index.test.ts` + `conformance.test.ts` (per wave) ·
  `a2ui-catalog.lld.md` LLD-C4/C5 (per wave) · NEXT.md (host-updated as waves land) · the corpus exemplar
  shelf + derived prompt (re-validate against the widened catalog).

## Acceptance

Realized when:

- `catalog/default/index.test.ts` **derives** the expected type-set from the descriptor glob (`controls/*/*.md`
  → PascalCase), subtracts the exclusion allowlist, and asserts the remainder is present in `catalog.json` AND
  factory-bound — with a synthetic negative control proving the gate BITES (an uncatalogued shipped control
  fails). The hand-frozen 19-name key-list is gone.
- The exclusion allowlist holds **exactly** the fork-deferred residue — **now confirmed empty** (all four forks
  resolved INCLUDE, Kim 2026-07-06) except the documentary-only `Image`/`Video` rows (no shipped control, never
  code-derived); no shipped control is silently uncatalogued.
- **Fork A's condition is satisfied only once the `List`/`Grid` catalog rows carry the Kim-required usage
  guidance** (Row/Column vs List vs Grid — see Decision, Fork A) in the SPEC §5.2 Notes column, not merely a
  bare type declaration — Wave C is not "done" on a green gate alone if that prose is missing.
- Each newly-catalogued control has a `catalog.json` row + a `ui-*` factory, validates a realistic payload
  0-`CATALOG` through the shared `validateA2ui`, and a negative control (unknown prop / type mismatch) still
  fails `CATALOG`.
- `a2ui-catalog.spec.md` SPEC-N2, SPEC-R3 AC1, and §5.2 read the whole-fleet policy; `npm run check && npm test`
  green at every wave boundary.

## Alternatives considered

- **Reconcile only the four undispositioned controls (icon/menu/popover/tooltip); leave the ADR-0053 deferrals
  and ADR-0016 exclusion frozen.** — rejected: it closes today's SPEC-N2 violation but keeps the policy a
  moving subset, so the next shipped control re-opens the same silent-drift hole. Kim's directive is the whole
  fleet, not the four; a one-time reconcile does not encode the rule.
- **Keep the frozen `index.test.ts` key-list and just extend it as rows land.** — rejected: a hand-maintained
  list is exactly what let icon/menu/popover/tooltip drift in unnoticed. The gate must derive from the fleet
  (the `site-coverage.test.ts` doctrine) or it re-earns its blind spot.
- **Land the fleet-derived gate LAST (Wave D only), after all rows exist.** — rejected as the primary path
  (offered as Fork-independent sequencing): it leaves catalog↔fleet drift CI-silent for the entire build. The
  seed-and-drain path makes every wave's coverage move a gated, visible step; Wave D then only deletes the
  frozen list and reconciles the residue.
- **Decide the per-control shapes (List/Grid, RadioGroup, Slider split, overlay slot model) in this ADR.** —
  rejected: those are genuine forks with taste and seam trade-offs (named-slot modelling, the dual-value bind,
  Row/Column-vs-List redundancy). Deciding them unilaterally would bury real design choices under a policy flip.
  They are surfaced as ratification forks with an INCLUDE default per Kim's lean, for Kim to confirm or object.
- **Mark uncatalogued controls `experimental` (the old SPEC-N2 escape) instead of an allowlist.** — rejected:
  `experimental` is a per-type marker with no mechanical coverage guarantee — it still relies on a human
  remembering to add it. The gate-encoded allowlist is a single enforced set: a control is catalogued or it is
  on the list-with-a-reason, and CI proves the partition is total.

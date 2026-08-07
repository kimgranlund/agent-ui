# SPEC — Multi-Select Field (M-F component contract)

> Status: proposed · v0.1 · 2026-08-07 · Layer: SPEC (execution contract)
> Refines: [`../adr/0175-association-multiselect-field-design-intake.md`](../adr/0175-association-multiselect-field-design-intake.md)
> (the ratified architecture this document turns into a checkable behavior contract — cl.1 mint
> ruling, cl.2 wire/catalog shape, cl.3 association-editing fence; ADR-0175's own Open forks
> OF1–OF4 are NOT resolved here, see §5).
> Relates: [`../adr/0161-catalog-multi-slot-two-way-value-marks.md`](../adr/0161-catalog-multi-slot-two-way-value-marks.md)
> (the mechanism this control does NOT use) ·
> [`../adr/0163-ui-table-interactive-widening.md`](../adr/0163-ui-table-interactive-widening.md) cl.9/cl.10
> (`Table.selected` — the array-typed single-slot precedent SPEC-R2/R3 argue from) ·
> [`../adr/0169-a2ui-basic-catalog-upstream-interop.md`](../adr/0169-a2ui-basic-catalog-upstream-interop.md)
> cl.9b row 16 / Exclusion E6 (the `ChoicePicker.variant` gate SPEC-R10 drains) ·
> [`../adr/0050-form-provider-context-registration.md`](../adr/0050-form-provider-context-registration.md)
> (why aggregation is NOT a provider fix — SPEC-R5's Fact-2/3 closing) ·
> [`../adr/0019-pull-renderer-lld-c8-two-way-binding.md`](../adr/0019-pull-renderer-lld-c8-two-way-binding.md)
> (the bindable-prop + commit-event two-way pattern SPEC-R2's slot reuses unchanged).
> Route: this SPEC feeds M-F's own future LLD (component anatomy, file layout, exact geometry
> numbers) — none of that is authored here.
> Altitude: contracts + acceptance criteria only. No implementation steps, no file layout, no
> anatomy ruling — those are the LLD's job. Requirement IDs are SPEC-R# (behavior) / SPEC-N#
> (non-goals), file-scoped.

---

## 1 · Purpose

ADR-0175 ratified an architecture: a multi-select FIELD primitive is minted (record-edit/binding
case only), its wire value rides the ORIGINAL single two-way slot with an array-typed prop (not
ADR-0161's multi-slot mechanism), and to-many association/relationship editing is fenced OUT as a
separately-scoped future problem. This SPEC converts those three frozen answers into a checkable
behavior contract — the control's tag identity, its value-slot semantics, its form participation,
its geometry/keyboard/a11y obligations, and the two catalog rows it earns (default + the
`a2ui-basic` E6 drain) — so M-F's LLD has a contract to implement against instead of re-deriving
ADR-0175's prose. Filed against [GH #498](https://github.com/kimgranlund/agent-ui/issues/498).

## 2 · Scope

**In scope:** the new control's public contract — tag/class identity, value-slot wire shape, form
participation, the geometry-row obligation, the keyboard/a11y behavioral contract, and the two
catalog rows (default catalog + `a2ui-basic`'s E6 drain).

**Out of scope (routes elsewhere, not this document):** the control's internal DOM anatomy/file
layout (ADR-0175 OF1, M-F's LLD) · a second value-mark slot (OF2, only if the LLD's anatomy needs
one) · the catalog `options` shape, `PropDef` vs. reconciled `children` (OF3) · E6 drain
sequencing relative to the default-catalog row (OF4) · any association/relationship-editing design
(ADR-0175 cl.3, fenced out entirely — SPEC-N1).

## 3 · Requirements (SPEC-R)

**SPEC-R1 — Tag name & component identity.**
**Ruling: `ui-multi-select` / `UIMultiSelectElement`, `extends: UIFormElement`.** Argued from the
fleet's own naming law (`ui-{name}`/`UI{Name}Element`, states what the thing IS — CLAUDE.md
Conventions) and from anatomy-neutrality, not fashion: `ui-tag-field` bakes in a chips display
metaphor the ADR's own OF1 explicitly leaves open (a checkbox list is an equally live candidate);
`ui-checkbox-group`/`ui-choice-group` bakes in the checkbox-children anatomy OF1 also leaves open
(a `ui-combo-box`-style overlay is the other named candidate); `ui-multi-select` names neither
internal shape, only the CONTRACT — bind an array, commit on selection change (ADR-0175 cl.3's own
description of what the primitive covers) — exactly mirroring how `ui-select`/`ui-multi-select`
read as siblings in the fleet's own tag vocabulary, the same honest-new-tag boundary cl.1 already
drew when it rejected widening `ui-select` in place ("a new tag is the honest boundary, not a
widened attribute," `0175:155-156`). `ui-multi-select` is that boundary's sibling name, not a
disguised variant.
- **AC1** *Given* the shipped descriptor, *then* `tag: ui-multi-select`, the class is
  `UIMultiSelectElement`, `extends: UIFormElement` — the fleet's `naming-gates.test.ts` trip-wire
  passes with zero special-casing.

**SPEC-R2 — Value-slot wire shape (ADR-0175 cl.2).**
The control's wire value rides the ORIGINAL single two-way mark — `{prop: 'value', event:
'select'}` — where `value` is `string[]` (matching Fact 6's upstream `DynamicStringList` pin
exactly) and needs **no `marshal` step** (unlike `ChoicePicker`'s `singletonStringList`, which
exists only because `ui-select`'s DOM value is a scalar forced into a list-shaped wire contract —
a mismatch this control never has, since its own DOM value already IS the array, cl.2's own
closing argument). The commit event is `select`, matching `Table.selected`'s own commit event name
(`{prop:'selected', event:'select'}`, ADR-0163 cl.9) — the nearest structural precedent for an
array-typed single slot — and staying inside the fleet's fixed event vocabulary (`change · input ·
select · open · close · toggle · action`).
- **AC1** *Given* the shipped descriptor, *then* its value mark is exactly `{prop: 'value', event:
  'select'}` with no `marshal` field, and `value`'s declared type is `string[]`.
- **AC2** *Given* the control mounted under the A2UI renderer with a bound `valuePath`, *when* the
  user changes the selection, *then* `input.ts`'s generic two-way controller (ADR-0019) writes the
  FULL new array to `surface.data` at `valuePath` with zero per-component renderer code — proven by
  a renderer round-trip probe committed with the build.

**SPEC-R3 — Commit granularity.**
Each user selection change commits the WHOLE updated array, never a per-item delta — matching
`Table.selected`'s own whole-array commit model and the fleet's "a whole-array bindable prop
replaces, never per-item binds" precedent (`Table.columns`/`Sparkline.values`, cited verbatim at
`a2ui-basic/factories.ts:317-319`).
- **AC1** *Given* an already-selected set `['a','b']`, *when* the user toggles `'c'` on, *then*
  exactly one `select` commit fires, and the control's `value` reads `['a','b','c']` (order:
  existing selection preserved, the newly toggled member appended) — never two events, never a
  partial/delta payload.
- **AC2** *Given* the same set, *when* the user toggles `'a'` off, *then* one `select` commit
  fires and `value` reads `['b']`.

**SPEC-R4 — Empty-selection shape.**
`value` defaults to `[]` and is NEVER `null`/`undefined` at any point in the control's lifecycle —
matching `Table.selected`'s own `String([])===''` empty bijection and `ChoicePicker`'s
`DynamicStringList` (an array of strings, possibly zero-length, never absent).
- **AC1** *Given* a freshly connected, unconfigured control, *then* `el.value` reads `[]` (not
  `null`, not `undefined`).
- **AC2** *Given* a fully selected control, *when* the user deselects every option, *then* one
  `select` commit fires with `value: []` — never a `null` write, never a suppressed commit.

**SPEC-R5 — FormData multiplicity vs. bindable aggregate (ADR-0175 Facts 2–4).**
The control's `formValue()` MUST return a `FormData` (`dom/form.ts`'s `FormValue` type already
includes it, zero base-class widening — Fact 4) contributing MULTIPLE entries under the control's
own `name`, matching native `<select multiple>`/checkbox-group `FormData` semantics. Simultaneously
— and this is the gap ADR-0175 closes, not a restatement of Fact 2's residual — the SAME control's
own bindable `value` prop IS the one-array aggregate a consumer binds against directly: no
`ui-form-provider` aggregation step, no page-side "collapse N duplicate-name entries into one
array" glue (the exact residual `saas-data-workbench.prd.md:161` names and ADR-0050 rules the
provider itself may never grow into fixing, `0175:56-62`).
- **AC1** *Given* the control inside a native `<form name="tags">` with ≥2 options selected, *when*
  `new FormData(form)` is read (or `ui-form-provider.entries()`, whose own documented "duplicate
  names PRESERVED" contract — `form-provider.md:20-22` — this control is the first consumer to
  actually exercise), *then* MULTIPLE entries appear under `name`, one per selected option — a
  jsdom form-submission probe.
- **AC2** *Given* the same control, *when* a consumer reads `el.value` (or binds against it, e.g.
  via `ui-form-provider.values()`), *then* it reads ONE array of the currently selected keys — zero
  page-side aggregation code required, proven by a bind round-trip test (`el.value = ['a','b']`
  externally reflects the checked/committed set; toggling an option updates `el.value` to the new
  full array, per SPEC-R3).

**SPEC-R6 — Form participation.**
Extends `UIFormElement`; carries the standard `formProps` spread (`name`/`disabled`/`required`).
`formValidity()` reports `valueMissing` when `required` and `value` is `[]` — the same rule
`ui-select` applies for its own scalar `''` empty case, generalized to the array empty case
(SPEC-R4).
- **AC1** *Given* `required` and an empty selection, *then* `formValidity().valueMissing` is
  `true`; *given* at least one selected option, *then* it is `false` — a validity probe in the
  control's own FACE form-participation tests (the packaging law's standing bar).

**SPEC-R7 — Geometry row requirement.**
Per `.claude/docs/references/geometry-sizing-spec.md` §1 / ADR-0038 (the `(scale × size) → row`
LOOKUP — no multipliers on the control path), the control MUST carry its own geometry-row entry
and an explicit `tier` classification in its descriptor before it ships — this SPEC requires the
row exist; it does not assign the row's numbers or resolve the tier (an LLD/build-time call against
the single ramp, the same discipline `ui-select`'s own `tier: pattern` composite — trigger =
Control class, panel = Container/surface, rows = legacy item-pad — already sets as precedent for a
composite geometry classification).
- **AC1** *Given* the shipped descriptor, *then* it declares a `tier` and every part it renders
  resolves against the geometry-sizing-spec's §1 ramp with no ad hoc size value — the fleet's
  geometry trip-wire test for the new control passes.

**SPEC-R8 — Keyboard/a11y contract.**
This SPEC rules the OUTCOME, not the mechanism (ADR-0175 OF1 stays open — see §5): every
selectable option MUST be reachable and toggleable by keyboard alone, with no mouse-only path.
Selection state MUST be announced through the anatomy's own NATIVE semantics (a real checkbox's
`checked` state, or an ARIA-pattern-correct `aria-selected`/`aria-checked` if the LLD picks an
overlay/listbox anatomy) — never a bespoke ARIA invention, following the same discipline the
fleet's own selectable-table precedent already sets (`table.md:157-161`: real focusable elements in
the normal tab order, no roving-tabindex composite contract, no invented `aria-selected` on a plain
checkbox anatomy — the equivalent overlay anatomy, if chosen instead, inherits `ui-combo-box`'s own
active-descendant contract, `combo-box.md:91`, rather than reinventing one). The control's
accessible name follows the fleet's `ui-field`/bare-usage labelling law (`ui-select`'s ADR-0085
pattern: `aria-labelledby` merge inside a `ui-field`, a control-created visually-hidden label span
otherwise).
- **AC1** *Given* the shipped control, *when* driven by keyboard only (no pointer events), *then*
  every option can be selected and deselected, and the resulting `select` commit matches the
  pointer-driven case byte-for-byte — a keyboard-only probe in the control's own test file.
- **AC2** *Given* the shipped control, *then* an axe-core (or the fleet's equivalent accessibility
  gate) probe reports zero violations, and the descriptor's own `keyboard:` block (the
  `checkbox.md`/`table.md`/`combo-box.md` convention) documents the actual contract the LLD chose.

**SPEC-R9 — Default-catalog row.**
The A2UI default catalog (`a2ui/src/catalog/default/{catalog.json,factories.ts}`) gains a new
widget-type row bound to `ui-multi-select`, with value mark `{prop: 'value', event: 'select'}`
(SPEC-R2, no marshal). The `options` prop MUST be catalog-representable as a bindable whole-array
set of `{label, value}` pairs; WHICH catalog shape carries that (a `PropDef` array, the
`ChoicePicker` precedent, vs. reconciled `children`, the `Select`/`Option` precedent) is OF3,
explicitly not ruled here (§5).
- **AC1** *Given* an A2UI payload declaring the new widget type with an `options` array and a bound
  `value` path, *when* rendered, *then* the surface shows the option set and a user selection
  round-trips through `input.ts` into `surface.data` exactly as SPEC-R2 AC2 describes.

**SPEC-R10 — `a2ui-basic` Exclusion-E6 drain (ADR-0169 cl.9b row 16).**
The `a2ui-basic` catalog's `ChoicePicker.variant` enum widens past `['mutuallyExclusive']` to
include `'multipleSelection'`, and a NEW factory arm binds that variant to `ui-multi-select`
(SPEC-R1) — not to `ui-select`. The new arm's value mark needs no `marshal` step (SPEC-R2's own
argument: the control's DOM value already IS the array); the EXISTING `mutuallyExclusive` arm
(`ui-select` + `marshal: 'singletonStringList'`) is untouched, byte-identical. This requirement's
existence is independent of WHEN it ships relative to SPEC-R9 (sequencing is ADR-0175's own OF4,
still open, §5) — it names the drain as owed, not the wave it lands in.
- **AC1** *Given* an upstream payload declaring `ChoicePicker.variant: 'multipleSelection'`, *when*
  validated against the `a2ui-basic` catalog, *then* it passes enum conformance (today it fails,
  recorded as Exclusion E6) and renders via the new `ui-multi-select` factory arm.
- **AC2** *Given* the existing `mutuallyExclusive` arm, *when* the enum widens, *then* its own
  behavior (target tag, value mark, `singletonStringList` marshal) is unchanged — a regression
  probe in the catalog's own factory tests proves it.

## 4 · Non-goals (SPEC-N)

- **SPEC-N1 — No association/relationship-editing design.** ADR-0175 cl.3 fences it out entirely:
  no remote/paginated option search, no inline create-in-place affordance, no
  associated/available split. This SPEC's control closes ONLY "plain multi-pick from a fixed,
  already-loaded option list" (cl.3's own framing) — nothing here reopens the fence.
- **SPEC-N2 — No PRD-D3 reopening.** The filter/facet vehicle stays `ui-form-popover` + a checkbox
  group with page-side aggregation, exactly as ratified; cl.1 explicitly does not reopen it, and
  neither does this SPEC.
- **SPEC-N3 — No `saas-data-workbench` fixture change.** The workbench's record fields stay scalar
  per its own ratified non-goal; this SPEC does not imply the workbench itself grows a to-many
  field.
- **SPEC-N4 — No implementation/anatomy ruling.** File layout, the internal DOM shape (checkbox
  children vs. inline listbox vs. combo-box-style overlay), and the exact geometry numbers are
  M-F's own LLD — this document states the outcome contract (§3), never the mechanism.

## 5 · Open forks carried, not resolved

ADR-0175's four open forks are NOT decided by this SPEC — each routes to M-F's LLD:

- **OF1 — internal anatomy/base-class shape.** SPEC-R8 states the outcome contract (keyboard/a11y)
  independent of which anatomy the LLD picks.
- **OF2 — a second, distinct value-mark slot** (e.g., an embedded search-query prop). Only
  consumed if the LLD's chosen anatomy (OF1) needs it; SPEC-R2 rules the primary value slot only.
- **OF3 — the catalog `options` shape** (`PropDef` array vs. reconciled `children`). SPEC-R9
  requires the capability, not the shape.
- **OF4 — E6-drain sequencing** relative to the default-catalog row. SPEC-R10 exists independent of
  when it ships.

## 6 · Traceability

| SPEC id | Serves (ADR-0175 clause) | Route |
|---|---|---|
| SPEC-R1 | cl.1 (mint vs. compose) | M-F's LLD — descriptor `tag`/class |
| SPEC-R2 | cl.2 (wire/catalog shape) | M-F's LLD — value mark; `a2ui/src/renderer/input.ts` (unchanged, generic) |
| SPEC-R3 | cl.2, Fact 5 | M-F's LLD — commit behavior |
| SPEC-R4 | cl.2, Fact 6 | M-F's LLD — default value |
| SPEC-R5 | Facts 2–4 | M-F's LLD — `formValue()`/`value` prop |
| SPEC-R6 | Fact 4 | M-F's LLD — `UIFormElement` participation |
| SPEC-R7 | packaging law | M-F's LLD — descriptor geometry row |
| SPEC-R8 | cl.3 (what the primitive covers) | M-F's LLD — keyboard/a11y build |
| SPEC-R9 | cl.2 | `a2ui/src/catalog/default/{catalog.json,factories.ts}` |
| SPEC-R10 | cl.2 closing, ADR-0169 E6 | `a2ui/src/catalog/a2ui-basic/{catalog.json,factories.ts}` |

## 7 · Acceptance for this document

Ships `proposed`; flips to `accepted` only by a deliberate mark once the contract is judged stable
(the doc-standards skill §2 rarity rule) — never self-flipped by the authoring session. Document
gates: `site/lib/docs-grammar.test.ts` (status keyword + the relative-link sweep) exit 0 inside
`npm run check`'s `check:site` step.

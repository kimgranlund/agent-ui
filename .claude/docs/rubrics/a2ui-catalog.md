# Rubric — a2ui-catalog (a catalog row)

> Status: proposed · v0.1 · 2026-07-03 · Layer: rubric (the referential standard `a2ui-reviewer` grades a catalog row against).
> Implements: [`../spec/a2ui-expert-harness.spec.md`](../spec/a2ui-expert-harness.spec.md) SPEC-R3 · wired by [`../lld/a2ui-harness-wiring.lld.md`](../lld/a2ui-harness-wiring.lld.md) §4.

The standard a **catalog row** is authored against and graded by when a new A2UI component type is added
or an existing one extended. A row is the mapping from **one A2UI component type → one `ui-*` control
factory**, and it is three co-located artifacts that must agree:

1. the `catalog.json` component definition — `{ properties: { <name>: { type, bindable?, mapsTo } }, children?, value? }` (`packages/agent-ui/a2ui/src/catalog/default/catalog.json`);
2. the `WidgetFactory` in `defaultFactories` (`packages/agent-ui/a2ui/src/catalog/default/factories.ts`) — `{ tag, create, applyProp, value?, submitGate? }`;
3. the tests + example + doc comment that exercise and explain it.

Dimensions are typed **[gate]** (a named probe decides it — the anchor cites the realized script, it never
re-judges the verdict; `process.md` rule 1) or **[review]** (judgment grounded in `file:line` + the committed
probe results). Scale 1–5; 1 = failure, 3 = adequate, 5 = excellent. **The reference rows the anchors cite are
the ADR-0053 form-family rows** — `Field` · `FormProvider` · `Checkbox` · `Switch` · `Select` · `Option`
(`factories.ts` §"the ADR-0053 form-family rows", `catalog.json`).

## Dimensions

| # | Dimension | Type | What it checks | 1 → 3 → 5 (anchors cite the realized probe / a shipped row) |
|---|---|---|---|---|
| D1 | Name conformance | [gate] | Every declared component key, property name, and function name is a UAX-31 identifier outside the reserved `@` namespace — `validName` (`src/catalog/naming.ts`: `/^\p{ID_Start}\p{ID_Continue}*$/u` ∧ `s[0] !== '@'` ∧ non-empty); `loadCatalog` (`catalog.ts`) rejects a bad name with `CatalogError(CATALOG_NAME_INVALID)` | 1: a name `loadCatalog` rejects — a non-identifier (`my-widget`, a leading digit) or a reserved `@name` — so the catalog never loads, or a name site bypasses `validName` · 3: `naming.test.ts` + `catalog.test.ts` green — every name in the row (the component key, each property, any function) passes `validName` and `loadCatalog` accepts the row · 5: + a planted hyphenated / `@`-prefixed name trips `CATALOG_NAME_INVALID` at load across all three name sites (key · prop · function), shown as a negative control |
| D2 | Load & payload conformance | [gate] | The row loads and payloads validate against it — `validatePropDef`/`loadCatalog` accept the PropDef shape (`type` present, `mapsTo` a string, `bindable` boolean-or-absent; `children` ∈ `child`\|`children`\|`ChildList`; `value` = `{prop, event}`); `validateCatalogConformance` (`src/catalog/conformance.ts`) returns `[]` for a conformant node and one `CATALOG` failure for an unknown type / unknown property / type mismatch, honoring `RESERVED` = `{id, component, child, children, checks}` | 1: `loadCatalog` throws `CATALOG_MALFORMED` (missing `type`/`mapsTo`, bad `children`), or a conformant node draws a spurious `CATALOG` failure / an unknown property slips through · 3: `catalog.test.ts` + `conformance.test.ts` green — the row loads; a valid node returns `[]`; unknown-type / unknown-prop / type-mismatch each yield a `CATALOG` at the right `path`; a `checks`/`id`/`child` key is never flagged (RESERVED) · 5: + a `bindable` prop accepts a `{path}`/`{call}` binding via `matchesType`/`isBinding` and rejects a wrong-primitive literal, proven by a conformance case |
| D3 | Factory binding & coverage | [gate] | Every type declared in `catalog.json` has a `WidgetFactory` in `defaultFactories` — a gap is `CATALOG_FACTORY_MISSING` at `registry.register` (SPEC-R7 AC1); `create()` yields the real upgraded `ui-*` control (not an inert `HTMLUnknownElement`) and `applyProp` routes each declared property | 1: a declared type absent from `defaultFactories` (register throws `CATALOG_FACTORY_MISSING`), or `create()` returns an `HTMLUnknownElement` · 3: `default/index.test.ts` + `registry.test.ts` green — every `catalog.json` type resolves to a factory; `default/factories.test.ts` proves `create()` is the upgraded control and `applyProp` sets each property · 5: + a planted extra type with no factory trips `CATALOG_FACTORY_MISSING` (negative control), and importing the factory drags only its own control (tree-shake clean) |
| D4 | Mapping fidelity to the `ui-*` control | [review] | The PropDef set actually corresponds to the target control's real surface — each `mapsTo` names a reflecting prop/attribute the control exposes (or its bespoke light-DOM target); `value: {prop, event}` names the control's real bindable prop + a commit event in the allowlist (`change`·`input`·`select`·`open`·`close`·`toggle`); `bindable`/`submitGate` are claimed only where the control supports them (a `submitGate` control exposes `submit(): boolean`) | 1: a `mapsTo` names a prop the control lacks (the payload validates but renders inert), a non-identity `mapsTo` is routed through `accessorFactory` (the `factories.ts` INVARIANT — the prop silently never reflects), or a `value.event` outside the allowlist · 3: every `mapsTo` resolves to a real accessor/attribute; identity mappings ride `accessorFactory`, a non-identity one (`Checkbox.label` → `textContent`) rides a bespoke factory (`indicatorFactory`); `value` names the control's bindable prop + commit event (`Select` → `{value, select}`) · 5: + the binding contract matches the shipped family exactly — one `value` mark per component (`Select` declares `value` not `open`, avoiding a light-dismiss desync), `FormProvider` carries `submitGate:true` over a control that exposes `submit()`, and `Option`'s non-`ui-*` `div[role=option]` primitive is a sanctioned exception |
| D5 | PropDef typing idiom | [review] | Each PropDef `type` is a precise JSON-Schema fragment — a closed set is an `enum`, a flag is `boolean`, a structured prop carries an object schema with `required`; `bindable` marks exactly the props the renderer wires a bind for; the identity-vs-bespoke `mapsTo` split is honored | 1: stringly types where a closed set exists (`type`/`variant`/`size` as bare `string`), a structured prop with no `required`, or `bindable` blanket-set / omitted regardless of the control · 3: closed sets are enums (`TextField.type`'s 12-value enum, `size` = `[sm,md,lg]`), flags are `boolean`, `Button.action` is an object schema with `required:['action']`, and `bindable` matches the two-way props · 5: + nothing is over-wide relative to the shipped rows, `bindable` is set precisely where a bind is wired and nowhere else, and every non-identity `mapsTo` prop is kept off `accessorFactory` |
| D6 | Example & doc coverage per row | [review] | Each new/extended row ships test + example + doc coverage — a conformance/factory test exercising its props, a seed or examples page that renders it (`src/examples/`), and the factory's doc comment naming the mapping rationale + owning ADR | 1: a row with no factory/conformance test, no example that renders it, or an undocumented bespoke mapping · 3: `factories.test.ts`/`conformance.test.ts` cover the row's props, a seed or examples page renders it, and the factory carries a doc comment citing its ADR (the ADR-0053 block precedent) · 5: + coverage exercises the binding path and the bespoke `mapsTo`, an idiomatic seed shows the row in a realistic tree, and the doc comment states the mapping invariant (identity vs bespoke, the `value`-mark rationale) |

## Gate to promote (the row is admissible / shippable)

- **Every [gate] dimension (D1, D2, D3) ≥ 4 — hard.** A mechanically-checkable fact that fails blocks
  admission regardless of the review scores: a name the loader rejects (D1), a payload-conformance defect
  (D2), or a declared type absent from `defaultFactories` (D3) is not negotiable.
- **Every [review] dimension (D4, D5, D6) ≥ 4.**
- **No compensation across dimensions** — a 5 elsewhere cannot offset a sub-4 dimension.

A row is admissible/promotable when all six dimensions clear ≥ 4 **and** zero [gate] fails. The `a2ui-reviewer`
critic scores against this rubric in a fresh context (generator ≠ critic, SPEC-R8); the `validName` /
`validateCatalogConformance` / `loadCatalog` / `registry` probes are the deterministic half.

**Top failure to look for first:** a declared type missing from `defaultFactories` (D3 = 1 — the row never
registers, so nothing downstream matters), or a non-identity `mapsTo` routed through `accessorFactory`
(D4 = 1 — the row registers and payloads validate, yet the property silently never reflects onto the control).

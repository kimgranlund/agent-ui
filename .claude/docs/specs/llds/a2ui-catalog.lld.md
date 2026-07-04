# LLD — A2UI Catalog (default catalog · registry · validators)

> Status: proposed · v0.1 · 2026-06-26 · Layer: LLD (implementation plan)
> Implements: [`../specs/a2ui-catalog.spec.md`](../specs/a2ui-catalog.spec.md) (SPEC-R1..R9, SPEC-N1..N4), targeting A2UI **v1.0**. Consolidates the previously-planned `a2ui-default-catalog` + `a2ui-catalog-schema` LLDs.
> Altitude: adds the **how**; cites `SPEC-R*` for behavior. Catalog-conformance validation is contributed *into* the renderer's shared `validate.ts` (renderer LLD-C11) to preserve one-implementation parity.

---

## 1. Component map (traceability)

| ID | Component | Implements | File (under `packages/agent-ui/a2ui/src/catalog/`) |
|---|---|---|---|
| **LLD-C1** | Catalog schema model + loader | SPEC-R1 | `catalog.ts` |
| **LLD-C2** | Naming validator (UAX-31 / `@`) | SPEC-R2 | `naming.ts` |
| **LLD-C3** | CatalogRegistry | SPEC-R6, R7 | `registry.ts` |
| **LLD-C4** | Default catalog definition | SPEC-R3, R8 | `default/catalog.json` + `default/index.ts` |
| **LLD-C5** | Widget factories (ui-* bindings) | SPEC-R4, R3 | `default/factories.ts` |
| **LLD-C6** | Catalog-conformance validator | SPEC-R7, R9, N3 | `conformance.ts` (consumed by renderer `validate.ts`) |
| **LLD-C7** | Client function library | SPEC-R5 | `functions.ts` |
| **LLD-C8** | Theme / surfaceProperties applier | SPEC-R5 | `theme.ts` |

**Dependencies.** Factories (LLD-C5) import `ui-*` controls from `@agent-ui/components`. Conformance (LLD-C6) is called by the renderer's `validate.ts` and (transitively) by corpus admission — one implementation, three callers (SPEC-N3). Zero third-party deps (SPEC-N4).

## 2. Catalog model & loader — LLD-C1 (SPEC-R1)

```ts
// see catalog SPEC §5.1 for Catalog / ComponentDef / PropDef / FunctionDef
function loadCatalog(json: unknown): Catalog;   // parse + structural-validate; throws on malformed
```

**Load pipeline:** JSON-parse → assert top-level `catalogId`,`protocolVersion`,`components` → for each component assert `properties` typed + child model ∈ {`child`,`children`,`ChildList`} → run naming validator (LLD-C2) over every component/function/property name. **Invariant:** a loaded `Catalog` is structurally valid; downstream code never re-checks shape.

## 3. Naming validator — LLD-C2 (SPEC-R2)

`validName(s): boolean` = matches the UAX-31 identifier profile (start char ∈ ID_Start, rest ∈ ID_Continue) **and** does not begin with the reserved `@`. The `@` namespace (e.g. `@index`) is reserved for system context and is rejected in catalog-declared names. Implemented with a precompiled Unicode property regex (zero-dep; `\p{ID_Start}`/`\p{ID_Continue}` via the `u` flag). Failure → `CATALOG_NAME_INVALID`.

## 4. Registry — LLD-C3 (SPEC-R6, R7)

```ts
class Registry implements CatalogRegistry {
  #catalogs = new Map<string, { catalog: Catalog; factories: Record<string, WidgetFactory> }>();
  register(catalog, factories) {
    loadCatalog(catalog);                                   // re-assert (defensive)
    for (const name of Object.keys(catalog.components))
      if (!factories[name]) throw err("CATALOG_FACTORY_MISSING", name);   // SPEC-R7 AC1
    this.#catalogs.set(catalog.catalogId, { catalog, factories });
  }
  get(id) { return this.#catalogs.get(id); }
  supportedCatalogIds() { return [...this.#catalogs.keys()]; }            // → renderer capabilities (a2ui-runtime §3.7)
}
```

**Two-tier (SPEC-R6, N1):** a project calls `registry.register(projectCatalog, projectFactories)` — a public API, **0 edits to the package**. **Edge:** re-registering an existing `catalogId` replaces it (last-wins) and logs; a project catalog MAY shadow the default by reusing its id or use a fresh id. Unknown `catalogId` at `createSurface` is the renderer's `CATALOG_UNKNOWN` (the registry is the allowlist).

## 5. Default catalog + factories — LLD-C4, LLD-C5 (SPEC-R3, R4, R8)

`default/catalog.json` declares the component set of catalog SPEC §5.2; `default/factories.ts` provides one `WidgetFactory` per type, binding directly to a `ui-*` control — **no Basic-catalog adapter** (SPEC-R8).

```ts
const uiButton: WidgetFactory = {
  tag: "ui-button",
  create: () => document.createElement("ui-button"),
  applyProp: (el, prop, value) => {                         // A2UI prop → control prop/attr (PropDef.mapsTo)
    switch (prop) {
      case "variant": (el as any).variant = value; break;
      case "label":   el.textContent = String(value ?? ""); break;
      default: setAttr(el, prop, value);
    }
  },
};
// input factories declare value:{prop,event} so renderer LLD-C8 wires two-way binding generically (SPEC-R4)
const uiTextField: WidgetFactory = { tag: "ui-text-field", create: …, applyProp: … };
```

**G9 container family (decomp `s11`, SPEC §5.2 shipped).** The default catalog declares the container set
DIRECTLY (SPEC-R8): `Row`→`ui-row`, `Column`→`ui-column`, `Card`→`ui-card`, `Tabs`→`ui-tabs`, `Modal`→`ui-modal`,
plus the component-native region/item sub-types (the ratified *regions = sub-elements*) `CardHeader`/`CardContent`/`CardFooter`→`ui-card-{header,content,footer}` and `Tab`/`TabPanel`→`ui-tab`/`ui-tab-panel`. The container
family + `ui-text-field` share **one** `accessorFactory(tag, value?)` builder: every catalog property is declared
with `mapsTo` EQUAL to the control prop name (the SPEC-R8 1:1 reflection — surface axes, the flex grammar,
`selected`/`open`/`persistent`/`scroll`, the text-field value surface), so `applyProp` sets the JS accessor
directly (`el[prop] = value`) — no per-prop switch, unlike `Button.label`→`textContent`. **Two-way (SPEC-R4 / ADR-0019):**
`Tabs` declares `value:{prop:'selected',event:'select'}`, `Modal` declares `value:{prop:'open',event:'toggle'}`, and
the back-filled `TextField` declares `value:{prop:'value',event:'change'}` — all consumed by the renderer's generic
input controller (LLD-C8 / renderer `input.ts`, decomp `s10`). `ui-list`/`ui-grid` are NOT catalog types (direct
`ui-*` primitives — the ratified G9 scope, ADR-0016).

**Coverage discipline (SPEC-N2):** a component type whose control has not shipped is either omitted from `catalog.json` or carries `"x-status":"experimental"`; `loadCatalog` warns on an experimental type so there are no silent dead types. **Edge:** `Image`/`Video` stay absent until media primitives land (Assumption A-2).

**`textFactory` — a bespoke fan-out factory (ADR-0025, fanned out ADR-0078 cl.5).** `Text`'s catalog schema
is frozen (`text`→textContent bindable, `variant` ∈ `h1…h5 | caption | body`, catalog UNCHANGED by the
ADR-0078 control redesign); `ui-text` itself grew three orthogonal props (`as`/`variant`/`size`) that the
wire's one `variant` value cannot address 1:1, so `textFactory.applyProp` is bespoke like `Button.label`
rather than routed through `accessorFactory`: on `'variant'` it looks the wire value up in a fixed
`{as,variant,size}` table (nearest-M3-row per wire level; an unrecognized value falls back to the `body`
triple) and sets all three control accessors. The catalog stays protocol-faithful; the translation lives
entirely at the factory seam — zero payload/corpus/prompt churn (catalog spec §5.2 `Text` row, SPEC-R3 AC1).

## 6. Conformance validator — LLD-C6 (SPEC-R7, R9, N3)

The catalog-aware half of the shared validator. The renderer's `validate.ts` (renderer LLD-C11) composes this; so does corpus admission tier-1 (corpus LLD-C6) — single implementation, identical verdict (parity).

```ts
function validateCatalogConformance(component: A2uiComponent, catalog: Catalog): Failure[] {
  const def = catalog.components[component.component];
  if (!def) return [{ code: "CATALOG", path: component.id }];               // unknown type (SPEC-R9)
  const out: Failure[] = [];
  for (const [k, v] of Object.entries(component)) {
    if (RESERVED.has(k)) continue;                                          // id/component/child/children
    const pd = def.properties[k];
    if (!pd) { out.push({ code: "CATALOG", path: `${component.id}.${k}` }); continue; }
    if (!matchesType(v, pd, def)) out.push({ code: "CATALOG", path: `${component.id}.${k}` }); // typed-correct
  }
  return out;
}
```

**`matchesType`** accepts a literal matching `pd.type`, or — when `pd.bindable` — a `{path}` binding object (deferred resolution at render). **Security (SPEC-R9):** unknown component or property ⇒ `CATALOG` ⇒ not rendered (renderer placeholder); text props are passed to the control as text/attribute, never to an unsafe sink (no `innerHTML` from agent strings — the renderer's `unsafeHTML` directive is never wired to catalog text).

## 7. Functions & theming — LLD-C7, LLD-C8 (SPEC-R5)

**LLD-C7 functions (ADR-0026):** pure implementations keyed by name — `required(args)→{valid:!isEmpty(args.value), message?}`, `email(args)`, `regex(args)`. Each takes a **named-args object** (`Record<string, unknown>`), **not** positional params — A2UI v1.0 function-call args are a named object (`{ call, args: {…} }`), so `FunctionDef.args` is `Record<string, JsonSchema>` (corrected from the positional `JsonSchema[]`; see catalog SPEC-R5 / `catalog.ts`). The renderer's function evaluator (renderer LLD-C10) looks them up from the bound catalog's `functions` and resolves each arg recursively (a literal | a `{path}` | a nested `{call}`). Unknown name → `FUNCTION` (renderer surfaces, render-time). **`formatString` is dropped** — v1.0 composes strings via the **DynamicString `${…}` interpolation** feature (`${/path}` / `${fn(args)}`), a renderer-side string-resolution mechanism (a **scoped follow-up**, ADR-0026), not a catalog function; a project catalog MAY still register its own `formatString` (the registry is open). Validation **`checks`** (a component `checks:[{call,args,message}]` array) run through this same evaluator; the field-error display channel that *surfaces* a failed check (SPEC-R10 AC1) is a dependent follow-up.

**LLD-C8 theming:** `applySurfaceProperties(host, props, catalog)` validates `props` against `catalog.surfaceProperties` then sets CSS custom properties (`--ui-*` / `--md-sys-color-{family}-{role}`) on the surface host — **pure CSS-variable repoint, no JS restyle** (SPEC-R5 AC2), consistent with the dimensional token system. v0.9.x `theme` is normalized to `surfaceProperties` by the version adapter (renderer LLD-C2).

## 8. Error & edge-case handling

| Code / edge | Stage | Handling |
|---|---|---|
| `CATALOG_NAME_INVALID` | LLD-C2 | non-UAX-31 / leading `@` in a declared name → reject at load/register |
| `CATALOG_FACTORY_MISSING` | LLD-C3 | component without a registered factory → `register` throws (SPEC-R7 AC1) |
| `CATALOG_UNKNOWN` | renderer (registry miss) | `createSurface.catalogId` not registered → renderer error, no surface |
| `CATALOG` | LLD-C6 | unknown component type or property, or type mismatch → not rendered |
| duplicate `catalogId` | LLD-C3 | last-wins replace + log (intentional override path for projects) |
| experimental type used | LLD-C4 | renders if a factory exists; load-time warn; absent type → `CATALOG` |
| `bindable` prop given `{path}` | LLD-C6 | accepted; resolution deferred to renderer binding (renderer LLD-C5) |
| project catalog shadows default | LLD-C3 | allowed; `supportedCatalogIds` reflects the registered set |

## 9. File & integration plan

```
packages/agent-ui/a2ui/src/catalog/
  catalog.ts naming.ts registry.ts conformance.ts functions.ts theme.ts index.ts
  default/  catalog.json  factories.ts  index.ts
```

**Integration:** `conformance.ts` is imported by renderer `validate.ts` (renderer LLD-C11) → also reached by corpus admission. `registry.ts` + `WidgetFactory` are consumed by renderer widget resolution (renderer LLD-C7). `theme.ts` is called by the renderer surface on `createSurface` (renderer LLD-C3). `default/factories.ts` imports `ui-*` controls from `@agent-ui/components`. `supportedCatalogIds()` feeds renderer capabilities (renderer LLD-C12).

## 10. Build sequence (dependency-ordered; each step verifiable)

1. **LLD-C2 naming** — UAX-31 + `@` rejection; table-driven fixtures. *(checkpoint: reserved/invalid names rejected)*
2. **LLD-C1 catalog model + loader** — load/validate a fixture catalog; malformed throws.
3. **LLD-C3 registry** — register/get/supportedCatalogIds; factory-missing throws; duplicate-id replace. *(checkpoint: a synthetic 10-type project catalog registers with 0 package edits — SPEC-R6 AC1 / N1)*
4. **LLD-C6 conformance** — unknown-type / unknown-prop / type-mismatch → `CATALOG`; bindable accepts `{path}`. *(checkpoint: same verdict when called from renderer `validate.ts` and corpus admission — N3 parity)*
5. **LLD-C5 factories + LLD-C4 default catalog** — Button/TextField/Checkbox/Switch/Select/Field factories; `catalog.json` reflecting them. *(checkpoint: a default-catalog payload renders 0 `CATALOG` errors — SPEC-R3 AC2 / PRD-G1)* — **G9 (decomp `s11`)** extended this with the container family (`Row`/`Column`/`Card`+regions/`Tabs`+tab/panel/`Modal`, the shared `accessorFactory`), the two-way `value` binds (Tabs `select`, Modal `toggle`, the TextField `change` back-fill — ADR-0019), and the SPEC §5.2 experimental→shipped flip.
6. **LLD-C7 functions** — required/email/regex (pure, named-args; `formatString` dropped → DynamicString `${…}`, ADR-0026).
7. **LLD-C8 theming** — surfaceProperties → token-role repoint; v0.9.x `theme` normalized.
8. **Integration** — wire conformance into renderer `validate.ts`; factories into renderer widget resolution; the renderer's step-5 stub catalog is replaced by the real default catalog.

**Discovered-reality note:** if a `ui-*` control's prop surface cannot express an A2UI component property cleanly (e.g. `ChoicePicker.multipleSelection` with no `ui-select` analogue), that is a catalog SPEC gap — fix `a2ui-catalog.spec.md` §5.2 (and possibly request a control change against the component plan), do not hand-jam a mapping in `factories.ts`.

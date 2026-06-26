# SPEC — A2UI Catalog (default catalog + two-tier extensibility)

> Status: proposed · v0.1 · 2026-06-26 · Layer: SPEC (execution contract)
> Refines: [`../a2ui-expert-system.prd.md`](../a2ui-expert-system.prd.md) — primarily **PRD-G1, PRD-G2**; closes **PRD-D3**; supports PRD-G4, PRD-G6. Target protocol: **A2UI v1.0** (Constraint C1).
> Refined by: [`../llds/a2ui-catalog.lld.md`](../llds/a2ui-catalog.lld.md). Consumed by the renderer ([`./a2ui-runtime.spec.md`](./a2ui-runtime.spec.md) SPEC-R9) for widget resolution.
> Altitude: owns the **catalog contract + default-catalog coverage**. Renderer mechanics are the runtime SPEC's; storage/wiring is the LLD's.
> Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Define what an A2UI **catalog** is in `@agent-ui/a2ui`, the **default catalog** it ships (mapping A2UI component types onto the zero-dependency `@agent-ui/components` controls — PRD-G1), and the **two-tier extension surface** by which a downstream app/service registers its own catalog + renderer with zero edits to the package (PRD-G2).

A2UI fact this conforms to (Constraint C1): *a catalog is a JSON-Schema file declaring the components, functions, and themes an agent may use*, and A2UI explicitly recommends building catalogs that **directly reflect the client's design system rather than adapting a generic catalog**. That guidance *is* our design: the default catalog's component types render directly to `ui-*` controls — not a runtime adapter over A2UI's Basic catalog (this resolves **PRD-D3**, SPEC-R8).

## 2. Definitions

- **Catalog** — a JSON-Schema document (`catalog.json`) declaring component types, client functions, and the surface theme schema, identified by a `catalogId` and pinned to a protocol version.
- **Component definition** — one catalog entry: a type name, its typed property schema, its child model, and (in our implementation) the `ui-*` widget it renders to.
- **Widget factory** — the registered binding from a component type to a live `@agent-ui/components` control (consumed by renderer SPEC-R9).
- **Catalog registry** — the runtime allowlist of catalogs + factories a client supports; the two-tier extension point (SPEC-R6).

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 Catalog format

**SPEC-R1 — A catalog is a versioned JSON-Schema document.** A catalog MUST be a JSON-Schema (`catalog.json`) declaring `components`, `functions`, and a `surfaceProperties`/`theme` schema, carrying a `catalogId` and a pinned `protocolVersion`. Component child references MUST use the A2UI structural types (`ComponentId`, `ChildList`) so payloads are structurally validatable. *(→ PRD-G1, PRD-D3)*
- **AC1** *Given* a catalog document, *when* validated, *then* it is well-formed JSON Schema, declares ≥1 component, and every child-bearing component types its children as `ComponentId`/`ChildList`.

**SPEC-R2 — v1.0 naming discipline.** Component, function, and property names MUST satisfy A2UI v1.0 naming (Unicode UAX-31) and MUST NOT use the reserved `@` namespace (reserved for system context such as `@index`). *(→ PRD-G6)*
- **AC1** *Given* a catalog with a component named with a leading `@` or a non-UAX-31 identifier, *when* validated, *then* it is rejected with `CATALOG_NAME_INVALID`.

### 3.2 Default catalog

**SPEC-R3 — The default catalog reflects `@agent-ui/components`.** `@agent-ui/a2ui` MUST ship a default catalog whose component types render directly to `ui-*` controls. Initial coverage MUST track the control family (Assumption A-2); the mapping is normative in §5.2. Names SHOULD align with A2UI's Basic catalog where a component corresponds (e.g. `Button`, `TextField`, `Text`) for LLM familiarity and corpus reuse. *(→ PRD-G1)*
- **AC1** *Given* the default catalog, *when* loaded, *then* every declared component type resolves to a registered widget factory whose tag is a `ui-*` control (or a sanctioned primitive for `Text`/layout).
- **AC2** *Given* a default-catalog payload using only declared component types, *when* rendered by the renderer, *then* it renders interactive controls with 0 `CATALOG` errors (the PRD-G1 default-catalog eval condition).

**SPEC-R4 — Component definition contract.** Each component definition MUST declare: the type `name`; a typed `properties` schema (each property mapped to a control prop/attribute, marked `bindable` where it accepts `{path}`); the `value` property + event for input components (for two-way binding, renderer SPEC-R7); and the child model (`child`/`children`/`ChildList`). *(→ PRD-G1, PRD-G2)*
- **AC1** *Given* an input component (e.g. `TextField`), *when* defined, *then* it declares a `value` property and the control event that commits it; the renderer's input controller (renderer LLD-C8) binds them without per-component code.

**SPEC-R5 — Client functions & theming.** The default catalog MUST declare its client functions (at least `required`, `email`, `regex`, `formatString`) with typed signatures (evaluated by the renderer's function evaluator — a2ui-runtime §3.6), and a `surfaceProperties` schema mapping theme variables to the design system's `--ui-*` / `--c-{family}-{role}` token roles. *(→ PRD-G1)*
- **AC1** *Given* a `TextField` with a `required` check, *when* evaluated empty, *then* the declared function returns `{valid:false, message}`.
- **AC2** *Given* a `surfaceProperties` value on `createSurface`, *when* applied, *then* it repoints the corresponding token roles (no JS restyle — pure-CSS token indirection, per the dimensional system).

### 3.3 Two-tier extensibility

**SPEC-R6 — Project catalogs register with zero package edits.** A downstream app MUST be able to register a project-specific catalog (JSON Schema) and its widget factories through the public `CatalogRegistry`, announce them via `supportedCatalogIds`, and have the agent target one via `createSurface.catalogId` — **without editing `@agent-ui/a2ui`**. Project catalogs MAY extend or wholly replace the default. *(→ PRD-G2)*
- **AC1** *Given* a project catalog of ≥10 component types registered via the public API, *when* the package source is diffed, *then* there are 0 edits to `@agent-ui/a2ui` and ≤1 registration unit per component type (the PRD-G2 measurable).
- **AC2** *Given* a registered project `catalogId`, *when* a `createSurface` names it, *then* the renderer resolves that surface's components against the project catalog, and `capabilities()` lists it in `supportedCatalogIds`.
- **AC3** *Given* a `createSurface.catalogId` not in the registry, *when* applied, *then* the renderer emits `CATALOG_UNKNOWN` (renderer SPEC-R2 AC3) — the registry is the allowlist.

**SPEC-R7 — Catalog conformance validation.** The system MUST validate (a) a catalog document (well-formed, UAX-31 names, no reserved `@`, every component has a registered factory) and (b) a payload against its catalog (every `component` type and property exists and is typed-correct). Payload validation MUST be the same shared validator used by the renderer (a2ui-runtime §3.7) and corpus admission (corpus SPEC-N1). *(→ PRD-G4, PRD-G2)*
- **AC1** *Given* a catalog whose component lacks a registered factory, *when* registered, *then* registration fails with `CATALOG_FACTORY_MISSING`.
- **AC2** *Given* a payload referencing a property absent from the catalog component, *when* validated, *then* it fails with `CATALOG` (identical verdict in renderer and corpus gate).

**SPEC-R8 — Direct-design-system, not adapter (resolves PRD-D3).** The default catalog MUST be a first-party catalog reflecting `@agent-ui/components` directly; it MUST NOT be implemented as a runtime adapter translating A2UI's Basic catalog. Name alignment with Basic is permitted (SPEC-R3); structural adaptation is not. *(→ PRD-D3, PRD-G1)*
- **AC1** *Given* the default-catalog implementation, *when* inspected, *then* component types bind directly to `ui-*` factories with no Basic-catalog translation layer.

**SPEC-R9 — Security allowlist.** Only components present in the bound catalog MAY render; the renderer MUST validate agent-supplied properties against the component's typed schema and MUST NOT render unsanitized agent text into unsafe sinks. *(→ PRD-G4)*
- **AC1** *Given* a payload naming a component absent from the bound catalog, *when* rendered, *then* it does not render (placeholder + `CATALOG`, renderer SPEC-R9 AC2).

---

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Zero-edit extensibility | Registering a project catalog requires 0 edits to `@agent-ui/a2ui` and no rebuild of the package (PRD-G2). |
| **SPEC-N2** | Coverage tracks the family | The default catalog declares a component for each shipped control; an unshipped control's type is either absent or explicitly marked `experimental` (no silent dead types). Tracks Assumption A-2. |
| **SPEC-N3** | Validator parity | Catalog-conformance (SPEC-R7) is the same code path in renderer + corpus admission (one implementation). |
| **SPEC-N4** | Zero runtime deps | The default catalog + registry add no third-party runtime dependency (Constraint C2). |

## 5. Typed contracts

### 5.1 Catalog, component, registry

```ts
interface Catalog {
  catalogId: string; protocolVersion: string;             // SPEC-R1, R2
  components: Record<string, ComponentDef>;               // type name → def
  functions: Record<string, FunctionDef>;                 // SPEC-R5
  surfaceProperties?: JSONSchema;                          // theme schema (SPEC-R5)
}
interface ComponentDef {
  name: string;                                            // UAX-31, no leading '@' (SPEC-R2)
  properties: Record<string, PropDef>;
  children?: "child" | "children" | "ChildList";          // child model (SPEC-R4)
  value?: { prop: string; event: string };                // input two-way binding (SPEC-R4)
}
interface PropDef { type: JSONSchema; bindable?: boolean; mapsTo: string }   // A2UI prop → ui-* prop/attr
interface FunctionDef { args: JSONSchema[]; returns: JSONSchema }

interface WidgetFactory {                                  // consumed by renderer SPEC-R9 / LLD-C7
  tag: string;                                             // e.g. "ui-button"
  create(): HTMLElement;
  applyProp(el: HTMLElement, prop: string, value: unknown): void;
}
interface CatalogRegistry {                                // the two-tier extension point (SPEC-R6)
  register(catalog: Catalog, factories: Record<string, WidgetFactory>): void;  // throws CATALOG_FACTORY_MISSING / CATALOG_NAME_INVALID
  get(catalogId: string): { catalog: Catalog; factories: Record<string, WidgetFactory> } | undefined;
  supportedCatalogIds(): string[];                         // → renderer capabilities (a2ui-runtime §3.7)
}
```

### 5.2 Default catalog mapping (normative coverage)

Initial coverage tracks the control family (A-2). Types absent until their control ships are marked — no silent dead types (SPEC-N2).

| A2UI type | `ui-*` widget | Notes |
|---|---|---|
| `Button` | `ui-button` | `variant`→variant; triggers `action` |
| `TextField` | `ui-text-field` | `label`,`value`,`placeholder`(v1.0),`variant`(shortText/longText),`checks` |
| `Checkbox` | `ui-checkbox` | boolean `value`; Indicator class |
| `Switch` | `ui-switch` | boolean `value` |
| `ChoicePicker` | `ui-select` / `ui-listbox` | `options`,`variant`(mutuallyExclusive/multipleSelection) |
| `Field` | `ui-field` | label/description/error wrapper |
| `Text` | text primitive | `variant` styling hint; a minimal primitive until a `ui-text` lands |
| `Row` / `Column` / `Image` / `Video` / `Card` / `Tabs` / `Modal` | — | `experimental`/absent until layout & media primitives land (A-2) |

### 5.3 Error codes (catalog-scoped; payload codes shared with renderer §5.2)

| Code | Meaning | Raised by |
|---|---|---|
| `CATALOG_NAME_INVALID` | non-UAX-31 name or reserved `@` | SPEC-R2 |
| `CATALOG_FACTORY_MISSING` | component has no registered factory | SPEC-R6, R7 |
| `CATALOG_UNKNOWN` | `catalogId` not in registry | SPEC-R6 (renderer raises) |
| `CATALOG` | payload component/prop absent from catalog | SPEC-R7, R9 (shared validator) |

## 6. Open items (non-normative)

- **Per-component property maps** for controls not yet shipped are deferred to the LLD as the family grows (A-2); this SPEC fixes the contract, not every cell.
- **Theming depth** (full `surfaceProperties` → token-role table) is sketched in SPEC-R5; the exhaustive map is an LLD/`@agent-ui/shared` concern.

## 7. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1, R3, R4, R5 | PRD-G1 (default-catalog generation) |
| SPEC-R6, N1 | PRD-G2 (two-tier extensibility) |
| SPEC-R7, R9, N3 | PRD-G4 (validity/security) |
| SPEC-R2 | PRD-G6 (naming/version coherence) |
| SPEC-R8 | PRD-D3 (resolved: direct, not adapter) |

_Co-serves PRD-G1 with the runtime SPEC and PRD-G2/G4 with sibling SPECs. See [`../README.md`](../README.md)._

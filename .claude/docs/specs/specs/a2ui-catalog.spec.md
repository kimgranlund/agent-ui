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
- **AC1** *Given* the default catalog, *when* loaded, *then* every declared component type resolves to a registered widget factory whose tag is a `ui-*` control (or a sanctioned primitive, e.g. `Option` → `div[role=option]`, ADR-0053 — `Text` itself shipped as `ui-text`, ADR-0025). `Text`'s wire `variant` (`h1…h5 | caption | body`) is protocol-frozen and unchanged; the factory (not the catalog) fans it out to the control's three-axis `as`/`variant`/`size` props (ADR-0078 cl.5, §5.2's `Text` row) — a catalog-schema change was deliberately NOT taken (it would break protocol familiarity and invalidate the shipped corpus/examples/derived prompt).
- **AC2** *Given* a default-catalog payload using only declared component types, *when* rendered by the renderer, *then* it renders interactive controls with 0 `CATALOG` errors (the PRD-G1 default-catalog eval condition).

**SPEC-R4 — Component definition contract.** Each component definition MUST declare: the type `name`; a typed `properties` schema (each property mapped to a control prop/attribute, marked `bindable` where it accepts `{path}`); the `value` property + event for input components (for two-way binding, renderer SPEC-R7); and the child model (`child`/`children`/`ChildList`). A component MAY carry a **component-level `checks` array** — `[{call,args,message}]` validation entries (a function-call + a human message; the Button `{condition:{call,args},message}` wrapper is tolerantly read, ADR-0029) — a **component-level construct, not a bindable property** (it is `RESERVED`, never `applyProp`'d). The renderer evaluates checks **client-side** and surfaces a failure **inline** (an input → its validity message; a Button → auto-disable; a2ui-runtime SPEC-R10, ADR-0029); checks emit **no** server error. **Recognition is `RESERVED`-only**: a per-component *declaration* of which components accept `checks` is **deferred** — the catalog `validatePropDef` requires `mapsTo` on every declared property, so a no-`mapsTo` `checks` marker is infeasible without a validator extension (ADR-0029, a catalog-schema follow-up). A `checks` on a non-input/non-Button is accepted structurally and the controller no-ops (acceptable for a v1.0 renderer — it does not reject valid payloads). *(→ PRD-G1, PRD-G2, PRD-G4)*
- **AC1** *Given* an input component (e.g. `TextField`), *when* defined, *then* it declares a `value` property and the control event that commits it; the renderer's input controller (renderer LLD-C8) binds them without per-component code.
- **AC2** *Given* a payload carrying a `checks` array on a component, *when* validated, *then* conformance accepts it (no `CATALOG` for the `checks` key — it is `RESERVED`), and the renderer runs each entry's `{call,args}` through the function evaluator (ADR-0029); on an input/Button target the failure surfaces, else the controller no-ops.

**SPEC-R5 — Client functions & theming.** The default catalog MUST declare its client functions (at least `required`, `email`, `regex`) with typed **named-args** signatures (the A2UI v1.0 call shape `{ call, args: {…named…} }`; evaluated by the renderer's function evaluator — a2ui-runtime §3.6, SPEC-R10), and a `surfaceProperties` schema mapping theme variables to the design system's `--ui-*` / `--md-sys-color-{family}-{role}` token roles. String composition is the DynamicString `${…}` interpolation feature (a2ui-runtime SPEC-R10), **not** a `formatString` catalog function (ADR-0026); a project catalog MAY still register one. The `${…}` **path** interpolation arm is delivered (ADR-0027); the `${fn(arg:val)}` function-expression arm is a deferred follow-up (a project catalog needing in-string formatting today registers a `{call}`-form function instead). Each function declaration MAY carry a **`callableFrom`** enum (`clientOnly` | `remoteOnly` | `clientOrRemote`) governing the **server-initiated `callFunction` RPC** (a2ui-runtime SPEC-R14, ADR-0034): an undeclared `callableFrom` **defaults to `clientOnly`** (least authority — not server-invocable), and a server `callFunction` is rejected (`INVALID_FUNCTION_CALL`) for a `clientOnly` or unregistered function. The default catalog's `required`/`email`/`regex` are `clientOnly` (local validators); it **also** ships one benign server-invocable utility — **`ping` → `true`**, declared `callableFrom:'clientOrRemote'` (per v1.0's `pingServer` example) — the single server-invocable default function (a liveness check: no args, no side effects, a constant return), demonstrating SPEC-R14 end-to-end. `callableFrom` does **not** affect local function-bindings (SPEC-R10) — the two surfaces are distinct. **Collision semantic (ADR-0034 amendment): when a function name is declared in more than one registered catalog, the effective `callableFrom` is the MOST RESTRICTIVE across them — `clientOnly` is a HARD FLOOR.** A `callFunction` is server-invoked only if the function is registered AND **no** active catalog marks it `clientOnly` (every declaration is `remoteOnly`/`clientOrRemote`); any `clientOnly` declaration rejects it, **independent of registration order** (NOT first-match / most-permissive). This honors the two-tier "stricter overrides" model (a sibling may *tighten*, never *loosen*, a security boundary). *(→ PRD-G1, PRD-G7)*
- **AC1** *Given* a `TextField` with a `required` check, *when* evaluated empty, *then* the declared function returns `{valid:false, message}`.
- **AC3** *Given* a function declared `callableFrom:'clientOnly'` (or undeclared → defaults clientOnly), *when* a server `callFunction` targets it, *then* the renderer rejects with `INVALID_FUNCTION_CALL`; *given* `callableFrom:'clientOrRemote'`/`'remoteOnly'` (and no `clientOnly` sibling), *then* the renderer invokes it. *Given* the same name `clientOnly` in one catalog and `clientOrRemote` in a sibling, *then* it is **still rejected** (most-restrictive-wins, a2ui-runtime SPEC-R14 / ADR-0034 amendment).
- **AC4** *Given* the default catalog, *then* it declares `ping` (`callableFrom:'clientOrRemote'`, returns `true`); *when* a server `callFunction{call:'ping', wantResponse:true}` is handled, *then* the renderer emits `functionResponse{call:'ping', value:true}` with the verbatim `functionCallId` — the server-invocable default (vs `required`/`email`/`regex`, which reject as `clientOnly`).
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
interface FunctionDef { args: Record<string, JSONSchema>; returns: JSONSchema;   // NAMED args (A2UI v1.0 call shape; ADR-0026)
  callableFrom?: "clientOnly" | "remoteOnly" | "clientOrRemote" }                 // SPEC-R14/ADR-0034: server-invoke gate; default clientOnly

// Action-typed prop (`mapsTo: 'action'`, e.g. Button.action) — canonical inbound shape (ADR-0011,
// extended by ADR-0054):
//   { action: string; context?: object; wantResponse?: boolean; submit?: boolean }
//   // `action` = the action NAME (required); `submit` is CLIENT-consumed only (ADR-0054) — it gates
//   // the click on the nearest `submitGate` ancestor and NEVER reaches the emitted wire `action` message.
// PropDef.type carries this as the object schema { type: 'object', properties: { action, context,
// wantResponse }, required: ['action'] }; the renderer's tolerant reader keeps `name`/bare-string
// fallbacks (Postel), so the declaration stays open (no additionalProperties: false) — `submit` needs
// no catalog.json edit, the open schema already tolerates it (ADR-0054 clause 1).

interface WidgetFactory {                                  // consumed by renderer SPEC-R9 / LLD-C7
  tag: string;                                             // e.g. "ui-button"
  create(): HTMLElement;
  applyProp(el: HTMLElement, prop: string, value: unknown): void;
  value?: { prop: string; event: string };                 // input two-way commit (renderer LLD-C8)
  submitGate?: true;          // ADR-0054: marks this factory's control a submit-action gate. The
                               // control MUST expose a public `submit(): boolean` (structural contract) —
                               // FormProvider (→ ui-form-provider) is the default catalog's one gate.
}
interface CatalogRegistry {                                // the two-tier extension point (SPEC-R6)
  register(catalog: Catalog, factories: Record<string, WidgetFactory>): void;  // throws CATALOG_FACTORY_MISSING / CATALOG_NAME_INVALID
  get(catalogId: string): { catalog: Catalog; factories: Record<string, WidgetFactory> } | undefined;
  supportedCatalogIds(): string[];                         // → renderer capabilities (a2ui-runtime §3.7)
  submitGateSelector(): string;    // ADR-0054: CSS selector over every registered submitGate factory's
                                    // tag (two-tier, aggregated across ALL registered catalogs); '' when
                                    // none — callers MUST treat that as a no-op (never `closest('')`).
}
```

### 5.2 Default catalog mapping (normative coverage)

Initial coverage tracks the control family (A-2). Types absent until their control ships are marked — no silent dead types (SPEC-N2).

| A2UI type | `ui-*` widget | Notes |
|---|---|---|
| `Button` | `ui-button` | `variant`→variant; `action` object → click triggers the named action (shape per §5.1, ADR-0011; `submit:true` gates the click on the nearest `submitGate` ancestor, ADR-0054); `checks` → any failure auto-disables (ADR-0029) |
| `TextField` | `ui-text-field` | **shipped** (G6, widened ADR-0044/0047/0048/0053). `value`,`label`,`placeholder`,`size`,`readonly`,`disabled`,`required`,`name`,`checks` + the 12-value `type` enum (`text/email/url/tel/password/search/number/currency/unit/percent/date/time`) · `currency` (ISO-4217) · `unit` · `step`/`min`/`max` (generalized steppers + range validity) — all 1:1 reflecting accessor props (ADR-0053 cl.6); `value:{prop:'value',event:'change'}` |
| `Field` | `ui-field` | **shipped** (G7, ADR-0050/0051/0053). label/description/error wrapper; `label`,`description` bindable 1:1 accessor props; child model **`child`** (the ONE wrapped control) |
| `FormProvider` | `ui-form-provider` | **shipped** (G7, ADR-0050/0053/0054). **Zero properties** — mirrors the attribute-less coordination element faithfully; `ChildList` children; its factory carries the ADR-0054 `submitGate` mark (structural contract: the control exposes `submit(): boolean`) |
| `Checkbox` | `ui-checkbox` | **shipped** (Indicator class, ADR-0041/0042/0053). Bindable **`checked`** (boolean — NOT Basic's `value`, ADR-0053 fork F2 naming law); `label` (string → textContent, bespoke); `disabled`,`required`,`name`; `value:{prop:'checked',event:'change'}` |
| `Switch` | `ui-switch` | **shipped** (Indicator class, ADR-0053). As `Checkbox` minus `required` (deliberately no required row); bindable `checked`; `label`,`disabled`,`name`; `value:{prop:'checked',event:'change'}` |
| `Select` | `ui-select` | **shipped** (Wave 4, ADR-0043/0053) — **supersedes the planned `ChoicePicker`**. Bindable `value` (the selected `Option`'s key); `placeholder`,`disabled`,`required`,`name`; `value:{prop:'value',event:'select'}`; `ChildList` of `Option`. `open` is deliberately NOT declared — one `value` mark per component; a one-way `open` would silently desync on platform light-dismiss |
| `Option` | `div[role=option]` primitive | **shipped** (ADR-0053) — a sanctioned NON-`ui-*` primitive (the pre-`ui-text` `Text` precedent, SPEC-R3 AC1): `ui-select` moves `[role=option]` light-DOM children into its listbox panel at first connect. `value` → the `value` attribute (not bindable); bindable `label` → textContent. **Known limitation:** Options reach the panel only at FIRST connect — a later `updateComponents` adding Options to an already-connected `Select` does not reach the moved panel (the Tab/TabPanel class of limitation) |
| `Text` | `ui-text` | **shipped** (ADR-0025, the Display-class text primitive; the wire schema is UNCHANGED under ADR-0078's control redesign). `text`→textContent (bindable); `variant` (h1-h5/caption/body) fans out at the factory seam (`textFactory`, ADR-0078 cl.5) to the control's three-axis triple (`as`/`variant`/`size`): `h1→(h1,display,sm)` · `h2→(h2,headline,lg)` · `h3→(h3,headline,md)` · `h4→(h4,headline,sm)` · `h5→(h5,title,lg)` · `body→(none,body,md)` · `caption→(none,body,sm)`; an unrecognized value falls back to the `body` triple |
| `Row` | `ui-row` | **shipped** (G9, ADR-0016). `elevation`,`brightness` (surface, ADR-0015); `align`,`justify`,`gap`,`wrap` (flex grammar); `ChildList` children |
| `Column` | `ui-column` | **shipped** (G9). As `Row`, column main axis (direction is the tag's identity, not a prop) |
| `Card` | `ui-card` | **shipped** (G9). `elevation`,`brightness`; `ChildList` regions. **Composition note (ADR-0056):** children SHOULD be region sub-types (`CardHeader`/`CardContent`/`CardFooter`) — regions carry the spacing system and are REQUIRED for sticky header/footer + `scroll`; a region-less Card renders with the CSS humane-default padding (mercy, not parity); mixed region+loose children get no fallback (regions present ⇒ the author owns the structure) |
| `CardHeader` / `CardContent` / `CardFooter` | `ui-card-header` / `-content` / `-footer` | **shipped** (G9). Region sub-types — the ratified *regions = sub-elements* (component-native `ChildList` children, SPEC-R3/R4); `CardContent` adds `scroll` |
| `Tabs` | `ui-tabs` | **shipped** (G9). `elevation`,`brightness`; bindable `selected`; `value:{prop:'selected',event:'select'}` (two-way, renderer SPEC-R7 / ADR-0019); `ChildList` children |
| `Tab` / `TabPanel` | `ui-tab` / `ui-tab-panel` | **shipped** (G9). Tab + panel sub-types (`ChildList` children) |
| `Modal` | `ui-modal` | **shipped** (G9, ADR-0017 native `<dialog>`). `elevation`,`brightness`; bindable `open`; `persistent` (presence-boolean, default off → non-dismissable; `<ui-modal>` is dismissable, ADR-0020); `value:{prop:'open',event:'toggle'}` (two-way); `ChildList` children |
| `Image` / `Video` | — | `absent` until media primitives land (A-2) |

> **Deferred (not this wave, ADR-0053):** option groups (`role=group` optgroup parity), `RadioGroup`, `Slider`,
> `Calendar`, `ComboBox` rows; `datetime-local`/`month` stay out of the `TextField` `type` enum (unshipped
> STRETCH, ADR-0048). Absence is intentional, not a silent dead type (SPEC-N2).

> `ui-list` / `ui-grid` ship as **direct `ui-*` layout primitives**, NOT catalog types (the ratified G9 scope, ADR-0016): an agent composes the catalog `Row`/`Column`/`Card` set; `ui-list`/`ui-grid` are app-side primitives. Their omission is intentional, not a silent dead type (SPEC-N2).

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

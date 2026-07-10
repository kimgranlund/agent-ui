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

**SPEC-R3 — The default catalog reflects `@agent-ui/components`.** `@agent-ui/a2ui` MUST ship a default catalog whose component types render directly to `ui-*` controls. Coverage MUST span the **whole shipped `ui-*` fleet** per SPEC-N2 (ADR-0087) — every shipped control resolves to a catalog type or sits on the gate-encoded exclusion allowlist; the mapping is normative in §5.2. Names SHOULD align with A2UI's Basic catalog where a component corresponds (e.g. `Button`, `TextField`, `Text`) for LLM familiarity and corpus reuse. *(→ PRD-G1)*
- **AC1** *Given* the default catalog, *when* loaded, *then* every declared component type resolves to a registered widget factory whose tag is a `ui-*` control (or a sanctioned primitive, e.g. `Option` → `div[role=option]`, ADR-0053 — `Text` itself shipped as `ui-text`, ADR-0025).
- **AC3** *Given* the shipped `ui-*` fleet (the `controls/*/*.md` descriptor glob), *when* the fleet-derived coverage gate runs (SPEC-N2), *then* every descriptor's PascalCase type is declared in the catalog AND factory-bound, OR is on the exclusion allowlist with a recorded reason; a shipped control that is neither FAILS the gate. `Text`'s wire `variant` (`h1…h5 | caption | body`) is protocol-frozen and unchanged; the factory (not the catalog) fans it out to the control's three-axis `as`/`variant`/`size` props (ADR-0078 cl.5, §5.2's `Text` row) — a catalog-schema change was deliberately NOT taken (it would break protocol familiarity and invalidate the shipped corpus/examples/derived prompt).
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

**SPEC-R7 — Catalog conformance validation.** The system MUST validate (a) a catalog document (well-formed, UAX-31 names, no reserved `@`, every component has a registered factory) and (b) a payload against its catalog (every `component` type and property exists and is typed-correct, including membership in a declared `enum` for a literal value — ADR-0098). Payload validation MUST be the same shared validator used by the renderer (a2ui-runtime §3.7) and corpus admission (corpus SPEC-N1). *(→ PRD-G4, PRD-G2)*
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
| **SPEC-N2** | Coverage is whole-fleet or gate-encoded-allowlisted (ADR-0087) | Every shipped control (`packages/agent-ui/components/src/controls/*/*.md`) MUST resolve to a default-catalog component type, OR appear on the **exclusion allowlist** — a code-level set (in `catalog/default/index.test.ts`) whose every entry carries a recorded reason + citation. The coverage gate **derives** the expected primary-type set from the descriptor glob (the same source `site-coverage.test.ts` walks: `tag` → PascalCase), subtracts the allowlist, and asserts the remainder is declared in `catalog.json` AND factory-bound — so a shipped-but-uncatalogued control FAILS CI. The allowlist is the ONLY sanctioned form of "absent": no silent dead types (a declared type with no factory), no silent uncatalogued controls, no reliance on a per-type `experimental` marker. Composite sub-types (`Option`/`Tab`/`CardHeader`/… , `MenuItem`/`Radio`) are parent-declared and exempt from the fleet derivation (the reverse "no extra type without a factory" is already gated by `factories.test.ts`). Supersedes the pre-ADR-0087 "tracks the family / mark `experimental`" rule. |
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

Coverage spans the whole shipped `ui-*` fleet (SPEC-N2, ADR-0087): every shipped control resolves to a catalog type or sits on the §5.2.1 exclusion allowlist. The table below is the **shipped-and-catalogued** set — the 27 fleet descriptors landed through the ADR-0107 chart-family wave (13 primary Wave 0-baseline types + the 12 ADR-0087 types landed across Waves A/B/C + the 2 chart-family types, plus their composite sub-types), PLUS the 8 types landed by the report/content/feed catalog wave (ADR-0111/0113/0112, LLD-C12/C13 across the three families) — `Table`/`Stat`/`Badge`, `Code`/`Disclosure`, `Progress`/`Avatar`/`Attachment` — PLUS the 3 types landed by the token-surface catalog wave (ADR-0118, token-surfaces.lld.md LLD-C13, M2) — `Swatch`/`Ramp`/`Ladder` — PLUS the 2 types landed by the M4 app-surfaces panes wave (ADR-0120 cl.5, app-surfaces-m4.lld.md LLD-C8, app-surfaces-m4.spec.md SPEC-R6) — `Split`/`SplitPane` — now all resolve to a row here; the §5.2.1 allowlist holds only the documentary-only `Image`/`Video` residue plus the three PERMANENT non-catalogue entries `Toast`/`ToastRegion`/`ThemeProvider` (ADR-0112 cl.6 / ADR-0117 — app-surface/theming chrome, never agent-emittable). No silent dead types, no silent uncatalogued controls.

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
| `Text` | `ui-text` | **shipped** (ADR-0025, the Display-class text primitive; the wire schema is UNCHANGED under ADR-0078's control redesign). `text`→textContent (bindable); `variant` (h1-h5/caption/body) fans out at the factory seam (`textFactory`, ADR-0078 cl.5) to the control's three-axis triple (`as`/`variant`/`size`): `h1→(h1,display,sm)` · `h2→(h2,headline,lg)` · `h3→(h3,headline,md)` · `h4→(h4,headline,sm)` · `h5→(h5,title,lg)` · `body→(none,body,md)` · `caption→(none,body,sm)`; an unrecognized value falls back to the `body` triple. `truncate` (boolean, non-bindable, ADR-0106) — CSS-only single-line ellipsis; the control unconditionally mirrors its own text onto `title` while set (no ResizeObserver, no clipped-state measurement). `emphasis` (boolean, non-bindable, ADR-0109) — weight intent: the platform bold register (700), CSS-only (no stamp leg, no observer — `font-weight` inherits through the ADR-0078 cl.4 stamp-transparency reset). **Usage note (the ADR-0057 non-color-signifier spirit, extended to weight):** emphasis is visual-only and invisible to assistive tech — never make it the SOLE carrier of a distinction; reach for it on names/labels/key values, not whole paragraphs. **`href`** (string, bindable, `format: 'safe-href'`, ADR-0114/content-family LLD-C13) — the hyperlink capability: a non-empty `href` wins `as='a'` at the factory seam REGARDLESS of application order against `variant` (a heading VISUAL is kept, its semantics lost — the stated consequence); the value crosses TWO gates before it can ever navigate — the static validator's `format: 'safe-href'` check (an ABSOLUTE literal naming a disallowed scheme fails `CATALOG`; a relative/unparseable-without-base literal defers) and the component's OWN `safeHref` gate (`controls/text/href.ts`) at render, which resolves every value (including relatives) against `document.baseURI` and is the sole writer of the stamped `<a>`'s `href`/`rel`/`target` — denied or empty strips all three, rendering plain text, never an announced-broken link |
| `Row` | `ui-row` | **shipped** (G9, ADR-0016; `reflow` added ADR-0096). `elevation`,`brightness` (surface, ADR-0015); `align`,`justify`,`gap`,`wrap` (flex grammar); `reflow` (`auto` default·`locked` — gates the ADR-0016 cl.4 `@container` narrow→column switch; element-local, not part of the flex grammar); `ChildList` children. **Embedding contract (ADR-0100 cl.2, normative):** `Row`/`Column` never establish the query container their `@container` reflow rule resolves against — an intrinsically-sized layout primitive can never safely be one (it would zero its own content-driven size). An embedder mounting an A2UI surface (`host.mount()`) SHOULD establish `container-type: inline-size` on its mount boundary (a box with a definite, stretched, or track-sized inline size — never the primitive itself). Without one, the reflow rules never match and every `Row`/`Column` renders its own tag identity — graceful degradation, not corruption; this is never an axis flip, only a missed reflow opportunity |
| `Column` | `ui-column` | **shipped** (G9). As `Row`, column main axis (direction is the tag's identity, not a prop). `reflow` (`locked` default·`auto`, ADR-0096) — the per-tag default FLIPS relative to `Row`: a column no longer switches to a row under a wide container unless `reflow="auto"` is set, so the catalog's prop-only consumer can reach and pin the tag's own vertical identity. Same embedding contract as `Row` above — the query container is the embedder's mount boundary, never the column itself |
| `Card` | `ui-card` | **shipped** (G9). `elevation`,`brightness`; `ChildList` regions. **Composition note (ADR-0056):** children SHOULD be region sub-types (`CardHeader`/`CardContent`/`CardFooter`) — regions carry the spacing system and are REQUIRED for sticky header/footer + `scroll`; a region-less Card renders with the CSS humane-default padding (mercy, not parity); mixed region+loose children get no fallback (regions present ⇒ the author owns the structure) |
| `CardHeader` / `CardContent` / `CardFooter` | `ui-card-header` / `-content` / `-footer` | **shipped** (G9). Region sub-types — the ratified *regions = sub-elements* (component-native `ChildList` children, SPEC-R3/R4); `CardContent` adds `scroll` |
| `Tabs` | `ui-tabs` | **shipped** (G9). `elevation`,`brightness`; bindable `selected`; `value:{prop:'selected',event:'select'}` (two-way, renderer SPEC-R7 / ADR-0019); `ChildList` children. **Transparent by default (ADR-0104):** unlike `Card`/`Modal`, a bare `Tabs` no longer self-seeds a surface — it passes its parent's plane through (fixes the pattern-wizard double-surface, ticket #29); a model that wants a plane sets `elevation`/`brightness` explicitly, same mechanism as every other surface-bearing type |
| `Tab` / `TabPanel` | `ui-tab` / `ui-tab-panel` | **shipped** (G9). Tab + panel sub-types (`ChildList` children) |
| `Modal` | `ui-modal` | **shipped** (G9, ADR-0017 native `<dialog>`). `elevation`,`brightness`; bindable `open`; `persistent` (presence-boolean, default off → non-dismissable; `<ui-modal>` is dismissable, ADR-0020); `value:{prop:'open',event:'toggle'}` (two-way); `ChildList` children |
| `Icon` | `ui-icon` | **shipped** (ADR-0087 Wave A, ADR-0065/0066). Display leaf, the `Text` precedent — not an input, no children. Bindable `name` (re-resolves the active icon pack's glyph, empty clears the host) and `label` (accessible name: non-empty → `role=img`+`aria-label`; empty → decorative `aria-hidden`) — both 1:1 reflecting accessors |
| `Menu` | `ui-menu` (+ `MenuItem` sub-type) | **shipped** (ADR-0087 Wave A, overlay-controller.lld, ADR-0043). Bindable `open`; `placement` (8-value `OverlayPlacement` enum); `value:{prop:'open',event:'toggle'}` (two-way, platform-dismiss only). **Child model (Fork D/d2, builder-resolved):** a plain `ChildList` — verified against `menu.ts`, which has NO named-slot DOM mechanism; the FIRST child is the trigger (any renderable node, typically `Button`), remaining children are `MenuItem` rows the control moves into its panel and auto-tags `role=menuitem`. `MenuItem` (sanctioned NON-`ui-*` primitive, `div[role=menuitem]`, the `Option` precedent): `value` → the `data-value` ATTRIBUTE (verified against `menu.ts` `#commit`, not a plain `value` attribute); bindable `label` → textContent |
| `Popover` | `ui-popover` | **shipped** (ADR-0087 Wave A, overlay-controller.lld, ADR-0043). Bindable `open`; `placement` (8-value enum); `value:{prop:'open',event:'toggle'}`. **Child model:** a plain `ChildList`, same positional convention as `Menu` (Fork D/d2) — the FIRST child is the disclosure trigger, remaining children move into the control-created panel. No `PopoverTrigger`/`PopoverContent` sub-type pair: `ui-popover` has no named-slot mechanism to bind one to (the `.md`'s "slots" section documents the positional convention, not a literal `<slot>`), and wrapping the trigger would move `aria-expanded`/`aria-controls` onto a synthetic wrapper instead of the real interactive element |
| `Tooltip` | `ui-tooltip` | **shipped** (ADR-0087 Wave A, overlay-controller.lld, ADR-0043). As `Popover`, plus `delay` (ms before showing on hover; keyboard focus shows immediately, no delay). Same positional `ChildList` trigger/content resolution as `Popover` — the FIRST child is the anchor the tooltip describes (`aria-describedby`/`focusin`/`focusout` wire directly to it, so a wrapper node would break keyboard accessibility), remaining children move into the tooltip panel |
| `RadioGroup` | `ui-radio-group` (+ `Radio` sub-type) | **shipped** (ADR-0087 Wave B, closes the ADR-0053 deferral / Fork B; `value` bind added as a Wave B follow-up). `name`,`disabled`,`required` (bindable `disabled`) and `orientation` (`horizontal`/`vertical`) — ALL 1:1 reflecting accessor props; bindable `value`; `ChildList` of `Radio`. (`variant` — ADR-0086 — was RETIRED by ADR-0095: the segmented presentation is the standalone `ui-segmented-control`, a separate catalog type, not a RadioGroup axis.) **`orientation` now has a visual effect (ADR-0103):** the group owns its interior layout — a `column` flex stack by default, `[orientation='horizontal']` a wrapping row, gap off the `--ui-space` ladder — so the roving-focus (keyboard) axis and the rendered (visual) axis are the SAME source of truth; previously `orientation` moved only the keyboard axis and every group (either orientation) rendered as an inline-flex mash with zero gap. **`value:{prop:'value',event:'change'}` — live (component-builder closed the formerly-verified gap):** `UIRadioGroupElement` now exposes a public `value` getter/setter delegating to its private `#selectedValue` signal (the `UICheckboxElement.checked` precedent); `change` is the correct commit event (verified: `UIRadioGroupElement#commit` calls `this.emit('change')`), and a programmatic `value` write never self-emits. **Known limitation (tracked, not resolved):** the setter's "value matches no child `Radio`" path silently CLEARS the selection with no `change` emitted — if the renderer ever writes an unmatched `value` from a data update ahead of (or without) the matching `Radio` children present, it would silently blank a valid prior selection with no event to reconcile. `Radio` (the Wave A reviewer correction — a REAL row, `ui-radio` ships its own descriptor, NOT a gate-exempt composite like `Option`/`MenuItem`): bindable `checked`,`label` (→ textContent, bespoke) + `value`; no `value` mark of its own (the group owns the commit; an individually-bound Radio would desync on exclusivity — `#commit` unchecks siblings via direct property writes with no `change` event on them) |
| `Slider` | `ui-slider` | **shipped** (ADR-0087 Wave B, closes the ADR-0053 deferral / Fork C). Bindable `value`; `min`,`max`,`step`,`name`,`disabled`,`required` — all 1:1 reflecting accessor props (`UIRangeElement`). `value:{prop:'value',event:'change'}` — VERIFIED (not guessed) against `slider.ts`/`range-element.ts`: `input` fires on every live drag/keyboard step, `change` fires only on blur when the value moved since focus — the committed event, not the live one |
| `SliderMulti` | `ui-slider-multi` | **shipped** (ADR-0087 Wave B, Fork C RESOLVED — two types). `min`,`max`,`step`,`name`,`disabled` + bindable `valueLo`/`valueHi` — all REAL 1:1 reflecting accessor props (`sliderMultiProps`, verified against `slider-multi.ts`). **No `value` mark** — the ADR-0019 seam permits only ONE two-way slot per component and this control commits TWO values; `valueLo`/`valueHi` are bindable ONE-WAY only (agent-set literals or `{path}` reads — the control's own drag/keyboard commits do not write back through the current seam). The documented seam limitation, not a bug |
| `Calendar` | `ui-calendar` | **shipped** (ADR-0087 Wave B, closes the ADR-0053 deferral; range mode added by ADR-0093 clause 7 follow-up). Bindable `value` (ISO `YYYY-MM-DD`, `''` = no date); `min`,`max`,`name`,`required`,`disabled` — all 1:1 reflecting accessor props. `value:{prop:'value',event:'change'}` — `calendar.md`'s OWN descriptor already declares this exact bind; confirmed against `calendar.ts`'s `#commit` (`this.emit('change')` alongside `this.emit('select', iso)`). **`mode`** (`single`/`range`, default `single`, NOT bindable — a structural enum) selects which value surface is live (ADR-0093's one-live-value-surface rule); **`valueStart`/`valueEnd`** (ISO `YYYY-MM-DD`, bindable **one-way only**) carry the range pair — the `SliderMulti` limitation applies: the row's one two-way slot stays `value`, inert-but-harmless in `mode="range"`, since the catalog schema supports only one two-way bind per component. **Sizing (ADR-0105, no schema/prop change):** the rendered grid is fluid, not fixed-width — shrink-wrapped it renders at its compact floor (unchanged), but composed inside a stretching ancestor (e.g. `Field`/`Column`'s default `stretch` align, ADR-0030 — the `f_dates`/`cal_dates` shape the booking-reservation seed uses) the grid fills the width it is handed instead of sitting fixed-width in a half-empty panel (the ticket #30 defect this closes) |
| `ComboBox` | `ui-combo-box` | **shipped** (ADR-0087 Wave B, Fork D/combobox resolved). Bindable `value`,`label`; `placeholder`,`strict`,`name`,`disabled` — all 1:1 reflecting accessor props; `ChildList` of `Option` (the `Select` precedent). `value:{prop:'value',event:'change'}` — the FORM value, NOT `open`/`toggle` (the overlay-family shape); corrects a stale `combo-box.md` comment (copied from the overlay family before ComboBox's own form value was catalogued) that claimed the catalog bound `open`/`toggle`. `open` remains a real, independently settable prop on the control (drives the overlay panel) but carries no catalog property at all — one `value` mark per component |
| `List` | `ui-list` | **shipped** (ADR-0087 Wave C, Fork A RESOLVED INCLUDE — supersedes ADR-0016's non-catalog exclusion). A `Column` specialization carrying `role=list`. `elevation`,`brightness` (surface, ADR-0015); `align`,`justify`,`gap`,`wrap` (the shared flex grammar, ADR-0016 — `align` defaults to `stretch`, ADR-0030); `ChildList` children. Not an input (no `value` mark). **Usage guidance (Fork A's build condition):** use `List` (not `Column`) for a **homogeneous, itemized collection** where list semantics matter to assistive tech (search results, a feed, a to-do list) — `List` carries `role=list` for free; plain `Column` does not and should not fake it. Reach for `Row`/`Column` instead when the children are a deliberate, heterogeneous arrangement (a toolbar, a form's field stack) where no single semantic role unifies them; reach for `Grid` instead when the arrangement should reflow its column count responsively with available width |
| `Grid` | `ui-grid` | **shipped** (ADR-0087 Wave C, Fork A RESOLVED INCLUDE — supersedes ADR-0016's non-catalog exclusion). The auto-fit/`minmax()` track model. `elevation`,`brightness` (surface); `gap` (the one flex-grammar prop a track grid consumes); `min` (the `minmax()` track floor — an arbitrary CSS `<length>` string); `ChildList` children. Not an input. **Usage guidance (Fork A's build condition):** use `Grid` when the children should **reflow their column count responsively** with available width (an image/card gallery, a dashboard of tiles) — i.e. the layout wants intrinsic wrapping, not an author-picked fixed arrangement. Prefer `Row`/`Column` (with an explicit `wrap`) when the arrangement should stay author-controlled rather than auto-fit; reach for `List` instead of `Grid` when the children are an itemized collection needing list semantics, not a reflowing tile layout |
| `Split` | `ui-split` | **shipped** (M4, ADR-0120 cl.5, app-surfaces-m4.spec.md SPEC-R6/app-surfaces-m4.lld.md LLD-C1/C8). A multi-pane, user-resizable split container. `axis` (`horizontal`\|`vertical`, NOT bindable — a structural enum, the `Row`/`Column`-flex-grammar precedent); bindable `sizes` (`number[]`, the live ratio vector — the `Sparkline.values`/`BarChart.data` array-prop precedent); `value:{prop:'sizes',event:'change'}` (two-way — the renderer's generic input controller reads/writes the array property verbatim on drag-end/keyboard-step commit, no bespoke factory needed); `ChildList` of `SplitPane`. The resize gesture is a **host-owned affordance**, exactly as `Slider`'s drag is (the F-catalog resolution — a `Split` container row over an `EXCLUSION_ALLOWLIST` entry). **Excluded from the feed sub-catalog** (`FEED_EXCLUDED`, ADR-0097 §3) — a user-resizable multi-pane layout is app-surface/canvas-scale chrome, the `Grid`/`List` "elaborate dashboard" reasoning applied to panes: no room for a drag-resize affordance inside a chat-bubble-sized ask |
| `SplitPane` | `ui-split-pane` | **shipped** (M4, ADR-0120 cl.5, SPEC-R1/R2). The generic pane child of `Split` — a structural region sub-type, the `CardHeader`/`-Content`/`-Footer` precedent (regions = sub-elements, own catalog row, `ChildList` children). `initial` (a one-time ratio seed consulted only at connect/pane-count-change, NOT bindable — the `Slider.min`/`max`/`step` structural-config precedent); `min`/`max` (CSS length strings, structural, NOT bindable); `collapsible` (a structural capability gate, NOT bindable — deliberately not the fleet's `disabled` dynamic-enablement idiom). No `value` mark of its own — the parent `Split` owns the two-way commit (the `Radio`/`RadioGroup` precedent). Excluded from the feed sub-catalog alongside its parent (composite closure) |
| `Sparkline` | `ui-sparkline` | **shipped** (ADR-0107, chart-family v1 — a Display-class series-shape mark, chart-family.spec.md SPEC-R1..R4). Bindable `values` (array of number, `mapsTo: values` — the JSON-emittable series a model produces, e.g. `[3,5,4,8,7]`); bindable `label` (string, the accessible context, e.g. "Revenue trend"); `variant` (`line`/`area`, non-bindable — a structural enum, the `orientation`/`placement` precedent). Display-only row: no `value:{prop,event}` mark, no children. `role=img` + a generated accessible summary ride the control itself (SPEC-R4), not the catalog. **Usage:** the shape of a series — see the when-to-use guidance below |
| `BarChart` | `ui-bar-chart` | **shipped** (ADR-0107, chart-family v1 — a Display-class magnitude-comparison bar list, chart-family.spec.md SPEC-R5..R8, fork F2). Bindable `data` (array of `{label: string, value: number}` objects, `mapsTo: data` — e.g. `[{"label":"EMEA","value":42},{"label":"APAC","value":31}]`); bindable `label` (string, the list's accessible name — SPEC-R8: unlabeled is legal). Display-only row: no `value:{prop,event}` mark, no children (every row is component-built from `data`). The row declares the full nested item schema (`label`/`value`); the shared validator accepts literal arrays/objects at top-level `type` depth only (deeper per-item checking is permitted, not required — component hardening, SPEC-R7, is the safety net either way). **Usage:** comparing magnitudes — see the when-to-use guidance below |
| `Table` | `ui-table` | **shipped** (ADR-0111, report-family v1, report-family.spec.md SPEC-R1..R6). A real, stamped `<table>` — bindable `columns` (`{key,label,type}[]`, `type` ∈ `string`\|`number`) and `rows` (open-record array, `bindable`); `label` (bindable, renders the `<caption>` + names the interior scroll region). Display-only leaf: no `value` mark, no children (every row is component-built from `rows`) |
| `Stat` | `ui-stat` | **shipped** (ADR-0111, report-family v1, SPEC-R7..R10). A metric tile — bindable `label`/`value` (string\|number union)/`delta` (number)/`caption`; no heading stamp (a stat's value is not a document heading). Display-only leaf: no `value:{prop,event}` mark, no children |
| `Badge` | `ui-badge` | **shipped** (ADR-0111, report-family v1, SPEC-R11..R13). A non-interactive status/label token — bindable `label` and `intent` (`neutral`\|`info`\|`success`\|`warning`\|`danger`, BINDABLE per ADR-0111 cl.2: an unknown bound value snaps to `neutral` at the component, not the static validator). Display-only leaf: no `value` mark, no children |
| `Code` | `ui-code` | **shipped** (ADR-0113, content-family v1, content-family.spec.md SPEC-R1/R3/R5). A zero-machinery verbatim code leaf — bindable `code`→textContent (bespoke `mapsTo`, the `Text.text`/`Button.label` non-identity precedent); `language` (string, inert metadata, NOT bindable — no rendering effect consumes it). Display-only leaf: `internals.role='code'`, no children |
| `Disclosure` | `ui-disclosure` | **shipped** (ADR-0113, content-family v1, SPEC-R14..R18). A native-`<details>` fold — bindable `summary`/`open`; `value:{prop:'open',event:'toggle'}` (two-way, ADR-0101 always-announce law — a model-driven transition announces exactly once, same as a user click); `ChildList` children (the folded body content) |
| `Progress` | `ui-progress` | **shipped** (ADR-0112, feed-family v1, feed-family.spec.md SPEC-R1..R3). A thin-rail progress bar — bindable `value` (number\|null; `null`/non-finite ⇒ INDETERMINATE, the native `<progress>` semantic, no separate boolean to desync), `max`, `label`. Display-only leaf: no `value:{prop,event}` mark (not an input), no children |
| `Avatar` | `ui-avatar` | **shipped** (ADR-0112, feed-family v1, SPEC-R4..R7). A non-interactive identity mark with a three-step fallback chain (image → initials → person glyph) that never renders broken or empty — bindable `src`/`name`/`label` (the a11y escape hatch: decorative by default, `label` opts into `role=img`); `size` (`sm`\|`md`\|`lg`, NOT bindable — the widget-box compact-ramp geometry class, the `TextField.size` precedent). No `value` mark |
| `Attachment` | `ui-attachment` | **shipped** (ADR-0112, feed-family v1, SPEC-R8..R11). A `FilePart`-aligned compact file card — bindable `name` (falls back to the file category's label when empty, never blank), `mimeType` (drives the category glyph), `sizeBytes` (bytes; the catalog property KEY matches the control's own accessor name — ADR-0112 Amendment 1 renamed it away from `size` specifically to avoid the fleet's reserved widget-tier `[sm,md,lg]` geometry enum name; **deliberately not a wire field** — `A2aFilePart` carries none, so this is conventionally embedder-supplied via a data-model bind rather than an agent-authored literal), `href` (`format: 'safe-href'`, the same two-gate contract as `Text.href`, ADR-0114) — its RENDERING leg (the name cell becoming a native `<a>`) is a separately-tracked component-side follow-up (feed-family LLD-C6); the catalog/factory wiring is correct today and inert until that leg lands. Display-only leaf: no `value` mark, no children |
| `Swatch` | `ui-swatch` | **shipped** (ADR-0118, token-surfaces v1, token-surfaces.spec.md SPEC-R1..R4, M2 catalog wave LLD-C13). A Display-class color-identity leaf — bindable `value` (a literal CSS color or a `--var` name, the shared `--var` lane resolves it live) and `label` (the token name/caption); `scheme` (`auto`\|`light`\|`dark`, NOT bindable — a structural rendering axis, the `Sparkline.variant`/`Avatar.size` precedent). Display-only leaf: no `value:{prop,event}` mark, no children. `role=img` + a composed accessible name (`label`, `', '`, `value`) ride the control itself (SPEC-R4), not the catalog. **Usage:** one color's identity — see the when-to-use guidance below |
| `Ramp` | `ui-ramp` | **shipped** (ADR-0118, token-surfaces v1, SPEC-R5..R8, M2 catalog wave LLD-C13). A Display-class ordered-color-series leaf — bindable `steps` (array of `{label: string, value: string}` objects, `mapsTo: steps` — the JSON-emittable series a model produces, e.g. `[{"label":"100","value":"#eef"},{"label":"900","value":"#003"}]`; order IS the content) and `label` (the strip's accessible name); `scheme` (`auto`\|`light`\|`dark`, NOT bindable, pins the whole strip). Display-only row: no `value:{prop,event}` mark, no children (every cell is component-built from `steps`). **Usage:** an ordered color progression / palette range — see the when-to-use guidance below |
| `Ladder` | `ui-ladder` | **shipped** (ADR-0118, token-surfaces v1, SPEC-R9..R12, M2 catalog wave LLD-C13). A Display-class labeled-dimensional-tiers leaf — bindable `tiers` (array of `{label: string, value: string}` objects, `mapsTo: tiers` — a literal CSS length per tier, e.g. `[{"label":"sm","value":"24px"},{"label":"lg","value":"36px"}]`, rendered at its real length, capped to the track) and `label` (the list's accessible name); no `scheme` (dimensions are scheme-invariant). Display-only row: no `value:{prop,event}` mark, no children. **Usage:** dimensional rhythm — see the when-to-use guidance below |
| `Image` / `Video` | — | on the §5.2.1 exclusion allowlist until media primitives land (no shipped `ui-image`/`ui-video` control) |

#### 5.2.1 Exclusion allowlist (the ONLY sanctioned "absent" — SPEC-N2, ADR-0087)

Under ADR-0087 the default catalog covers the whole shipped fleet: a control is either catalogued (§5.2) or on
this allowlist with a recorded reason. The allowlist is **code-encoded** in `catalog/default/index.test.ts` (the
gate reads it); this table is its documentary mirror. All four ADR-0087 forks are now RESOLVED INCLUDE (Kim,
2026-07-06) and every fork-deferred type has landed (Waves A/B/C). The report/content/feed catalog wave
(ADR-0111/0113/0112) drained the eight temporary "shipped ahead of its catalog row" seeds it had accumulated
(`Table`/`Stat`/`Badge`/`Code`/`Disclosure`/`Progress`/`Avatar`/`Attachment`), and the token-surface M2 wave
(ADR-0118) drained the three it had seeded at M1 (`Swatch`/`Ramp`/`Ladder`, token-surfaces.lld.md LLD-C10) —
the code `EXCLUSION_ALLOWLIST` now holds exactly **three PERMANENT entries**, `Toast`/`ToastRegion`/
`ThemeProvider` (ADR-0112 cl.6 / ADR-0117 — app-surface/theming chrome, never agent-emittable, never
catalogue-bound at all); the only OTHER row left is the documentary-only `Image`/`Video` entry, which never
enters the derived set to begin with.

| Control (fleet tag) | Planned catalog type | State | Reason / fork |
|---|---|---|---|
| `ui-toast` | `Toast` | **PERMANENT exclusion — code-encoded** | ADR-0112 cl.6: app-surface chrome driven by `show()`, not agent-emittable (a self-expiring record breaks history-must-not-lie; agent-raised chrome breaks payload↔DOM traceability; the ADR-0097 partition bans overlays in asks) — never catalogued, no LLD wave ever adds a row for it. |
| `ui-toast-region` | `ToastRegion` | **PERMANENT exclusion — code-encoded** | ADR-0112 cl.6 — the Toast host surface; same three reasons; consumed by page code only, never a catalog row. |
| `ui-theme-provider` | `ThemeProvider` | **PERMANENT exclusion — code-encoded** | ADR-0117 / theme-provider.spec.md SPEC-R8: page/app-owner theming chrome establishing a color-scheme subtree, not agent-emittable content (the ADR-0112 cl.6 Toast/ToastRegion reasoning applied verbatim) — never catalogued. |
| *(no control)* `Image`/`Video` | `Image`/`Video` | **documentary-only — NOT in the code set** | no shipped `ui-image`/`ui-video` descriptor, so the fleet-derived gate never derives these rows and the code `EXCLUSION_ALLOWLIST` carries no entry for them; this row exists only so a reader isn't left wondering where media types went. Catalogued (and this row deleted) when the media primitives land. |

> The `TextField` `type` enum keeps `datetime-local`/`month` OUT (unshipped STRETCH, ADR-0048) — a value-enum
> gap inside a catalogued type, not a fleet-coverage exclusion (so not an allowlist row).
>
> Select's `role=group` optgroup parity (ADR-0053's original deferred note also listed "option groups") is
> consciously dropped from this table: it is an intra-type affordance gap on the already-catalogued `Option`
> children, not a fleet-coverage exclusion — tracked, if at all, as a `Select`/`Option` follow-up, not here.
>
> **`List`/`Grid` usage guidance (ADR-0087 Fork A condition, Kim 2026-07-06 — landed in the `List`/`Grid` §5.2
> row Notes above, prompt-facing, not only here):**
> - **`Row`/`Column`** — the general flex-grammar primitives. Use for a deliberate, heterogeneous arrangement
>   (a toolbar, a form's field stack, a card's internal sections) where no single semantic role unifies the
>   children.
> - **`List`** — a `Column` specialization. Use for a homogeneous, itemized collection where list semantics
>   matter to assistive tech (search results, a feed, a to-do list) — `List` carries `role=list` for free;
>   plain `Column` does not and should not fake it.
> - **`Grid`** — the auto-fit track model. Use when the column count should reflow responsively with available
>   width (an image/card gallery, a dashboard of tiles). Prefer `Row`/`Column` (with an explicit `wrap`) when
>   the arrangement should stay author-controlled rather than auto-fit.
>
> **Landed state:** all four ADR-0087 forks are RESOLVED INCLUDE (Kim, 2026-07-06) and all four waves (A/B/C)
> have landed their rows; no fork-deferred residue remains. The wave M1 chart family (`BarChart`/`Sparkline`,
> ADR-0107) seeded, then drained, its own temporary allowlist entries at LLD-C10 (chart-family.lld.md §5/§9).
> The report/content/feed catalog wave (ADR-0111/0113/0112) seeded, then drained, EIGHT temporary entries the
> same way (report-family.lld.md LLD-C12, content-family.lld.md LLD-C13, feed-family.lld.md LLD-C13). The
> token-surface family (ADR-0118) seeded THREE temporary entries at M1 and drained them at this M2 wave
> (token-surfaces.lld.md LLD-C10/LLD-C13) — the code `EXCLUSION_ALLOWLIST` now holds only the three PERMANENT
> `Toast`/`ToastRegion`/`ThemeProvider` entries (never drained, never catalogued) plus the documentary-only
> `Image`/`Video` table row above (never code-encoded at all).
>
> **Chart-vs-stat-vs-table usage guidance (ADR-0107 cl.6 + ADR-0111 cl.6, chart-family.spec.md SPEC-R14 /
> report-family.spec.md SPEC-R20 — the four-way rule, re-based M2, landed in the `Sparkline`/`BarChart`/
> `Table`/`Stat` §5.2 row Notes above, prompt-facing, not only here):** `Stat` for a latest value ·
> `Sparkline` for the shape of a series · `BarChart` for comparing magnitudes · `Table` when exact values
> must be scanned row-by-row.
>
> **Text-vs-Code-vs-Disclosure-vs-link usage guidance (ADR-0113 cl.5, content-family.spec.md SPEC-R23,
> ADR-0087 Fork-A style — prompt-facing, not only here):** `Text` for prose · `Code` for verbatim/
> preformatted output (never for emphasis) · `Disclosure` for progressive detail (never hide the primary
> answer or a required control) · links (`Text.href`) for sources and references (`https`; never bare
> navigation-as-action — actions are `Button`s).
>
> **Avatar-vs-Progress-vs-Attachment usage guidance (ADR-0112 cl.6, feed-family.spec.md SPEC-R22 — prompt-
> facing, not only here):** `Avatar` for who acted — beside a name, decorative · `Progress` for how far
> along — indeterminate unless a real fraction exists · `Attachment` for what was produced — never a
> hand-built `Icon`+`Text` card. **TaskState pairing** (guidance prose only — no `@agent-ui/a2a` import
> anywhere in this family, SPEC-N6): `submitted`/`working` → indeterminate, or determinate when the agent
> reports a fraction; `input-required` → an ask, never a progress bar; terminal states → no bar —
> completion announcements are toast/app-chrome territory.
>
> **Tile-vs-Swatch/Ramp-vs-Ladder-vs-Table usage guidance (ADR-0118 cl.6, token-surfaces.spec.md SPEC-R18 —
> prompt-facing, not only here):** `Stat` for a single metric tile (a number, not a token) · `Swatch`/`Ramp`
> for color identity/relationships — one named color (`Swatch`) or an ordered progression / palette range
> (`Ramp`; a semantic role SET is not an ordered progression — reach for individual `Swatch`es instead, never
> fake a `Ramp` out of unordered roles) · `Ladder` for dimensional rhythm — labeled tiers rendered at their
> real, literal length (never cross-tier normalized) · a `Table` when exact strings must be scanned
> row-by-row instead of read as shape/magnitude/rhythm. All three token-surface types are **report/reference
> content, never an ask affordance** — they carry no `value` mark and are excluded from the feed sub-catalog
> (`FEED_EXCLUDED`, ADR-0097 §3) the same way `Sparkline`/`BarChart`/`Stat`/`Table` are.

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
| SPEC-R3 AC3, N2 | PRD-G6 (whole-fleet coverage — the anti-drift catalog↔fleet gate, ADR-0087) |
| SPEC-R8 | PRD-D3 (resolved: direct, not adapter) |

_Co-serves PRD-G1 with the runtime SPEC and PRD-G2/G4 with sibling SPECs. See [`../README.md`](../README.md)._

# SPEC — A2UI Runtime (`@agent-ui/a2ui` renderer)

> Status: proposed · v0.1 · 2026-06-26 · Layer: SPEC (execution contract)
> Refines: [`../a2ui-expert-system.prd.md`](../a2ui-expert-system.prd.md) — primarily **PRD-G1**; supports PRD-G2, PRD-G4, PRD-G6, PRD-G7. Target protocol: **A2UI v1.0** (Constraint C1; v0.9.1 supported via version pin).
> Refined by: [`../llds/a2ui-renderer.lld.md`](../llds/a2ui-renderer.lld.md). The component **catalog** (type→widget mapping) is owned by [`./a2ui-catalog.spec.md`](./a2ui-catalog.spec.md); this SPEC owns the *runtime that consumes a stream and drives a catalog*.
> Altitude: owns the renderer **behavior + message contract**. Module/signal internals are the LLD's. Requirements reference PRD goal IDs; they do not restate them.
> Requirement IDs are file-scoped (`SPEC-R1…`); cross-document references qualify by doc name (e.g. "corpus SPEC-R8").

---

## 1. Purpose

Define the behavior of `@agent-ui/a2ui`'s **zero-dependency native renderer**: the client that consumes an ordered A2UI v1.0 message stream and progressively renders it into live, interactive `@agent-ui/components` controls, closing the gap that A2UI's upstream Lit/`web_core` renderers cannot (they violate Constraint **C2**). This is the foundation milestone **A1** and the substrate the catalog (PRD-G2), gates (PRD-G4), and pipelines (PRD-G7) build on.

A2UI facts this SPEC conforms to (external; Constraint C1): the message envelope, the flat adjacency-list component model, JSON-Pointer data binding, progressive rendering, and the v1.0 action request/response model. They are cited, not redefined.

## 2. Definitions

- **Surface** — an isolated UI context keyed by `surfaceId`, bound to one catalog, with its own component set and data model.
- **Message** — one JSON object from the stream (server→client) or to the server (client→server), §5.
- **Binding** — a value that is a literal, a `{ "path": <JSONPointer> }` reference resolved against the surface data model, or a **function call** `{ "call": <name>, "args"?: {…} }` evaluated client-side (SPEC-R10). A literal **string** is additionally a **DynamicString**: at *runtime* a string containing an unescaped `${…}` is an interpolation template, re-resolved against the data model (SPEC-R10, ADR-0027) — the literal-string arm is therefore not always opaque, though the wire shape is unchanged (a DynamicString is a plain JSON string).
- **Widget** — a live `@agent-ui/components` control instance the renderer creates for a component node, via the catalog (a2ui-catalog SPEC).

---

## 3. Requirements

Normative per RFC 2119. Each carries a stable ID, a PRD trace, and acceptance criteria.

### 3.1 Stream consumption

**SPEC-R1 — Line-delimited message ingestion + dispatch.** The renderer MUST consume a JSONL stream, decoding each line as one message and dispatching by its top-level type (`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`, `actionResponse`). Messages MUST be applied in arrival order. *(→ PRD-G1)*
- **AC1** *Given* a stream of N well-formed messages, *when* ingested, *then* each is dispatched to its handler exactly once, in order.
- **AC2** *Given* a malformed line, *when* ingested, *then* the renderer emits an `error` (§5.2, code `PARSE`) and continues with the next line without tearing down existing surfaces (SPEC-N4).

### 3.2 Surface lifecycle

**SPEC-R2 — Surface create/delete.** On `createSurface` the renderer MUST create a surface keyed by `surfaceId`, bind its `catalogId`, register `surfaceProperties` (v1.0; `theme` accepted for v0.9.x) and `sendDataModel`, and prepare empty component + data state. On `deleteSurface` it MUST release the surface and all its components, data, widgets, and listeners. *(→ PRD-G1)*
- **AC1** *Given* a `createSurface{surfaceId,catalogId}`, *when* applied, *then* a surface exists bound to that catalog with empty component/data state.
- **AC2** *Given* a `deleteSurface`, *when* applied, *then* the surface's widgets are disconnected and its memory released (no retained signals/listeners — provable per SPEC-N3).
- **AC3** *Given* a `createSurface` whose `catalogId` is unknown, *when* applied, *then* the renderer emits `error{code:"CATALOG_UNKNOWN"}` and does not create the surface.

### 3.3 Component tree & progressive rendering

**SPEC-R3 — Buffer, reconstruct, render-on-root.** `updateComponents` MUST buffer flat components by `id`, reconstruct the tree via `child`/`children` ID references, and begin rendering as soon as a valid `root` exists (there is no explicit "begin" signal in v0.9.1+). Exactly one `root` per surface. *(→ PRD-G1)*
- **AC1** *Given* components including `id:"root"`, *when* applied, *then* the surface renders the tree rooted at `root`.
- **AC2** *Given* a second component with `id:"root"`, *when* applied, *then* the renderer emits `error{code:"IDGRAPH"}` and does not replace the existing root.

**SPEC-R4 — Out-of-order / incomplete tolerance.** A component MAY reference a `child`/`children` ID not yet delivered, or a `path` not yet in the data model. The renderer MUST render what is available, hold unresolved references, and patch them in when later messages arrive — never blocking or erroring on a not-yet-defined reference. *(→ PRD-G1)*
- **AC1** *Given* a parent referencing a child ID that arrives in a later message, *when* the child arrives, *then* it is patched into place with no full re-render of the unaffected subtree.
- **AC2** *Given* a binding to an undefined `path`, *when* rendered, *then* the widget shows an empty/placeholder value (not an error) and updates when the data arrives.

### 3.4 Data model & binding

**SPEC-R5 — Data model upsert + binding resolution.** `updateDataModel` MUST apply upsert semantics at the given JSON-Pointer `path` (whole-model when `path` omitted), per surface. Bindings (`{path}`) MUST resolve against the surface data model and MUST re-resolve (update the widget) when the bound data changes. *(→ PRD-G1)*
- **AC1** *Given* `updateDataModel{path:"/user/name",value:"Ada"}` then a `Text` bound to `/user/name`, *when* applied, *then* the text renders "Ada"; *when* the path is later updated, *then* the text updates without a message re-send.
- **AC2** *Given* `updateDataModel` with no `path`, *when* applied, *then* it replaces/merges the whole surface data model per upsert semantics.

**SPEC-R6 — Dynamic lists (template iteration).** A container MAY bind `children` to an array `path` with an item template; the renderer MUST render one instance per array element, resolving relative (child-scope) paths within each item, and MUST add/remove instances reactively as the array changes. *(→ PRD-G1)*
- **AC1** *Given* a list bound to `/items` (length 3) with a template, *when* rendered, *then* 3 instances exist; *when* an element is appended via `updateDataModel`, *then* a 4th appears without re-rendering the first 3.

### 3.5 Interaction & actions (v1.0)

**SPEC-R7 — Two-way input binding (optimistic).** For input widgets (e.g. `TextField`, `Select`, `Slider`), the renderer MUST display the bound value, update the local data model optimistically on user input, and surface the new value in the action context when an action commits. *(→ PRD-G1)*
- **AC1** *Given* a `TextField` bound to `/form/email`, *when* the user types, *then* `/form/email` updates locally; *when* a submit action fires, *then* the action context carries the current `/form/email`.

**SPEC-R8 — Action emission + actionResponse (v1.0).** On a triggered action the renderer MUST emit an `action` message that includes a client-generated `actionId` (v1.0 requirement), the resolved context, `wantResponse:true` when a reply is expected, and the full data model when `sendDataModel` was set. It MUST correlate an incoming `actionResponse{actionId,value|error}` to the originating action. *(→ PRD-G1)*
- **AC1** *Given* a button action with `wantResponse:true`, *when* triggered, *then* the emitted `action` carries a unique `actionId` and resolved context; *when* `actionResponse{actionId}` arrives, *then* it is delivered to the awaiting caller (value or error).
- **AC2** *Given* `sendDataModel:true` on the surface, *when* an action fires, *then* the action metadata includes the full surface data model.

### 3.6 Catalog binding & functions

**SPEC-R9 — Catalog-driven widget resolution.** The renderer MUST instantiate each component by resolving its `component` type against the surface's bound catalog to a widget factory, and MUST map component properties + bindings to the widget. The *mapping definitions* are owned by the catalog (a2ui-catalog SPEC); the renderer owns resolution + instantiation + the unknown-type failure. *(→ PRD-G1, PRD-G2)*
- **AC1** *Given* a component whose `component` type is registered in the bound catalog, *when* rendered, *then* the mapped widget is created and bound.
- **AC2** *Given* a `component` type absent from the catalog, *when* rendered, *then* the renderer emits `error{code:"CATALOG"}` and renders a non-fatal placeholder (the rest of the tree still renders).

**SPEC-R10 — Client-side function evaluation.** The renderer MUST evaluate **function-call bindings** — a `{ "call": <name>, "args"?: {…named…} }` value (alongside a literal and a `{path}`) — by resolving the named function (a `@`-prefixed **system** function, the only v1.0 one being `@index` = the innermost collection-scope index + optional `offset`; or a **catalog** function from the bound catalog's `functions`), resolving its args **recursively** (each arg a literal, a `{path}`, or a nested `{call}`), and producing the derived value or validation result. An unknown/throwing function (or `@index` outside a collection scope) MUST emit `error{code:"FUNCTION"}` and render a placeholder, not tear down the surface (SPEC-N4). *(→ PRD-G1)*

A component's **`checks`** array (`[{call,args,message}]`, catalog SPEC-R4) runs each entry's `{call,args}` through this evaluator (TRUE = valid, FALSE = invalid) and surfaces a failure **client-side, inline** (ADR-0029): on an input component a failed check drives the control's validity + message display (`setCustomValidity`); on a Button **any** failed check auto-disables it. Checks re-evaluate reactively when a bound (`{path}`) arg changes (SPEC-N2). A failed check emits **no** server error — checks are client-side only (`VALIDATION_FAILED` is the *schema*-validation code, §5.2, not a form-validation channel).

Additionally, the renderer MUST support **DynamicString `${…}` interpolation** in any bindable **string** value: a literal string containing an **unescaped** `${…}` is an interpolation template whose `${…}` expressions are resolved and spliced into the surrounding literal text (ADR-0027). An expression is either a **JSON-Pointer path** — absolute (`${/user/name}`) or relative within a collection scope (`${name}`, resolved like a relative `{path}`/`@index`) — **or** a **function-expression** `${name(arg:value, …)}` (ADR-0028): a **named**-argument call (an optionally `@`-prefixed name; arg values being a quoted string literal, a number/boolean, a `${…}`-wrapped path, or a nested `${…}` function-call) that the renderer MUST parse into a function-call binding and evaluate through the same function evaluator above (so an unknown/throwing function emits `FUNCTION` and the segment renders empty, and a nested `${path}` arg re-resolves reactively per SPEC-N2). Paths inside an arg MUST be `${…}`-wrapped (a bare identifier arg value is not a path). A **malformed** (un-parseable), or a positional/unnamed-arg, function-expression segment renders **literally** (no error code, consistent with the placeholder discipline). A literal `${` is escaped `\${`. Resolved values MUST coerce to string per the table below; the template MUST re-resolve when an embedded path's data changes (SPEC-N2). A non-`${` literal string is unchanged.

| resolved value | coercion |
|---|---|
| number / boolean | standard string (`String(v)`) |
| `null` / `undefined` | empty string `""` |
| object / array | JSON-stringified (`JSON.stringify(v)`) |
| string | itself |

- **AC1** *Given* a `TextField` with a `required` check, *when* empty and an action commits, *then* the check fails and the renderer surfaces the validation message on the widget (no server round-trip required).
- **AC2** *Given* a `Text` whose `text` is `"Hi ${/user/firstName} (${/user/age})"` and `/user = {firstName:"Ada", age:36}`, *when* rendered, *then* it shows `"Hi Ada (36)"`; *when* `/user/firstName` later updates to `"Grace"`, *then* it shows `"Hi Grace (36)"` (path interpolation + coercion + reactive re-resolve); *given* an absent path the segment renders `""`; *given* `"\${literal}"` it renders `"${literal}"`.
- **AC3** *Given* a `Text` whose `text` embeds a function-expression `"${fmt(value:${/d}, format:'yyyy')}"`, a catalog declaring `fmt`, and `/d = "2026-01-01"`, *when* rendered, *then* the parsed call evaluates with `value` resolved from `/d` and `format:"yyyy"` and its result is spliced into the text; *when* `/d` changes, *then* the text re-resolves (the nested `${/d}` arg wakes per SPEC-N2). *Given* `"${now()}"` and a catalog **without** `now`, *then* the renderer emits `FUNCTION` and the segment renders `""`. *Given* a malformed function-expression, *then* the segment renders literally (no error).
- **AC4** *Given* a `Button` with a `checks` entry whose call resolves FALSE, *when* rendered, *then* the button is disabled; *when* the bound data later makes the check resolve TRUE, *then* the button re-enables (reactive). *Given* a failed check on any component, *then* **no** server `error` is emitted (client-side only).

**SPEC-R14 — Server-initiated function invocation (`callFunction` RPC).** The renderer MUST handle an inbound **`callFunction`** envelope — a server→client RPC `{ functionCallId, wantResponse?, callFunction:{ call, args? } }`, **envelope-level** (no `surfaceId`) — by looking `call` up in the active-catalog registry and **invoking** it with the **concrete** `args` (per the function's catalog schema), then: on success with `wantResponse:true`, emitting a **`functionResponse`** (§5.2) carrying the **verbatim `functionCallId`**, the `call`, and the `value`; with `wantResponse` false/absent, fire-and-forget (no response). The renderer MUST **reject** — emitting `error{code:"INVALID_FUNCTION_CALL", functionCallId, message}` (§5.2; `surfaceId` excluded) — when the function is **unregistered** OR **any** active catalog declares it `callableFrom:`**`clientOnly`** (the cross-catalog collision is **most-restrictive-wins**, `clientOnly` a hard floor, order-independent — catalog SPEC-R5 / ADR-0034 amendment; a throwing invocation is also rejected non-fatally, ADR-0034). This is a **distinct surface** from the local function-bindings of SPEC-R10 (those evaluate locally with no round-trip); the two share the function *registry*, not the dispatch. *(→ PRD-G1, PRD-G7)*
- **AC1** *Given* a registered `clientOrRemote`/`remoteOnly` function and `callFunction{functionCallId:"fc1", wantResponse:true, callFunction:{call,args}}`, *when* handled, *then* the renderer emits `functionResponse{functionCallId:"fc1", call, value}`.
- **AC2** *Given* `callFunction` for a `clientOnly` (or unregistered) function, *when* handled, *then* the renderer emits `error{code:"INVALID_FUNCTION_CALL", functionCallId}` with **no** `surfaceId`, and does not invoke; `wantResponse:false` on a successful invoke emits no `functionResponse`. In all cases the `functionCallId` is copied verbatim.

### 3.7 Conformance

**SPEC-R11 — Validation & structured errors.** The renderer MUST validate payloads (MIME `application/a2ui+json`) and, on a schema/catalog/idgraph/pointer failure, emit a structured `error` (client→server, §5.2) rather than rendering invalid UI. The validator MUST be the single shared implementation also used by the corpus admission gate (corpus SPEC-N1). *(→ PRD-G1, PRD-G4)*
- **AC1** *Given* an invalid message, *when* validated, *then* a structured `error{code,surfaceId,path,message}` is produced and the invalid content is not rendered.
- **AC2** *Given* the same payload, *when* validated here and in corpus admission, *then* both return the identical verdict (parity).

**SPEC-R12 — Capabilities exchange.** The renderer MUST be able to declare an `a2uiClientCapabilities` object (supported protocol versions, surfaces, action features) to the server; under A2A transport it MUST place it in the A2A `Message` metadata. *(→ PRD-G1, PRD-G7)*
- **AC1** *Given* a capabilities request (or A2A handshake), *when* the renderer responds, *then* the declared object lists its supported `protocolVersion`(s) including `v1.0`.

**SPEC-R13 — Version handling.** The renderer MUST honor each message's `version`, support the pinned set (default `v1.0`; `v0.9.1` supported), and reject an unsupported version with `error{code:"VERSION_UNSUPPORTED"}`. *(→ PRD-G6)*
- **AC1** *Given* a message with a supported `version`, *when* dispatched, *then* it is handled by that version's semantics (e.g. `surfaceProperties` for v1.0, `theme` for v0.9.x).
- **AC2** *Given* an unsupported `version`, *when* dispatched, *then* the renderer emits `VERSION_UNSUPPORTED` and skips the message.

---

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Progressive first paint | Renders the partial tree on `root` arrival without waiting for stream end; a streamed payload shows incremental UI (not a single final paint). *(→ PRD-G1)* |
| **SPEC-N2** | Reactive update cost | A `updateDataModel` to one path updates only the widgets bound to it (per-binding `Object.is` cutoff via the signals kernel); no full-surface re-render. |
| **SPEC-N3** | Teardown is leak-free | After `deleteSurface` (or renderer disposal), the surface leaves zero live signals/effects/listeners — provable via the kernel's `inspect()` + AbortSignal (mirrors the component foundation's discipline). |
| **SPEC-N4** | Fault isolation | One malformed message or one unknown component type MUST NOT tear down the surface or stop the stream. |
| **SPEC-N5** | Zero runtime dependencies | The renderer adds no third-party runtime dependency (Constraint C2); it builds on `@agent-ui/components` (signals + controls) only — it MUST NOT use `@a2ui/web_core`. |
| **SPEC-N6** | Validator parity | The validation in SPEC-R11 is the same code path as corpus admission (one implementation, two callers). |

## 5. Typed contracts

### 5.1 Inbound messages (server→client, A2UI v1.0)

```ts
type A2uiServerMessage =
  | { version: string; createSurface:   { surfaceId: string; catalogId: string;
                                          surfaceProperties?: object; theme?: object; sendDataModel?: boolean } }
  | { version: string; updateComponents:{ surfaceId: string; components: A2uiComponent[] } }
  | { version: string; updateDataModel: { surfaceId: string; path?: string; value?: unknown } }
  | { version: string; deleteSurface:   { surfaceId: string } }
  | { version: string; actionResponse:  { surfaceId: string; actionId: string; value?: unknown; error?: A2uiError } }
  | { version: string; functionCallId: string; wantResponse?: boolean;          // SPEC-R14, ADR-0034: server→client RPC
      callFunction:   { call: string; args?: Record<string, unknown> } };       // envelope-level (NO surfaceId); args CONCRETE

interface A2uiComponent {
  id: string; component: string;            // type discriminator, e.g. "Text" | "Button" | "TextField"
  child?: string; children?: string[];      // ID references (adjacency list)
  [prop: string]: unknown;                  // component-specific props + bindings ({path} | {call} | literal)
}
type Binding<T> = T | { path: string } | FunctionCall;        // literal | JSON-Pointer ref (RFC 6901, relative in child scope) | client fn call
interface FunctionCall { call: string; args?: Record<string, Binding<unknown>>; message?: string } // SPEC-R10; args named + recursive
```

### 5.2 Outbound messages (client→server)

```ts
type A2uiClientMessage =
  | { version: string; action: { surfaceId: string; actionId: string; name: string;
                                 sourceComponentId: string; timestamp: string;
                                 context: Record<string, unknown>; wantResponse?: boolean; dataModel?: unknown } }
  | { version: string; functionResponse: { functionCallId: string; call: string; value: unknown } }  // SPEC-R14, ADR-0034: callFunction success (functionCallId copied verbatim)
  | { version: string; error:  A2uiWireError };

// WIRE error (client→server) — the A2UI v1.0 two-code contract (ADR-0031). The contextID is TIED to the
// code (NOT a free XOR), and there is NO `path` field — the wire shape is exactly {code, message, ctxID}:
type A2uiWireError =
  | { code: "VALIDATION_FAILED";     message: string; surfaceId: string }       // requires surfaceId
  | { code: "INVALID_FUNCTION_CALL"; message: string; functionCallId: string }; // requires functionCallId
type WireErrorCode = "INVALID_FUNCTION_CALL" | "VALIDATION_FAILED";

// INTERNAL diagnostic taxonomy (the validator's Failure codes + render-time emits; shared with corpus
// admission, SPEC-N6 parity). Richer than the wire; mapped to A2uiWireError at the `#emit` boundary
// (ADR-0031): EVERY code → VALIDATION_FAILED (+surfaceId) this wave — incl. FUNCTION (render-time
// binding-eval = message validation, NOT the server-initiated INVALID_FUNCTION_CALL, which the repo has
// no path for; that arm is reserved for #23). The internal `path` locus folds into the wire `message`.
interface A2uiError { code: ErrorCode; surfaceId?: string; path?: string; message: string }
type ErrorCode =
  | "PARSE" | "SCHEMA" | "CATALOG" | "CATALOG_UNKNOWN" | "IDGRAPH"
  | "POINTER" | "VERSION_UNSUPPORTED" | "FUNCTION";
```

### 5.3 Renderer surface (behavioral; signatures illustrative — internals are the LLD)

```ts
interface A2uiRenderer {
  mount(host: HTMLElement, catalogs: CatalogRegistry): void;     // SPEC-R9
  ingest(message: A2uiServerMessage): void;                      // SPEC-R1..R8, R13
  onClientMessage(cb: (m: A2uiClientMessage) => void): void;     // SPEC-R8, R11, R12: actions/errors out
  capabilities(): A2uiClientCapabilities;                        // SPEC-R12
  dispose(): void;                                               // SPEC-N3
}
```

## 6. Open items (non-normative)

- **Transport** — this SPEC consumes/produces messages; *how* the stream arrives (raw JSONL/stdio, AG-UI, A2A, MCP) is owned by the streaming-pipeline SPEC (PRD-D2). The renderer only assumes line-delimited JSON messages and the capabilities/A2A-metadata hook (SPEC-R12).
- **Catalog mapping table** — owned by a2ui-catalog SPEC; this SPEC depends on it for SPEC-R9 but does not define the per-type mapping.

## 7. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1–R8, R10, N1, N2, N4 | PRD-G1 (default-catalog generation renders) |
| SPEC-R9 | PRD-G1, PRD-G2 (catalog-driven; extensible) |
| SPEC-R11, N6 | PRD-G4 (provable validity) + PRD-G1 |
| SPEC-R12 | PRD-G1, PRD-G7 (transport interop) |
| SPEC-R13 | PRD-G6 (version coherence) |
| SPEC-N3, N5 | PRD-G1 + Constraint C2 (zero-dep, leak-free) |

_Covers PRD-G1 fully; PRD-G2/G4/G6/G7 are co-served with sibling SPECs (catalog, harness, streaming-pipeline). See [`../README.md`](../README.md)._

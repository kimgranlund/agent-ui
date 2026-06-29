# LLD — A2UI Renderer

> Status: proposed · v0.1 · 2026-06-26 · Layer: LLD (implementation plan)
> Implements: [`../specs/a2ui-runtime.spec.md`](../specs/a2ui-runtime.spec.md) (SPEC-R1..R13, SPEC-N1..N6), targeting A2UI **v1.0**.
> Owns the shared **`validate.ts`** that the corpus LLD imports (validator parity, runtime SPEC-N6 / corpus SPEC-N1).
> Altitude: adds the **how** on the `@agent-ui/components` signals kernel; cites `SPEC-R*` for behavior, never re-derives it.

---

## 1. Component map (traceability)

| ID | Component | Implements | File (under `packages/agent-ui/a2ui/src/renderer/`) |
|---|---|---|---|
| **LLD-C1** | Stream parser (JSONL) | SPEC-R1 | `parser.ts` |
| **LLD-C2** | Message dispatcher (version-aware) | SPEC-R1, R13 | `dispatch.ts` |
| **LLD-C3** | Surface model (signals state) | SPEC-R2, N3 | `surface.ts` |
| **LLD-C4** | Component buffer + tree reconstructor | SPEC-R3, R4 | `tree.ts` |
| **LLD-C5** | Binding resolver (JSON-Pointer→signal) | SPEC-R5, N2 | `binding.ts` |
| **LLD-C6** | Dynamic list renderer | SPEC-R6 | `list.ts` |
| **LLD-C7** | Widget factory / catalog resolver | SPEC-R9 | `widget.ts` |
| **LLD-C8** | Input binding controller (two-way) | SPEC-R7 | `input.ts` |
| **LLD-C9** | Action dispatcher (+ actionResponse) | SPEC-R8 | `action.ts` |
| **LLD-C10** | Client-side function evaluator | SPEC-R10 | `functions.ts` |
| **LLD-C11** | Validator (shared) | SPEC-R11, N6 | `validate.ts` |
| **LLD-C12** | Capabilities | SPEC-R12 | `capabilities.ts` |
| **LLD-C13** | Renderer host / orchestrator | SPEC-R1, N3, N4 | `renderer.ts` |

**Kernel reuse (SPEC-N5).** All reactivity is the `@agent-ui/components` `reactive/` kernel — `signal`/`computed`/`effect`/`createScope`/`inspect`. No `@a2ui/web_core`, no third-party dep. A **positional** (A2UI v1.0) dynamic list uses a **kernel positional reconcile** (a length-`effect` + per-index `createScope` + `createWidget`) — **not** the `repeat` directive (positional lists never reorder, so a keyed-move primitive is mismatched; ADR-0024 / B2). `repeat` remains the vehicle for a **keyed** list (hand-authored, stable-key, where #69's focus-preserving move applies). Both are kernel-reuse — SPEC-N5 (zero third-party dep) holds either way. Widgets are `ui-*` controls created as custom elements.

## 2. Surface model — LLD-C3 (SPEC-R2, N3)

One surface = one ownership **scope** (kernel `createScope()`) + an `AbortController`, mirroring `UIElement`'s lifetime discipline so teardown is provably leak-free.

```ts
interface Surface {
  id: string; catalogId: string; version: string;
  surfaceProperties?: object; sendDataModel: boolean;
  components: Map<string, A2uiComponent>;          // raw, buffered by id (SPEC-R3)
  data: Signal<unknown>;                            // the surface data model (SPEC-R5)
  scope: Scope;                                     // owns every binding effect; dispose() on deleteSurface
  ac: AbortController;                              // owns every DOM listener
  widgets: Map<string, HTMLElement>;               // id → live control
}
```

**Invariants.** (i) `deleteSurface` ⇒ `scope.dispose()` + `ac.abort()` ⇒ zero live signals/listeners (SPEC-N3, asserted via `inspect()`). (ii) `data` is one signal; all bindings are computeds over it (so a one-path update wakes only its dependents — SPEC-N2). (iii) `createSurface` with an unknown `catalogId` ⇒ `CATALOG_UNKNOWN`, no surface created (SPEC-R2 AC3).

## 3. Stream parse & dispatch — LLD-C1, LLD-C2

**LLD-C1** `parseLine(line) → A2uiServerMessage | ParseError`: trim, `JSON.parse`, on throw return a `ParseError` (→ `error{code:"PARSE"}`, stream continues — SPEC-R1 AC2 / N4). The host never lets a parser throw escape.

**LLD-C2** `dispatch(msg, surfaces)`: read `msg.version`; if unsupported → `VERSION_UNSUPPORTED`, skip (SPEC-R13). Else select the version adapter (v1.0 default; v0.9.x maps `theme`→`surfaceProperties`, lacks `actionResponse`) and route the single envelope key to its handler. Dispatch is a pure switch over the five server message kinds; `default` (unknown key) → `error{code:"SCHEMA"}`.

## 4. Tree reconstruction & progressive render — LLD-C4 (SPEC-R3, R4)

**Buffering + render-on-root.** `updateComponents` merges each component into `surface.components` by `id`. After each batch: if `root` is present and not yet mounted, mount the tree; else patch.

**`mountNode(id, parentScope)` (DFS):**
1. Look up `components.get(id)`; if absent → create a **placeholder** node and register `id` in a `pendingParents` multimap keyed by the missing id (SPEC-R4). Return.
2. Resolve the widget via LLD-C7; attach to parent.
3. Bind props (LLD-C5) and recurse into `child`/`children` in order.

**Patch-in (SPEC-R4 AC1).** When a later `updateComponents` delivers a previously-missing id, look it up in `pendingParents`, mount it under each waiting parent, and clear the entry — **no re-render of unaffected subtrees** (only the patched node mounts).

**Edges:** second `root` → `IDGRAPH`, existing root kept (SPEC-R3 AC2); cycle in `child`/`children` → detected by DFS colouring → `IDGRAPH` on the back-edge; unreachable buffered components are inert until referenced.

## 5. Binding resolver & dynamic lists — LLD-C5, LLD-C6

**LLD-C5 `resolve(binding, surface, itemScope?)`:**
- Literal → return as-is.
- `{path}` → a **computed** that reads `surface.data` and walks the RFC-6901 pointer (absolute from root; relative resolves within `itemScope` for child scope, SPEC-R6). Undefined path → `undefined` (widget shows placeholder, SPEC-R4 AC2). Each bound prop is set inside a `surface.scope`-owned `effect`, so a data change re-resolves only that prop (SPEC-N2).

> **As-built reconciliation (B2, LLD-C5 shipped — no contract change).** Two precisions on the bullets above:
> - **The literal split lives in widget.ts, not `resolve`.** "Literal → return as-is" is realized one layer up: widget.ts's `isBinding(value)` decides per prop — a literal is `applyProp`'d once, only a `{path}` value reaches `binding.ts`. So `resolve` only ever sees the `{path}` branch (LLD-C7 owns the split, D6); the bullet is the *subsystem* contract, not the `resolve` signature.
> - **Per-path waking is a value-cutoff, not per-path invalidation.** There is ONE writable signal (`surface.data`); every path is a memoized `computed(() => resolvePointer(data.value, pointer))` over it (a module-private `WeakMap<Surface, Map<pointer, computed>>`, created inside `surface.scope` ⇒ disposed by `scope.dispose()`, SPEC-N3). A write marks *every* path computed possibly-stale — cheap, no DOM work — but the kernel's `Object.is` equality cutoff settles each one before its bound-prop effect runs: a computed that re-resolves to an `Object.is`-equal value does not bump its version, so the effect's verification concludes "unchanged" and skips `applyProp`. That cutoff only bites because `updateDataModel`'s `setPointer` write is IMMUTABLE with structural sharing — an untouched sibling subtree keeps its reference identity across a write, so a `/b` binding resolves to the same object after a `/a` write and stays asleep. `setPointer` is therefore the SPEC-N2 enabler, not an implementation detail: it must never deep-clone.

**LLD-C6 dynamic list:** a `children`-**template** ChildList (`{ path, componentId }`, A2UI v1.0) renders one instance per array element, **positionally / index-based** — A2UI v1.0 defines **no per-item key**: items match by array **index**, reconciliation is positional and never a keyed move (corrected from the earlier "keyed by item identity" over-specification — v1.0 has no identity concept). Each item gets a child scope whose **relative** pointers resolve to `{path}/{index}/…` and **absolute** pointers to root (`@index` = the 0-based iteration index, a system function in the collection scope). A length change adds/removes instances at the **boundary** (SPEC-R6 AC1); a mid-array shift re-binds positionally through the per-path computeds, **not** a move; item scopes dispose on removal (no leak). The reconcile is a **bespoke positional loop** (ADR-0024 / B2): a `surface.scope` `effect` on a length-computed grows/shrinks item instances by index, each built via `createWidget` in a per-index child scope bound to `{path}/{index}` — **not** the `repeat` directive (positional never moves).

## 6. Widget factory & input — LLD-C7, LLD-C8

**LLD-C7 `createWidget(node, surface)`:** resolve `node.component` against `catalogs.get(surface.catalogId)` → a `WidgetFactory`. Unknown type → emit `error{code:"CATALOG"}`, return a non-fatal placeholder element so siblings still render (SPEC-R9 AC2). The factory (owned by a2ui-catalog) declares the `ui-*` tag and the prop/binding map; this component instantiates the element, sets static props, and installs a scope-owned effect per bound prop.

**LLD-C8 input controller:** for input widgets the factory marks `valueBinding` + `valuePath`. The controller listens (via `surface.ac`) to the control's `input`/`change` event and writes the new value into `surface.data` at `valuePath` (optimistic, SPEC-R7). On action commit, the resolved value is already in `data` and flows into action context (LLD-C9). **Inside a dynamic-list item the writeback resolves `valuePath` through the item's `itemScope` first** — a relative path → `{path}/{index}/…`, reusing the **same** LLD-C5/C6 `scopedPointer` rewrite the read direction uses, so write and read land at the **same** absolute pointer (ADR-0024 write-side amendment). An absolute path and the ordinary no-`itemScope` case are unchanged; `itemScope` is captured once per instance and immutable (positional `index === position`), so the writeback target is a per-instance constant.

## 7. Actions & functions — LLD-C9, LLD-C10

**LLD-C9 action dispatch (SPEC-R8):**
```ts
function emitAction(node, surface, opts:{name; wantResponse?:boolean}) {
  const actionId = newId();                                  // v1.0 client-generated id
  const context  = collectContext(node, surface);           // resolved bound paths + input values
  const msg = { version: surface.version, action: { surfaceId: surface.id, actionId,
                name: opts.name, sourceComponentId: node.id, timestamp: nowIso(),
                context, wantResponse: opts.wantResponse,
                dataModel: surface.sendDataModel ? surface.data.peek() : undefined } };
  if (opts.wantResponse) pending.set(actionId, deferred());  // correlation map
  emitClient(msg);
  return opts.wantResponse ? pending.get(actionId)!.promise : undefined;
}
```
`actionResponse{actionId,value|error}` → resolve/reject `pending.get(actionId)` then delete it (SPEC-R8 AC1). **Edge:** an `actionResponse` with an unknown `actionId` is dropped with a logged warning (no throw). `timestamp`/`newId` come from injected providers (the kernel/scripts ban ambient `Date.now()`/random in some contexts; the renderer takes them via construction for testability/determinism).

**LLD-C10 functions:** evaluate catalog client functions referenced in bindings/`checks`. `formatString` interpolates resolved bindings; validation `checks` (e.g. `required`, `email`, `regex`) run on the bound value and return `{valid, message?}`; a failing check surfaces `message` on the widget without a server round-trip (SPEC-R10 AC1). Unknown/throwing function → `error{code:"FUNCTION"}`, treated as `{valid:false}` for checks.

## 8. Validator (shared) — LLD-C11 (SPEC-R11, N6)

The single validator imported by both the renderer and corpus admission (corpus LLD-C6 re-exports this).

```ts
function validateA2ui(msgOrOutput: unknown, catalog: Catalog): ValidationVerdict;
//   pipeline: MIME/shape → schema (per version) → catalog-conformance (component+prop exist)
//             → id-graph (EXACTLY one root [missing or 2nd both fail], acyclic, no dangling; on a COMPLETE component set)
//             → JSON-pointer SYNTAX only (RFC-6901 — never resolution against the data model)
interface ValidationVerdict { valid: boolean; failures: { code: ErrorCode; path: string }[] }
```

Pure and total (never throws). Produces the `error` payloads of §5.2.

**Id-graph granularity (the false-positive fix).** The id-graph stage assumes a *complete* component set. A missing `root` and a dangling `child` are legal *transient* states mid-stream (SPEC-R4 out-of-order tolerance), so the renderer host (LLD-C13) MUST invoke `validateA2ui` id-graph at **finalize** granularity — on the assembled component set, never per incremental `updateComponents` message. (LLD-C4 still eager-guards the *always*-invalid cases — a 2nd `root` or a cycle — in-stream per SPEC-R3 AC2; missing-root and dangling are finalize-only.)

**Pointer is syntactic.** The JSON-pointer stage validates RFC-6901 *syntax only* — a malformed pointer string → `POINTER`. It never resolves the pointer against the data model: an undefined `path` is a render-time placeholder (SPEC-R4 AC2), not a validation failure. A binding whose pointer does not *resolve* is a corpus-admission-only concern layered on top of this shared validator (corpus LLD §8), not part of `validateA2ui`.

**Parity (N6).** Corpus admission tier-1 calls this exact function on a record's *complete* `a2uiOutput`, and the renderer calls it at finalize granularity — so both judge the same complete component set and return identical verdicts (corpus SPEC-R8 AC3). Stages only one caller adds (the renderer's incremental render; the corpus's pointer-*resolution*, dedup, leak, quality) sit *outside* `validateA2ui` and do not affect the shared verdict.

## 9. Error & edge-case handling (the enumeration this LLD owns)

| Code / edge | Stage | Handling |
|---|---|---|
| `PARSE` | LLD-C1 | malformed line → emit error, continue stream (N4) |
| `VERSION_UNSUPPORTED` | LLD-C2 | unknown `version` → emit error, skip message (SPEC-R13 AC2) |
| `SCHEMA` | LLD-C2/C11 | unknown envelope key / schema fail → error, do not render |
| `CATALOG_UNKNOWN` | LLD-C3 | `createSurface` with unbound `catalogId` → error, no surface (R2 AC3) |
| `IDGRAPH` | LLD-C11 (validate, at finalize) | **missing `root`**, 2nd `root`, cycle, or dangling — all evaluated on a COMPLETE component set at finalize, never per-message (SPEC-R4) → error; existing root kept (R3 AC2). LLD-C4 eager-guards the always-invalid 2nd `root`/cycle in-stream. |
| `CATALOG` | LLD-C7 | unknown `component` type → error + placeholder; siblings render (R9 AC2) |
| undefined `path` | LLD-C5 | placeholder value, not an error; updates when data arrives (R4 AC2) |
| `FUNCTION` | LLD-C10 | unknown/throwing client fn → error; checks treated as invalid |
| unknown `actionId` | LLD-C9 | drop with warning; no throw |
| out-of-order child | LLD-C4 | hold in `pendingParents`, patch on arrival (R4 AC1) |
| `deleteSurface` mid-stream | LLD-C3 | dispose scope + abort; late messages for that surface → no-op |
| teardown | LLD-C3 | `inspect()` asserts zero subscribers; AbortSignal asserts zero listeners (N3) |

## 10. File & integration plan

```
packages/agent-ui/a2ui/src/renderer/
  parser.ts dispatch.ts surface.ts tree.ts binding.ts list.ts widget.ts
  input.ts action.ts functions.ts validate.ts capabilities.ts renderer.ts index.ts
```

**Integration points:** imports `signal/computed/effect/createScope/inspect` + the `repeat` directive from `@agent-ui/components`; resolves widgets through the `CatalogRegistry` (a2ui-catalog SPEC/LLD); `validate.ts` is re-exported by `src/corpus/validate.ts` (corpus LLD-C6); `capabilities.ts` + the client-message callback are consumed by the streaming-pipeline LLD (transport). The renderer is the foundation other A1 work builds on.

## 11. Build sequence (dependency-ordered; each step verifiable)

1. **LLD-C11 validate.ts** — first: it gates everything and is shared. Fixtures of valid/invalid payloads → expected verdicts. *(checkpoint: corpus admission can import it — closes the corpus LLD step-3 TODO)*
2. **LLD-C3 surface model** — create/delete, scope+AbortController lifetime. *(checkpoint: deleteSurface leaves 0 subscribers via `inspect()`, N3)*
3. **LLD-C1/C2 parser + dispatch** — JSONL decode, version routing, fault isolation. *(checkpoint: malformed line does not stop the stream, N4)*
4. **LLD-C5 binding** — JSON-pointer computeds; one-path-update wakes only dependents (N2).
5. **LLD-C7 widget factory** — against a stub catalog (a `Text`+`Button` mapping) until a2ui-catalog lands; unknown-type placeholder.
6. **LLD-C4 tree** — render-on-root, out-of-order patch, idgraph errors.
7. **LLD-C8 input + LLD-C9 action** — two-way optimistic; actionId/wantResponse/actionResponse correlation; sendDataModel.
8. **LLD-C10 functions** — formatString + checks.
9. **LLD-C6 dynamic list** — positional/index iteration (A2UI v1.0, no per-item key), child scope, delta-only boundary updates.
10. **LLD-C12 capabilities** — declare protocolVersion set; A2A metadata hook.
11. **LLD-C13 host** — wire mount/ingest/onClientMessage/dispose; the §9 error table becomes the test matrix; a streamed multi-message fixture renders progressively into real `ui-*` controls (the A1 integration proof). The host invokes `validate.ts` id-graph at **finalize** granularity (the complete component set), never per `updateComponents` message — out-of-order streaming (SPEC-R4) must not raise a false `IDGRAPH` (the missing-root/dangling false-positive).

**Discovered-reality note:** step 5 depends on the catalog's `WidgetFactory` shape. If the catalog SPEC's mapping contract cannot express a needed binding (e.g. a control prop with no A2UI analogue), that is a SPEC-level gap — fix a2ui-catalog SPEC and re-derive, do not improvise in `widget.ts`.

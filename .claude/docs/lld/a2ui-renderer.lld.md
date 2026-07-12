# LLD — A2UI Renderer

> Status: proposed · v0.1 · 2026-06-26 · Layer: LLD (implementation plan)
> Implements: [`../spec/a2ui-runtime.spec.md`](../spec/a2ui-runtime.spec.md) (SPEC-R1..R13, SPEC-N1..N6), targeting A2UI **v1.0**.
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
| **LLD-C10** | Client-side function evaluator + `${…}` interpolator + `checks` validation | SPEC-R10 | `functions.ts` · `interpolate.ts` (ADR-0027) · `fn-expr.ts` (ADR-0028) · `checks.ts` (ADR-0029 client-side checks) |
| **LLD-C11** | Validator (shared) | SPEC-R11, N6 | `validate.ts` |
| **LLD-C12** | Capabilities | SPEC-R12 | `capabilities.ts` |
| **LLD-C13** | Renderer host / orchestrator | SPEC-R1, N3, N4 | `renderer.ts` |
| **LLD-C14** | Server-initiated `callFunction` RPC handler | SPEC-R14 | `call-function.ts` (ADR-0034) |

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

**Per-item `(scope, ac)` pair (LLD-C6, ADR-0024 amendment 3).** SPEC-N3 is *item*-granular, not only surface-granular: a dynamic-list **item** gets the same lifetime pair the surface has — its per-index `childScope` (owning the item's bound-prop effects) is matched by a per-item `AbortController` (owning the item's DOM listeners: the action click and the input commit). Positional removal aborts the item ac alongside disposing its scope, so a removed item leaks **neither** an effect **nor** a listener — mirroring `disposeSurface` (`scope.dispose() + ac.abort()`) at item granularity. The ac defaults to `surface.ac` for every non-item caller, so the static tree is unchanged.

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

**LLD-C5 `resolve(binding, surface, itemScope?)`:** A bound prop value is one of **three** kinds — `literal | {path} | {call}` — dispatched by `resolveValue` (LLD-C10); `resolve` owns the `{path}` arm:
- Literal → return as-is — **except** a literal **string** containing an unescaped `${…}`, which is a **DynamicString interpolation template** routed to the `${…}` interpolator (`interpolate.ts`, LLD-C10 / ADR-0027). A non-`${` literal is byte-identical to before.
- `{path}` → a **computed** that reads `surface.data` and walks the RFC-6901 pointer (absolute from root; relative resolves within `itemScope` for child scope, SPEC-R6). Undefined path → `undefined` (widget shows placeholder, SPEC-R4 AC2). Each bound prop is set inside a `surface.scope`-owned `effect`, so a data change re-resolves only that prop (SPEC-N2).
- `{call}` → a **function call** (`{ call, args? }`, A2UI v1.0 / ADR-0026), evaluated by `functions.ts` (LLD-C10) — handled in the **same** bound-prop effect, so a `{path}` *inside* its args re-resolves reactively (SPEC-N2 unchanged).

> **As-built reconciliation (B2, LLD-C5 shipped — no contract change).** Two precisions on the bullets above:
> - **The literal split lives in widget.ts, not `resolve`.** "Literal → return as-is" is realized one layer up: widget.ts's `isBinding(value)` decides per prop which values route into the scope-owned bound-prop effect. Its arms are **three** (ADR-0026/0027): an **object** binding (`{path}` or `FunctionCall`) **or** an **interpolated template string** (`typeof v === 'string' && isInterpolated(v)`, ADR-0027) are `resolveValue`'d inside the effect (reactive); a **non-template** literal is `applyProp`'d **once** (static). So `resolve` only ever sees the `{path}` branch (LLD-C7 owns the split, D6) — a template string reaches the interpolator, not `resolve` directly; the bullet is the *subsystem* contract, not the `resolve` signature. **Without** the template-string arm a template would `applyProp(once)` and never re-resolve — so the `isBinding` widening is what makes the LLD-C10 interpolator's reactivity (below) actually hold.
> - **Per-path waking is a value-cutoff, not per-path invalidation.** There is ONE writable signal (`surface.data`); every path is a memoized `computed(() => resolvePointer(data.value, pointer))` over it (a module-private `WeakMap<Surface, Map<pointer, computed>>`, created inside `surface.scope` ⇒ disposed by `scope.dispose()`, SPEC-N3). A write marks *every* path computed possibly-stale — cheap, no DOM work — but the kernel's `Object.is` equality cutoff settles each one before its bound-prop effect runs: a computed that re-resolves to an `Object.is`-equal value does not bump its version, so the effect's verification concludes "unchanged" and skips `applyProp`. That cutoff only bites because `updateDataModel`'s `setPointer` write is IMMUTABLE with structural sharing — an untouched sibling subtree keeps its reference identity across a write, so a `/b` binding resolves to the same object after a `/a` write and stays asleep. `setPointer` is therefore the SPEC-N2 enabler, not an implementation detail: it must never deep-clone.

**Whole-model replace + the `/` root alias (ADR-0099).** The host's `#onUpdateDataModel` (LLD-C13) treats `path` omitted, `""`, **or `"/"`** as whole-model replacement — upstream defines `/` as the root-equivalent default (both v0.9/v1.0 §updateDataModel; the omitted-path default is literally `/`). The alias is a **protocol-layer** rule normalized at each apply-site's whole-model branch (the renderer host + the corpus's two fold mirrors, corpus-store LLD §canonicalize step 1) — **never inside `setPointer`**, which stays RFC-6901-pure (under RFC-6901, `""` is the document root and `/` is the empty-string-key token; deeper empty keys like `"/a/"` must keep resolving). Scope is `updateDataModel` only: component-binding `{path:"/"}` semantics are unverified upstream and unchanged (ADR-0099 open question).

**LLD-C6 dynamic list:** a `children`-**template** ChildList (`{ path, componentId }`, A2UI v1.0) renders one instance per array element, **positionally / index-based** — A2UI v1.0 defines **no per-item key**: items match by array **index**, reconciliation is positional and never a keyed move (corrected from the earlier "keyed by item identity" over-specification — v1.0 has no identity concept). Each item gets a child scope whose **relative** pointers resolve to `{path}/{index}/…` and **absolute** pointers to root (`@index` = the 0-based iteration index, a system function in the collection scope). A length change adds/removes instances at the **boundary** (SPEC-R6 AC1); a mid-array shift re-binds positionally through the per-path computeds, **not** a move; each item's per-index child **scope** *and* its per-item **`AbortController`** dispose/abort on removal — so a positionally-removed item leaks neither an effect nor a DOM listener (the action click + input commit ride the item ac, not `surface.ac`; ADR-0024 amendment 3, the per-item `(scope, ac)` pair). The reconcile is a **bespoke positional loop** (ADR-0024 / B2): a `surface.scope` `effect` on a length-computed grows/shrinks item instances by index, each built via `createWidget` in a per-index child scope bound to `{path}/{index}` — **not** the `repeat` directive (positional never moves). **An item renders its template's FULL subtree** (ADR-0024 subtree amendment): the loop reuses the static tree's own child-walk recursion (`tree.ts` `#mountChildrenInto` / `#mountInstance`), threaded with the item's child scope + `itemScope`, so a relative binding on **any** descendant resolves to `{path}/{index}/…` (absolute → root) — not just the template root. **Nested lists compose for free:** an inner template's array path resolves through the outer item's `itemScope` (`scopedPointer(innerPath, outerItemScope)` is the fully-resolved absolute pointer, e.g. `/items/{i}/sublist`), so the inner items bind `/items/{i}/sublist/{j}/…` — the collection-scope chain is **baked into the pointer**, with a single-frame `itemScope`, no explicit chain (standard `@index` is the innermost index = `itemScope.index`; an outer-index `@index` would be a C10-era chain decision). A list-item descendant uses an inert anchor (no `pendingParents` patch-in) and is not registered in `surface.widgets` (an item-template id aliases across the N instances); the static `children: string[]` / `child` path is unchanged.

## 6. Widget factory & input — LLD-C7, LLD-C8

**LLD-C7 `createWidget(node, surface)`:** resolve `node.component` against `catalogs.get(surface.catalogId)` → a `WidgetFactory`. Unknown type → emit `error{code:"CATALOG"}`, return a non-fatal placeholder element so siblings still render (SPEC-R9 AC2). The factory (owned by a2ui-catalog) declares the `ui-*` tag and the prop/binding map; this component instantiates the element, sets static props, and installs a scope-owned effect per bound prop.

**LLD-C8 input controller:** for input widgets the factory marks `valueBinding` + `valuePath`. The controller listens (via the item's `AbortController` inside a dynamic-list item, else `surface.ac` — ADR-0024 amendment 3) to the control's `input`/`change` event and writes the new value into `surface.data` at `valuePath` (optimistic, SPEC-R7). Registering the commit listener on the **item** ac is what lets a positionally-removed input row drop its listener with the item (SPEC-N3); the non-list default is `surface.ac`, unchanged. On action commit, the resolved value is already in `data` and flows into action context (LLD-C9). **Inside a dynamic-list item the writeback resolves `valuePath` through the item's `itemScope` first** — a relative path → `{path}/{index}/…`, reusing the **same** LLD-C5/C6 `scopedPointer` rewrite the read direction uses, so write and read land at the **same** absolute pointer (ADR-0024 write-side amendment). An absolute path and the ordinary no-`itemScope` case are unchanged; `itemScope` is captured once per instance and immutable (positional `index === position`), so the writeback target is a per-instance constant.

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

**Action listener lifetime (LLD-C13 wiring, ADR-0024 amendment 3).** The host strips the action-typed props before the base resolver and re-expresses them as a `click → emitAction` listener (`renderer.ts` `#wireAction`). That listener is registered on the **item's `AbortController`** when the action control is a dynamic-list item, else `surface.ac` — so a positionally-removed action row (e.g. a Card-with-button) drops its click listener with the item (SPEC-N3, item-granular). The ac threads to `#wireAction` through the **same** host `createWidget` closure that already receives the item's `scope`/`itemScope` (no separate action-wiring pass); the non-list default is `surface.ac`, unchanged.

**LLD-C10 functions (ADR-0026 — A2UI v1.0 function-call bindings):** a binding value has a **third kind** beyond a literal and a `{path}` — a **function call** `{ call: string; args?: Record<string, Binding>; message? }` (`protocol.ts` `FunctionCall`). `functions.ts` is the read-side twin of `binding.ts resolve`; it plugs into the **same per-prop split in widget.ts** (LLD-C7) that already separates literal vs `{path}`, via a single dispatcher:

```ts
function resolveValue(value, surface, itemScope?) {           // literal | {path} | {call}
  if (isCallBinding(value)) return evaluate(value, surface, itemScope);   // LLD-C10
  if (isBinding(value))     return resolve(value, surface, itemScope);    // LLD-C5 {path}
  return value;                                                           // literal
}
function evaluate({ call, args }, surface, itemScope?) {
  const named = mapValues(args ?? {}, (a) => resolveValue(a, surface, itemScope)); // recursive args
  if (call[0] === '@') return system(call, named, surface, itemScope);   // @index (the only v1.0 system fn)
  const fn = catalogOf(surface).functions[call];                          // catalog registry (LLD-C7)
  if (fn === undefined) return fail('FUNCTION', surface, call);           // unknown → emitError + undefined
  try { return fn(named); } catch { return fail('FUNCTION', surface, call); }
}
```

- **Args are a NAMED object, not positional** (corrects `FunctionDef.args` to named — catalog LLD-C7). Each arg is itself a binding value, **resolved recursively** through `resolveValue` (a literal, a `{path}`, or a nested `{call}`). A `{path}` arg re-resolves reactively because `evaluate` runs **inside** the bound-prop `effect` (LLD-C7, `widget.ts`) — so SPEC-N2 per-path waking holds for function-call bindings unchanged.
- **`@index` is the only v1.0 system function and is INNERMOST-ONLY** — it returns `itemScope.index + (args.offset ?? 0)` (the `offset` is a numeric addend, e.g. 1-based display; **not** outer-scope addressing). The list already exposes the index via the single-frame `itemScope` (`list.ts` / LLD-C6), so `evaluate` reads it off the **same** `(binding, surface, itemScope)` signature `resolve` takes — no threading change, no scope chain (ADR-0026 settles ADR-0024's deferred "outer-index = a chain decision": single-frame is sufficient and v1.0-faithful). **Outside a Collection Scope (`itemScope` absent) `@index` is a `FUNCTION` error** (v1.0: "outside iteration the client MUST treat it as an error").
- **FUNCTION is render-time, not a validator verdict.** Unknown/throwing fn — a `@`-name not in the system table, a catalog name absent from `catalog.functions`, `@index` outside a list, or a throwing impl — emits `error{code:"FUNCTION"}` via the **same `emitError` sink** the unknown-type `CATALOG` uses (LLD-C7), and yields `undefined` for the prop (render-time placeholder, like an undefined `{path}`, SPEC-R4 AC2). `validate.ts` stays pure/total — it adds **no** FUNCTION stage (the §9 table already places FUNCTION here, not at LLD-C11); `conformance.ts matchesType` only **accepts** a `{call}` on a `bindable` prop (deferred resolution, symmetric with `{path}`) so it raises no false `CATALOG`.
- **Catalog functions (LLD-C7):** the pure `required(args)→{valid,message?}` / `email` / `regex` trio, looked up from the bound catalog's `functions` registry. **String composition is the DynamicString `${…}` interpolation feature, NOT a `formatString` function** (ADR-0026 / catalog SPEC-R5) — its **path arm is delivered** (see the interpolator below, ADR-0027), its **`${fn(arg:val)}` function-expression arm is delivered** (ADR-0028), and **`checks`-surfacing is delivered** (ADR-0029 — see the `checks` controller below; a component `checks:[{call,args,message}]` array runs each entry through this evaluator and surfaces a failure **client-side, inline** — an input's validity message / a Button's auto-disable — **not** via `VALIDATION_FAILED`, which is the unrelated *schema* code).

**`${…}` DynamicString interpolation (`interpolate.ts` + `fn-expr.ts`, ADR-0027/0028).** A literal **string** value is no longer always opaque: a string with an **unescaped** `${…}` is an interpolation template. `resolveValue`'s literal arm becomes `isInterpolated(s) ? interpolate(s, surface, itemScope, resolve, emitError, registry) : s` — a non-`${` string is byte-identical. The interpolator is a small string parser layered on the **existing** per-path resolver + the `{call}` evaluator, orthogonal to the `{call}` value kind:
- **Scan (escape-aware).** Split the template into ordered literal runs and `${…}` expressions: `\${` emits a literal `${` (backslash consumed); an unescaped `${` opens an expression closing at its matching `}` (brace-depth tracked so a nested `${…}` stays parse-stable). This scanner is **unchanged** across both arms — only the classifier grows (the ADR-0027 forward-compat seam, realized by ADR-0028).
- **Classify.** A body **without** `(` is a **JSON-Pointer path**; a body **with** `(` is a **function-expression** `${name(arg:value, …)}` (ADR-0028).
- **Resolve a path (reuse LLD-C5).** A path expression resolves through `resolve({path: expr}, surface, itemScope)` — the **same per-path memo**; a **relative** path uses `scopedPointer(expr, itemScope)` (ADR-0024), identical to the `{path}`/`@index` read rewrite. No new resolution machinery.
- **Resolve a function-expression (`fn-expr.ts` → `evaluate`, ADR-0028).** `parseFunctionExpr(body)` tokenizes the body into a `FunctionCall { call, args }` whose arg values are the **existing JSON shapes `resolveValue` dispatches** (`literal | {path} | {call}`) — the call name (an optionally `@`-prefixed identifier before `(`), named args (`arg:value`) split on top-level commas/colons (depth-aware so a comma/colon inside a nested `(…)`/`${…}` is not a delimiter); an arg value is a quoted string literal (`'…'`/`"…"`) → literal, a number/boolean → literal, a `${path}` → `{path}` Binding, or a nested `${fn(…)}` → a nested `{call}` Binding. The `FunctionCall` routes to **`evaluate`** (ADR-0026) — the **same** evaluator the JSON `{call}` value kind uses, so namespace dispatch (`@`-system vs catalog — `@index(offset:N)` flows here too), recursive per-arg `resolveValue` (incl. a nested `{path}`/`{call}` arg), and the `FUNCTION` error are all reused; the result is `coerce`d and spliced. **The parser is pure syntax — no second evaluator, no new system functions, no new resolution/reactivity code.** Deferred: a **positional/unnamed** arg (the `${upper(${now()})}` outlier) → parser returns `null` → that segment renders verbatim (`evaluate`'s args are named-only).
- **Coerce + concat (spec-exact).** number/boolean → `String(v)`; **null/undefined → `""`**; object/array → `JSON.stringify(v)`; string → itself. Segments join in source order. An unknown/throwing function evaluates to `undefined` → `""` (FUNCTION emitted, like an unresolved `{path}`).
- **Reactive for free.** Running inside the bound-prop `effect` (LLD-C7), each `${/path}` (top-level or **inside a function-expression arg**) reads the per-path computed, so the effect depends on exactly the embedded paths — a template re-resolves when **any** changes and stays asleep on an unrelated write (SPEC-N2 reused; a `${fmt(value:${/d})}` template wakes on `/d`).
- **Malformed → render literally, NO error** (ADR-0027/0028 design decision; the §9 table adds no interpolation code): an unterminated `${` and an **un-parseable** function-expression are emitted **verbatim** — no new code. (A *parsed* function naming an **unknown** function is different — that is a real evaluation and rides `evaluate`'s `FUNCTION` + `""`, ADR-0028 partially overturning ADR-0027's "no FUNCTION for `${fn}`" — which held only while the form was unparsed.) Conformance is a **no-op**: a template is a `string` literal, so `conformance.ts matchesType` accepts it via the ordinary string-type leg (no `{path}`/`{call}` branch, no false `CATALOG`).

**`checks` — client-side inline validation (`checks.ts`, ADR-0029).** A component-level `checks: [{call,args,message}]` array (catalog SPEC-R4; the Button `{condition:{call,args},message}` wrapper is tolerantly unwrapped) is a **`RESERVED` key** (`widget.ts`/`conformance.ts`), read by the host `createWidget` wrapper — `#wireChecks(el, node, surface, scope, ac)`, a sibling to `#wireAction` (LLD-C13). It runs **client-side only — no server error** (`VALIDATION_FAILED` is the schema code, §5.2, not this). Mechanism, all reuse:
- **Evaluate via `evaluate` (ADR-0026).** Each check's `{call,args}` runs through the **same** evaluator the `{call}` value kind uses, inside a **`scope`-owned effect**. A `{path}` arg makes the check **reactive** — it re-evaluates when its bound data changes (SPEC-N2, the per-path memo). TRUE = valid, FALSE = invalid (a `{valid}`-result function is read via `.valid`).
- **Input target → `setCustomValidity` (components form base).** The first failing check's `message` drives `el.setCustomValidity(message)` (a new `UIFormElement` seam, signal-backed, native-parity); all-pass → `setCustomValidity('')`. The base **merges** it with the subclass `formValidity()` (native invalid wins, else custom — ADR-0029 B1), so ui-text-field's existing `:state(user-invalid)` border + message node display it **for free**; the message node becomes **visible** when non-empty (extends ADR-0014, A1). The renderer never touches the control's internals — it drives the native validity API.
- **Button target → auto-disable.** Any failing check → `el.disabled = true` (the reflecting `disabled` prop, exists); all-pass → restore the node's static boolean `disabled`. A Button is not a `UIFormElement` (no `setCustomValidity`) — the v1.0 model is message-on-input, disable-on-button, and **checks OWN `disabled`** when present. (A `{path}`-**bound** `disabled` combined with `checks` on the same Button is a deferred tension — two effects write `el.disabled` and `Boolean({path-object})` is always truthy; an uncommon combo, ADR-0029 Consequences.)
- **Lifetime + fault isolation.** The effect rides the item-or-surface `scope`/`AbortController` (SPEC-N3; a list-item's checks die with the item). A check naming an unknown/throwing function rides `evaluate`'s existing `FUNCTION` emit (treated invalid for the gate) — the only error path; a *failing* check emits nothing (SPEC-N4 sibling isolation holds).

**`callFunction` — server-initiated function invocation (`call-function.ts`, LLD-C14, ADR-0034).** A **6th inbound envelope** (`dispatch.ts` gains the route + `DispatchHandlers.callFunction`) — a server→client RPC `{ functionCallId, wantResponse?, callFunction:{call,args?} }`, **envelope-level (no `surfaceId`)** — handled host-side. **This is a DISTINCT surface from binding-eval (ADR-0026/§7 above): same registered functions, different invocation.** Mechanism:
- **Lookup + `callableFrom` gate (most-restrictive-wins; ADR-0034 amendment).** `handleCallFunction` looks `call` up across **all** registered catalogs (`CatalogRegistry`) and takes the **most restrictive `callableFrom`** — **`clientOnly` is a HARD FLOOR**. It **rejects** — `emitError(INVALID_FUNCTION_CALL, functionCallId)` (the ADR-0031 arm, now reachable; `surfaceId` excluded) — when the function is **unregistered** OR **any** active catalog declares it `clientOnly` (default). It **invokes** only when registered with an impl AND **no** catalog marks it `clientOnly` (every declaration `remoteOnly`/`clientOrRemote`). **Order-independent** — NOT first-match/most-permissive (a permissive sibling does not loosen a `clientOnly` guard; the two-tier model's "stricter overrides" — a sibling may tighten, never loosen).
- **Invoke — reuse the registry, NOT `evaluate`.** The pure impl is `catalogFunctions[call](args)` (the shared ADR-0026 table); **args are CONCRETE literals** (the RPC is surfaceless — no data model to resolve `{path}` against; the spec's "args per catalog schema"). No `@`-system dispatch, no recursive `resolveValue` — a flat gated call. The binding-eval `evaluate` is untouched (`callableFrom` is read ONLY here).
- **Emit (via `#emit`, LLD-C13).** Success + `wantResponse` → `functionResponse{functionCallId (verbatim), call, value}`; `wantResponse` false/absent → fire-and-forget. A throwing impl → `INVALID_FUNCTION_CALL` + `functionCallId`, caught (non-fatal, SPEC-N4 — mirrors ADR-0026). `@index` (system, not a catalog function) is unregistered here → rejects. Default-catalog functions are all `clientOnly` → every `callFunction` rejects until a project catalog registers a server-invocable function.

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

The first column is the **internal** diagnostic code; the **wire** column is the v1.0 two-code (`VALIDATION_FAILED` / `INVALID_FUNCTION_CALL`) the `#emit` boundary maps it to (ADR-0031). The wire `message` (with the internal `path` locus folded in — there is no wire `path`) carries the specificity the coarse wire code drops; the validator's internal codes are unchanged (corpus parity, SPEC-N6).

| Code / edge | Stage | → wire | Handling |
|---|---|---|---|
| `PARSE` | LLD-C1 | `VALIDATION_FAILED` | malformed line → emit error, continue stream (N4) |
| `VERSION_UNSUPPORTED` | LLD-C2 | `VALIDATION_FAILED` | unknown `version` → emit error, skip message (SPEC-R13 AC2) |
| `SCHEMA` | LLD-C2/C11 | `VALIDATION_FAILED` | unknown envelope key / schema fail → error, do not render |
| `CATALOG_UNKNOWN` | LLD-C3 | `VALIDATION_FAILED` | `createSurface` with unbound `catalogId` → error, no surface (R2 AC3) |
| `IDGRAPH` | LLD-C11 (validate, at finalize) | `VALIDATION_FAILED` | **missing `root`**, 2nd `root`, cycle, or dangling — all evaluated on a COMPLETE component set at finalize, never per-message (SPEC-R4) → error; existing root kept (R3 AC2). LLD-C4 eager-guards the always-invalid 2nd `root`/cycle in-stream. |
| `CATALOG` | LLD-C7 | `VALIDATION_FAILED` | unknown `component` type → error + placeholder; siblings render (R9 AC2) |
| undefined `path` | LLD-C5 | — (no emit) | placeholder value, not an error; updates when data arrives (R4 AC2) |
| `FUNCTION` | LLD-C10 | `VALIDATION_FAILED` | unknown/throwing client fn in a binding → error; checks treated as invalid. **Render-time binding-eval, NOT server-initiated** → `VALIDATION_FAILED` (the message references an invalid function, like `CATALOG`); `INVALID_FUNCTION_CALL` is reserved for a server-initiated path (none yet, #23). |
| unknown `actionId` | LLD-C9 | — (no emit) | drop with warning; no throw |
| out-of-order child | LLD-C4 | — | hold in `pendingParents`, patch on arrival (R4 AC1) |
| `deleteSurface` mid-stream | LLD-C3 | — | dispose scope + abort; late messages for that surface → no-op |
| `INVALID_FUNCTION_CALL` | LLD-C14 | `INVALID_FUNCTION_CALL` (+functionCallId) | server `callFunction` for a `clientOnly`/unregistered/throwing function → reject; `surfaceId` excluded (ADR-0034) |
| teardown | LLD-C3 | — | `inspect()` asserts zero subscribers; AbortSignal asserts zero listeners (N3) |

**Wire boundary (LLD-C13, ADR-0031/0034).** `renderer.ts #emit` is the single client→server chokepoint; it applies `toWireError(internal): A2uiWireError`. The contextID is **tied to the code** (v1.0: `INVALID_FUNCTION_CALL` requires `functionCallId` and excludes `surfaceId`; `VALIDATION_FAILED` requires `surfaceId`), so the wire type is a discriminated union. **Render-time/validator codes map to `VALIDATION_FAILED` + `surfaceId`** — including binding-eval `FUNCTION` (= message validation, **not** the server-initiated call). The internal `path` locus is **folded into the wire `message`** — no wire `path` field. **`INVALID_FUNCTION_CALL` + `functionCallId` is now REACHABLE** — emitted by the `callFunction` handler (LLD-C14, ADR-0034) when a server-initiated invocation is rejected (clientOnly/unregistered/throwing); it is the **only** path that emits that arm (binding-eval never does).

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
8. **LLD-C10 functions** — the `{call}` binding evaluator: `@index` (innermost + `offset`) + catalog functions (named args) + recursive args + the `FUNCTION` error (ADR-0026); **plus the `${…}` DynamicString interpolator (`interpolate.ts`, ADR-0027)** layered on the literal-string arm of `resolveValue`, **its `${fn(arg:val)}` function-expression parser (`fn-expr.ts`, ADR-0028)** that parses into a `FunctionCall` (named args, `${path}`/nested-`${call}` arg values) and reuses `evaluate`, **and the `checks` controller (`checks.ts`, ADR-0029)** — a component `checks` array run through `evaluate`, surfacing client-side (input message / button disable). (Positional/unnamed-arg form remains a scoped follow-up.)
9. **LLD-C6 dynamic list** — positional/index iteration (A2UI v1.0, no per-item key), child scope, delta-only boundary updates.
10. **LLD-C12 capabilities** — declare protocolVersion set; A2A metadata hook.
11. **LLD-C13 host** — wire mount/ingest/onClientMessage/dispose; the §9 error table becomes the test matrix; a streamed multi-message fixture renders progressively into real `ui-*` controls (the A1 integration proof). The host invokes `validate.ts` id-graph at **finalize** granularity (the complete component set), never per `updateComponents` message — out-of-order streaming (SPEC-R4) must not raise a false `IDGRAPH` (the missing-root/dangling false-positive).

**Discovered-reality note:** step 5 depends on the catalog's `WidgetFactory` shape. If the catalog SPEC's mapping contract cannot express a needed binding (e.g. a control prop with no A2UI analogue), that is a SPEC-level gap — fix a2ui-catalog SPEC and re-derive, do not improvise in `widget.ts`.

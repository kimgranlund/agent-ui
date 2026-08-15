# SaaS product utilities — gateway + data-management patterns (research brief)

> Status: brief (pre-PRD research) · v0.1 · 2026-08-15 · Layer: BRIEF (pre-PRD research; decides nothing)

Owner's charter: gateway patterns as they concern a front-end component library's consumers
(auth token flow, request shaping, error normalization, retry/backoff, streaming pass-through),
and — the heart of the category — "simple customizable strategy/interface and adapter patterns
that allow us to keep UI implementations simple, while the CRUD pathways are highly flexible and
customizable, and support concepts like streaming and sockets natively."

Constraint carried throughout: this fleet is zero-dependency by law (CLAUDE.md; one ruled
CodeMirror exception, ADR-0139). Every pattern below is named at the level of NATIVE mechanics —
`fetch` + `ReadableStream`, `EventSource`, `WebSocket`, `AsyncIterable`/async generators,
`AbortSignal`, `structuredClone`, `localStorage`/`indexedDB` — never as a library adoption.
TanStack Query, SWR, Apollo, RxJS, Zero/Replicache et al. appear only as pattern *sources*.

## 0. The repo's existing prior art (read before anything else)

This repo already holds real seams the category must build ON, not beside:

- **`AgentTransport` + `Session`** — `packages/agent-ui/a2ui/src/agent/agent-transport.ts`
  (ADR-0137, SPEC-R1/R8). THE house transport-adapter shape: one interface method
  `turn(input: TurnInput): AsyncIterable<string>`; the page binds only to the interface; recorded
  / live-proxy / future transports swap behind it at one construction site; the session (turn
  array) lives client-side, the server stays stateless.
- **`AgentProvider`** — same file. The provider-strategy shape: per-vendor adapters normalize
  upstream SSE → text fragments; optional capabilities (`effort?`, `onEvent?`, `tools?` +
  `executeTool?`, `signal?`) are additive so pre-existing adapters stay byte-unchanged.
- **`readNdjsonLines`** — `site/lib/ndjson-lines.ts`. The one streaming-line idiom:
  `ReadableStream<Uint8Array>` → `AsyncIterable<string>`, chunk-boundary-proof, tested once.
- **`A2aChannel`** — `packages/agent-ui/a2a/src/channel/loopback.ts` (a2a SPEC §6): a
  message-channel adapter with `close()` drain-and-end semantics; loopback today, live arms
  (SPEC-R17/R18) proved WebSocket-shaped delivery behind it.
- **Signals kernel** — `packages/agent-ui/components/src/reactive/` (`signal`, `computed`,
  `effect`, `createScope`, `whenFlushed`). The reactivity substrate any data layer must surface
  results through.
- **Corpus store** — `packages/agent-ui/a2ui/src/corpus/store.ts` (ADR-0062): a PURE store —
  platform-neutral in-memory core, single mutation surface (`put`), derived index, the I/O shell
  (`tools/corpus/fs-store.ts`) injected from outside. The house pure-core/shell split.
- **`SettingsStore` + `createMemoryStore`** — `packages/agent-ui/app/src/controls/settings/`
  (SPEC-R12): a key-value persistence adapter interface; the component imports only the
  interface; Map and `localStorage`-mirrored reference adapters exist.
- **Tool-dispatch seam** — a2ui-live-agent SPEC-R16–R19 (`integration-standards` skill): manifest
  registry, fail-closed enablement, dispatch-time schema validation, server-side-keyed
  integrations (key NAMES, never values, cross the seam), one shared dispatch for both live arms.

The recurring house grammar: **pure zero-dep core + interface seam + injected adapters +
optional-capability widening + AsyncIterable for anything streamed**. The category's job is to
extend this grammar to general CRUD/query data, not to invent a second grammar.

## 1. Pattern survey — canon vs. repo

Verdict key: **EXISTS** (a repo seam already is this) · **PARTIAL** (the shape exists somewhere
but is not general/consumable) · **MISSING**.

### P1 — Transport strategy for turn/request streams — EXISTS

Canon: strategy interface between UI and wire ("repository" at the transport tier); swap
implementations without touching consumers. Repo: `AgentTransport` (§0) is exactly this, shipped
and proven across three transports. Any recommendation here that re-draws this shape without
citing it is a defect; the category should treat `AgentTransport` as the shape to GENERALIZE
(agent-turn-specific today: `TurnInput` is intent/client-message shaped).

### P2 — Unified streaming adapter (fetch-stream / SSE / WebSocket) — PARTIAL

Canon: one consumer-facing contract — `AsyncIterable<T>` (or a subscribe/callback dual) — with
per-mechanism adapters:
- **fetch + ReadableStream**: POST-capable, header-capable; lines via NDJSON split (the repo's
  `readNdjsonLines`) or SSE-frame parse; cancel via `AbortSignal` → `reader.cancel()`.
- **EventSource**: GET-only, auto-reconnect + `Last-Event-ID` resume built in; no custom headers
  (auth must ride cookie/query/ticket); events → an async iterator via a small push-queue bridge.
- **WebSocket**: bidirectional; needs app-level heartbeat/reconnect/backpressure (`bufferedAmount`)
  that the other two get for free or don't need.
Backpressure and teardown are the hard parts: an async-generator bridge over a push source must
buffer or drop by declared policy, and `return()`/abort must close the underlying socket/reader.

Repo: `readNdjsonLines` (fetch-stream leg, done), `AgentProvider` adapters (SSE-parse leg, done
but vendor-internal), `A2aChannel` (socket-shaped leg with drain semantics), live-proxy transport
(dev-only). What's missing: ONE public, package-level contract the three mechanisms sit behind —
today each leg lives in a different layer (site lib, a2ui internals, a2a) and none is exported
for a general consumer.

### P3 — Query/resource abstraction (read pathway) — MISSING

Canon (TanStack/SWR distilled, framework-agnostic): a resource = key + fetcher(strategy) +
lifecycle state exposed reactively — `status: 'idle'|'loading'|'success'|'error'`, `data`,
`error`, `updatedAt`; stale-while-revalidate; request dedup by key; key-based invalidation →
refetch; `AbortSignal` on unmount/supersede. In signals terms: a resource is a small state
machine whose fields are signals, so components bind with zero data logic.

Repo: nothing general. Pages hand-roll `fetch` + local signals. The corpus store is a pure
in-memory repository but read-only-shaped and domain-specific; `SettingsStore` covers key-value
settings only.

### P4 — Mutation pathway + optimistic updates — MISSING

Canon: a mutation = strategy fn + lifecycle signals + declared cache effects: invalidate keys on
settle, or optimistic write (snapshot → apply local patch → rollback on error) — needs a
structural-sharing store to make snapshots cheap. Repo prior art worth citing: the a2ui binding
layer's structural-sharing `setPointer` + `Object.is` cutoff (per-path waking) is the exact
mechanism an optimistic cache wants; the corpus store's single-writer `put` is the house
mutation-surface discipline. Neither is exposed as a general CRUD pathway.

### P5 — Cursor pagination / infinite resources — MISSING

Canon: page params derived from previous page (`getNextCursor(lastPage)`), pages held as an
ordered list under one key, append/prepend, refetch-from-first on invalidate. A thin layer over
P3 once P3 exists; not worth its own package surface.

### P6 — Persistence / offline adapter — PARTIAL

Canon: same strategy trick one tier down — a `StorageAdapter` (get/set/subscribe/namespace)
with memory, `localStorage`, `indexedDB` implementations; cache hydration + cross-tab sync
(`storage` event / `BroadcastChannel`). Repo: `SettingsStore` + `createMemoryStore` (§0) is this
shape, including the GH #409 namespace-prefix-scan lesson — but it lives in the `app` layer,
settings-scoped. Local-first sync-engine vocabulary (client store as source of truth, mutations
as a log, server reconciliation) is FUTURE vocabulary only — flag, don't design.

### P7 — Gateway-facing client contract — PARTIAL

Canon, scoped to what a component library's CONSUMERS need from a BFF/API-gateway/edge-proxy:
- **Auth token flow**: request-decorator seam (async `getToken()` hook → header), single-flight
  401-refresh (one refresh in flight, queued retries), token never stored in the data layer.
- **Request shaping**: base-URL/headers/serialization middleware — compose-around-fetch
  (`(req, next) => Promise<Response>` onion), the native-mechanics middleware shape.
- **Error normalization**: one typed error envelope (`{ kind: 'http'|'network'|'abort'|'parse',
  status?, code?, retryable, cause }`) so UI states are drivable from `kind`/`retryable` alone.
- **Retry/backoff**: exponential + full jitter, retry only idempotent/`retryable`, honor
  `Retry-After`, cap attempts, always `AbortSignal`-interruptible.
- **Streaming pass-through**: middleware must not buffer bodies — a gateway client that consumes
  the `Response` body breaks P2; the stream leg must pass `Response` through untouched.

Repo: the dev proxy + SPEC-R16–R19 already rule the SERVER side of this (keys server-side,
fail-closed enablement, dispatch-time validation — the house gateway posture). The a2ui error
taxonomy is a normalization precedent. But there is no consumer-facing client contract: no
retry/backoff anywhere, no shared error envelope for plain HTTP, no token-flow seam.

## 2. Gap summary

| # | Pattern | Verdict | Repo seam |
|---|---------|---------|-----------|
| P1 | Transport strategy | EXISTS | `AgentTransport`/`Session` (a2ui `src/agent/`) |
| P2 | Unified streaming adapter | PARTIAL | `readNdjsonLines` · `AgentProvider` · `A2aChannel` |
| P3 | Query/resource (read) | MISSING | — (signals kernel is the substrate) |
| P4 | Mutation + optimistic | MISSING | corpus `put` discipline · a2ui `setPointer` sharing |
| P5 | Cursor pagination | MISSING | — (thin layer over P3) |
| P6 | Persistence adapter | PARTIAL | `SettingsStore`/`createMemoryStore` (app layer) |
| P7 | Gateway client contract | PARTIAL | dev proxy + SPEC-R16–R19 (server side only) |

## 3. Recommended first slice — a QUESTION for the owner, not a decision

A `@agent-ui/data` package sketch (zero-dep, sibling branch off `components` alongside
`router`/`code`, catalog-invisible by construction — the ADR-0115/0119 precedent):

- **Core (`.`)**: `DataSource<T>` strategy interface (the CRUD verbs as optional capabilities,
  the `AgentProvider` additive-widening precedent) + `resource(key, source)` returning
  signal-backed lifecycle state (P3) + `mutation(...)` with invalidate/optimistic effects (P4) +
  the typed error envelope and retry/backoff policy (P7 client half).
- **Streaming (`./stream` or in core)**: the ONE `Streamed<T> = AsyncIterable<T>` contract with
  `fromFetchStream` (hoisting `readNdjsonLines` out of `site/lib`), `fromEventSource`,
  `fromWebSocket` adapters (P2) — so a `DataSource` can declare `subscribe()` natively, and
  streaming/sockets are first-class CRUD pathways, per the owner's words.
- **Persistence**: generalize the `SettingsStore` shape into the package's `StorageAdapter` (P6)
  rather than minting a third store interface.

**Open forks for the owner** (package minting is an ADR-worthy fork — flagged here, no ADR
drafted):
1. Mint `@agent-ui/data` vs. grow these seams inside `components` (a `data/` layer above
   `reactive/`)? The layering law and catalog-invisibility argue for a sibling package.
2. Should `AgentTransport` retroactively become a `DataSource` specialization, or stay a
   parallel, cited precedent? (Brief's lean: cited precedent — don't churn a shipped seam.)
3. Does P7's gateway client belong in `@agent-ui/data` core or its own `./gateway` subpath?
4. Is local-first sync (P6's far end) in scope for v1 at all? (Brief's lean: no — vocabulary
   only.)

## 4. Issues filed

Three `feature` records link back here: GH #955 gateway-facing client patterns (P7) ·
GH #956 the data-adapter seam (P3/P4/P5, carries the package-minting fork) · GH #957
streaming/sockets unification (P2). Do not build from this brief; it decides nothing.

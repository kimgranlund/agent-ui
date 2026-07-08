# LLD — A2A Protocol Core (`@agent-ui/a2a`, B1 wave)

> Status: accepted · v0.2 · 2026-07-08 (review-fix pass: §4 count 35/46 · HV-11/12 deltas §§2/5 · R8-AC1 framing note §6) · Layer: LLD (implementation plan)
> Implements: [`../spec/a2a-foundations.spec.md`](../spec/a2a-foundations.spec.md) **SPEC-R2, SPEC-R3, SPEC-R4, SPEC-R5, SPEC-R6, SPEC-R7, SPEC-R8** (+ operates under the SPEC-R1 grounding discipline; non-functionals SPEC-N1/N2/N3/N4/N5). PRD trace via the SPEC: PRD-G1 (protocol core), PRD-G6 (grounding + pinning). Component IDs are **file-scoped** (`LLD-C1…` here is unrelated to the arena LLD's `LLD-C*`).
> Altitude: adds the **how** for the protocol core only; the arena is [`a2a-tic-tac-toe.lld.md`](a2a-tic-tac-toe.lld.md) (B2/B3 — it consumes what this file builds), corpus/site/bridge LLDs land at B4/B5/B6 ([`../prd/a2a-section.prd.md`](../prd/a2a-section.prd.md) §6).
> Derived from the coverage-clean B1 decomposition ([`../decompositions/a2a-protocol-core.decomp.json`](../decompositions/a2a-protocol-core.decomp.json), strict + plan mode) — itself a module-granularity re-cut of the section intake decomp's core/tools regions.
> Grounding: every upstream shape cites its **resolved** SPEC §2 HV row. Two field-level residuals surfaced during this decomposition — **HV-11/HV-12, added to §2 UNRESOLVED in this same change** — were **resolved by the host 2026-07-07** against the pinned v0.3.0 types (SPEC §2 B1 intake addendum): no contradictions, three additive deltas (skill `security?` · `TaskIdParams.metadata?` · typed `MessageSendConfiguration`), incorporated in §§2/5 below. The S2/S5 dispatch block is lifted (SPEC-R1 AC1 satisfied); no ⚠ placeholders remain in this file.
> Version posture: pin `protocolVersion: "0.3.0"` (PRD-D3). Everything HV-3/HV-9 name as **v1.0-renamed** is deliberately isolated in two `as const` tables (LLD-C5/C6) so the named 1.x migration fork touches two modules + fixtures, nothing else.

---

## 1. Component map (traceability)

| ID | Component | Implements | File (under `packages/agent-ui/a2a/`) | Scope |
|---|---|---|---|---|
| **LLD-C1** | Typed wire model (Message/Part/Task/TaskStatus/AgentCard, `TaskState` union, `PROTOCOL_VERSION`) | SPEC-R3, R4 (state set), R5 (card shape), R2 (pin constant) | `src/protocol/types.ts` | runtime (zero-dep) |
| **LLD-C2** | Byte-fidelity codec (`decodeA2a`/`encodeA2a`) | SPEC-R3 AC1 | `src/protocol/codec.ts` | runtime (zero-dep) |
| **LLD-C3** | Total validator (`validateA2a`, closed 5-code set) | SPEC-R6, R3 AC2, R5 AC1, R2 AC1, N4 | `src/protocol/validate.ts` | runtime (zero-dep) |
| **LLD-C4** | Task-lifecycle transition table + guard | SPEC-R4 | `src/protocol/task-state.ts` | runtime (zero-dep) |
| **LLD-C5** | Error-code table + wire-error mapping (HV-9) | SPEC-R7 | `src/rpc/errors.ts` | runtime (zero-dep) |
| **LLD-C6** | JSON-RPC framing + correlation (`message/send` · `tasks/get` · `tasks/cancel`) | SPEC-R7 | `src/rpc/frame.ts` | runtime (zero-dep) |
| **LLD-C7** | `A2aChannel` contract + in-proc loopback pair | SPEC-R8, N5, N3 | `src/channel/loopback.ts` | runtime (zero-dep — the arena runner's isolation boundary) |
| **LLD-C8** | HTTP JSON-RPC transport (total `handleRpc` core · thin `node:http` shell · client channel) | SPEC-R8, R7, N1, N2 | `tools/http/{core,server,channel}.ts` | dev (Node) |
| **LLD-C9** | Well-known card serving + discovery client | SPEC-R5 | `tools/wellknown.ts` | dev (Node) |
| **LLD-C10** | Committed wire fixtures (HV-transcribed, canonical form) | SPEC-R3 AC1, R5 AC1, R7 AC1, R2 | `src/protocol/fixtures/*.json` | committed data (test-only import) |
| **LLD-C11** | Package scaffold: exports map, root tsconfig `paths`, gate wiring | SPEC-N1 | `package.json` + root `tsconfig.json` delta | infra |

**Split rule (SPEC-N1/N2, the a2ui precedent):** `src/` imports nothing third-party and nothing cross-package — not even `@agent-ui/shared`; `tools/` is Node/dev, never reachable from the exports map. Layering inside `src/` is downward-only: `protocol/` (bottom, imports nothing) ← `rpc/` ← `channel/` (← `arena/` at B2). `tools/` may import any `src/` layer; nothing imports `tools/` except tests and (at B3, dev-graph-only per the arena LLD §8) the arena proxy.

## 2. Typed wire model (LLD-C1 — field names per HV-4/HV-5/HV-7 resolutions)

`erasableSyntaxOnly` bans `enum`: states are a literal union over an `as const` tuple; discriminators are literal fields. All types are `interface`/`type` only — the module emits three small consts and zero behavior.

```ts
export const PROTOCOL_VERSION = '0.3.0'                                   // PRD-D3 pin; SPEC-R2
export const TASK_STATES = ['submitted','working','input-required','completed',
  'canceled','failed','rejected','auth-required','unknown'] as const      // HV-5, all 9
export type TaskState = (typeof TASK_STATES)[number]
export const TERMINAL_STATES = ['completed','canceled','rejected','failed'] as const // HV-5 "can't be restarted"

export interface A2aMessage {                                             // HV-4
  kind: 'message'                       // REQUIRED discriminator — round-trip fails without it
  role: 'user' | 'agent'
  parts: A2aPart[]
  messageId: string
  taskId?: string; contextId?: string   // contextId: server-generated grouping (HV-10)
  referenceTaskIds?: string[]; extensions?: string[]
  metadata?: Record<string, unknown>
}
export type A2aPart = A2aTextPart | A2aFilePart | A2aDataPart             // HV-4 verbatim union
export interface A2aTextPart { kind: 'text'; text: string; metadata?: Record<string, unknown> }
export interface A2aDataPart { kind: 'data'; data: Record<string, unknown>; metadata?: Record<string, unknown> }
export interface A2aFilePart { kind: 'file'; file: A2aFileWithBytes | A2aFileWithUri; metadata?: Record<string, unknown> }
export interface A2aFileWithBytes { bytes: string; uri?: never; name?: string; mimeType?: string }  // HV-11 (FileBase optionals confirmed)
export interface A2aFileWithUri   { uri: string; bytes?: never; name?: string; mimeType?: string }  // HV-4/HV-11 — mutual exclusion typed via `never`, upstream's FileBase idiom flattened (no shared base needed)

export interface A2aTask {                                                // HV-5
  kind: 'task'; id: string; contextId: string; status: A2aTaskStatus
  history?: A2aMessage[]; artifacts?: A2aArtifact[]; metadata?: Record<string, unknown>
}
export interface A2aTaskStatus { state: TaskState; message?: A2aMessage; timestamp?: string }   // HV-11 (confirmed as believed)
export interface A2aArtifact { artifactId: string; parts: A2aPart[]; name?: string
  description?: string; metadata?: Record<string, unknown>; extensions?: string[] }             // HV-11 (confirmed as believed)

export interface A2aAgentCard {                                           // HV-7 required set verbatim
  protocolVersion: string               // the protocol pin (upstream default "0.3.0")
  name: string; description: string; url: string
  version: string                       // the AGENT's own version — never conflated with the pin (SPEC-R2 reconcile note)
  capabilities: A2aAgentCapabilities
  defaultInputModes: string[]; defaultOutputModes: string[]
  skills: A2aAgentSkill[]
  preferredTransport?: string           // default "JSONRPC" (HV-2/HV-7)
  additionalInterfaces?: unknown[]; securitySchemes?: Record<string, unknown>; security?: unknown[]
  supportsAuthenticatedExtendedCard?: boolean; signatures?: unknown[]
}
export interface A2aAgentCapabilities { streaming?: boolean; pushNotifications?: boolean
  stateTransitionHistory?: boolean; extensions?: unknown[] }              // HV-7 verbatim
export interface A2aAgentSkill { id: string; name: string; description: string; tags: string[]
  examples?: string[]; inputModes?: string[]; outputModes?: string[]
  security?: { [scheme: string]: string[] }[] }                           // HV-11 — security? is the one addition the belief missed
```

Streaming event types (`TaskStatusUpdateEvent`/`TaskArtifactUpdateEvent`, HV-6) are deliberately **not typed** in B1 — no B1 requirement consumes them (typing unconsumed shapes is gold-plating; they land with the bridge wave that needs them).

## 3. Validator (LLD-C3 — total, batch, one implementation for everything)

```ts
export interface A2aFailure { code: 'A2A_SCHEMA'|'A2A_PIN'|'A2A_STATE'|'A2A_RPC'|'A2A_CARD'
                              path: string; detail: string }
export type A2aArtifactKind = 'message'|'task'|'card'|'rpc-request'|'rpc-response'
export function validateA2a(artifact: unknown,
  opts: { protocolVersion: string; expect?: A2aArtifactKind | 'auto' }): A2aFailure[]
```

- **Additive delta vs SPEC §6 sketch (flagged for doc-review):** `detail` on `A2aFailure` and the `expect` opt. Behavior is unchanged from the sketch; both are diagnostic surface the a2ui `A2uiError.message` precedent proved necessary.
- **Totality by construction:** no `throw` statement in the module; every branch appends failures and continues. The malformed-input corpus (hand-built + a structured fuzzer over field deletion/retyping/discriminator corruption) asserts zero throws (SPEC-R6 AC1).
- **Batch:** the walk collects every failure; `path` is JSON-Pointer style (`/parts/0/file`).
- **Detection (`expect: 'auto'`, used by gates over mixed artifacts):** `jsonrpc` key → rpc; `kind: 'message' | 'task'` → those; `protocolVersion` + `url` keys → card; anything else → one `A2A_SCHEMA` at `/`. Admission and fixtures pass an explicit `expect` — auto is a convenience, never the standing gates' mode.
- **Code ownership (design note, so the builder doesn't hunt):** `validateA2a` emits `A2A_SCHEMA`/`A2A_PIN`/`A2A_CARD`/`A2A_RPC`; **`A2A_STATE` is emitted only by the LLD-C4 guard**, which returns the same `A2aFailure` type. SPEC-R6's "one validator" = one judging subsystem with one closed code set and one failure shape; the SPEC-R6 AC1 corpus includes illegal-transition fixtures judged through the guard.
- **Pin enforcement (SPEC-R2):** any artifact carrying a `protocolVersion` field is checked against `opts.protocolVersion` → `A2A_PIN` at `/protocolVersion` on mismatch. In B1 the pin-bearing artifact is the card; transcript headers (B2) and record meta (B4) reuse the same check. Bare messages/tasks are version-silent upstream — their pin is owned by the containing artifact.

## 4. Task lifecycle (LLD-C4 — explicit table; policy vs upstream fact separated)

**Upstream normative facts (HV-5):** the 9-member state set, and the four terminals admit no restart. **Everything else in this table is family policy** — upstream v0.3.0 defines no full transition matrix; this LLD is the owning record for the edge set. Policy defaults conservative; edges exist where a consumer (the arena) needs them.

```ts
export const TASK_TRANSITIONS: Record<TaskState, readonly TaskState[]> = { /* the table below */ }
export function canTransition(from: TaskState, to: TaskState): boolean
export function guardTransition(from: TaskState, to: TaskState): A2aFailure[]  // [] | [A2A_STATE at /status/state]
```

| From \ legal to | Successors | Rationale |
|---|---|---|
| `submitted` | `submitted · working · auth-required · canceled · rejected · failed · unknown` | accept/decline/authgate before work; no `input-required`/`completed` without work starting |
| `working` | `working · input-required · auth-required · completed · canceled · failed · unknown` | the live arm; no regression to `submitted`, no post-acceptance `rejected` |
| `input-required` | `input-required · working · completed · canceled · failed · unknown` | resume on input; **`→ completed` is arena-driven** (game ends by forfeit while a move is pending — arena LLD §3) |
| `auth-required` | `auth-required · working · canceled · rejected · failed · unknown` | auth resolves to work or decline; no direct `input-required` |
| `unknown` | all 9 | the indeterminacy wildcard: knowledge lost (any non-terminal `→ unknown` is legal) and regained; keeping it edge-less would make the 9th state decorative |
| `completed` / `canceled` / `rejected` / `failed` | — (none) | terminals sealed (HV-5); rows are empty **by construction**, re-asserted by test |

Non-terminal self-loops are legal (status re-emission with a fresh `status.message`). The SPEC-R4 AC1 test enumerates the **full 9×9 matrix** (81 pairs: 35 legal / 46 illegal — submitted 7 · working 7 · input-required 6 · auth-required 6 · unknown 9 · four terminals 0) — asserting exact table contents, not spot checks; a second assertion derives "terminals have zero outgoing edges" from `TERMINAL_STATES` rather than repeating literals.

## 5. RPC framing (LLD-C5/C6 — JSON-RPC 2.0; the version-sensitive modules)

**Method tables (LLD-C6):** two `as const` tuples — `SUPPORTED_METHODS = ['message/send','tasks/get','tasks/cancel']` (what B1 frames + serves) and `KNOWN_METHODS` = the full HV-3 v0.3.0 JSON-RPC surface (adds `message/stream`, `tasks/resubscribe`, the four `tasks/pushNotificationConfig/*`, `agent/getAuthenticatedExtendedCard`) so the server can distinguish **known-but-unsupported (`-32004`)** from **unknown (`-32601`)**. The scope choice is SPEC-R7's ratified posture (JSON-RPC-only is compliant per HV-2). Why these three: the arena's seats speak `message/send` (each move + the `input-required` continuation, HV-10 `contextId`/`taskId` correlation); `tasks/get` covers the runner's state poll; `tasks/cancel` realizes the runner's abort→forfeit arm (arena LLD §7).

**Envelopes:** JSON-RPC 2.0 shapes (`jsonrpc: '2.0'`, `id`, `method`/`params` | `result`/`error`) — the one external standard cited directly (versionless, stable); A2A specifics ride HV-3/HV-9. Per-method params/results (HV-12, resolved 2026-07-07): `message/send` → `{ message: A2aMessage; configuration?: A2aMessageSendConfiguration; metadata? }` → `A2aTask | A2aMessage`, where `A2aMessageSendConfiguration = { acceptedOutputModes?: string[]; historyLength?: number; pushNotificationConfig?: unknown; blocking?: boolean }` is **typed, not elided** — the arena runner may genuinely want `blocking?`; `pushNotificationConfig` stays `unknown` because push config is known-unsupported (`-32004`), typing it would be gold-plating; `tasks/get` → `{ id: string; historyLength?: number; metadata?: Record<string, unknown> }` → `A2aTask`; `tasks/cancel` → `{ id: string; metadata?: Record<string, unknown> }` → `A2aTask` (both task-method param shapes ride upstream's `TaskIdParams`, which carries `metadata?` — HV-12's addition).

**Correlation:** `createRpcCorrelator()` — a **monotonic integer id counter starting at 1** plus a pending-map; deterministic by design (no randomness — the arena's byte-stable transcripts, SPEC-R12/N3, sit on this). `parseFrame(text)` is total: a discriminated `{ok: true, frame} | {ok: false, failures}` where failures are `A2A_RPC`-coded via LLD-C3.

**Error table (LLD-C5):** one `as const` map, both directions — standard `-32700/-32600/-32601/-32602/-32603` + A2A `-32001 TaskNotFound · -32002 TaskNotCancelable · -32003 PushNotificationNotSupported · -32004 UnsupportedOperation · -32005 ContentTypeNotSupported · -32006 InvalidAgentResponse · -32007 AuthenticatedExtendedCardNotConfigured` (HV-9 verbatim). `toRpcError(failure: A2aFailure)` maps validator codes outbound (`A2A_RPC`→`-32600`, parse→`-32700`, everything schema-shaped→`-32602`); `fromRpcError(code)` maps inbound with an explicit `'unknown'` fallback name that preserves the numeric code — never a throw.

## 6. Channel + transports (LLD-C7/C8/C9)

```ts
export interface A2aChannel {                       // SPEC §6 verbatim — close() drain-and-end semantics are SPEC-owned (behavioral, ruled at review)
  send(msg: A2aMessage): Promise<void>
  receive(): AsyncIterable<A2aMessage>
  close(): void
}
export function createLoopbackPair(): [A2aChannel, A2aChannel]
```

**Loopback (LLD-C7):** two FIFO queues + pending-resolver lists; microtask-only (no timers, no I/O — SPEC-N3's "zero timers-of-faith"). Ordering is structural: `send` appends, `receive` shifts; an interleaved-send test asserts order (SPEC-N5). `close()` ends both directions: buffered messages drain, then iterators complete; `send` after close returns a rejected Promise carrying a typed `A2aChannelClosedError` — a programming error surfaced loudly, not a silent drop. This channel **is the arena's isolation boundary** (arena LLD §2): message-level, no side channel.

**HTTP (LLD-C8, dev/Node):** the SPEC-N2/N3 letter ("no standing test performs network I/O") is honored by a **socket-free core**: `createRpcCore(handlers): { handleRpc(body: string): Promise<string> }` owns the whole path — parse (`-32700`) → envelope validation (`-32600`) → method dispatch (`-32601`/`-32004`) → handler → framed response; handler throws are caught at this boundary → `-32603` (the core is total). `serveA2a(core, card, opts)` is a thin `node:http` shell (~20 lines: POST `/a2a` → `handleRpc`; GET the well-known path → LLD-C9) covered by a **manual dev smoke** (`tools/http/smoke.ts`, run by hand like `npm run size`). `httpChannel(endpoint, { post? })` is the client arm: `send` frames `message/send` and awaits each POST **sequentially** (ordering, SPEC-N5); responses enqueue to `receive` in arrival order; the injectable `post` seam is what the standing transport-invariance test wires directly to `handleRpc` — the full framing path exercises with zero sockets. **SPEC-R8 AC1, stated outright: the AC's "HTTP" arm is satisfied at the framing path** — the socket-free `handleRpc` core plus the injectable `post` seam carry the same `A2aMessage` sequence through the complete frame→dispatch→respond path, decoded sequences asserted identical to loopback; **real-socket carriage is deliberately delegated to the manual dev smoke** (`tools/http/smoke.ts`), per SPEC-N2/N3's no-network-in-standing-tests letter.

**Well-known (LLD-C9):** `wellKnownAgentCardPath = '/.well-known/agent-card.json'` (HV-7 — the v0.3.0-renamed path, NOT `agent.json`). `serveAgentCard(card)` validates via LLD-C3 **at startup and refuses to serve an invalid card** (fail-fast — a lying card is worse than no card); `discoverAgent(baseUrl, { get? })` fetches + validates, returning `{card} | {failures}` — a card with failures is never returned as usable (SPEC-R5). The injectable `get` keeps its test socket-free, same seam as above.

## 7. Fixtures (LLD-C10) & byte-fidelity mechanics (LLD-C2)

**Codec:** `decodeA2a(text, opts)` = guarded `JSON.parse` (parse failure → `A2A_SCHEMA` at `/` with detail, never a throw) + `validateA2a` — decode **composes** the shared validator (a decode that skips judgment would fork SPEC-R6/N4). `encodeA2a(value)` = `JSON.stringify(value)` — compact, key-order-preserving, no transform. **Byte-fidelity holds because fixtures are committed in encode-canonical form** (compact single-line JSON, key order = authoring order): `encodeA2a(decodeA2a(raw)) === raw` (SPEC-R3 AC1). Readability is the corpus's job (B4), not the fixtures'. **Known hazard:** JS re-orders integer-like object keys, so a fixture (or metadata map) with keys like `"0"` breaks identity — the fixture canon rule bans integer-like keys in fixture maps, and the round-trip test itself is the trip-wire at commit time.

**Catalog** (`src/protocol/fixtures/`, loaded raw in tests via the `?raw` import the root tsconfig's `vite/client` types already declare): `message.text` · `message.data` (a DataPart message — the shape the arena's BoardMessage rides) · `message.file-bytes` · `message.file-uri` · `task.input-required` · `task.completed` · `card.referee` · `card.seat-x` · `card.seat-o` (the arena SPEC-R5 AC1 trio; each carries **both** `protocolVersion: "0.3.0"` and `version`) · per-method rpc request/response pairs · `rpc.error.task-not-found`. A standing test re-validates every committed fixture through `validateA2a` under the `PROTOCOL_VERSION` pin (SPEC-R2; the corpus-data standing-gate precedent). Malformed inputs are **test-local literals + fuzz**, not committed fixtures — the fixtures dir holds only truth.

## 8. Error & edge handling (enumerated per case)

| Case | Component | Handling |
|---|---|---|
| Unknown part `kind` | C3 | `A2A_SCHEMA` at `/parts/i/kind`; no throw (SPEC-R3 AC2) |
| Missing `kind: 'message'` discriminator | C3 | `A2A_SCHEMA` at `/kind` (HV-4 — the corrected sketch's load-bearing field) |
| FilePart with BOTH `bytes`+`uri`, or neither | C3 | `A2A_SCHEMA` at `/parts/i/file` (HV-4 mutual exclusion) |
| `role` outside `user\|agent` / missing required field | C3 | `A2A_SCHEMA` at the field path |
| Non-JSON input to decode | C2 | `A2A_SCHEMA` at `/` with parse detail; total |
| Integer-like keys break byte-identity | C2/C10 | fixture canon rule bans them; round-trip test bites at commit time |
| Unknown `TaskState` string | C3 | `A2A_SCHEMA` at `/status/state` (out-of-union is shape, not lifecycle — `A2A_STATE` is the guard's code) |
| Illegal transition / terminal-exit attempt | C4 | `guardTransition` → `A2A_STATE`; terminal rows empty by construction, re-asserted by the 81-pair test |
| Card missing a required field | C3 | `A2A_CARD` at the field path (SPEC-R5 AC1) |
| Card pin mismatch | C3 | `A2A_PIN` at `/protocolVersion`; nothing downstream consumes it (SPEC-R2 AC1) |
| `protocolVersion`/`version` conflation | C1/C3 | two distinct required card fields (SPEC-R2 reconcile note); fixtures carry both; validator checks both presences independently |
| Malformed envelope (shape) / unparseable body | C6/C8 | `A2A_RPC` (client side); server maps → `-32600` / `-32700` |
| Unknown method | C6/C8 | `-32601 MethodNotFound` |
| Known-but-unsupported method (`message/stream`, push-config, …) | C8 | `-32004 UnsupportedOperationError` — the deliberate JSON-RPC-only scope (SPEC-R7/HV-2) |
| Response id matches no pending request | C6 | correlation failure surfaced as `A2A_RPC` with the orphan id in `detail`; dropped-with-record, never a throw |
| Unknown inbound error code | C5 | numeric code preserved; name falls back to `'unknown'`; total |
| Handler throws inside the server core | C8 | caught at the `handleRpc` boundary → `-32603 InternalError` envelope; the core stays total |
| `send` after `close` | C7 | rejected Promise, typed `A2aChannelClosedError` |
| `receive` after `close` | C7 | buffered messages drain, then the iterator completes (`done`) — no loss (SPEC-N5) |
| HTTP non-200 / transport failure / invalid response JSON | C8 | coded `A2A_RPC` failure with detail; `receive` never fabricates a message |
| Discovery: 404 / invalid card | C9 | `{failures}` returned; the card is never used (SPEC-R5) |
| Serving an invalid card | C9 | startup refusal (fail-fast), never serves |

## 9. Package layout, exports & gate wiring (LLD-C11)

```
packages/agent-ui/a2a/
  package.json          # { "name": "@agent-ui/a2a", "exports": { ".": "./src/index.ts" }, no deps at all }
  src/
    index.ts            # barrel: protocol + rpc + channel public surface (ONE writer — integration slice only)
    protocol/           # types.ts · codec.ts · validate.ts · task-state.ts · fixtures/*.json (+ co-located *.test.ts)
    rpc/                # errors.ts · frame.ts
    channel/            # loopback.ts · transport-invariance.test.ts (imports ../../tools/http/* relatively)
  tools/
    http/               # core.ts · server.ts · channel.ts · smoke.ts (manual dev smoke)
    wellknown.ts
```

- **Workspace/gates:** the root `workspaces` glob (`packages/agent-ui/*`), tsc `include` (`packages/agent-ui/*/src`), and the vitest `packages` project glob (`packages/agent-ui/*/src/**/*.test.ts`) all pick the package up with **zero config edits**. The scaffold's only root delta: `@agent-ui/a2a` + `@agent-ui/a2a/*` entries in root tsconfig `paths` (B2+ consumers; harmless now, prevents a B2 config collision).
- **`tools/` type-checking (the a2ui precedent):** root tsc includes only `src/`, but `src/`-located tests import `tools/` relatively (the invariance test above), pulling it into the checked program — tools ride `npm run check && npm test` without an include change. `smoke.ts` is the one file exercised only manually; it stays import-reachable from the invariance test's module graph (types only) so it cannot rot silently.
- **Consumer-surface proof (SPEC-N1/N2):** the exports map carries `.` only — no `./tools` subpath exists to leak; the S7 checkpoint greps the barrel's transitive import graph for `tools/` (must be absent).
- **No vitest alias needed** in B1 (all imports are package-relative); the site alias lands with the B5 page, not here.

## 10. Build sequence (dependency-ordered; each slice verifiable; fan-out-safe)

Precondition **S0 (host, not build):** resolve **HV-11 + HV-12** in SPEC §2 (verbatim citations). *Gate: zero unresolved rows referenced by S2/S5 (SPEC-R1 AC1).* **SATISFIED 2026-07-07** (SPEC §2 B1 intake addendum) — S2/S5 are dispatchable.

1. **S1 scaffold (C11)** — package.json, tsconfig `paths` delta, `index.ts` stub, one placeholder test. *(checkpoint: `npm run check && npm test` green with the package present)*
2. **S2 types + fixtures (C1, C10)** — transcribe HV-resolved shapes; commit the fixture catalog in canonical form. *(checkpoint: fixture-transcription test — every fixture parses into the typed model)*
3. **S3 validator + codec (C3, C2)** — judgment then decode-composes-judgment. *(checkpoint: totality corpus 0 throws; one firing fixture + passing sibling per code — the negative-control discipline; round-trip byte-identity — SPEC-R6 AC1, R3 AC1/AC2; fixture standing gate live from here)*
4. **S4 task machine (C4)** — table + guard. *(checkpoint: the 81-pair matrix — SPEC-R4 AC1)* *(parallel with S3 after S2 — disjoint files)*
5. **S5 errors + framing (C5, C6)** — tables + correlator. *(checkpoint: per-method round-trip with correlation intact; malformed → `A2A_RPC`; 12-code bidirectional mapping — SPEC-R7 AC1)*
6. **S6 loopback (C7)** — *(checkpoint: ordered-delivery interleave, close semantics, zero timers — SPEC-R8 loopback arm, N5)* *(parallel with S5 — disjoint files)*
7. **S7 HTTP + well-known (C8, C9)** — core/shell/client + card endpoints. *(checkpoint: socket-free transport-invariance — SPEC-R8 AC1; the three arena cards validate, a broken card fails `A2A_CARD` at its path — SPEC-R5 AC1; consumer-surface grep clean — N1/N2)*
8. **S8 integration (serial, one writer)** — `src/index.ts` barrel finalized; SPEC §7 staging note re-synced; handoff composed. *(checkpoint: full `npm run check && npm test` green; family `trace_check` reports exactly R14/R15/R16 UNIMPLEMENTED)*

**Fan-out rules (per the decomposition doctrine):** one writer per file; the barrel is edited only in S8; S3∥S4 and S5∥S6 are the two safe parallel pairs; every new coded-failure gate lands with its passing sibling (negative control).

**Arena consumption points (what B2/B3 plug into):** arena runner (its LLD-C7) ← `createLoopbackPair`; arena referee (its LLD-C2) ← `guardTransition`/`TASK_TRANSITIONS` incl. the `input-required → completed` forfeit edge; arena transcript + isolation gate (its LLD-C3/C4) ← `validateA2a` + `PROTOCOL_VERSION`; arena model seat (its LLD-C6) ← the `A2aMessage`/`A2aDataPart` shapes; arena cards (SPEC-R5 AC1) ← LLD-C9 + the three card fixtures; the arena dev proxy MAY reuse `createRpcCore` (dev-graph, optional).

## 11. What B1 explicitly does NOT build

The arena (all of it — B2/B3, the sibling LLD) · the corpus subsystem (B4) · the site section (B5) · the A2UI-over-A2A bridge (B6, blocked per PRD A-3) · `message/stream`/SSE + the HV-6 event types (deferred to the wave that consumes them; HV-6 resolution confirmed the arena doesn't need streaming) · push-notification config methods, `tasks/resubscribe`, `agent/getAuthenticatedExtendedCard` (known-unsupported, `-32004`) · gRPC / HTTP+JSON-REST transports (out of scope per PRD; JSON-RPC-only is compliant per HV-2) · auth schemes / security hardening (PRD out-of-scope: no production server SDK) · an `A2aClient` SDK object (no SPEC-R demands one; framing + channels are the contract — adding a client wrapper is gold-plating until a consumer names it).

**Discovered-reality rule (discharged for HV-11/HV-12, 2026-07-07):** both rows resolved with no contradictions and three additive deltas (skill `security?` · `TaskIdParams.metadata?` · typed `MessageSendConfiguration`), incorporated into §§2/5 in the same change. The rule stands for any future HV row: repair SPEC §2 (the resolutions) and re-derive the consuming sections of this file before their slices dispatch — never build around a stale placeholder. If any repair touches SPEC-R3/R7 normative text, the SPEC is fixed first (the family sync doctrine).

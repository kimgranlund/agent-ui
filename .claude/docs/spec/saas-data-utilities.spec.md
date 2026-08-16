# SPEC — SaaS Data Utilities v1 (`@agent-ui/data`)

> Status: proposed · v0.1 · 2026-08-16 · Layer: SPEC (execution contract)
> Refines: [`../prd/saas-data-utilities.prd.md`](../prd/saas-data-utilities.prd.md) — **PRD-G1** (DataSource seam), **PRD-G2** (read pathway), **PRD-G3** (mutation pathway), **PRD-G4** (streaming), **PRD-G5** (gateway client), **PRD-G6** (pagination), **PRD-G7** (fleet pillars), **PRD-G8** (teaching); realizes [ADR-0192](../adr/0192-agent-ui-data-package.md) clauses 1–6 (**proposed, NOT yet ratified** — Kim flips; nothing here self-ratifies). Rules the PRD's delegated **PRD-D6** (PRD §5 — defaults + budget) as recommendations on record, in this SPEC's §3.5 and the clauses it names (R10, R12, R14).
> Decomposition: [`../decompositions/saas-data-utilities.decomp.json`](../decompositions/saas-data-utilities.decomp.json) (both planes, PLAN, `--strict` clean); this SPEC is that manifest's **n6b** and the gate on its n6b→n1 edge (the build is dispatched from a fixed contract).
> Altitude: owns the **v1 behavior contract** — the package boundary, the core seam's semantics, the gateway middleware laws, the streaming contract, and every observable at each boundary. Why/what is the PRD's; the file map is the manifest's; mechanisms beyond a clause + its tests belong to the build (an LLD only if one proves too large — PRD §7). Requirement IDs file-scoped (`SPEC-R#` / `SPEC-N#`); every R traces to a PRD-G (§6).
> Prior art cited by clause, never re-litigated: `AgentTransport`/`AgentProvider` ([ADR-0137](../adr/0137-a2ui-agent-producer-toolkit-export.md)) · `readNdjsonLines` (`site/lib/ndjson-lines.ts`) · `A2aChannel` (`packages/agent-ui/a2a/src/channel/loopback.ts`) · corpus store `put` ([ADR-0062](../adr/0062-corpus-packaging-pure-core-subpath-data-home.md)) · signals kernel (`components/src/reactive/`) · [ADR-0191](../adr/0191-fleet-stale-pending-state-convention.md) (`:state(pending)`, proposed) · a2ui-live-agent SPEC-R16–R19 (server posture) · [ADR-0115](../adr/0115-spa-router-v1-scope.md)/[ADR-0119](../adr/0119-code-prose-family-v1-scope.md) (sibling-package precedent, incl. the router's `defaultRouter` soft-global posture).

---

## 1 · Purpose

Define what `@agent-ui/data` is at v1: a **zero-dep, headless data layer** for the fleet — a `DataSource<T>` strategy interface whose CRUD verbs are optional capabilities; `resource()`/`mutation()`/`paginated()` returning **kernel signals** so components bind with zero data logic; a `./gateway` subpath carrying the consumer-side client contract (middleware onion, token flow, typed error envelope, retry/backoff, streaming pass-through); and a `./stream` subpath carrying ONE `Streamed<T>` contract with `fromFetchStream`/`fromEventSource`/`fromWebSocket` adapters. Sibling branch off `components`; catalog-invisible by construction.

## 2 · Definitions

- **Key** — an opaque string identifying a cached value (`'users/42'`); **prefix invalidation** matches by string prefix (`'users/'`).
- **DataSource** — a consumer-authored strategy object; every verb optional (§3.2 R2).
- **Resource** — a signal-backed read state machine over one key: `status ∈ idle · loading · success · error`, `data`, `error` (a `DataError`), `updatedAt`, `pending` (a fetch is in flight, incl. background revalidate).
- **Store** — the instance-scoped key→value cache with structural-sharing snapshots and one writer (`commit`).
- **Mutation** — a signal-backed write state machine with declared cache effects (`invalidate`, `optimistic`).
- **DataError** — the ONE typed error envelope `{ kind: 'http'|'network'|'abort'|'parse'|'unknown', status?, code?, retryable: boolean, cause: unknown }`.
- **Middleware** — `(req: Request, next: (req: Request) => Promise<Response>) => Promise<Response>`; composed as an onion around `fetch`.
- **Streamed<T>** — `AsyncIterable<T>`; the one streaming contract. **Bridge** — the push→pull queue turning a callback source into a `Streamed<T>` under a declared backpressure policy.
- **Headless invariant** — core/gateway modules reference no DOM global (`window`, `document`); `./stream` adapters touch only the platform object they wrap (`EventSource`, `WebSocket`) and accept an injected constructor for tests.

---

## 3 · Requirements

Normative per RFC 2119; each carries an ID, a PRD trace, and testable acceptance criteria.

### 3.1 Package boundary

**SPEC-R1 — `@agent-ui/data` joins the DAG as a components-consumer sibling; three export surfaces; nothing imports it inward.** The package MUST declare runtime dependencies of exactly `{@agent-ui/components, @agent-ui/shared}` (the kernel; `shared` for utility types); MUST NOT be imported by `components`, `a2ui`, `shared`, `router`, or `code` (`@agent-ui/app` MAY later consume it); MUST follow the strict TS posture (`erasableSyntaxOnly`/`verbatimModuleSyntax`/`.ts` local imports); and MUST expose exactly: `.` (DataSource types + `Streamed<T>` type + store + resource/mutation/paginated + `DataError`/`normalizeError`), `./gateway` (client + middleware), `./stream` (bridge + three adapters). The `.` barrel MUST NOT import from `./gateway` or `./stream`. *(→ PRD-G7; ADR-0192 cl.1–2; PRD-D3/D5)*
- **AC1** *Given* the package, *when* `data/src/layering.test.ts` runs, *then* every import under `data/src` resolves to `{@agent-ui/components, @agent-ui/shared}` or a local path, and the test goes RED under a planted upward import (negative control, unique token, grep-confirmed applied).
- **AC2** *Given* the repo, *when* the a2ui/router/code/app layering trip-wires run with their inward-scan extended to `@agent-ui/data`, *then* no source under `components/src`, `a2ui/src`, `shared/src`, `router/src`, `code/src` imports it — the **catalog fence is structural**.
- **AC3** *Given* a consumer importing only `.`, *when* the tree-shake probe (`scripts/measure-size.mjs`) runs, *then* no `./gateway`/`./stream` symbol (`createGateway`, `withRetry`, `fromFetchStream`, `fromWebSocket`) is in the output.
- **AC4** *Given* `data/package.json`, *then* `dependencies` is exactly the two workspace packages and there is no third-party entry (grep gate).

### 3.2 The core seam

**SPEC-R2 — `DataSource<T>`: every verb is an optional capability; widening is additive.**
```ts
interface SourceContext { signal: AbortSignal }
interface DataSource<T, Q = unknown, I = Partial<T>> {
  read?(key: string, ctx: SourceContext): Promise<T>
  list?(query: Q, ctx: SourceContext): Promise<readonly T[]>
  create?(input: I, ctx: SourceContext): Promise<T>
  update?(key: string, patch: I, ctx: SourceContext): Promise<T>
  remove?(key: string, ctx: SourceContext): Promise<void>
  subscribe?(key: string, ctx: SourceContext): Streamed<T>
}
```
A source MUST be accepted with any subset of verbs; `resource()`/`mutation()` MUST fail fast with a `DataError` (`kind: 'unknown'`, `code: 'missing-capability'`) when asked to use a verb the source lacks; adding a verb to this interface in a later version MUST NOT require any change to an existing source (the `AgentProvider` `effort?`/`onEvent?`/`tools?` additive precedent). *(→ PRD-G1; ADR-0192 cl.3)*
- **AC1** *Given* `const s = { read: async () => 1 } satisfies DataSource<number>`, *then* it type-checks and `resource('k', s)` runs to `success`.
- **AC2** *Given* a source without `subscribe`, *when* `resource('k', s, { live: true })` is created, *then* `error.value.code === 'missing-capability'` and `status === 'error'` (no throw at construction).
- **AC3** *Given* the fixture sources in the suite, *when* a new optional verb is appended to the interface (a test-only extension type), *then* every fixture still type-checks unchanged.

**SPEC-R3 — `resource(key, source | fetcher, opts?)` is a signal-backed read state machine with SWR, dedup, invalidation and abort.** Returns `Resource<T>`:
```ts
interface Resource<T> {
  status: ReadonlySignal<'idle' | 'loading' | 'success' | 'error'>
  data: ReadonlySignal<T | undefined>
  error: ReadonlySignal<DataError | undefined>
  updatedAt: ReadonlySignal<number | undefined>
  pending: ReadonlySignal<boolean>
  refetch(): Promise<void>
  dispose(): void
}
```
`opts`: `{ store?, staleMs? (default 0 = always revalidate on subscribe), live?: boolean, enabled?: ReadonlySignal<boolean> | boolean }`. Semantics: (a) **SWR** — if the store holds a value for `key`, `data` is served **synchronously** and `status` is `success` while a background revalidate runs (`pending === true`); (b) **dedup** — concurrent resources on one key share ONE in-flight source call; (c) **invalidation** — `store.invalidate(key | prefix)` marks matching entries stale and every active resource on them refetches; (d) **abort** — `dispose()` and a superseding refetch abort the in-flight `SourceContext.signal`; (e) **live** — with `live: true` and `source.subscribe`, each yielded value commits to the store and wakes `data`; (f) **error** — `error` is always a `DataError` (normalized), and a stale `data` value is **kept** on error (the SWR contract; UI decides). `pending` is the signal a control wires to ADR-0191's `:state(pending)`; this package never styles. Core MUST satisfy the headless invariant. *(→ PRD-G2; ADR-0192 cl.3)*
- **AC1** *Given* an empty store, *when* `resource('k', s)` is created, *then* `status` transitions `idle → loading → success` and `updatedAt` is set; *given* a rejecting source, *then* `→ error` with a `DataError` and `data` unchanged.
- **AC2** *Given* a store pre-seeded with `k`, *when* a resource is created, *then* `data.value` equals the seed synchronously, `status === 'success'`, `pending === true` until the revalidate settles, and `data` then reflects the fresh value.
- **AC3** *Given* two resources on `k` created in one tick, *then* the source's `read` is called exactly once (spy count 1).
- **AC4** *Given* `invalidate('users/')`, *then* every active resource under `users/*` refetches (spy counts increment) and one under `posts/1` does not.
- **AC5** *Given* `dispose()` mid-flight, *then* the passed `signal.aborted === true`; *given* a `refetch()` while one is in flight, *then* the earlier signal aborts and the later result wins.
- **AC6** *Given* `core/*.ts`, *when* a `window`/`document` reference is planted (unique token), *then* the static headless gate goes RED (negative control).
- **AC7** *Given* `live: true` over a source whose `subscribe` yields three values, *then* `data` wakes three times with those values in order and `status === 'success'`.

**SPEC-R4 — the store is instance-scoped, single-writer, structurally sharing.** `createStore()` returns `{ get(key), commit(key, value | (prev) => value), snapshot(), restore(snap), invalidate(key | prefix), subscribe(key, cb) }`. Only `commit` MUST mutate; a `snapshot()` MUST be O(1) (structural sharing — untouched entries keep identity); `restore()` MUST make the store byte-equal to the snapshot; `commit` with a value `Object.is`-equal to the current one MUST NOT wake subscribers (the kernel cutoff). A module-level default store MUST exist for `resource()`/`mutation()` called without `store`, documented as a **soft global** (the ADR-0115 `defaultRouter` posture); tests MUST use explicit stores. *(→ PRD-G2/G3; ADR-0192 cl.3)*
- **AC1** *Given* a store, *when* a value obtained from `get` is mutated in place, *then* subscribers are NOT woken and `get` returns the committed reference (single-writer proven by observation).
- **AC2** *Given* `snapshot()` then `commit('a', 2)` then `restore(snap)`, *then* `get('a')` is the pre-commit value and `get('b')` is `Object.is` the same reference before and after.
- **AC3** *Given* `commit('a', sameRef)`, *then* the subscriber callback count is unchanged.

**SPEC-R5 — `mutation(fn, effects?)` is a signal-backed write with declared cache effects.** `mutation(fn: (input, ctx: SourceContext) => Promise<R>, { store?, invalidate?: string[] | ((input, result) => string[]), optimistic?: (input, store) => void })` returns `{ status, error, data, run(input): Promise<R | undefined>, dispose() }`. Semantics: `run` transitions `idle → pending → success | error`; `invalidate` keys are invalidated **on settle** (success or error) — refetch happens through R3(c); `optimistic` runs **synchronously before `fn`** against a `snapshot()`; on error the store is `restore()`d to that snapshot; on success the optimistic write stands until invalidation refetches. Concurrent `run`s are allowed; each holds its own snapshot; rollback restores **only** the keys that run touched (per-key snapshot, so an unrelated concurrent success is not undone). *(→ PRD-G3; ADR-0192 cl.3)*
- **AC1** *Given* `run()`, *then* `status` is `pending` before `fn` resolves and `success` after; a rejecting `fn` yields `error` as a `DataError`.
- **AC2** *Given* `invalidate: ['users/']` and an active resource on `users/1`, *when* `run` settles (either way), *then* that resource refetches (spy).
- **AC3** *Given* `optimistic: (input, s) => s.commit('users/1', patched)`, *then* a resource on `users/1` sees `patched` synchronously after `run()` is called; *given* `fn` rejects, *then* `users/1` is byte-equal to the pre-run value and an untouched `users/2` keeps `Object.is` identity.
- **AC4** *Given* two concurrent runs touching different keys where the first rejects, *then* only the first's keys roll back.

**SPEC-R6 — `DataError` is the ONE envelope; `normalizeError` maps every failure onto it.** `normalizeError(e: unknown): DataError` MUST map: fetch `TypeError` → `network`/`retryable: true`; `AbortError` (`DOMException` name) → `abort`/`false`; a `Response` (or `HttpError` carrying one) → `http` with `status`, `retryable` = `status ∈ {408, 425, 429, 500, 502, 503, 504}`; `SyntaxError` from body parsing → `parse`/`false`; an existing `DataError` → itself by identity; anything else → `unknown`/`false`. `code` is an optional consumer/server-supplied string (e.g. a JSON `error.code`), never derived by guessing. UI MUST be drivable from `kind`/`retryable` alone. *(→ PRD-G5; ADR-0192 cl.4)*
- **AC1** the six mappings above each hold in the unit suite (one `it` per row); identity passthrough is `Object.is`.
- **AC2** *Given* a `Response` with a JSON body `{ error: { code: 'E_QUOTA' } }` and a `code` extractor option, *then* `code === 'E_QUOTA'`; *given* no extractor, *then* `code === undefined`.

**SPEC-R7 — `paginated(key, fetchPage, { getNextCursor })` is a thin layer over R3.** `fetchPage(cursor: C | undefined, ctx)` → `Promise<P>`; returns `{ pages: ReadonlySignal<readonly P[]>, status, error, pending, hasMore: ReadonlySignal<boolean>, loadMore(): Promise<void>, refetch(), dispose() }`. `loadMore` appends one page using `getNextCursor(lastPage)`; `hasMore` is `false` when it returns `undefined`; invalidation of `key` refetches **from the first cursor** and replaces `pages`. Pages live under ONE store key (`key`), never one key per page. *(→ PRD-G6)*
- **AC1** *Given* three `loadMore()` calls over a fixture with three pages, *then* `pages.value.length === 3` and `hasMore.value === false`.
- **AC2** *Given* `invalidate(key)` after two pages, *then* `fetchPage` is called with `undefined` first and `pages` becomes the fresh first page only.

### 3.3 The gateway subpath (`./gateway`)

**SPEC-R8 — `createGateway` composes an onion of middleware around an injected `fetch`.** `createGateway({ baseUrl?, headers?, fetch?, middleware?: Middleware[] })` returns `{ request(input, init?): Promise<Response>, json<T>(input, init?): Promise<T> }`. Middleware type: `(req: Request, next: (req: Request) => Promise<Response>) => Promise<Response>`; order is **onion** (first-listed is outermost); `baseUrl` + default `headers` + JSON body serialization (`init.json`) are applied by the innermost built-in shaping step; any throw or non-`Response` from a middleware surfaces as a `DataError` (R6). Headless. *(→ PRD-G5; ADR-0192 cl.4)*
- **AC1** *Given* middleware `[a, b]` each appending to a log on entry/exit, *then* the log reads `a-in, b-in, b-out, a-out`.
- **AC2** *Given* `baseUrl: 'https://x/'` and `request('users')`, *then* the stubbed fetch receives `https://x/users` with the default headers merged (per-request headers win).
- **AC3** *Given* a middleware that throws `new Error('x')`, *then* `request()` rejects with a `DataError` of `kind: 'unknown'` whose `cause` is that error.

**SPEC-R9 — `withToken(getToken, { refresh?, header? })` decorates requests and refreshes once on 401.** `getToken(): string | Promise<string | undefined>` sets `Authorization: Bearer <t>` (or `header`) per request; on a `401` **with** `refresh` provided, exactly ONE `refresh()` runs across all concurrent 401s (single-flight); every queued request replays once with the new token; a second `401` after replay is returned as-is (no loop); if `refresh` rejects, every queued request rejects with the SAME `DataError` (`http`, `401`, `retryable: false`). The token MUST NOT be written to any store/state this package owns. *(→ PRD-G5)*
- **AC1** *Given* 5 concurrent requests all answered `401` then `200`, *then* `refresh` is called once and each request resolves `200` with the new token in its header.
- **AC2** *Given* `refresh` rejecting, *then* all 5 reject with one `DataError` (`Object.is` across rejections).
- **AC3** *Given* the full flow, *then* `store.snapshot()` contains no string equal to either token (grep + assertion).
- **AC4** *Given* a request that streams (R11) and a `401` on it, *then* the replay is issued only if the original request's body was not a one-shot stream (`init.body` re-creatable), else it rejects with `kind: 'http'`, `code: 'unreplayable-body'`.

**SPEC-R10 — `withRetry(policy)` retries retryable, idempotent requests with exponential backoff + full jitter.** `policy: { maxAttempts = 3, baseMs = 200, capMs = 5_000, retryOn?: (err: DataError, res?: Response) => boolean }`. Defaults (PRD-D6): retry iff `normalizeError` says `retryable` AND (`method ∈ GET/HEAD/OPTIONS/PUT/DELETE` OR `init.idempotent === true`); delay = `random(0, min(capMs, baseMs · 2^attempt))` (full jitter); a `Retry-After` header (seconds or HTTP-date) MUST override the computed delay when larger; the wait MUST be interruptible by `req.signal` (reject `kind: 'abort'` immediately); attempts capped at `maxAttempts` (total, incl. the first). *(→ PRD-G5)*
- **AC1** *Given* fake timers and responses `503, 503, 200`, *then* 3 fetch calls, each delay `∈ [0, baseMs·2^n]`, final `200`.
- **AC1b** *Given* a `GET` answered `503, 200` with no `idempotent` option, *then* 2 fetch calls and a `200` (the method default retries without opt-in); the same for `PUT` and `DELETE`.
- **AC2** *Given* a `POST` without `idempotent: true` answered `503`, *then* exactly 1 fetch call and a `DataError` `http/503/retryable: true` (retryable but not retried — the caller may opt in).
- **AC3** *Given* `Retry-After: 2` on the first `503`, *then* the second attempt happens ≥ 2000 ms later.
- **AC4** *Given* an abort during the back-off wait, *then* rejection with `kind: 'abort'` before the timer fires (fake timers not advanced).
- **AC5** *Given* `503 × 5` and `maxAttempts: 3`, *then* exactly 3 fetch calls.

**SPEC-R11 — the streaming pass-through rule: no middleware reads, tees, or buffers a `Response.body`.** Every built-in middleware (shaping, token, retry) MUST return the upstream `Response` object with `body` unread; retry MUST decide from `status`/headers only (a `5xx` with a body is retried without reading it); `json()` is the only built-in that consumes a body and it is a **terminal** helper, not middleware. Documented as a law consumer middleware must also obey. *(→ PRD-G5; ADR-0192 cl.4)*
- **AC1** *Given* a streaming stub `Response` (a `ReadableStream` body) through the full default chain (`shaping + withToken + withRetry`), *then* the caller receives it with `bodyUsed === false` and `body.locked === false`.
- **AC2** *Given* a planted `await res.text()` inside a built-in middleware (unique token), *then* AC1's test goes RED (negative control).

### 3.4 The stream subpath (`./stream`)

**SPEC-R12 — ONE contract, ONE bridge: `Streamed<T> = AsyncIterable<T>`; `pushToPull` bridges push sources under a declared backpressure policy with exact-once teardown.** `pushToPull<T>({ backpressure: 'buffer' | 'drop-oldest' | 'drop-newest', highWaterMark = 256, signal?, onTeardown? })` returns `{ push(v: T): boolean, end(err?: unknown): void, stream: Streamed<T> }` — `push` returns `false` once the queue is at/over `highWaterMark` (the consumer's backpressure cue). Default policy (PRD-D6): **`'buffer'`** with a `highWaterMark` beyond which `push` returns `false` (the consumer's cue), never throws — chosen because dropping is a semantic decision the adapter cannot make for the consumer; the drop policies exist for telemetry-shaped feeds. `iterator.return()` and `signal.abort()` MUST each end the stream and call `onTeardown` **exactly once**; `push` after end is a no-op. `AgentTransport.turn(): AsyncIterable<string>` (ADR-0137) is the house precedent for the contract; it is cited, not changed. *(→ PRD-G4; ADR-0192 cl.5)*
- **AC1** *Given* `'buffer'`, *then* every pushed value is yielded in order; *given* `'drop-oldest'` at HWM, *then* the oldest queued value is dropped; *given* `'drop-newest'`, *then* the incoming value is dropped.
- **AC2** *Given* `return()` then `abort()`, *then* `onTeardown` count is 1 and the iterator is done; the same for the reverse order.
- **AC3** *Given* `push` after `end`, *then* no yield and no throw.

**SPEC-R13 — three adapters over the bridge, native mechanics only.**
(a) `fromFetchStream(input, init & { frame: 'ndjson' | 'sse' | 'lines', fetch? }): Streamed<Frame>` — POST- and header-capable; `ndjson`/`lines` reuse the HOISTED `readNdjsonLines` (moved into `data/src/stream/ndjson-lines.ts`; `site/lib/ndjson-lines.ts` becomes a one-line re-export with the IDENTICAL exported name and signature `readNdjsonLines(body: ReadableStream<Uint8Array>): AsyncIterable<string>` — behavior parity is pinned by the site suite, type parity by `tsc`); `sse` parses `data:` (multi-line joined by `\n`), `event:`, `id:`, `retry:` per the WHATWG grammar, ignores `:` comments; abort → `reader.cancel()`.
(b) `fromEventSource(url, { events?: string[], withCredentials?, EventSource? }): Streamed<MessageEvent>` — GET-only; the **no-custom-headers auth constraint** (cookie / query ticket) MUST be stated in the export's doc comment; `Last-Event-ID` resume is the platform's; `return()` → `es.close()`.
(c) `fromWebSocket(url, { protocols?, heartbeat?: { intervalMs, timeoutMs, ping }, reconnect?: { maxAttempts, baseMs, capMs }, highWaterMark?, WebSocket? })` → `Streamed<MessageEvent> & { send(data): Promise<void>, close(code?, reason?) }` — messages in order; `send` awaits when `bufferedAmount > highWaterMark` (drain by polling/`onmessage` tick); heartbeat sends `ping` every `intervalMs` and treats no message within `timeoutMs` as dead → reconnect **only if opted in** (exp backoff, full jitter, capped); `return()`/`close()` → close code `1000` and no reconnect (the `A2aChannel` close-drain precedent). Injected constructors (`EventSource?`, `WebSocket?`, `fetch?`) MUST exist for jsdom testing. *(→ PRD-G4; ADR-0192 cl.5)*
- **AC1** the existing `site/lib/ndjson-lines.test.ts` chunk-boundary cases pass against `data/src/stream/ndjson-lines.ts`; grep shows ONE implementation body (`site/lib/ndjson-lines.ts` is `export { readNdjsonLines } from '@agent-ui/data/stream'`).
- **AC2** *Given* an SSE body `data: a\ndata: b\nid: 7\n\n:comment\n\ndata: c\n\n`, *then* two frames `{ data: 'a\nb', id: '7' }` and `{ data: 'c' }`.
- **AC3** *Given* abort mid-stream, *then* the reader's `cancel` spy is called once.
- **AC4** *Given* a fake `EventSource`, *then* `return()` calls `close()` once; the doc comment contains "no custom headers" (grep).
- **AC5** *Given* a fake `WebSocket` and `heartbeat.timeoutMs` elapsed with no message (fake timers), *then* with `reconnect` a second socket is constructed (count 2) and without it the stream ends with a `DataError` `network`; *given* `return()`, *then* close code `1000` and no reconstruction.
- **AC6** *Given* `bufferedAmount` above `highWaterMark`, *then* `send()` does not resolve until it drops below.

### 3.5 Pillars, defaults and budget

**SPEC-R14 — pillars + teaching.** (a) Zero runtime deps (R1 AC4); (b) headless invariant gated for `core/**` and `gateway/**`; (c) size line-item in `scripts/measure-size.mjs`: **`.` ≤ 6 kB, `./gateway` ≤ 3 kB, `./stream` ≤ 4 kB** min+brotli (PRD-D6 recommendation — sized against the router's core line-item; the build re-measures and the ADR's Consequences carry the honest number); (d) CLAUDE.md Layout + import-DAG rows name `data`; (e) a site doc page (`site/data-doc.html`) with the nav/toc gates green; (f) M2: one `site/` page's hand-rolled fetch replaced by `resource()`/`fromFetchStream()` with behavior pinned. *(→ PRD-G7/G8; ADR-0192 cl.6)*
- **AC1** `npm run check && npm test` exit 0 with the new package; `npm run test:browser` green for the `./stream` browser shard.
- **AC2** the size gate passes at the stated budgets or the ADR Consequences row is amended with the measured number before merge (never silently raised).
- **AC3** CLAUDE.md's Layout and Conventions DAG rows include `data`; grep confirms.

---

## 4 · Non-goals (SPEC-N)

- **SPEC-N1 — no UI element, CSS, or token** ships from this package (PRD §4). `pending` is a signal; ADR-0191's `:state(pending)` is the consumer's to wire.
- **SPEC-N2 — `AgentTransport`/`AgentProvider` are byte-unchanged** (PRD-D2); no `agentSource()` adapter at v1; `a2ui` never imports `data` (R1 AC2).
- **SPEC-N3 — no server code, no persistence, no offline/local-first** (PRD §4; #959 owns `StorageAdapter` in `shared`; hydration is v2).
- **SPEC-N4 — no third-party runtime code**, no polyfills, no normalized entity graph, no query language (PRD §4).

## 5 · Examples

```ts
// a table bound to a paginated API with optimistic edits
import { createStore, resource, mutation, paginated } from '@agent-ui/data'
import { createGateway, withToken, withRetry } from '@agent-ui/data/gateway'
import { fromWebSocket } from '@agent-ui/data/stream'

const api = createGateway({ baseUrl: '/api/', middleware: [withToken(getToken, { refresh }), withRetry()] })
const store = createStore()
const users = paginated('users', (cursor, { signal }) => api.json(`users?cursor=${cursor ?? ''}`, { signal }),
  { getNextCursor: p => p.next, store })
const rename = mutation((u: User, { signal }) => api.json(`users/${u.id}`, { method: 'PATCH', json: u, signal }),
  { store, invalidate: ['users'], optimistic: (u, s) => s.commit(`users/${u.id}`, u) })
const live = resource('presence', { subscribe: () => fromWebSocket('/ws/presence') }, { live: true, store })
// a control binds users.pages / rename.status / live.data; wires :state(pending) from users.pending
```

## 6 · Clause map

| SPEC | PRD | ADR-0192 |
|---|---|---|
| R1 | G7 | cl.1, cl.2 |
| R2 · R3 · R4 · R5 | G1 · G2 · G2/G3 · G3 | cl.3 |
| R6 · R8 · R9 · R10 · R11 | G5 | cl.4 |
| R7 | G6 | cl.3 |
| R12 · R13 | G4 | cl.5 |
| R14 | G7 · G8 | cl.6 |

## 7 · Acceptance (wave-level)

- **Design wave (this record):** PRD/SPEC/ADR authored; `npx vitest run site/lib/adr.test.ts site/lib/docs-grammar.test.ts` exit 0; `coverage_check.py --strict` exit 0 on the manifest; `docs:doc-checker` verdicts on all three docs repaired to PASS; ADR-0192 Status stays `proposed` until Kim ratifies.
- **Build wave (on ratification):** every R-AC above green; `npm run check && npm test` + the `./stream` browser shard exit 0; the manifest's leaves closed in edge order.

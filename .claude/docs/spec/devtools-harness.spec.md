# SPEC — `@agent-ui/devtools`: the Chat & A2UI dev/debug harness (GH #1122)

> *Term note (2026-08-29):* the "harness" this spec names is the **devtools capture** (`@agent-ui/devtools`:
> transports, `recordTurn`, the `DevtoolsEvent` timeline, the `DevtoolsCapture` file); the filename is
> historical. Fleet term sheet: [`references/agent-model.md`](../references/agent-model.md) §2.
> Status: proposed · v0.1 (skeleton — enough for build slices to cite; rows harden as slices land) · 2026-08-17 · Layer: SPEC (execution contract)
> Refines: GH #1122 (Kim's Rulings comment, 2026-08-17 — the four ruled forks) under
> [ADR-0200](../adr/0200-agent-ui-devtools-package.md) (the package mint + seam contract, proposed).
> **No owning PRD** — a dev-tooling capability scoped entirely by its own issue + rulings (the
> site-command-search precedent for a single issue-scoped surface with no family PRD); the why/what
> lives in #1122 and ADR-0200's Context.
> Build plan: [`../decompositions/devtools-harness.decomp.json`](../decompositions/devtools-harness.decomp.json)
> (plan mode — no source exists yet). Slice map: S1=R1 · S2=R2–R5 · S3=R6–R7 · S4=R8–R9 · S5=R11 · S6=R10, R12.
> Altitude: owns **what the harness does** — the package boundary, the three transports' common interface,
> the seam endpoints + NDJSON event vocabulary, the page's surfaces, the render-confirm semantics, the
> capture/replay format, and the Playwright helper contract. Implementation (file layout beyond the export
> surfaces, per-module design) is the build slices'; an LLD is minted only if a slice earns one.
> Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Contract the dev/debug harness for chat + A2UI production issues: one seam-faithful way to run an agent
turn against any of three backends, observe the raw JSON payload timeline (headlessly over HTTP/NDJSON, or
browser-true on a real page with render confirmation), and capture/replay sessions in a format that
round-trips with the agent-admin debug export. Everything rides the existing `AgentTransport`/`Session`
seam (ADR-0137) byte-unchanged.

## 2. Definitions

- **Backend** — one of three `AgentTransport` implementations: `replay` (canned timelines), `proxy` (live
  Claude via the existing `/__a2ui/agent` dev-proxy mount, HTTP only), `a2a` (an A2A peer over `A2aChannel`).
- **Timeline** — the ordered `DevtoolsEvent[]` recorded around one or more turns (§SPEC-R7's vocabulary).
- **Capture** — a persisted `DevtoolsCapture` (§SPEC-R10): session + timeline, replayable.
- **Render-confirm** — a per-surface browser-truth verdict (`render` event): the surface either mounted on
  the real A2UI canvas or visibly failed. Headless runs carry NO render events — absence, never fabrication.
- **Seam** — the `/__devtools` dev-only HTTP mount (`./server`), the agent-drivable headless surface.

## 3. Requirements

### R1 — package boundary + export surfaces

**SPEC-R1.** `@agent-ui/devtools` at `packages/agent-ui/devtools/`; `dependencies` exactly
`{@agent-ui/a2ui, @agent-ui/a2a}`; zero third-party runtime deps; export surfaces `.` (browser-safe core:
transports, backend descriptors, `DevtoolsEvent` + `recordTurn`, capture parse/serialize), `./server`
(Node/Vite dev-only plugin), `./playwright` (types-only helper). The `.` barrel never imports the subpaths.
Nothing from `a2ui/tools/**` is imported (the ADR-0137 site-shell boundary); no key, provider adapter, or
`produce()` import anywhere in the package.
- **AC1:** `devtools/src/layering.test.ts` is green and goes RED under a planted upward import in any lower
  package (`a2ui`, `a2a`, `components`, `shared`, `router`, `code`, `data`, `app` — negative control with a
  unique token); every existing inward `layering.test.ts` scan extends by `@agent-ui/devtools`.
- **AC2:** grep gates: no `produce(`/provider-adapter/`tools/agent` import under `devtools/src`; the `.`
  barrel's module graph reaches no `./server`/`./playwright` module.
- **AC3:** `npm run check && npm test` exit 0 with the package in the workspace.

### R2 — the common transport interface

**SPEC-R2.** All three backends implement `AgentTransport` (a2ui `src/agent/agent-transport.ts`) unchanged:
`turn(input: TurnInput): AsyncIterable<string>` where every yielded string is one A2UI JSONL line.
`listBackends(opts)` returns descriptor rows `{ id: 'replay' | 'proxy' | 'a2a', label: string,
available(): Promise<boolean> }`.
- **AC1:** a page/seam consumer swaps backends at ONE construction site; no other code changes (type-level:
  each factory's return type IS `AgentTransport`).
- **AC2:** `replay`/`a2a` report `available() === true` unconditionally; `proxy.available()` maps the
  mount's `GET /status` `{available}` through, and a probe rejection resolves `false` — never throws.

### R3 — the scripted/replay transport (deterministic; CI backbone + fixture source)

**SPEC-R3.** `replayTransport(capture: DevtoolsCapture)` replays the capture's assistant turns:
`turn()` call N yields capture turn N's `line` events' payloads, in order. `scriptTransport(timelines:
string[][])` does the same over inline canned line arrays. Zero I/O, zero timers, zero randomness.
- **AC1:** two runs over the same capture yield byte-identical line sequences.
- **AC2:** call N+1 past the last recorded turn yields one terminal `a2uiMeta` error line (the
  recorded-transcript-exhausted idiom) rather than hanging or throwing.

### R4 — the live/proxy transport

**SPEC-R4.** `proxyTransport({ url, fetch?, provider?, model?, … })` POSTs the dev-proxy body shape
(`{ input, provider, model, … }` — the fields `dev-proxy-plugin.ts`'s produce branch reads) to a
dev-proxy-shaped mount and yields the streamed `application/x-ndjson` body line-by-line across arbitrary
chunk boundaries. Injected `fetch` (browser- and Node-capable, jsdom-testable).
- **AC1:** stubbed-fetch suite: the request body carries the caller's `TurnInput` verbatim; a 3-line NDJSON
  body split at arbitrary byte boundaries yields exactly 3 lines.
- **AC2:** a non-2xx response throws carrying the proxy's `{error}` text; the thrown failure is the caller's
  to route (the page routes it to the turn-fail path; the seam to an `error` event).
- **AC3:** the transport module imports nothing from `a2ui/tools/**` — the coupling is HTTP-only, and the
  body fields it writes are pinned HERE so proxy drift is a SPEC diff, not a silent break.

### R5 — the A2A peer transport

**SPEC-R5.** `peerTransport(channel: A2aChannel)` frames a `TurnInput` as an A2A message to the peer and
yields the peer's reply lines in order. The loopback pair (`createLoopbackPair`) makes it in-browser and
CI capable; the arena's isolation posture (message-level boundary, no side channel) is inherited.
- **AC1:** loopback suite: a scripted peer answering on the far end round-trips one turn's lines in order.
- **AC2:** `close()` mid-turn ends the iterable cleanly (microtask-only — the a2a zero-timers posture);
  `A2aChannelClosedError` surfaces as a thrown turn failure, never a silent stop.

### R6 — the orchestration seam endpoints

**SPEC-R6.** `devtoolsHarnessPlugin()` (`./server`) is `apply: 'serve'` (dev-only, the dev-proxy posture)
and mounts `/__devtools`: `GET /status` → `{ backends: [{id, label, available}] }` · `POST /turn` (body
`{ backend, input: TurnInput, …backend opts }`) → a streamed `application/x-ndjson` `DevtoolsEvent`
timeline · `GET /captures` → the capture index · `POST /captures` (a `DevtoolsCapture` body) → persisted ·
`GET /captures/:id` → one capture.
- **AC1:** route suite (fabricated req/res): `POST /turn` on the replay backend streams a complete
  `turn-start → … → turn-end` timeline, content-type `application/x-ndjson`.
- **AC2:** unknown backend id → 400 `{error}`; malformed body → 400 — never a crash; a mid-stream transport
  failure writes an `error` event then `turn-end{status:'error'}` before ending the response (the GH #144
  headers-already-committed discipline).
- **AC3:** capture `POST` then `GET` round-trips byte-equal.

### R7 — the NDJSON event vocabulary (the wire contract)

**SPEC-R7.** One JSON object per line; envelope `{ seq: number, at: string, kind }`; `seq` contiguous
from 0 per timeline. Kinds: `turn-start` `{input, backend}` · `line` `{line}` (one raw emitted A2UI JSONL
line, verbatim) · `meta` `{meta}` (a parsed `a2uiMeta` line — progress/error — routed distinctly, absent
from `line`) · `client` `{message}` (an injected client message that becomes a follow-up turn) · `render`
`{surfaceId, ok, error?}` (browser-truth only — see R9) · `turn-end` `{status: 'ok'|'error'|'halt', lines,
ms}` · `error` `{message}`. `recordTurn(transport, input)` is the ONE producer of this shape; the seam
serializes it, the page renders it, the capture stores it — no second vocabulary anywhere.
- **AC1:** `turn-start` first and `turn-end` last, exactly once each; every event round-trips
  `JSON.parse(JSON.stringify(e))` structurally equal.
- **AC2:** an `a2uiMeta` line appears as `meta` and NOT as `line`; a transport throw yields `error` then
  `turn-end{status:'error'}`.

### R8 — the harness page's surfaces

**SPEC-R8.** `site/pages/devtools-harness.{html,ts}` (site-internal — the ADR-0137 placement law): the
reused `ui-conversation` chat thread (the a2ui-chat re-host idiom, no new chat component), a backend
switcher over R2's descriptors, a live raw-payload timeline pane rendering `DevtoolsEvent` rows as the
turn streams, the A2UI canvas render-confirm view (R9), and capture export/import controls (R10).
- **AC1:** the page mounts under `vite dev` with zero console errors; a replay turn renders end-to-end
  with the timeline pane showing every event.
- **AC2:** switching backend is one construction-site swap (R2 AC1 observed on the real page).
- **AC3:** the page carries stable DOM hooks (data-attributes) for every affordance R11's helper drives —
  the helper contract and the page's hooks are the same list, drift-gated by the smoke spec.

### R9 — render-confirm semantics

**SPEC-R9.** Every surface a turn creates/updates gets a per-surface verdict on the canvas view: `ok`
(mounted, renderer accepted) or failed (`{ok: false, error}`) — a failure is a VISIBLE verdict row, never
a blank canvas. Verdicts re-emit as `render` events into the same timeline (and into captures). Headless
seam runs contain NO `render` events: browser truth is only ever produced by a real page (the
pixel-truth-over-repo-truth law); the seam never fabricates it.
- **AC1:** a valid replay turn yields `render{ok:true}` per created surface on the page; a turn whose
  surface fails validation/render yields a visible failed row + `render{ok:false}`.
- **AC2:** a seam-only (`POST /turn`) timeline contains zero `render` events.

### R10 — the capture format + debug-export round-trip

**SPEC-R10.** `DevtoolsCapture = { kind: 'agent-ui-devtools-capture', version: 1, createdAt, backend,
session: Session, timeline: DevtoolsEvent[] }`. The agent-admin debug bundle (GH #889,
`agent-admin-debug-export.ts`) extends ADDITIVELY: optional `captures/<id>.json` entries + manifest
`files.captures?: string[]`; `DEBUG_BUNDLE_VERSION` stays 1 (optional, ignorable addition — the manifest's
own bump rule).
- **AC1:** round-trip: harness export → `parseCapture` → `replayTransport` replays a byte-identical `line`
  sequence.
- **AC2:** every pre-existing `agent-admin-debug-export` test passes unchanged with the extension in place
  (the additive proof); a v1 bundle WITHOUT captures parses with the field absent, never a throw.
- **AC3:** malformed capture JSON → a typed parse error naming the offending field.

### R11 — the Playwright helper contract

**SPEC-R11.** `./playwright` exports pure functions over a CONSUMER-supplied `Page`: `openHarness(page,
baseUrl)` · `selectBackend(page, id)` · `postTurn(page, text)` · `waitForTurnEnd(page)` ·
`readTimeline(page): Promise<DevtoolsEvent[]>` · `expectRendered(page, surfaceId)` · `exportCapture(page):
Promise<DevtoolsCapture>`. Playwright appears as `import type` only (erased) + a repo devDependency for
the smoke spec — never a runtime dependency.
- **AC1:** grep gate: no value import from any playwright specifier under `devtools/src`.
- **AC2:** one browser-lane smoke spec drives replay end-to-end (`postTurn → waitForTurnEnd →
  expectRendered` green) and goes RED against a surfaceId that never rendered (negative control).

### R12 — teaching + gates

**SPEC-R12.** CLAUDE.md Layout + import-DAG rows name `devtools`; site nav/manifest rows carry the harness
page; the roadmap row moves on ship.
- **AC1:** the grep/nav/manifest gates named in the decomposition's n8 accept row are green.

## 4. Non-goals (fenced)

- **SPEC-N1** — NOT a test runner/assertion framework: scheduling, retries, reporting belong to the
  consumer's runner; the helper only wraps the page.
- **SPEC-N2** — NOT CI infrastructure: no workflows, no shard changes beyond adopting the one smoke spec.
- **SPEC-N3** — NO key handling, provider adapters, or `produce()` in this package; NO production mount for
  the seam (`apply: 'serve'` only). The trust boundary stays at `/__a2ui/agent` (ADR-0073/ADR-0152).
- **SPEC-N4** — NO new chat/canvas UI components and NO a2ui protocol/seam changes (`AgentTransport`
  byte-unchanged).
- **SPEC-N5** — NO persistence layer of its own: seam capture storage is dev-lifetime simple (file/in-memory per
  the build slice); durable storage is `@agent-ui/shared`'s `StorageAdapter` seam if ever needed (ADR-0193).

# LLD — A2A Live Real-Time Demo Arms (B7: streaming arena + conversational artifact feed)

> Status: proposed · v0.1 · 2026-07-09 · Layer: LLD (implementation plan) · awaits ADR-0116 ratification + the SPEC §4.6 widening's doc-review
> Implements: [`../spec/a2a-foundations.spec.md`](../spec/a2a-foundations.spec.md) **SPEC-R17/R18** (+ consumes SPEC-R2 pin · SPEC-R6 shared validator · SPEC-R12/R13 transcript/demo contracts · SPEC-R16/HV-8 bridge carriage · SPEC-N1/N2 split/hygiene — referenced, not re-derived). PRD trace via the SPEC: **PRD-G2** (arena live arm) · **PRD-G5** (bridge live realization) · **PRD-G4** (site-section posture). Decision record: [`../adr/0116-a2a-live-realtime-examples.md`](../adr/0116-a2a-live-realtime-examples.md) (proposed — forks F1–F7 with firm recommendations).
> Altitude: adds the **how** only. Derived from the coverage-clean decomposition ([`../decompositions/a2a-live-realtime.decomp.json`](../decompositions/a2a-live-realtime.decomp.json) — STRICT + PLAN, exit 0, 2026-07-09).
> Scoping ruling: ONE LLD for both slices (the corpus-docs B4/B5 precedent) — they share the carriage idiom (chunked NDJSON through one line reader), the fail-closed posture, and the same-checker doctrine; splitting them would duplicate §3 and §8 verbatim.

---

## 1. Component map (traceability)

| ID | Component | Implements | File | Scope |
|---|---|---|---|---|
| **LLD-C1** | Shared NDJSON line reader | SPEC-R17/R18 carriage | `site/lib/ndjson-lines.ts` (+ `live-proxy-transport.ts` refactored onto it) | site (browser) |
| **LLD-C2** | Incremental replay accumulator | SPEC-R17 AC1 | `site/lib/arena-replay.ts` (extends the shipped module) | site, no DOM |
| **LLD-C3** | Streaming live-match client | SPEC-R17 | `site/lib/arena-live-transport.ts` (extends; batch `runLiveMatch` superseded) | site, dev-only reach |
| **LLD-C4** | Runner abort seam | SPEC-R17 AC3 | `packages/agent-ui/a2a/tools/arena/match.ts` (`RunMatchOptions.signal`) + `dev-proxy-plugin.ts` (close→abort) | tools (Node) |
| **LLD-C5** | Arena page live mode | SPEC-R17 | `site/pages/a2a-tic-tac-toe.ts` (live section rework) | site |
| **LLD-C6** | Part-frame protocol | SPEC-R18 AC1 | `packages/agent-ui/a2a/tools/feed/frames.ts` | pure, browser-safe (§3 split note) |
| **LLD-C7** | Feed-session derivation | SPEC-R18 (log-as-session) | `packages/agent-ui/a2a/tools/feed/feed-session.ts` | pure, Node+browser-safe |
| **LLD-C8** | Feed dev proxy | SPEC-R18 AC3 | `packages/agent-ui/a2a/tools/feed/dev-proxy-plugin.ts` (mount `/__a2a/feed`) | tools (Node, `apply:'serve'`) |
| **LLD-C9** | Feed entry derivation refactor | SPEC-R18 (no-fork rendering) | `site/lib/artifact-feed.ts` (`deriveFeedEntry` exported) | site, no DOM |
| **LLD-C10** | Feed live transport | SPEC-R18 | `site/lib/feed-live-transport.ts` (NEW, DEV dynamic import) | site, dev-only reach |
| **LLD-C11** | Feed page live overlay | SPEC-R18 | `site/pages/a2a-artifact-feed.ts` (the reserved §7 seam filled) | site |
| **LLD-C12** | Same-checker + hygiene gates | SPEC-R17 AC2 · R18 AC2/AC3 · N2 | `packages/agent-ui/a2a/src/feed/*.test.ts` · `site/lib/*.test.ts` legs · manual dist grep | test |
| **LLD-C13** | Integration + doc re-sync (serial) | context-is-memory | `site/main.ts` (unchanged nav — both pages exist) · bridge LLD §7 row · banners · SPEC/PRD/CHANGELOG | shared — one serial slice |

Cross-package edges: NONE new. `a2a/tools/feed/*` → a2ui tools (`produce.ts`, `providers-config.ts`, `providers/index.ts`, `transports/a2a.ts`) rides the SAME dev-graph edge the arena proxy already ratified (bridge LLD §3 / arena LLD §8); `@agent-ui/a2a` `src/` SOURCE is untouched (SPEC-N1) — the C12 test files co-locate under `src/feed/` per the shipped tests-over-tools precedent (the vitest include is `src/**/*.test.ts`; the bridge's `a2ui/src/bridge/*.test.ts`-over-`tools/` pattern).

## 2. Slice A — the arena goes real-time (LLD-C1…C5)

**What already streams.** `dev-proxy-plugin.ts` writes the header line up front and one
`JSON.stringify(event) + '\n'` per transcript event AS `runMatch`'s `onEvent` fires (its banner:
"genuinely streaming … review finding 4 closed"). The bytes on the wire are ALREADY the fixture format,
emitted incrementally. Nothing server-side changes for delivery — only the abort seam (C4) is added.

**LLD-C1 — the reader.** Extract `live-proxy-transport.ts`'s proven inline reader (getReader → decode
stream → buffer-split on `\n` → trimmed non-empty yields → tail flush) into
`readNdjsonLines(body: ReadableStream<Uint8Array>): AsyncIterable<string>`. `live-proxy-transport.ts`
refactors onto it (behavioral no-op — its existing tests hold); C3 and C10 consume it. One idiom, one home.

**LLD-C2 — the accumulator** (extends `arena-replay.ts`; no DOM, drift-gate-testable like everything
else in that module):

```ts
export interface ReplayAccumulator {
  /** Feed ONE raw transcript line (header first). Returns the steps/context lines this line appended —
   *  empty for a wire-only line — or a typed fault (malformed line, line before header). Fail-closed:
   *  after a fault the accumulator accepts nothing further. */
  push(line: string): { ok: true; steps: ReplayStep[]; contexts: { seat: Mark; line: ContextLine }[] }
                    | { ok: false; reason: string }
  /** Every raw line pushed so far, verbatim — the accumulated text a completed run hands BACK to the
   *  batch path (`loadTranscript`), guaranteeing the live and fixture paths converge byte-identically. */
  raw(): string
  /** True once a `game:{kind:'end'}` event has been pushed — the referee emits exactly one for every
   *  completed match (win · draw · forfeit). COMPLETION IS THIS MODULE'S FACT, not the validator's: the
   *  shipped `validateTranscript` (a2a `src/arena/transcript.ts:166`) checks header shape+pin, per-event
   *  shape, and move ordering — it deliberately has NO terminal-event requirement, so a cleanly truncated
   *  valid prefix VALIDATES ok. The page's `done` state MUST gate on `isComplete()`, never on stream end
   *  or on validation success (doc-review HIGH: the arena proxy's error-after-headers path does a clean
   *  `res.end()` of a partial, so stream end alone lies). */
  isComplete(): boolean
}
export function createReplayAccumulator(): ReplayAccumulator
```

Internally it mirrors `buildReplaySteps`'s derivation one event at a time (board maintained via
`applyMove`; the `noteForMove` lookup becomes an as-you-go map from seat wire messages). **The
chunk-equivalence gate (SPEC-R17 AC1)** is the module's authority: for each committed fixture, pushing
line-by-line (and via `readNdjsonLines` over adversarially re-chunked bytes) must deep-equal
`buildReplaySteps(loadTranscript(raw))` + `buildIsolationReport(t).contexts`, with `isComplete()` true
after each fixture's final line. Negative controls: a malformed line mid-stream → `ok:false` and a
subsequent push stays refused; a fixture with its trailing `game end` event dropped still VALIDATES
line-by-line (the validator accepts a prefix — the point) but leaves `isComplete()` FALSE — the
truncation negative that genuinely bites (SPEC-R17 AC2's completion-gate arm).

**LLD-C3 — the streaming client** (supersedes batch `runLiveMatch`; the proxy contract is byte-unchanged):

```ts
export interface LiveMatchStream {
  lines: AsyncIterable<string>      // one transcript line per iteration, via readNdjsonLines
  raw(): string                     // accumulated verbatim text (for the completed → loadTranscript hop)
}
export function runLiveMatchStream(
  seats: { X: ArenaSeatSelection; O: ArenaSeatSelection },
  opts?: { signal?: AbortSignal },
): Promise<LiveMatchStream>        // rejects on non-2xx with the proxy's own error text (unchanged posture)
```

An abort mid-stream ends `lines` with a typed cancelled outcome (the page distinguishes cancel from
fault); the module keeps the file's standing banner guarantees (no `VITE_*`, no key, dev-dynamic-import
reach only) — the banner's "there is nothing mid-flight for it to render yet" rationale is DELETED in the
same change (C13).

**LLD-C4 — the abort seam.** `RunMatchOptions` gains `signal?: AbortSignal`. The runner races it at the
SAME point the per-move timeout already races (`withTimeout` → a three-way race), and checks it between
outbound deliveries; on abort it throws a typed `MatchAborted` — the existing `finally` closes all four
channel endpoints (the loud-straggler guarantee holds). The proxy wires `res.on('close', …)` /
`req.on('close', …)` to an `AbortController` and passes its signal; a `MatchAborted` after headers simply
`res.end()`s (the client already sees a truncated stream = discard). **Zero-regression control:** the
scripted CI match with no signal is byte-identical (the seam is additive; a test asserts the transcript
bytes). Deeper hardening — threading the signal into `createModelSeat` → `provider.stream(req.signal)` so
the in-flight provider call itself cancels — is NAMED as optional follow-up; without it one dangling move
call runs to the 30 s per-move timeout server-side, which is accepted (ADR-0116 Consequences).

**LLD-C5 — the page.** The live section reworks around three states (`idle → running → done|cancelled|faulted`):

- **running:** `selectFixture` is suspended for the live pseudo-fixture; each accumulator push appends
  steps to `currentSteps` and lines to the inspector columns/timeline; the scrubber stays enabled —
  **follow-tail rule:** if `stepIndex === currentSteps.length - 1` before the append, advance with it;
  otherwise leave the user where they scrubbed. The isolation card shows the truthful pending state
  (`verdict.dataset.verdict = 'pending'`; text: "the verdict runs over the completed transcript"). A
  Cancel button (ui-button, ghost) aborts the fetch signal.
- **done — GATED ON `accumulator.isComplete()`, never on stream end alone:** `liveRaw = stream.raw()`;
  `selectFixture('live')` — the EXISTING code-identical `loadTranscript → applyLoaded` path (SPEC-R17
  AC2's "same checker, same call sites"). The verdict, inspector, and scrubber are thereafter exactly the
  batch page of today. (Why the gate: `validateTranscript` accepts a valid prefix, and the proxy's
  error-after-headers path ends the response cleanly — a stream that merely *ended* may be a partial that
  would load `ok:true` and paint a verdict over an unfinished game. `isComplete()` is the only honest
  done signal.)
- **cancelled | faulted (including a stream that ends with `isComplete()` false):** the partial
  accumulation is dropped (never assigned to `liveRaw`), the error panel explains, and the previously
  selected recorded fixture is re-selected. A provider fault that the referee converted to a forfeit is
  NOT this state — it arrives as a complete transcript (the referee's terminal `game end` event present)
  and lands in **done** normally.

## 3. Slice B — the feed's live arm (LLD-C6…C11)

**Split note (SPEC-N1/N2):** `frames.ts` + `feed-session.ts` are pure and browser-safe (type-only imports
from `@agent-ui/a2a` src + the bridge module; zero Node builtins) — the same "pure tools modules ARE
site-bundleable" ruling the bridge module itself shipped under (bridge LLD §3). Only `dev-proxy-plugin.ts`
is Node, `apply:'serve'`, never bundle-reachable.

**LLD-C6 — the part-frame protocol.** One turn = one stream:

```
line 1   {"turn":{"messageId":"…","contextId":"…","taskId":"…?","role":"agent","parts":<count>}}
line 2+  {"part":<A2aPart>}          // message.parts in order: TextPart (prose), then tagged DataParts
                                     // COMPLETION = declared count received, NEVER stream end alone:
                                     // the header's `parts` is the completion invariant (doc-review
                                     // MEDIUM — without it a truncated stream is indistinguishable
                                     // from a short complete turn). The proxy knows the count up front
                                     // because the message is fully built before the first write (the
                                     // buffered one-construction below).
```

```ts
export function framesOf(msg: A2aMessage): string[]                 // derived from ONE built message
export interface FrameAssembler {
  push(line: string): { ok: true; part?: A2aPart } | { ok: false; reason: string }  // part frames surface for progressive paint
  complete(): { ok: true; message: A2aMessage } | { ok: false; reason: string }     // reassembles field-identically
}
export function createFrameAssembler(): FrameAssembler
```

Invariants (SPEC-R18 AC1): `createFrameAssembler`-over-`framesOf(m)` reassembles deep-equal `m` for
prose-only / artifact-only / mixed / zero-part turns. Faults are typed, never thrown: a `part` before
`turn` · a foreign frame kind · `complete()` before any `turn` · **`complete()` with fewer OR more parts
than the header declared** — the truncation/overrun fault the `parts` count makes mechanically decidable
(a `parts: 0` header with no part frames is a valid empty turn, NOT a fault). This module is BOTH the
proxy's emitter and the browser's only reassembler — the `buildMatchHeader` one-construction lesson,
applied at the seam where it was first learned.

**LLD-C7 — feed-session derivation** (pure; the log is the session — ADR-0116 F4):

```ts
export type FeedSession =
  | { ok: true; session: Session; input: TurnInput; contextId: string | undefined }
  | { ok: false; status: 400; error: string }   // coded: not-a-user-tail | caps-missing | schema-invalid
export function sessionFromFeed(lines: string[], opts: { protocolVersion: string }): FeedSession
```

Rules, in order: (1) every line `validateA2a`-clean at the pin (else coded fail); (2) the LAST line must
be `role:'user'` carrying `metadata.a2uiClientCapabilities` (HV-8, server-verified — SPEC-R18's rejection
arm); (3) fold the preceding lines pairwise into `Session.turns` — a user message's TextParts join as the
user turn text (a tagged client DataPart contributes `frameClientMessage(...)`, the shipped a2ui framing),
an agent message's `unwrapTurn(...).envelopes` re-serialize (one per line) as the assistant turn content —
exactly the shape `appendAssistantTurn` stores on the a2ui-live page, so produce() sees the session it was
designed for; (4) the last user message becomes `TurnInput` (`{kind:'intent', text}` for prose;
`{kind:'client', message}` when it carries a client envelope). Deterministic: same log ⇒ deep-equal
output (asserted twice in the unit leg); the committed artifact-feed fixture is the golden input.

**LLD-C8 — the feed dev proxy** (`/__a2a/feed`; the arena proxy's skeleton verbatim — `loadEnv` posture,
per-request providers.json reload, MAX_BODY 1 MiB, `GET /status` boolean+count, key never in a response):

POST `{ feed: string[], provider: string, model: string }` →
`resolvePair` allowlist (400/503 per the arena's `resolveSeat` degrade posture) → `sessionFromFeed`
(400 on its coded fails, **before any provider dispatch** — SPEC-R18 AC3's "no provider call occurs") →
`produce(input, deps, { maxRounds: 3, model })` with the a2ui deps (catalog + judged shard + adapter — the
`/__a2ui/agent` construction verbatim) → buffer the turn's yielded lines (meta-line note peeled via
`readMetaLine`; remaining lines parsed back to `A2uiServerMessage[]`) → ONE
`wrapServerTurn(envelopes, { messageId: 'live-a<n>', contextId, prose: note })` → `res.write` each
`framesOf(message)` line → `res.end()`. A `ProduceHalt` always surfaces as a 500 BEFORE headers — the
buffered one-construction drains produce() fully before the first frame is written, so a generation
failure can never truncate a frame stream (doc-review correction: the previously named after-headers halt
arm is unreachable by construction). After-headers truncation arises only from transport faults — a proxy
crash, a dropped connection, a client abort — which the assembler's part-count check catches on the
browser side (fail-closed, §4). The proxy holds NO conversation state between requests.
*Testability:* the plugin factory accepts an optional injected provider-dispatch seam (the produce-deps
`provider`), so LLD-C12's offline legs run the full POST path with a stub — the a2ui proxy precedent of
gate-covering loop mechanics with no live model.

**LLD-C9 — derivation refactor.** `loadFeed`'s per-message entry computation is extracted as
`deriveFeedEntry(message: A2aMessage, index: number): FeedEntry` — the input is the already-PARSED
message (`loadFeed` maps parsed objects today, `site/lib/artifact-feed.ts`; the decomp's n3d and C11's
call sites agree — doc-review signature reconcile). The entry's `wire` field becomes the canonical
`JSON.stringify(message)` — identical to the committed line under the fixture gate's byte-stability
assertion (`JSON.stringify(JSON.parse(line)) === line`), and exactly the serialization the live log
stores. Stated honestly: the refactor moves ONLY the per-entry derivation; `loadFeed` keeps parse +
`validateA2a` + the whole-feed verdict accumulation it owns today — the checks do not move. Behavioral
no-op for the recorded path (the existing jsdom leg must pass unchanged, entry-for-entry). The live
overlay renders EVERY bubble (user + agent, live or recorded) through this one derivation — no second
bubble-building fork.

**LLD-C10 — the live transport** (NEW; mirrors `live-proxy-transport.ts`'s shape — no `VITE_*`, no key):

```ts
export function probeFeedLive(): Promise<LiveStatus>                       // GET /__a2a/feed/status
export async function* sendTurn(feed: string[], sel: { provider: string; model: string },
  opts?: { signal?: AbortSignal }):
  AsyncIterable<{ part: A2aPart }>                                          // progressive frames via readNdjsonLines
  // returns (as the generator's return value) the assembler's completed A2aMessage — ONE reassembler (C6), imported
```

**LLD-C11 — the page overlay** (fills the reserved bridge-LLD §7 seam; probe-gated, DEV dynamic import —
the posture the seam named, WIDENED knowingly: the live arm adds a composer, which the seam's
"nothing else changes" wording did not foresee; the seam row is re-synced in C13, not silently stretched):

- **Go live:** visible only when `probeFeedLive()` reports a key. Activating it clears the timeline to a
  FRESH conversation (ADR-0116 F6): synthesized header line
  (`{"a2aFeed":{"protocolVersion":"0.3.0","a2ui":"v1.0","provenance":{"source":"live","date":…}}}`) +
  a new `contextId` (`live-<ISO date>`); the client-held `liveLog: string[]` starts with the header.
  Reset (existing button) disposes hosts, drops the live log, and rebuilds the recorded fixture exactly.
- **User turn:** composer (ui-text-field + Send — the a2ui-live composer idiom, busy-gated). The message
  is `wrapClientTurn({ text }, { messageId: 'live-u<n>', contextId })`-built IN the browser, its
  JSON line appended to `liveLog`, its bubble rendered via `deriveFeedEntry` (the handshake chip now
  shows the REAL wire that is about to travel). Then `sendTurn(liveLog, sel)`.
- **Agent turn, progressive:** on the first `part`: build the agent bubble; a TextPart paints prose; each
  tagged DataPart → `partToEnvelope` → `host.ingest(JSON.stringify(envelope))` into the bubble's own
  `createRenderer()` host (the ADR-0097 per-message lifecycle the page already uses); `finalize()` at
  stream end. The completed reassembled message's line joins `liveLog` ONLY then; the wire disclosure
  shows it (the same bubble anatomy as recorded entries — C9's one derivation).
- **Verdict per turn:** after each completed turn, `loadFeed(liveLog.join('\n'))` recomputes the verdict
  line — the SAME standing checks, now running over a conversation that is happening (SPEC-R18 AC2's
  in-page arm).
- **Interactions go real:** `host.onClientMessage` → `wrapClientTurn({ message }, …)` → append + send —
  the next turn. The "Composed locally — not sent (recorded demo)" annotation renders ONLY in recorded
  mode (`appendComposedBubble` stays for it).
- **Faults:** a transport error, non-2xx, or failed `complete()` annotates the bubble ("turn failed —
  not recorded"), tears down its partial paint (host disposed), leaves `liveLog` WITHOUT the turn
  (fail-closed — the next `sessionFromFeed` never sees a half-turn), and re-enables the composer.

## 4. Error & edge-case handling

| Edge / failure | Stage | Handling |
|---|---|---|
| malformed/out-of-order transcript line mid-stream | C2 | accumulator `ok:false`, refuses further pushes; page → faulted state, recorded default re-selected |
| cancel mid-match | C3/C4/C5 | fetch aborted; proxy close-event aborts the runner (typed `MatchAborted`); channels close in `finally`; partial accumulation discarded — never `liveRaw` |
| provider fault mid-match | existing referee | abort→forfeit completes the transcript; streams + verifies as **done** (NOT a fault state) |
| proxy dies mid-stream / error-after-headers clean `res.end()` | C2/C5 | stream ends with `isComplete()` FALSE → faulted state, partial discarded (NOT loaded — `validateTranscript` would accept the clean prefix, which is exactly why the completion gate, not validation, decides); error panel; fixtures untouched |
| scrubbed-back user during live append | C5 | follow-tail only from the tail; appended steps never move a parked `stepIndex` |
| part frame before header / foreign frame kind | C6 | typed fault from `push` — never a throw (SPEC-R18 AC1 negatives) |
| transport drop mid-frames (received parts ≠ header's declared count) | C6/C11 | `complete()` `ok:false` (the part-count completion invariant) → turn annotated, excluded from the log (fail-closed) |
| caps-less / non-user tail / invalid line in posted log | C7/C8 | coded 400 BEFORE any provider dispatch (SPEC-R18 AC3) |
| unregistered `{provider,model}` / no key | C8 | 400 / 503 — the arena `resolveSeat` degrade posture verbatim |
| `ProduceHalt` | C8 | ALWAYS a 500 before headers — the buffered construction drains produce() before any frame is written; a generation failure can never truncate a frame stream |
| note-only turn (zero envelopes) | C8/C11 | valid: `wrapServerTurn([], {prose: note})` → one TextPart — a prose bubble, no artifact mount (empty ≠ invalid, ADR-0088) |
| interaction clicked while a turn is in flight | C11 | busy-gated (the a2ui-live `busy` idiom) — one turn at a time |
| reset mid-turn | C11 | in-flight signal aborted, hosts disposed, recorded fixture rebuilt |
| `dist/` hygiene | C12 | grep covers BOTH mounts + key names; both live modules remain DEV-dynamic-import-only |

## 5. Build sequence (fan-out-sliced; each step verifiable; one writer per file)

1. **S0 — LLD-C1** reader extraction + `live-proxy-transport.ts` refactor. *(checkpoint: existing a2ui-live legs green unchanged; new chunk-boundary unit test green)*
2. **S1 — fan-out (3 writers, no shared files):** C2 accumulator + chunk-equivalence gate ‖ C6 frames + round-trip gate ‖ C7 feed-session + golden-fixture tests. *(checkpoints: SPEC-R17 AC1 · R18 AC1 · C7's determinism leg — all with firing negatives)*
3. **S2 — fan-out (2 writers):** C3+C4 streaming client + abort seam (one writer: the seam pair spans `arena-live-transport.ts`/`match.ts`/arena proxy) ‖ C8 feed proxy + stub-provider offline leg. *(checkpoints: scripted no-signal transcript byte-identical; SPEC-R18 AC3 rejections fire; stub streamed turn reassembles valid)*
4. **S3 — fan-out (2 writers):** C5 arena page live mode ‖ C9+C10+C11 feed refactor + transport + overlay. *(checkpoints: manual dev-run with a key — moves land live, cancel works; a typed message round-trips with real artifacts; recorded defaults byte-identical when overlays never activate)*
5. **S4 —** C12 same-checker legs (SPEC-R17 AC2 / R18 AC2 offline) + browser legs for both pages. *(checkpoint: truncation negatives BITE)*
6. **S5 — INTEGRATION (serial):** C13 — `vite build` + dist grep both mounts · bridge LLD §7 seam row → realized-by · arena transport banner's expired rationale deleted · SPEC §7 / PRD §6 / ADR README / CHANGELOG re-sync · full `npm run check && npm test` + `test:browser`. *(checkpoint: all gates green repo-wide; no doc still calls the live seam batch-only or "structure only")*

Review gate: the independent reviewer seat (generator ≠ critic) grades S0–S5 against this LLD BEFORE the wave commit — the standing wave discipline.

## 6. Verification summary

Done when: coverage_check clean (it is — STRICT/PLAN, exit 0) · S0–S5 checkpoints green · SPEC-R17 AC1–AC3 + SPEC-R18 AC1–AC3 hold · the §4.6 widening passes independent doc-review · ADR-0116's forks are ratified by Kim · the C13 re-syncs landed in the same change. NOT done if: any live artifact reaches a checker through a forked derivation (the accumulator, frames, or feed derivation growing a second implementation), a partial stream reaches the replay/verdict path or the feed log (the completion gates — `isComplete()` and the part-count invariant — are the fail-closed authority, since the validators deliberately accept clean prefixes), a caps-less message reaches a provider, or `vite build` carries either mount.

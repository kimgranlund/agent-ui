# ADR-0116 — A2A live real-time examples: the arena's dev-only live match streams move-by-move into the replay UI, and the artifact feed gains its reserved live arm — a user-initiated conversational turn loop genuinely carried over A2A (caps handshake server-verified, prose + live A2UI artifacts per turn) — all recorded-default, dev-only, same-checker

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-09
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-09 |
> | **Proposed by** | a2a-live-designer (design seat — Kim's verbatim ask, 2026-07-09: *"can we make the A2A examples live so they occur in real time user initiated?"*; number 0116 verified free — README tail = 0115; 0108 is a known hole, never reused) |
> | **Ratified by** | — awaiting Kim |
> | **Repairs** | [`../spec/a2a-foundations.spec.md`](../spec/a2a-foundations.spec.md) v0.6 (SPEC-R17/R18 widening — flagged for independent doc-review, the R14/R16-AC2 precedent) · NEW [`../lld/a2a-live-realtime.lld.md`](../lld/a2a-live-realtime.lld.md) · [`../prd/a2a-section.prd.md`](../prd/a2a-section.prd.md) §6 B7 milestone row · [`../decompositions/a2a-live-realtime.decomp.json`](../decompositions/a2a-live-realtime.decomp.json) (coverage-clean, STRICT + PLAN, exit 0) · on ratification+build: `site/lib/{ndjson-lines,arena-live-transport,feed-live-transport,artifact-feed,arena-replay}.ts` · `site/pages/{a2a-tic-tac-toe,a2a-artifact-feed}.ts` · `packages/agent-ui/a2a/tools/arena/{match,dev-proxy-plugin}.ts` · NEW `packages/agent-ui/a2a/tools/feed/**` · the bridge LLD §7 live-arm seam row flips to realized-by |
> | **Supersedes / Superseded by** | relates **ADR-0073** (the server-side-key dev-proxy trust boundary — both live arms ride it unchanged) · relates the bridge LLD ([`../lld/a2a-a2ui-bridge.lld.md`](../lld/a2a-a2ui-bridge.lld.md)) §7 (the reserved live-arm seam this wave fills) · relates **ADR-0097** (feed-embedded asks — its ask policy governs a2ui-live, NOT this feed; the bridge LLD fork 3 full-catalog ruling stands) · relates **ADR-0088/0090/0091** (the produce() meta-line/mode/mini-skill machinery the feed arm reuses server-side, unmodified) |

## Context

**Both pages already have a live seam; neither is real-time.** The arena page's dev-only overlay
(`wireLiveOverlay()` → `site/lib/arena-live-transport.ts` → the `/__a2a/arena` Vite middleware) runs a
REAL model-vs-model match server-side — and the proxy already streams the transcript incrementally
(`match.ts` `onEvent` → one `res.write()` per event, its banner: *"genuinely streaming … review finding 4
closed"*) — but the client reads `res.text()`, so the user stares at "this can take a little while…" and
the finished match loads at once. The feed page reserves its live arm by name (bridge LLD §7: `probeLive()`
+ a DEV-guarded dynamic import, *"nothing else in the page changes — that is the whole seam"*) and its
interactions are annotated *"Composed locally — not sent (recorded demo)"*. Kim's ask closes both gaps:
moves rendering as they are played; a typed message genuinely going over A2A with the agent answering in
real time with prose + live A2UI artifacts.

**Everything load-bearing already exists.** Server-side per-event streaming (the arena proxy); an
incremental NDJSON line reader (inline in `live-proxy-transport.ts` — the a2ui live page has streamed
per-line since it shipped); the bounded produce() loop with validate-then-stream (a2ui LLD-C2 realized);
the HV-8 bridge builders (`wrapClientTurn`/`wrapServerTurn`/`unwrapTurn` — one construction, caps by
construction); the providers.json allowlist + ADR-0073 trust boundary; and the same-checker doctrine
(the arena page already runs `checkIsolation` in-page; the feed page already runs the fixture gate's
checks in-page). This wave is therefore *plumbing and posture*, not new protocol machinery — the design
problem is choosing the seams so nothing forks and every standing gate keeps biting.

**What is NOT relitigated:** C4 recorded-default (the static build ships recorded/replayable, zero
network/keys — the live arms are dev-only behind the key-holding proxy); SPEC-N1 (zero runtime deps in
`@agent-ui/a2a` `src/` — every new module is `tools/`- or site-scoped); the isolation gate's authority
(a live match's completed transcript is checkable by the SAME checker); produce()'s validate-then-stream
contract (nothing invalid ever paints — which bounds what "real-time" can honestly mean within one turn,
see clause 4 and the fence in clause 7).

## Decision

Ship the **B7 live real-time wave** — two slices under one intake. Seven clauses; the SPEC (R17/R18) owns
behavior, the LLD owns mechanism.

1. **Real-time carriage = chunked NDJSON over the existing dev-proxy POSTs** *(fork F1)*. The arena proxy
   already emits NDJSON incrementally; the a2ui proxy has streamed line-wise since it shipped, and the
   Vite dev middleware demonstrably carries incremental `res.write()`. The client side becomes a shared
   line reader (`site/lib/ndjson-lines.ts`, extracted from `live-proxy-transport.ts`'s proven inline
   reader — one idiom, one home; that module refactors onto it). **SSE rejected**: `EventSource` cannot
   POST, so we would hand-parse SSE frames over `fetch` anyway — one more envelope around the same JSON
   for zero gain, and the arena's stream would stop being byte-identical to the committed fixture format.
   **Polling rejected**: it needs server-held match/conversation state (breaking the stateless-proxy
   posture) and adds latency where the push channel already exists.

2. **Arena slice: the client goes incremental; the completed stream re-enters the EXISTING batch path.**
   `arena-replay.ts` gains an incremental accumulator (feed one transcript line at a time → appended
   `ReplayStep`s + context lines, board maintained internally); the page appends steps as they arrive with
   a follow-tail scrubber (a user who scrubbed back is never yanked forward). On completion, the
   accumulated raw text — byte-identical to what the batch path returned, because the proxy's line
   emission is unchanged — goes through the SAME `loadTranscript` → `applyLoaded('live')` call sites the
   recorded fixtures use, so the finished replay, the side-by-side context inspector, and the isolation
   panel are code-identical to today. **The isolation verdict derives from the completed transcript
   only** *(fork F3)*: during a live match the panel shows a truthful "pending — the verdict runs over the
   completed transcript" state. A provisional mid-match verdict is rejected — `checkIsolation`'s canary/
   wire-origin semantics are defined over a complete transcript, and a green badge that could still turn
   red teaches the wrong thing about what the gate proves.

3. **Mid-match cancel = user-initiated abort; a partial transcript is DISCARDED — refused by an explicit
   completion gate** *(fork F2)*. The page gains a Cancel control (AbortSignal through the streaming
   client); the proxy listens for the response's close event and aborts the runner via a new optional
   `RunMatchOptions.signal` seam (raced at the per-move collection point the timeout already races;
   teardown rides the existing `finally` — all four channel endpoints close). The scripted CI path with no
   signal is byte-identical (zero-regression control). **Cancel-as-forfeit rejected**: it would fabricate
   a game outcome that never happened — a forfeit is a seat's failure, not a spectator's impatience — and
   transcript truthfulness outranks transcript completeness. **Discard is enforced by the live arm's OWN
   completion gate, not by validation** (doc-review correction of this record's first draft): the shipped
   `validateTranscript` deliberately has no terminal-event requirement — a cleanly truncated valid prefix
   validates ok, and the proxy's error-after-headers path ends the response cleanly — so the accumulator
   tracks the referee's terminal `game end` event (`isComplete()`), the page's done state gates on it, and
   a stream ending without it is treated as cancelled/faulted: the error panel shows, the recorded
   fixtures remain untouched, and nothing partial ever reaches the replay/verdict path (fail-closed). A
   provider fault mid-match is NOT a transport fault — the referee's existing abort→forfeit arm already
   completes the transcript (terminal event present), and that path streams fine.

4. **Feed slice: a real conversational turn loop over A2A — the log IS the session** *(forks F4/F5/F7)*.
   - **Wire honesty both directions.** The browser builds every user turn with `wrapClientTurn` (caps in
     `metadata`, extension URI declared — by construction) and appends it to a client-held ordered A2A
     message log; the handshake chip shows the REAL wire. A new dev proxy (`/__a2a/feed`,
     `a2a/tools/feed/dev-proxy-plugin.ts` — arena symmetry, *fork F7*) receives the whole log, validates
     the `{provider,model}` pair against the SAME providers.json allowlist, runs `validateA2a` over every
     line at the 0.3.0 pin, and REJECTS (400, coded) a log whose last message is not a caps-bearing user
     message — the HV-8 "every client→server message" clause becomes server-verified, not just
     by-construction. Extending `/__a2ui/agent` instead was rejected: the message would never actually
     cross the trust boundary in A2A form, and the caps handshake would stay a client-side fiction.
   - **Stateless proxy, client-held state** *(fork F4)*: the produce() `Session` is DERIVED from the log by
     a pure function (`feed-session.ts`: user TextParts → intent text, a tagged client DataPart → the
     framed client message, agent turns → their unwrapped envelopes re-serialized — exactly what
     `appendAssistantTurn` stores on the a2ui-live page). One source of truth; no parallel session object
     shipped alongside (rejected: two states that can drift). A pleasant consequence: after N turns the
     accumulated log — header line synthesized at go-live — is *structurally a feed fixture*, so the
     standing `loadFeed` checks run over the live conversation unchanged, per turn, in-page (clause 6).
   - **One construction, streamed as part-frames with a declared count** *(fork F5)*: the proxy buffers
     produce()'s validated output for the turn, builds ONE `wrapServerTurn` message (the note → the
     leading TextPart, one tagged DataPart per envelope — the fixture's exact shape), and streams frames
     DERIVED from that message (a header frame **declaring the part count — the completion invariant, so
     a truncated stream is mechanically distinguishable from a short complete turn and stream end alone is
     never the completion signal** — then one frame per part; `a2a/tools/feed/frames.ts`, pure and
     browser-safe, is both the emitter and the only reassembler). The browser renders progressively —
     prose on the TextPart frame, `host.ingest` per DataPart — and the reassembled message joins the log
     only when the declared count is met. The buffering costs ≈ nothing: produce() is validate-then-stream,
     so all of a turn's envelopes are already in hand the moment the first one yields — which also means a
     generation failure (`ProduceHalt`) always surfaces as a 500 BEFORE any frame is written, never as a
     truncated frame stream. This is the `buildMatchHeader` lesson applied forward: never two
     hand-maintained constructions of one wire shape.
   - **Fresh conversation on go-live** *(fork F6)*: the live arm starts a new log (new `contextId`,
     synthesized header with `provenance.source:"live"`); it does not append to the recorded fixture
     (rejected: mixed provenance in one log muddies both the teaching surface and the verdict). Reset
     restores the recorded fixture exactly. Interactions flip from "Composed locally — not sent" to
     genuinely sent: an artifact control's client message becomes the next turn.

5. **Fail-closed logs, tolerant rendering.** A turn that faults (ProduceHalt, proxy 4xx/5xx, transport
   drop mid-frames) is annotated in the timeline and NEVER joins the canonical log — the next turn's
   derived session cannot contain a half-turn. Partial artifact paint from an interrupted frame stream is
   torn down with the bubble's annotation. The same posture as clause 3, one level up: what enters the
   canonical record must be complete and checkable; what shows on screen may be transient.

6. **Deterministic gates for everything new; the standing checkers gain live legs, no forks.**
   (a) *Chunk-equivalence*: for every committed match fixture, streaming its lines through the accumulator
   (including adversarial chunk boundaries through the shared reader) yields steps/contexts deep-equal to
   the batch derivation. (b) *Frame round-trip*: frames-of(wrapServerTurn(…)) reassembles deep-equal, with
   biting negative controls (frame before header; fewer parts than the header declares; foreign frame
   kind). (c) *Same-checker + completion gates*: offline tests (stub provider) prove a completed live-feed
   log passes the SAME `loadFeed` checks the fixture gate runs, and a completed streamed arena run passes
   `loadTranscript` + `checkIsolation` — and that truncated versions of each are REFUSED by the layer that
   owns refusal: the arena's end-event completion gate (clause 3 — the truncated prefix still VALIDATES,
   which the negative control demonstrates) and the feed's part-count invariant (clause 4), with a forced
   raw-frame line in a log failing `loadFeed` outright. (d) The standing hygiene proof widens: the `dist/`
   grep covers both mounts. Independent review (generator ≠ critic) gates the wave commit, as every wave.

7. **Fenced, with named triggers.** (a) **A protocol-faithful A2A streaming server** (`message/stream`
   JSON-RPC + SSE, `TaskStatusUpdateEvent`/`TaskArtifactUpdateEvent` — HV-6's resolved shapes) is NOT
   built: the dev proxy is demo plumbing, not an A2A server, and the PRD out-scopes the server SDK;
   trigger = a real cross-process A2A-interop consumer needing standard streaming, via its own intake +
   a fresh HV pass over HV-6. (b) **Within-turn token streaming** is not attempted: produce()'s
   validate-then-stream contract (a2ui SPEC-R5 — nothing invalid ever paints) is ratified and stands;
   "real-time" for the feed honestly means per-turn latency + progressive per-part paint. (c) **A
   "download this live conversation / match as a fixture" affordance** is named as a *could* — the
   accumulated artifacts are already fixture-shaped by construction — but ships only if Kim wants it
   (one taste call, flagged in §Open).

## Alternatives

- **SSE for the real-time channel** *(F1)* — rejected. `EventSource` is GET-only, so the POST bodies both
  proxies need would force hand-parsed SSE over `fetch` anyway; each event would wrap the same JSON one
  more time; and the arena stream would stop being byte-identical to the committed `matches/*.jsonl`
  format, breaking the "concatenated stream IS a transcript" property clause 2 leans on.
- **Polling for match/turn progress** *(F1)* — rejected. Requires server-held session state (breaks the
  stateless-proxy posture both existing proxies keep), adds latency, and replaces a working push channel.
- **Cancel-as-forfeit** *(F2)* — rejected. Produces a complete transcript by fabricating a game outcome
  that never happened; transcript truthfulness outranks completeness. Discard-and-fail-closed instead.
- **Provisional mid-match isolation verdict** *(F3)* — rejected. `checkIsolation` is defined over a
  complete transcript; a green badge that can still turn red mis-teaches what the gate proves.
- **A parallel client-held `Session` object shipped beside the A2A log** *(F4)* — rejected. Two sources
  of truth that can drift; the log already determines the session, so derive it (one pure function).
- **Realizing A2A `message/stream` (JSON-RPC + SSE, HV-6 event shapes) for the feed arm** *(F5)* —
  rejected for this wave, fenced with a named trigger (clause 7a). The PRD out-scopes the production
  server SDK; the dev proxy must not masquerade as an A2A server.
- **Batch whole-message turn delivery for the feed** *(F5)* — rejected. Fails the "real time" half of
  Kim's ask: no progressive paint, and the composer would feel like the arena's old dead air.
- **Continuing the live conversation from the recorded fixture's log** *(F6)* — rejected. Mixed
  provenance in one log muddies the verdict and the teaching surface; fresh log + Reset instead.
- **Extending `/__a2ui/agent` instead of a new `/__a2a/feed` mount** *(F7)* — rejected. The user's
  message would never cross the trust boundary in A2A form; the caps handshake would remain a client-side
  fiction instead of a server-verified contract.

## Acceptance

- SPEC-R17 ACs hold: chunk-equivalence over every committed fixture; a completed streamed live match's
  accumulated text passes `loadTranscript` + `checkIsolation` (the same checker); a stream ending without
  the terminal `game end` event is refused by the completion gate — with a negative control showing the
  truncated prefix still validates, proving the gate (not the validator) bites — and the recorded default
  is unharmed.
- SPEC-R18 ACs hold: frame round-trip ≡ the one `wrapServerTurn` construction with biting negative
  controls (including fewer-parts-than-declared); a stub-provider live conversation's accumulated log
  passes the SAME `loadFeed` checks the fixture gate runs (and a forced raw-frame line in the log fails
  them); a caps-less or schema-invalid inbound log is rejected with a coded 400; the `dist/` grep is
  clean over both mounts.
- The wave commit is gated by an independent review (generator ≠ critic) and the serial doc re-sync
  (bridge LLD §7 seam row, arena transport banner, SPEC §7 trace, PRD §6 B7, CHANGELOG) lands in the
  same change.

## Consequences

- The arena page's "this can take a little while…" dead air becomes a watchable match; the batch
  `runLiveMatch` client function is superseded by the streaming client (the proxy contract is unchanged —
  old and new clients read the same bytes).
- `@agent-ui/a2a` gains `tools/feed/**` (Node/dev + pure browser-safe modules only; `src/` untouched —
  SPEC-N1 holds). The a2a-tools → a2ui-tools dev-graph edge already ratified for the arena proxy now
  carries produce() reuse too; no new package edge.
- The bridge LLD §7 seam prose ("this wave ships NONE of it") and the arena transport banner ("there is
  nothing mid-flight for it to render yet") both become false the moment this builds — their re-sync is
  IN the wave's serial doc slice, not deferred.
- The feed page grows a composer in live mode only; the static build's recorded page is byte-identical
  (the overlay is DEV-guarded dynamic import, the reserved seam's own posture).
- Risk accepted: clause 3's runner-level abort lets one in-flight provider call run to its per-move
  timeout server-side after cancel (bounded ≤ 30 s, one move); threading the signal into the seat's
  provider call is named in the LLD as optional hardening, not a blocker.

## Open (for Kim — recommendations firm, nothing blocks on these)

1. Ratify forks F1–F7 as recommended (this record).
2. The clause 7(c) *could*: a "save this live run" affordance (download the fixture-shaped artifact) —
   cheap, but it invites committing un-curated fixtures; recommend DEFER until a live match/conversation
   worth curating actually appears (the run-flagship.ts pipeline remains the curation path).

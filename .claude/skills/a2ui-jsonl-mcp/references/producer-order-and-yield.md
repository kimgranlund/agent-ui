# Producer order, yield order, and the terminal error line

Source of truth: `produce` in `packages/agent-ui/a2ui/src/agent/produce.ts` (with
`ProduceOptions.maxRounds`, `ProduceHalt`, `interleaveProgress`, `formatMetaLine`,
`feedScopeFailures`, `netNoOpSurfaceIds`, `askIntegrityHolds`), `sessionSurfaceSeeds` in
`packages/agent-ui/a2ui/src/agent/surface-seeds.ts`, `src/catalog/semantic-check.ts`
(`semanticSurfaceViews`, `runSemanticChecks`, ADR-0238), and `meta-line.ts` (`formatErrorLine`,
`TURN_PROGRESS_STAGES`). ADR-0206 for the timing contract.

## Per round, in this order

1. Accumulate the provider text (progress events may interleave, see below).
2. `peelMetaLine`, then `peelGenuiLines` (peel before anything else sees the text).
3. A note-only or genui-only turn (zero A2UI lines) is a clean success: nothing to validate. One
   exception: a closing-shaped turn (a note, no ask, no plan, no genui, no `flowEnd`) whose user
   message is an explicit close gets ONE `FLOW_END_MISSING` correction round if a round remains,
   else it ships unchanged and tallies `FLOW_END_UNCORRECTED`.
4. `assembleFromRaw`: `stripOuterFence`, per-line `heal`. Any unparseable line fails the round as
   `PARSE`.
5. `stampCreateSurfaceCatalogId`.
6. `validateA2ui(output, catalog, sessionSeeds, {atFinalize:true})`. Session seeds merge prior
   turns' components into the judged graph so an update that references an earlier-turn id
   passes (`sessionSurfaceSeeds`, TKT-0081; the renderer's own cross-turn guard is ADR-0128).
   `atFinalize` is a turn-end-only judgment (ADR-0187), off mid-stream, so a
   `createSurface` with no components fails `root-missing` before anything ships.
7. On a valid verdict: the FEED_SCOPE gate when an `ask` is declared (a violation is a
   self-correct round), then the persona's semantic checks when `deps.semanticChecks` is set
   (ADR-0238: a finding is a self-correct round carrying its sentence; on the last round
   the valid payload ships tallied `SEMANTIC_UNCORRECTED`, never a halt), then the NET_NOOP dodge check (a surface created and deleted in one turn
   gets one correction round, then the group is stripped and the turn degrades to prose,
   tally `NET_NOOP_STRIPPED`), then ask integrity.
8. Ask integrity is a silent whole-degrade, never a retry: an ask with no matching payload, or
   colliding with a session-known surface, is dropped and every message naming its surface is
   suppressed, so a dropped ask cannot repaint an answered card.
9. On an invalid verdict the structured failures feed the next round (SPEC-R4). A genui failure
   rides along on a retry the A2UI verdict already needs; it never causes a round or a halt alone.

The `render_surface` tool round (ADR-0242, accepted): on an a2ui-enabled turn the model's text is the
reply and the A2UI payload arrives as the `render_surface` tool input, which enters step 4 in place of
the text; the round ends on that call with no follow-up request. A text channel whose first line parses
as A2UI is the legacy shape and runs steps 1 to 9 unchanged. Text-channel A2UI lines beside a tool call
are dropped and tallied `TEXT_JSONL_IGNORED`. At the last round an invalid tool payload with non-empty
text ships as text, tallied `SURFACE_DEGRADED`, instead of `ProduceHalt`.

T-0172 rules (2026-10-14 traces):

- The tool input is `messages`, an array of A2UI message objects, one message per entry
  (`renderSurfaceJsonl` in `response-type.ts` turns it into one JSON line each). The model never
  hand-escapes JSON inside a string. A legacy `jsonl` string is still read, for recorded fixtures.
- Updating an open surface: send `updateComponents` and `updateDataModel` for the ids that changed. A
  resent component id replaces its whole record, `root` included when its component TYPE is the same
  (A2UI v1.0 `updateComponents` adds or updates by id; runtime SPEC-R3 AC2 REV). A `root` of another
  type, or two `root`s in one payload, still fails `sid:root`, and the repair is a re-create
  (`createSurface`, same id, the complete tree).
- A text round whose prose carries A2UI lines (a model that wrote its surface as text) routes them as
  the payload, tallied `TEXT_JSONL_ROUTED`; they never stream as `textDelta` or ship in the note.
- A self-correct round never loses a surface: a session-new surface the failed round created that no
  failure names must come back. The repair message names it ("Keep `ask-1` ..."); a later valid round
  without it spends a `SURFACE_DROPPED` round, and on the last round halts with `SURFACE_DROPPED`.

`maxRounds` bounds the loop. Exhaustion throws `ProduceHalt` carrying the last failures; a
transport that already committed a 200 turns that into the terminal error line below.
`FEED_SCOPE`, `NET_NOOP`, `FLOW_END_MISSING`, `SURFACE_DROPPED`, the genui codes and a semantic check's own codes
(`HAND_TOTAL`, `HAND_COUNT`, `NATURAL_ACTIONS`, `SEMANTIC_UNCORRECTED`, `SEMANTIC_CHECK_ERROR`) are produce-layer-only and
are not members of the protocol `ErrorCode` union.

## What the consumer sees, in order (validate-then-stream)

1. Progress meta-lines, only when the caller sets `progress: true` (`progressDetail`, one of
   `stages`, `full`, `source`, only controls what an event carries; `progressReasoning: true`
   forwards the bounded `reasoning` excerpts on its own axis, so they can ride beside `source`,
   ADR-0240), as they happen, ahead of all content. Output is byte-identical with progress off. `interleaveProgress` keeps a
   provider that runs a tool round without yielding text from starving progress delivery.
2. `textDelta` meta-lines, `{"a2uiMeta":{"textDelta":"..."}}`, one per reply-text fragment as it arrives,
   only when every declared tool is terminal and the text is not the legacy shape (ADR-0242). With an
   integration tool active none is yielded and the note ships whole.
3. The leading meta-line (`formatMetaLine`), when there is a `note` or a surviving `ask`; its `note`
   carries the whole reply even when `textDelta` lines preceded it.
4. The genui line, intact, when one survived.
5. The validated A2UI lines, one `JSON.stringify` per message, as a synchronous burst.

Consequence for UX: nothing invalid is ever painted; the early signals are the `textDelta` lines and the meta-line.
ADR-0206's `target` arm exists for that reason: it names the surface about to be mutated so the
host can show a working state during the wait. The host's `working` state starts at turn start
(GH #1104); `target` refines it.

## The terminal error line

A transport (the dev proxy, the Cloudflare Worker) that has already sent its 200 and then sees
`produce()` halt or throw writes `formatErrorLine(message)` as the LAST line: `{"a2uiMeta":
{"error":"..."}}` (GH #144). Without it a halted turn reads as an empty success. The reader sees
it as `a2uiMeta.error`. Over HTTP the stream is NDJSON (`application/x-ndjson`, set in
`tools/agent/dev-proxy-plugin.ts` and `tools/agent/worker/index.ts`).

Turn bounds. `produce()` runs its whole loop under one absolute deadline, `withTurnDeadline`
(`src/agent/deadlines.ts`): `ProduceOptions.turnDeadlineMs`, default `TURN_DEADLINE_MS` (300000), `0` disables,
set by the server and never read from a request body. It cuts a provider or tool that ignores the abort signal
too, and throws `TurnDeadlineError`; a caller abort before the limit keeps its own error. The Anthropic adapter
adds per-wait bounds (first byte, and `StreamStallError` for silence between reads, 60000 ms each). Both
errors are `AgentTimeoutError`s carrying a plain-words `userMessage` with no upstream detail. The hosts write
`failureMessageFor(err)` (`tools/agent/chat-validation.ts`) on the error line and on the prose `/chat` arm's
500 body: a `ProduceHalt` keeps its message (closed failure codes only), an `AgentTimeoutError` its
`userMessage`, anything else the generic line; the raw error is logged server-side only (T-0023, T-0024).

The `render_surface` correction round. A user override that asks for UI (`detectUserOverride` in
`src/agent/response-type.ts`, or the request's `responsePreference: 'surface'`) forces the tool. If the round
still comes back as text with no payload, the loop feeds one `SURFACE_REQUESTED` correction round while a
round is left; after that the text ships with `SURFACE_REQUESTED_UNMET` tallied. A text override withholds the
tool. The lexicon is closed and phrase-based: text phrases win a tie, and `show me`, `build a` and `make me a`
count as a surface ask only when a surface noun follows within four words.

## Order is the contract

A consumer may rely on: meta-lines (progress, `textDelta`, then the leading one) before any genui or A2UI
line; at most one genui line; A2UI lines already valid. It must not rely on the count of progress
lines, on a leading meta-line always existing, or on a `target` arriving without a `note`.

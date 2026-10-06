# Producer order, yield order, and the terminal error line

Source of truth: `produce` in `packages/agent-ui/a2ui/src/agent/produce.ts` (with
`ProduceOptions.maxRounds`, `ProduceHalt`, `interleaveProgress`, `formatMetaLine`,
`sessionSurfaceSeeds`, `feedScopeFailures`, `netNoOpSurfaceIds`, `askIntegrityHolds`),
`src/catalog/semantic-check.ts` (`semanticSurfaceViews`, `runSemanticChecks`, ADR-0238), and
`meta-line.ts` (`formatErrorLine`, `TURN_PROGRESS_STAGES`). ADR-0206 for the timing contract.

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

`maxRounds` bounds the loop. Exhaustion throws `ProduceHalt` carrying the last failures; a
transport that already committed a 200 turns that into the terminal error line below.
`FEED_SCOPE`, `NET_NOOP`, `FLOW_END_MISSING`, the genui codes and a semantic check's own codes
(`HAND_TOTAL`, `HAND_COUNT`, `SEMANTIC_UNCORRECTED`, `SEMANTIC_CHECK_ERROR`) are produce-layer-only and
are not members of the protocol `ErrorCode` union.

## What the consumer sees, in order (validate-then-stream)

1. Progress meta-lines, only when the caller sets `progress: true` (`progressDetail`, one of
   `stages`, `full`, `source`, only controls what an event carries), as they happen, ahead
   of all content. Output is byte-identical with progress off. `interleaveProgress` keeps a
   provider that runs a tool round without yielding text from starving progress delivery.
2. The leading meta-line (`formatMetaLine`), when there is a `note` or a surviving `ask`.
3. The genui line, intact, when one survived.
4. The validated A2UI lines, one `JSON.stringify` per message, as a synchronous burst.

Consequence for UX: nothing invalid is ever painted, but the only early signal is the meta-line.
ADR-0206's `target` arm exists for that reason: it names the surface about to be mutated so the
host can show a working state during the wait. The host's `working` state starts at turn start
(GH #1104); `target` refines it.

## The terminal error line

A transport (the dev proxy, the Cloudflare Worker) that has already sent its 200 and then sees
`produce()` halt or throw writes `formatErrorLine(message)` as the LAST line: `{"a2uiMeta":
{"error":"..."}}` (GH #144). Without it a halted turn reads as an empty success. The reader sees
it as `a2uiMeta.error`. Over HTTP the stream is NDJSON (`application/x-ndjson`, set in
`tools/agent/dev-proxy-plugin.ts` and `tools/agent/worker/index.ts`).

## Order is the contract

A consumer may rely on: meta-lines (progress, then the leading one) before any genui or A2UI
line; at most one genui line; A2UI lines already valid. It must not rely on the count of progress
lines, on a leading meta-line always existing, or on a `target` arriving without a `note`.

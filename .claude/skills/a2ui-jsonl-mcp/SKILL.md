---
name: a2ui-jsonl-mcp
description: >-
  A2UI JSONL line protocol on the AgentTransport stream: the three line kinds (A2UI message,
  a2uiMeta meta-line, genui line), per-line heal, peeling the leading meta-line and its drop-alone
  arm law (ADR-0088), the produce() round order and validate-then-stream yield order (ADR-0206),
  the terminal error line, NDJSON, record/replay. Use for "my meta-line was dropped",
  "what order do lines arrive", "per-line heal repairs", "replay a captured turn". NOT for
  composing payloads or arm vocabulary (a2ui-payload-authoring); NOT for writing or changing code
  such as heal.ts, produce.ts or a transport (a2ui-build); NOT for corpus curation
  (a2ui-corpus-curation) or catalogs (a2ui-multi-catalog).
user-invocable: false
disable-model-invocation: false
---

# A2UI JSONL line protocol: framing, heal, order, replay

One `AsyncIterable<string>` carries a whole agent turn, one JSON object per line. This skill owns
what happens to those LINES between a model's raw text and a renderer: how a line is classified,
repaired, ordered and recorded. It does not own what the lines SAY (composition) or the code that
moves them (build).

**Ownership.** Line framing, peel, per-line heal, producer order, yield order, the terminal error
line, record/replay are here. The six model-authored meta arms (`ask`, `plan`, `personaPatch`,
`flowEnd`, `team`, `target`): their meaning and when a model should declare one is
`a2ui-payload-authoring`'s `references/meta-line-vocabulary.md`; what the line DOES to them on
the wire is here. Editing `produce.ts`, `heal.ts`, `meta-line.ts` or a transport is
`a2ui-build-agent`'s method (`a2ui-build`).

## The three line kinds (one stream, told apart by keys)

| Kind | Marker | Reader | Fate |
|---|---|---|---|
| A2UI server message | `version` plus exactly one envelope key | `heal()` then `validateA2ui` | validated, then streamed |
| Meta-line | `a2uiMeta` key, NO `version` | `readMetaLine` / `isMetaLine` | peeled before heal, never validated as A2UI |
| genui line | `genui` key, NO `version`, NO `a2uiMeta` | `readGenuiLine` / `isGenuiCandidate` | peeled before heal; one ships per turn, extras dropped and counted |

Disjointness is the design: a meta-line is provably not an `A2uiServerMessage` (SPEC-N3 wire
purity), so `readMetaLine` rejects any line carrying `version`. A transport-composed terminal
error line is the same kind, `formatErrorLine`.

## What to read

| Question | Read |
|---|---|
| How is a line classified, peeled, healed? What do the arms do when malformed? | `references/line-framing-and-heal.md` |
| In what order does `produce()` work and what order does the consumer see? | `references/producer-order-and-yield.md` |
| Record a turn, replay a transcript or a devtools capture | `references/record-and-replay.md` |
| Script a multi-turn stream, judge its line order, heal and seeded verdict keylessly | the A2UI test kit, `packages/agent-ui/a2ui/tools/testkit/README.md` (`agent-ui-a2ui-scenario`; `toRecordedTranscript` bridges to `createRecordedTransport`) |

## Traps (each verified against the code, 2026-10-03)

- Only the FIRST non-empty line is peeled as the meta-line (`peelMetaLine`). A meta-line later in
  the output is not peeled: `heal()` fills a `version` into it and the validator rejects it SCHEMA,
  a wasted self-correct round. A turn wrapped in a markdown fence fails the same way: the peel
  runs on the raw text before `stripOuterFence`, so the first line it sees is the fence.
- A meta-line reaches the wire only with a `note` or a surviving `ask` on a content-bearing turn.
  A line carrying only `target` or `plan` is peeled and silently not re-emitted.
- Per-line `heal()` always reports `single-object-envelope`, so "changed" is true for every line;
  the trace's `healed` count excludes it on purpose (`assembleFromRaw`).
- Malformed arms drop alone, but a non-string `note` or non-object `trace` drops the WHOLE
  meta-line (`readMetaLine`).
- Validate-then-stream means content arrives as one burst; only the meta-line is early.
- `createRecordedTransport` cannot carry `personaPatch`, `flowEnd`, `team` or `target`, and emits
  a meta-line only when the turn has a `note`.
- Devtools replay yields recorded `line` events only; `meta` events are not replayed.

## Citation key

The convention is to cite by symbol, never line number (`produce`, `peelMetaLine`, `readMetaLine`, `heal`,
`createRecordedTransport`, `recordTurn`, `scriptTransport`). Decisions: ADR-0088 (meta-line
channel), ADR-0061 (the closed healer), ADR-0206 (`target`, validate-then-stream timing),
ADR-0187 (`atFinalize`), TKT-0081 (session seeds), ADR-0067 (why this skill exists and when).

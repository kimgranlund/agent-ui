# ADR-0239 — A devtools capture replays its meta events as meta-lines, in order, widening the line-only replay law

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-06
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-06 |
> | **Proposed by** | the sdlc-lite solo run `devtools-meta-replay` (T-0018), the follow-up T-0010 recorded in the SPEC-N1 note, GH [#1815](https://github.com/kimgranlund/agent-ui/issues/1815). Number 0239 claimed against the file tree and `origin/main` (0238 the highest), every sibling worktree, every remote branch, and the open PR list (none held a higher number) |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-06, ratified by Kim in the sdlc-lite session (AskUserQuestion) |
> | **Ratified by** | *(pending: only Kim flips this, via `scripts/adr_ratify.py`)* |
> | **Repairs** | [`../spec/devtools-harness.spec.md`](../spec/devtools-harness.spec.md) SPEC-R3 (the replay body, new AC3), SPEC-R7 (the `meta` arm description), SPEC-R10 (AC1 widened, new AC4), the SPEC-N1 note · [`../spec/agent-model.spec.md`](../spec/agent-model.spec.md) SPEC-R27 (one clause) · skill `a2ui-jsonl-mcp` (`references/record-and-replay.md`, `SKILL.md`, `intent.md`, `evals/evals.json`) · `packages/agent-ui/devtools/src/transports/replay.ts` (`capturedLineTimelines`) |
> | **Supersedes / Superseded by** | none · **Extends** [ADR-0200](./0200-agent-ui-devtools-package.md) (cl.3 and cl.7 stand: the `line` sequence still replays byte-identical; this adds the `meta` events to what replays) · relates [ADR-0088](./0088-a2ui-live-conversational-channel.md) (the `a2uiMeta` envelope and its closed arm vocabulary, unchanged) |

## Context

`recordTurn` (`devtools/src/timeline/events.ts`, SPEC-R7) routes every line `readMetaLine` accepts into a parsed `meta` event and every other line into a `line` event. `capturedLineTimelines` (`devtools/src/transports/replay.ts`, SPEC-R3) replays only the `line` events. A capture of a real turn therefore replays without its `note`, `ask`, `plan`, `personaPatch`, `flowEnd`, `team`, `target`, `trace`, `progress` and `error` lines, and the keyless admin runner (`scripts/e2e-admin`, T-0010) had to keep raw wire lines in its fixtures instead of reusing captures. ADR-0200 cl.3 and cl.7 state the replay law as a byte-identical `line` sequence; that stays true after this change, but the replayed stream is now larger than the `line` sequence, which is a visible change to every consumer of `replayTransport`.

Two facts make a lossless meta replay cheap. `compactMeta` drops only `undefined` members, so the stored `meta` event is the whole parsed payload, and a `meta` event never carries a `version` key, so `{"a2uiMeta": meta}` is a well-formed meta-line by construction. `recordTurn` does not keep the original bytes of a meta-line, so the replay can promise equivalence under `readMetaLine`, not byte identity with the original wire line (key order follows `readMetaLine`, and an arm member it normalizes, such as extra keys on `ask`, stays normalized).

## Decision

**We will make `capturedLineTimelines` replay each `meta` event as the NDJSON line `{"a2uiMeta": <meta>}`, interleaved with the `line` events in `seq` order, so `replayTransport` and the replay backend yield the same stream shape `recordTurn` consumed.** The whole payload is re-emitted: the replay holds no arm list of its own and follows the closed `a2uiMeta` vocabulary in `a2ui/src/agent/meta-line.ts` (today `note`, `ask`, `plan`, `personaPatch`, `flowEnd`, `team`, `target`, `trace`, `progress`, `error`). `line` events replay verbatim as before; a capture with no `meta` events replays exactly as it did. `render` and `client` events still never replay. The round-trip law becomes: `recordTurn`, then `capturedLineTimelines`, then `recordTurn` again yields the same `line` and `meta` events in the same order, the same `turn-end.status` and the same `usage` latch. `scriptTransport`, the `DevtoolsCapture` shape, `capture` version 1 and `AgentTransport` are unchanged, and no import is added, so the ADR-0073 trust boundary holds (no key, provider or `produce()` enters devtools).

## Consequences

- A replayed capture now carries the leading `note`, any `ask`, `plan`, `team`, `personaPatch`, `target` and `flowEnd` lines, so a consumer that asserted on a replay having no meta-line sees one. The devtools tests that encoded the old law are rewritten in the same change.
- A captured `error` meta-line replays as a terminal error line, so a replayed halted turn records `halt` again, and a captured `progress` line replays at its original position. A fixture that wants a quiet replay edits the capture, not the replay law.
- The admin runner may now reuse captures instead of hand-kept wire lines; whether it does is its own decision (SPEC-N1's note still allows raw lines).
- Stale to re-verify: the `a2ui-jsonl-mcp` skill's "replay yields `line` events only" statements and its eval prompt t06, and any fixture that was built around a meta-free replay.
- Meta replay is equivalent under `readMetaLine`, not byte-identical: a capture cannot reproduce the exact original bytes of a meta-line, and this ADR does not promise it. Keeping the raw meta bytes would change the SPEC-R7 vocabulary and is a separate decision.

## Alternatives considered

- **Replay a hand-kept list of arms (`note`, `ask`, `patch`, `plan`, `team`, `flowEnd`).** Rejected: it is a second copy of the `meta-line.ts` vocabulary that drifts when an arm is added, it would already omit `target`, `trace`, `progress` and `error`, and a partial replay would still not be lossless.
- **Make meta replay opt-in behind a flag on `capturedLineTimelines`.** Rejected: the goal is a lossless capture replay, and a flag leaves the default silently dropping arms, which is the defect being fixed. A caller that wants line-only filters the capture.
- **Store the raw meta line in the `meta` event for byte-identical replay.** Rejected here: it changes the SPEC-R7 event vocabulary and every stored capture's meaning for a guarantee no consumer needs; equivalence under `readMetaLine` is what a reader of the stream sees.
- **Leave replay line-only and keep raw wire lines in the admin fixtures.** Rejected: that is the T-0010 workaround, and it leaves captures unable to reproduce a real turn.

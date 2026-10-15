<!-- role=builder level=L4 model=opus effort=xhigh -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/agent/produce.ts`: tool offer and per-round capture executor, conditional-spread request (`terminalTools`, `toolChoice`), round classification (capture, legacy via `isLegacyRound`, text), `textDelta` hold-and-yield in both stream branches, tool-aware repair tail, `SURFACE_REQUESTED` / `SURFACE_REQUESTED_UNMET`, `TEXT_JSONL_IGNORED`, degrade at the bound (`SURFACE_DEGRADED`), `onRepairRound` with a per-round model and effort, `responsePreference` / `prefers` / `onRepairRound` options, doc comments brought in line.
- `packages/agent-ui/a2ui/src/agent/meta-line.ts`: `textDelta?: string` on the envelope; `readMetaLine` shallow-validates it and keys it only when present.
- `packages/agent-ui/a2ui/src/agent/session.ts`: `appendAssistantTurn(session, jsonl, note?)`.
- `packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts` (new): 43 tests in the describes `render_surface tool round`, `textDelta`, `user override`, `degrade at the bound`, `escalation seam`, `two-turn history`, `a2ui disabled`.
- `packages/agent-ui/a2ui/src/live-agent/mcp-enablement.test.ts` (widened): `turn()` filters `render_surface` out of the produce arm's tool names.
- `packages/agent-ui/devtools/src/transports/replay.test.ts` (widened): `textDelta` arm fixture, added to the anti-vacuous arm list and the round-trip turn.
- One squashed local commit `10cc47df` on `feat/response-type-selection`. Not pushed.

## Checks
- `redck.py record .sdlc/0060-response-type-selection/step-4/handoff.md` before the first edit (rerun handoff hash): exit 0, 7 pre-edit controls recorded red.
- (red) `npx vitest run --project packages .../produce-response-type.test.ts`: exit 0, 43 passed.
- (red) `-t "degrade at the bound"`: exit 0, 5 passed. `-t "user override"`: exit 0, 10 passed. `-t "two-turn history"`: exit 0, 3 passed. `-t "textDelta"`: exit 0, 7 passed.
- (red) the `appendAssistantTurn` node one-liner: exit 0. The `readMetaLine` textDelta node one-liner: exit 0.
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/ packages/agent-ui/a2ui/src/agent/ --maxWorkers=4`: exit 0, 56 files, 995 passed, 1 skipped.
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit packages/agent-ui/devtools/src --maxWorkers=4`: exit 0, 31 files, 715 passed.
- (guard) `eval-agent-behavior.ts selftest && kit.ts selftest`: exit 0.
- (guard) scope loop against `0affd8ad`: lists only `packages/agent-ui/a2ui/src/live-agent/mcp-enablement.test.ts` and `packages/agent-ui/devtools/src/transports/replay.test.ts`. Both are under `## Scope widened`. The literal case list predates the widenings, so as written it exits 1 on them.
- `npm run check`: exit 0. Before the replay fixture landed, `npx tsc` was red only at `replay.test.ts:40`.
- Extra regressions checked: `npx vitest run --project tools`: exit 0, 32 files, 397 passed. `npx vitest run --project packages` over croupier personas, `a2ui/tools/agent`, `a2ui/tools/agent-eval` and `genui-pack-library.test.ts`: 46 passed. `npx vitest run --project site site/lib/admin-live-runner.test.ts`: 45 passed.
- Touched packages in full: `npx vitest run --project packages packages/agent-ui/a2ui packages/agent-ui/devtools --maxWorkers=4`: exit 0, 168 files, 3831 passed, 1 skipped.
- Meta consumers: `git grep -n "readMetaLine(" -- site packages/agent-ui/app`. The hits in `admin-live-runner.ts`, `plan-runner.ts`, `a2ui-chat.ts`, `a2ui-live.ts` (both sites) and `gen-ui-live.ts` each act on a meta arm only when it is defined. A `textDelta`-only line is inert in all of them: it is peeled, never ingested as content, and never treated as a note.
- Mutation controls, each restored with `git checkout`: renaming `SURFACE_DEGRADED` turned 2 degrade tests red. Disabling deltas turned 5 textDelta tests red. Skipping the `SURFACE_REQUESTED` round turned 2 override tests red. Making `appendAssistantTurn` ignore the note turned 2 history tests red.

## Notes
Decisions the handoff left open, each covered by a test:
1. Legacy detection is `isLegacyRound`. A round is legacy when `isLegacyShape(raw)` holds, or when the first line after the meta-line passes one of three checks: it is an A2UI or genui line, it is a `{` line that `isGenuiCandidate` or the shared `heal()` accepts, or it sits inside an outer code fence and passes one of those. With strict `isLegacyShape` alone, `produce-loop` "trace.healed counts a REAL form repair" went red: its trailing-comma payload fell into the text path. Fenced JSONL keeps today's path, and the delta hold covers a backtick opener.
2. `textDelta` streams on the first round only. A repair round would send the already-streamed reply a second time, and the step 7 bubble appends deltas until the final note replaces them.
3. `SURFACE_REQUESTED` fires only on a text round, meaning no capture and not legacy. `genui-produce.test.ts` uses the intent "show me a chart" with a legacy meta-plus-genui round and must not spend an extra round.
4. A `render_surface` call with blank or non-string `jsonl` counts as a failed payload (PARSE, tool-aware repair) and never as a text turn. A genui-only capture payload still ships.
5. Integration tools join the offer only when `executeTool` is present. This keeps the GH #49 rule that `tools` without an executor means no tools.
6. On a capture round, the repair round's assistant turn is `<reply text>\n<jsonl>`, so the model sees the payload it sent.
7. A captured `target` fills the outgoing `target` arm on a shipped capture round when the text meta-line declared none. A degraded turn never gets it.
8. `TEXT_JSONL_IGNORED` stays set for the whole turn, like `GENUI_MULTIPLICITY`. A degraded turn ships `rounds: maxRounds`, the last round's failure codes, any tallies, then `SURFACE_DEGRADED`. It keeps the last round's plan, personaPatch, flowEnd, team and target, and drops ask.

Follow-ups, out of scope:
- With `progress: true`, the step 3 Anthropic adapter's `execute()` also fires `onEvent({kind:'tool', text:'render_surface'})` for the terminal call. Every capture round therefore yields a `tool` progress stage with detail `render_surface`, which the activity strip shows as a step. ADR-0146 describes that stage as naming an integration-registry tool. Step 7 or the adapter owner may want to filter it.
- The PARSE and NET_NOOP hint sentences still teach the legacy contract ("the note belongs ONLY on the leading meta-line"). On a capture round only the closing sentence is tool-aware. The step 5 prompt work may want tool-aware hint text.
- The lexicon loose end in the task handoff was not touched, as briefed.

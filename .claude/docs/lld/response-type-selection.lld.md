# LLD: Response type selection (module map and build plan)

> Status: proposed · v0.1 · 2026-10-09 · Layer: LLD (implementation plan) · architect seat, sdlc-lite run `response-type-selection` (T-0060)
> Implements: [`../spec/response-type-selection.spec.md`](../spec/response-type-selection.spec.md) (RTS-R1 to R11, RTS-N1 to N4) under [ADR-0242](../adr/0242-render-surface-terminal-tool-response-type.md) (proposed; the build starts from the ratified text). Why: [`../prd/response-type-selection.prd.md`](../prd/response-type-selection.prd.md).
> Folds into on build: [`./a2ui-live-agent.lld.md`](./a2ui-live-agent.lld.md) LLD-C3 (the loop) and LLD-C10 (the adapter). The tree wins over this document when they disagree.
> Build breakdown with runnable acceptance per step, builder levels, disjoint file lists and the merge order: `.sdlc/response-type-selection/breakdown.md` (the sdlc-lite artifacts dir; its decompose manifest is `decompose/manifest-v1.json`).

## 1. How `produce()` decides today (the baseline the design starts from)

There is no decision point. `grammar.md` decides in prose; `produce()` (`packages/agent-ui/a2ui/src/agent/produce.ts`, `produceTurn`) buffers the whole round, peels the leading meta-line, peels genui lines, and branches on `restLines.length === 0` (a note-only turn is a clean success). A surface becomes text only after the fact: the `NET_NOOP` strip, the ask-integrity degrade, and `ProduceHalt` at the round bound, whose note is discarded and replaced host-side by `GENERIC_FAILURE_MESSAGE` (`tools/agent/chat-validation.ts`). The first wire line of any turn follows the whole generation. With integration tools active the Anthropic adapter (`src/agent/providers/anthropic.ts`, the GH #49 loop) buffers each round's text and yields only the last round's. The `/chat` prose arm of `dev-proxy-plugin.ts` (agent-admin's own composed-prompt turns) bypasses `produce()` entirely and is out of scope: the response-type decision lives on the produce path only.

## 2. Module map

| Module | Change | SPEC |
|---|---|---|
| `src/agent/response-type.ts` (new, pure, zero-dep) | `RESPONSE_TYPES`, `ResponsePreference`, `RENDER_SURFACE_TOOL_NAME`, `renderSurfaceTool(openSurfaceIds): ToolDef`, `detectUserOverride(input): 'text' \| 'surface' \| undefined`, `classifyResponse(hasText, hasSurface)`, `isLegacyShape(text)` | R1, R6, R10 |
| `src/agent/agent-transport.ts` | `stream` request gains `terminalTools?` and `toolChoice?` (additive, documented as ignorable) | R2 |
| `src/agent/providers/anthropic.ts` | terminal-only round yields text live and ends on a terminal call without continuation; mixed rounds keep the GH #49 law; `buildRequestBody` maps `toolChoice` only when no `thinking` is sent | R2 |
| `src/agent/meta-line.ts` | `textDelta?: string` on the envelope type and `readMetaLine` (shallow, drops only itself) | R5 |
| `src/agent/session.ts` | `appendAssistantTurn(session, jsonl, note?)` stores the reply text ahead of the lines | R12 |
| `src/agent/produce.ts` | offers the tool; wraps `executeTool` to capture the payload; text channel as reply with the legacy fallback; `textDelta` yield; tool-aware repair wording; degrade at the bound (`SURFACE_DEGRADED`); `responsePreference`, override handling (`SURFACE_REQUESTED`, `SURFACE_REQUESTED_UNMET`), `onRepairRound` | R1, R3, R4, R5, R6, R8, R9 |
| `src/agent/system-prompt.ts` + `prompts/grammar.md` + `prompts/response-preference-{text,surface}.md` + `assets.gen.ts` (regenerated) + `live-agent/prompt-equivalence.baseline.json` (recaptured) | tenth parameter and the `response-preference` section; the grammar intro rewrite | R7, R11 |
| `tools/agent/chat-validation.ts`, `dev-proxy-plugin.ts`, `worker/index.ts` | `validateResponsePreference`; thread `responsePreference` into `produce()` | R6, R7 |
| `site/lib/admin-live-runner.ts`, `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts`, `.../conversation/conversation.ts` | the persona setting, the request key, the `text-delta` event painted into the bubble and replaced by the note | R5, R7 |
| `tools/agent-eval/{observe,score,legs,cases,scripted,eval-agent-behavior}.ts`, `fixtures/response-type-cases.json`, `fixtures/scripted-turns.json`, `fixtures/pins.json` | the leg, the scorer, the labelled set, the scripted turns | R10 |
| `tools/testkit/scenarios/response-type-*.scenario.json` | kit scenarios on the existing tool-round shape | R3, R6 |

## 3. The turn, step by step (the loop after this change)

1. Pre-loop (once): `retrieve`, `selectMiniSkills`, `buildSystemPromptSections(..., responsePreference)`, `detectUserOverride(input)`; the effective preference is the override, else `opts.responsePreference`, else `auto`. The tool list is `[...opts.tools, renderSurfaceTool(sessionKnownSurfaceIds)]` unless `a2uiEnabled === false` or the override is `text`. `terminalTools = ['render_surface']`; `toolChoice = {name:'render_surface'}` on a surface override.
2. Round: `provider.stream({..., tools, executeTool: captureWrapper, terminalTools, toolChoice, effort/model possibly replaced by onRepairRound(ctx)})`. The wrapper stores the `render_surface` input (`jsonl`, `target`) and returns `received`; other names delegate.
3. Text channel: hold fragments until the first newline or a non-`{` first character. Peel the meta-line as today. If the rest is the legacy shape, run the pre-change body unchanged (RTS-R4). Otherwise yield each fragment as `textDelta` when no integration tool is declared, and keep the trimmed text as the reply.
4. Payload: the captured `jsonl` (or none). None: a note-only turn (today's branch, with the model's text as `note`, the FLOW_END correction included). Some: `assembleFromRaw`, `stampCreateSurfaceCatalogId`, `validateA2ui(seeds, atFinalize)`, FEED_SCOPE, semantic checks, NET_NOOP, ask integrity, exactly today's order and codes; a failure is a self-correct round with the tool-aware feedback.
5. Bound: invalid payload on the last round and a non-empty text: ship the meta-line (`note`, trace with the last codes plus `SURFACE_DEGRADED`) and no content; empty text: `ProduceHalt`. A surface override whose round returned no payload: one `SURFACE_REQUESTED` correction round, then ship text with `SURFACE_REQUESTED_UNMET`.
6. Ship: `done` progress, meta-line first, genui line, content lines (SPEC-R5 unchanged).
7. History: the host appends the assistant turn as `<note>\n<jsonl>` (`appendAssistantTurn(session, jsonl, note)`), so the next turn's model input shows a reply followed by the rendered JSONL, never bare JSONL (RTS-R12); both session parsers skip non-JSON lines, verified in `sessionKnownSurfaceIds` and `sessionSurfaceSeeds`.

## 4. Measurements that exist keyless (the K6 script)

Run from the repo root with `node --experimental-strip-types`: load the `agent-ui` catalog through `tools/catalog-files.ts` `loadCatalogById`, call `buildSystemPromptSections(catalog, [], undefined, [])` and print `text.length` and `sections`; add `JSON.stringify(renderSurfaceTool([])).length` after step 1 lands. Baseline on this tree: 42,209 chars (grammar 24,035, components 18,029, functions 145). The K6 room is about 4,200 chars.

## 5. Risks the builders watch

- The baseline recapture touches every composed key; recapture once, after the grammar rewrite, by the `a2ui-prompt-authoring` flow, and diff the baseline before committing.
- Haiku 5.5 may deliver `jsonl` as expected (a string) but the `input_json_delta` stream can split JSON escapes across fragments; `parseToolInput` already tolerates partial input only at the end of the block, so the capture must read the fully assembled input (`collector.calls[n].inputJson`), never a fragment.
- `observe.ts` reads component types from raw text; after this change the payload is in the tool input, so `attemptedTypes` must also read captured inputs or the persona leg goes blind.

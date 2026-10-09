# SPEC: Response type selection (`render_surface` as a terminal tool, text as the default, text first)

> Status: proposed · v0.2 · 2026-10-09 · Layer: SPEC (execution contract) · architect seat, sdlc-lite run `response-type-selection` (T-0060)
> Realizes: [`../prd/response-type-selection.prd.md`](../prd/response-type-selection.prd.md) (PRD-G1 to G6, R1 to R11). Decision: [ADR-0242](../adr/0242-render-surface-terminal-tool-response-type.md) (proposed). Plan: [`../lld/response-type-selection.lld.md`](../lld/response-type-selection.lld.md).
> Amends on ratification: [`a2ui-live-agent.spec.md`](./a2ui-live-agent.spec.md) SPEC-R4 (the repair round's feedback and the degrade at the bound), SPEC-R5 (text is not content: the text arm may precede validation, A2UI lines still never do), SPEC-R6 (two new composed sections), SPEC-R11 (two additive request fields on `AgentProvider.stream`). IDs below are `RTS-R#`; the amendment sheet keeps this SPEC's ids and adds a pointer row per touched requirement.
> Holds unchanged: ADR-0073 clause 5 (keys and `produce()` stay server-side, nothing enters devtools), the neutral `ActivityStep` contract (`packages/agent-ui/app/src/controls/conversation/activity-step.ts`), the `TurnProgress` stage table, and every meta-line arm's wire shape.

## 1. Definitions

- Response type: `text` (a turn with no A2UI lines), `surface` (A2UI lines with an empty or caption-length text), `both` (a non-empty text followed by A2UI lines). Observed from the wire, never declared by the model.
- Terminal tool: a tool whose call ends the model's turn. The adapter executes it once and makes no further upstream request; its result never reaches the model in that turn.
- Text channel: the model's ordinary assistant text. Under this SPEC it is the user-facing reply; the leading meta-line (declarations) may still open it.
- Legacy shape: a text channel whose first non-empty line is an A2UI message (`{"version":...}`) or whose only content after a meta-line is A2UI JSONL. The pre-change grammar.
- Preference: `'text' | 'surface' | 'auto'`. The user override is per turn and mechanical; the persona hint is per agent and advisory.

## 2. Requirements

### RTS-R1: the `render_surface` terminal tool

`produce()` offers one tool on every turn where `a2uiEnabled !== false`, named `render_surface`, declared by `renderSurfaceTool(openSurfaceIds)` in `src/agent/response-type.ts`. Input schema: `{ jsonl: string (required): the A2UI JSONL, one message per line; target?: string: the open surfaceId this payload updates }`. The description names the open surfaces of the session (`sessionKnownSurfaceIds`) and asks for an update over a create when one fits. The tool is appended to the caller's integration tools; `tools` without `executeTool` is still "no tools" for the adapter, so `produce()` always supplies an executor that captures a `render_surface` input and delegates every other name to `opts.executeTool`.

- AC1: with `a2uiEnabled: false` the tool is not offered and the request shape is byte-identical to before this SPEC.
- AC2: a scripted provider that reports a `render_surface` tool round with `{jsonl}` reaches `produce()`'s executor exactly once; the executor's result text is `received` and is never fed back as a tool result within the turn.
- AC3: the serialized tool definition plus the grammar teaching added for it stay within the K6 room (PRD §6).

### RTS-R2: the seam gains `terminalTools` and `toolChoice`

`AgentProvider.stream` takes two additive, optional fields. `terminalTools?: readonly string[]`: a round that ends with a call to a named tool executes it, yields the round's text, and returns without a continuation request. `toolChoice?: { name: string }`: force that tool for the round when the provider supports it. An adapter that ignores either is byte-behavior-unchanged (the `effort?` precedent). The Anthropic adapter: when every declared tool is terminal, the round's text fragments are yielded live as they arrive (no scratch prose can follow a terminal-only round); with a mix of integration and terminal tools, text stays buffered per round as today and a terminal call ends the loop. `tool_choice` is sent only when the request sends no `thinking` parameter (the API forbids a forced tool choice with extended thinking); otherwise it is omitted and RTS-R6's correction round applies.

- AC1: fixture-tested request bodies: `toolChoice` present with `effort` absent or `low` carries `tool_choice: {type:'tool', name}`; with `effort: 'high'` it carries none.
- AC2: a scripted SSE stream with a text block then a `render_surface` tool_use block yields the text fragments before the executor runs and makes one upstream request.
- AC3: a scripted stream with an integration tool_use then a text round still makes two requests and yields only the second round's text (the GH #49 law, unchanged).

### RTS-R3: the text channel is the reply; the leading meta-line stays optional

`produce()` reads the round's text channel as follows. The first non-empty line is peeled as the meta-line when `readMetaLine` accepts it (today's `peelMetaLine`). If the remaining text's first non-whitespace character is `{` and the line parses as an A2UI message, the round is the legacy shape and runs today's path unchanged (RTS-R4). Otherwise the remaining text, trimmed, is the reply; the outgoing meta-line's `note` is that text, or the model-authored `note` when the text is empty. The A2UI payload is the captured `render_surface` input's `jsonl`, run through `assembleFromRaw`, `stampCreateSurfaceCatalogId`, `validateA2ui` with the session seeds and `atFinalize: true`, the FEED_SCOPE gate, the semantic checks, the NET_NOOP detector and the ask-integrity rule, in that order, exactly as the legacy text payload is today. A round that both calls `render_surface` and carries A2UI or genui lines in its text channel ships the tool payload; the text-channel lines are dropped from the reply and tallied `TEXT_JSONL_IGNORED` on the trace.

- AC1: a tool round `{jsonl}` with `then: "Here is your card."` ships `{"a2uiMeta":{"note":"Here is your card.",...trace}}` first, then the validated A2UI lines.
- AC2: a text-only round (no tool call, no JSONL) ships a note-only turn with `rounds: 1` and no A2UI line; it never halts.
- AC3: a round whose text opens with `{"a2uiMeta":{"ask":{"surfaceId":"ask-1"}}}` and whose tool payload creates `ask-1` ships the ask arm and the surface; the ask-integrity rule applies to the tool payload exactly as to a legacy payload.

### RTS-R4: the legacy shape is byte-identical

A legacy-shape round runs the pre-change loop body with no change in yielded lines, trace fields, failure codes or round count.

- AC1: every scripted turn in `tools/agent-eval/fixtures/scripted-turns.json`, every kit scenario under `tools/testkit/scenarios/`, every seeded fixture and every `produce-loop` test passes unedited.
- AC2: the recorded transports (`createRecordedTransport`) and the devtools replay are untouched by this SPEC.

### RTS-R5: text streams first as an additive meta arm

When the turn's declared tools are all terminal (no integration tool active) and the text channel is not the legacy shape, `produce()` yields `{"a2uiMeta":{"textDelta":"<fragment>"}}` per text fragment as it arrives, strictly ahead of any content line, after the leading meta-line (if any) has been peeled (fragments are held until the first newline or until the first non-whitespace character is known not to be `{`). The final leading meta-line still carries the complete `note`. `readMetaLine` gains `textDelta?: string` (shallow-validated like every arm: a non-string drops only itself). A2UI content lines never precede validation (SPEC-R5 unchanged: text is not content).

- AC1: a scripted provider yielding three fragments produces three `textDelta` lines, then the meta-line whose `note` equals their concatenation trimmed, then the content lines.
- AC2: with an integration tool active in the turn, no `textDelta` line is yielded and the note ships whole.
- AC3: `admin-live-runner.ts` yields a `{kind:'text-delta'}` event the conversation paints into the bubble and replaces on the final note; `a2ui-chat` and `a2ui-live` ignore the arm this wave and render as today.

### RTS-R6: user override, mechanical

`detectUserOverride(input: TurnInput)` in `response-type.ts` is a fixed lexicon over the `kind: 'intent'` arm only (the `isExplicitClose` precedent): a text override ("just tell me", "in words", "no card", "text only", "don't show", "skip the ui") and a surface override ("show me", "as a card", "as a table", "as a chart", "build a", "make me a", "render"). A request field `responsePreference` (validated fail-closed by `validateResponsePreference` in `chat-validation.ts`, the composer toggle's path) threads as `ProduceOptions.responsePreference` and has the same effect: it is the mechanical override, and `'auto'` means none. The intent lexicon beats it as the latest instruction. Text override: `render_surface` is not offered that turn. Surface override: `toolChoice: {name:'render_surface'}` when the provider can honor it; otherwise, if the round returns no payload, one correction round with code `SURFACE_REQUESTED` and a one-sentence hint, then ship as text with `SURFACE_REQUESTED_UNMET` tallied. The override beats the persona hint.

- AC1: a turn whose intent matches the text lexicon offers no `render_surface` tool (asserted on the request the stub provider receives), whatever `prefers` says.
- AC2: a turn whose intent matches the surface lexicon sends `toolChoice`; a stub that returns text only triggers exactly one correction round, then ships text with the tally.
- AC3: `responsePreference: 'text'` on the proxy request has AC1's effect; any other value than the three literals is dropped.

### RTS-R7: persona hint `prefers`

`ProduceOptions.prefers?: 'text' | 'surface' | 'auto'` threads to `buildSystemPrompt` as a tenth additive parameter composing one `response-preference` section from `prompts/response-preference-text.md` or `prompts/response-preference-surface.md` (byte-pinned, embedded by `generate-agent-assets.mjs`); `'auto'` and absent compose zero bytes. `prefers` is advisory only: it never changes the tool offer or `toolChoice`. The agent-admin persona record gains a `prefers` setting (default `auto`) beside the Surface Options, sent by the admin runner as the `prefers` request field; the user override of RTS-R6 wins over it per turn.

- AC1: `buildSystemPromptSections(..., 'auto')` is byte-identical to the nine-parameter call; `'text'` and `'surface'` each add exactly one section.
- AC2: the schema default is `auto` and the runner omits the key when the value is `auto` (the `effort` absent-key precedent).

### RTS-R8: degrade to text at the round bound

A payload that fails validation is a self-correct round on today's loop with today's codes; the feedback message names the tool: "Call render_surface again with the COMPLETE corrected JSONL; keep your reply text addressed to the user". At the last round, when the payload is still invalid and the text channel is non-empty, the turn ships as text: the leading meta-line with `note`, `rounds`, the last round's failure codes plus `SURFACE_DEGRADED`, and no A2UI line. When the text is empty, `ProduceHalt` is thrown as today.

- AC1: a scripted turn with three invalid payloads and the text "Here is the plan." ships note-only with `failureCodes` ending in `SURFACE_DEGRADED` and outcome `eventual-text` in the eval's observation.
- AC2: three invalid legacy rounds still halt (the `repair-halt` scripted turn, unchanged).

### RTS-R9: the escalation seam

`ProduceOptions.onRepairRound?: (ctx: { round: number; failures: readonly { code: string; path: string }[] }) => { effort?: Effort; model?: string } | undefined` is consulted at the top of every self-correct round; a returned field replaces that round's `effort` or `model` on the provider request and the trace's `model` records the model that produced the shipped round. Absent: byte-identical. No policy ships; the hosts do not set it this wave.

- AC1: a stub policy returning `{effort:'high'}` on round 2 is observed on the second `stream()` request only.

### RTS-R10: measurement

`tools/agent-eval/fixtures/response-type-cases.json` (pinned in `pins.json`) holds at least 40 cases `{id, catalogId, prompt, expect: 'text'|'surface'|'both'}`. `observeTurn` gains `hasText`, `hasSurface`, `toolCalled` and `outcome: 'eventual-text'`; `attemptedTypes` also reads captured `render_surface` inputs. `scoreResponseType(obs, expect)` fails `text` on `hasSurface`, `surface` on `!hasSurface`, `both` on `!hasSurface || !hasText`; the leg's summary line reports the false-surface and missed-surface rates and, on the live arm, per-case wall time to the first wire line. `live --leg response-type` is the manual run; the selftest gains scripted turns for a clean text turn, a clean tool turn, the degrade, the text override, and one seeded wrong choice that must fail. The agent-eval `scriptedProvider` accepts the kit's tool-round shape.

- AC1: `npm run eval:agent-behavior -- selftest` exits 0 and its summary counts the new turns; removing the seeded turn's expected failure makes it exit 1.
- AC2: `cases.test.ts` asserts the case count is at least 40 and every `expect` is one of the three literals.

### RTS-R11: the prompt change is deliberate

`grammar.md`'s intro and note paragraphs are rewritten to the text-channel contract ("Reply in prose; to show UI call `render_surface` with the A2UI JSONL; the declarations below still ride an optional first meta-line"); the "omit entirely if the UI isn't changing" output rule becomes "call `render_surface` only when the UI changes". The two mode files are untouched. The baseline is recaptured once by the documented flow; `prompt-budget.test.ts` stays green; `assets.gen.ts` is regenerated; the agent-model reference and the `a2ui-jsonl-mcp` skill name the new arm and the tool.

- AC1: `prompt-equivalence.test.ts`, `prompt-drift.test.ts`, `agent-assets-freshness.test.ts` and `prompt-budget.test.ts` exit 0 after the recapture.

### RTS-R12: conversation history carries the reply text

The hosts store an assistant turn as the reply text followed by the shipped A2UI lines: `appendAssistantTurn(session, jsonl, note?)` (`src/agent/session.ts`) widens additively and writes `<note>\n<jsonl>` when a note is given, `jsonl` alone otherwise. Both session parsers (`sessionKnownSurfaceIds` in `produce.ts`, `sessionSurfaceSeeds` in `surface-seeds.ts`) already skip a non-JSON line, so a prose prefix is inert to seeding and ask integrity. `messagesFor` sends prior assistant turns verbatim; the grammar says that earlier assistant turns show the reply followed by the JSONL that was rendered, so a continuation turn is not pulled back to the legacy shape and the model keeps its own prior answers. Response-type observation runs the labelled set's multi-turn cases with a seeded two-turn session.

- AC1: a two-turn scripted produce test whose first turn stored `<note>\n<jsonl>` validates the second turn's update against the seeded surface (no `sid:root` false failure) and passes ask integrity.
- AC2: `tools/agent-eval/fixtures/response-type-cases.json` holds at least four cases with a `session` of one prior assistant turn, and `observeTurn` accepts an optional `session`.

## 3. Negative requirements

- RTS-N1: no classifier, router or pre-turn model call exists anywhere on the path; `produce()` makes one provider request per round, as today.
- RTS-N2: `produce()` composes no reply text of its own. A degrade ships the model's text or halts; the only runtime-composed user-facing string stays the host's `GENERIC_FAILURE_MESSAGE`.
- RTS-N3: nothing under `@agent-ui/devtools` imports `produce()`, a provider or a key; the capture format records the new arm as an ordinary meta event.
- RTS-N4: the `TurnProgress` stage table is unchanged; `textDelta` is a meta arm, not a progress stage.

## 4. Acceptance summary

Keyless: every AC above except the live halves of RTS-R10 runs under `npm test` or `check:scripts`. Live: Kim's `live --leg response-type` run fills K1 to K3 in the PRD.

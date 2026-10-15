<!-- role=architect level=L1 model=fable effort=high -->
## Approach

How `produce()` decides today: it does not. `grammar.md` decides in prose ("You do NOT reply in prose", the reply rides a leading `{"a2uiMeta":{"note":...}}` line, A2UI JSONL follows and is "omitted entirely if the UI isn't changing"). `produceTurn` in `packages/agent-ui/a2ui/src/agent/produce.ts` buffers the whole round, peels the meta-line and genui lines, treats zero A2UI lines as a clean note-only turn, and demotes a surface to text only after the fact (the `NET_NOOP` strip, the ask-integrity degrade, and `ProduceHalt` at the round bound, which discards the model's note so the host shows `GENERIC_FAILURE_MESSAGE`). Nothing reaches the wire before the whole round validates, and with integration tools active the Anthropic adapter's GH #49 loop buffers each round's text and never yields pre-tool text. The `/chat` prose arm of `dev-proxy-plugin.ts` bypasses `produce()` and is out of scope.

The design: `render_surface` is a terminal tool owned by `produce()`. The model's ordinary text is the reply; the A2UI JSONL rides the tool input (`jsonl`, optional `target`). The adapter learns two additive request fields, `terminalTools` and `toolChoice`: a terminal-only round yields its text live and ends on the call with no continuation request, so a clean text or surface turn costs one upstream request as today, and the text precedes the surface on the wire. `produce()` wraps `executeTool` to capture the payload and runs it through the existing validate, feed-scope, semantic, net-noop and ask-integrity chain in today's order; a failure is today's repair round with tool-aware feedback; at the bound a non-empty text ships as a text turn tallied `SURFACE_DEGRADED`, an empty text halts as today. Text streams first as an additive meta arm `textDelta`, yielded only when no integration tool is in the turn (progress stages untouched, A2UI lines still never precede validation). The leading meta-line stays optional for declarations (`ask`, `plan`, `flowEnd`, `personaPatch`, `team`, `target`); a legacy-shape round (JSONL in the text channel) runs the pre-change loop byte for byte, so every existing fixture, kit scenario and recorded transport stays green. Hosts store an assistant turn as `<note>\n<jsonl>` so a continuation turn sees a reply, never bare JSONL. Steering precedence: user override (a mechanical lexicon on the intent, or the `responsePreference` request field; text withholds the tool, surface forces it or spends one correction round) beats the persona hint `prefers: text | surface | auto` (one composed teaching paragraph, zero bytes on auto). The escalation hook ships as a seam only, `ProduceOptions.onRepairRound`. Measurement is a `response-type` eval leg over a pinned labelled set of at least 40 prompts with a pure scorer and keyless scripted selftest turns; K1 to K3 live halves are `pending-live` for Kim's manual run.

Written and committed on `feat/response-type-selection` (commit `7cdeec2f`, no push): the PRD, SPEC, LLD, draft ADR-0242 (proposed), the breakdown and the decompose manifest; `doc_lint` exit 0 on every doc, `npm run check` exit 0, docs-grammar, adr and sitemap tests exit 0 (202 tests), coverage_check clean.

## Interfaces

- New `packages/agent-ui/a2ui/src/agent/response-type.ts`: `RESPONSE_TYPES`, `ResponsePreference`, `RENDER_SURFACE_TOOL_NAME`, `renderSurfaceTool(openSurfaceIds): ToolDef`, `detectUserOverride(input)`, `classifyResponse`, `isLegacyShape`.
- `packages/agent-ui/a2ui/src/agent/agent-transport.ts`: `AgentProvider.stream` request gains `terminalTools?: readonly string[]` and `toolChoice?: { name: string }` (additive, ignorable).
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`: terminal-only round streams text live and ends without continuation; `buildRequestBody` maps `toolChoice` to `tool_choice` only when no `thinking` is sent.
- `packages/agent-ui/a2ui/src/agent/produce.ts`: `ProduceOptions.responsePreference`, `ProduceOptions.onRepairRound`; new trace codes `SURFACE_DEGRADED`, `SURFACE_REQUESTED`, `SURFACE_REQUESTED_UNMET`; the `textDelta` yield.
- `packages/agent-ui/a2ui/src/agent/meta-line.ts`: `textDelta?: string` on the envelope, shallow-validated.
- `packages/agent-ui/a2ui/src/agent/session.ts`: `appendAssistantTurn(session, jsonl, note?)`.
- `packages/agent-ui/a2ui/src/agent/system-prompt.ts`: tenth parameter `responsePreference`; new byte-pinned `prompts/response-preference-{text,surface}.md`; `prompts/grammar.md` intro rewritten; `assets.gen.ts` regenerated; baseline recaptured once.
- `packages/agent-ui/a2ui/tools/agent/chat-validation.ts`: `validateResponsePreference`; both hosts thread it.
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts`: persona setting `responsePreference` (default `auto`); `site/lib/admin-live-runner.ts`: the request key and a `text-delta` event; `conversation.ts` paints deltas then the note.
- `packages/agent-ui/a2ui/tools/agent-eval/`: `response-type` leg, `scoreResponseType`, `observeTurn` fields `hasText`/`hasSurface`/`toolCalled`/`eventual-text` and optional `session`; `fixtures/response-type-cases.json` (pinned).
- Docs: `.claude/docs/prd/response-type-selection.prd.md`, `.claude/docs/spec/response-type-selection.spec.md` (RTS-R1 to R12, N1 to N4), `.claude/docs/lld/response-type-selection.lld.md`, `.claude/docs/adr/0242-render-surface-terminal-tool-response-type.md`; plan: `.sdlc/0060-response-type-selection/breakdown.md`, manifest `.sdlc/0060-response-type-selection/decompose/manifest-v1.json`.

## Constraints and assumptions

- The text channel can carry a text block then a tool_use block in one assistant message, so text streams before the payload with no continuation: verified by the adapter's SSE walk (`parseAnthropicSSE` collects `tool_use` blocks by index alongside `text_delta` fragments) | the "all terminal tools" live-yield rule is new adapter code
- One upstream request per clean turn today: verified by `scripted PASS repair-first-pass ... rounds 1` (eval selftest exit 0)
- A halt discards the note and shows the host's generic message: verified in `produce.ts` (`ProduceHalt`) and `chat-validation.ts` (`GENERIC_FAILURE_MESSAGE`)
- Both session parsers skip non-JSON lines, so a prose prefix in a stored assistant turn is inert: verified in `sessionKnownSurfaceIds` (try/catch) and `surface-seeds.ts` (try/catch)
- The kit's scripted provider tool-round shape `{tool, input, then}` delivers a payload to `produce()`'s executor with no kit change: verified in `tools/testkit/scripted-provider.ts`
- Default prompt composition is 42,209 chars (grammar 24,035, components 18,029, functions 145): measured on this tree with `buildSystemPromptSections`
- The API rejects a forced `tool_choice` with extended thinking, including `thinking: {type:'adaptive'}`: unverified (from recall; step 2's builder checks the docs before coding the gate)
- Older published readers of `@agent-ui/a2ui/agent` ignore the unknown `textDelta` arm rather than fault-isolating each line: unverified
- Haiku 5.5 delivers a long `jsonl` string input intact through `input_json_delta`: unverified (T-0034 showed object fields arriving as strings; strings themselves have not been stressed)
- ADR number 0242 is free: verified against the file tree, sibling worktrees and local/remote branches

## Rejected alternatives

- Router or classifier model call before the turn: one added call and its latency on every turn, a second prompt to maintain, a decision taken without the catalog and session context; Kim ruled it out on 2026-10-09.
- A model-declared `response` arm on the leading meta-line: zero added calls and no seam change, but it only labels what the payload already shows, gives the model no mechanism that makes text the default, and leaves the whole generation buffered; recorded as the fallback if the terminal-tool route misses K3 live.
- `render_surface` as an ordinary tool whose result returns to the model: one added upstream request on every surface turn (K3 fails) and the GH #49 buffering hides the text until the continuation.
- Moving every declaration into tool inputs and retiring the meta-line: six host-consumed arms move at once, text-only declaration turns need a surface-less tool, and the legacy fallback loses its anchor.
- Runtime-composed text when the surface fails and the model wrote none: fabricated prose (the ADR-0146 F2 posture); the host's generic message stays the only runtime string.
- A `TurnProgress` stage carrying text deltas: progress is not content and the stage table is a closed label set.

## Risks

- The grammar rewrite re-pins the whole prompt baseline; a sloppy recapture hides drift. Step 4 recaptures once via the `a2ui-prompt-authoring` flow after the rewrite and diffs the baseline.
- If adaptive thinking does allow a forced `tool_choice`, the surface override needlessly degrades to a correction round; if it forbids it, the fixture test in step 2 pins the gate. Either way K5's "forced" half may become "corrected" under effort above low.
- A round that carries both legacy JSONL in the text channel and a `render_surface` call is unruled; the SPEC should rule "the tool payload wins, the text JSONL is tallied" before step 3 starts.
- Text deltas chatter the wire (one meta line per fragment) exactly as ADR-0240's reasoning excerpts do; coalescing is a follow-up if it matters.
- Multi-turn behaviour depends on hosts passing the note to `appendAssistantTurn`; a host that forgets stores bare JSONL and pulls the model back to the legacy shape silently. Step 6 touches every call site under `site/`; the two-turn scripted case in step 7a is the keyless guard.
- K1 to K3 live numbers do not exist yet; the PRD table is honest about `pending-live`, and a baseline on `main` must be captured before step 3 merges or there is nothing to compare against.
- The handoff's Context did not receive the `Decomposition:` line the decompose skill asks for (the handoff's sha is pinned in the dispatch record); the report is at `.sdlc/0060-response-type-selection/decompose/report.md`.
- The ADR H1 keeps its one em dash because `site/lib/adr.ts` parses the title after it (the gate's grammar); every other new line is em-dash free.

## Carry forward

- `produceTurn` in `packages/agent-ui/a2ui/src/agent/produce.ts` buffers the whole round and yields nothing before validation; the note-only branch is `restLines.length === 0`
- The Anthropic tool loop (`anthropicProvider.stream`, `providers/anthropic.ts`) buffers each round's text and yields only the last round's; `MAX_TOOL_ROUNDS` is 4
- `AgentProvider.stream` yields text fragments only; tool calls reach `produce()` solely through `executeTool` (`agent-transport.ts`)
- `appendAssistantTurn` (`session.ts`) stores bare JSONL; `sessionKnownSurfaceIds` (`produce.ts`) and `sessionSurfaceSeeds` (`surface-seeds.ts`) both skip non-JSON lines
- `readMetaLine` (`meta-line.ts`) validates each arm independently; a malformed arm drops only itself
- The kit scripted provider's tool round `{tool, input, then}` calls `executeTool` once then yields `then` (`tools/testkit/scripted-provider.ts`); the agent-eval `scripted.ts` accepts strings only
- `observeTurn` (`tools/agent-eval/observe.ts`) runs with `session: {turns: []}` and reads attempted types from raw text, not tool inputs
- Keyless baselines, this tree: eval selftest exit 0 (7 turns, 0 mismatches), kit selftest exit 0, live leg without a key exit 2, `npm run check` exit 0
- Default `agent-ui` prompt: 42,209 chars (grammar 24,035, components 18,029, functions 145); 43,879 with three mini-skills; K6 room about 4,200 chars
- `GENERIC_FAILURE_MESSAGE` in `tools/agent/chat-validation.ts` is the only runtime-composed user-facing string today
- Both hosts spread `buildToolDispatch` into `ProduceOptions` and validate request fields fail-closed in `chat-validation.ts` (`dev-proxy-plugin.ts`, `worker/index.ts`)
- The `/chat` prose arm in `dev-proxy-plugin.ts` bypasses `produce()`; out of scope for this ticket
- Docs-only gate run: `doc_lint.py` lives at `/Users/kimgranlund/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py`; sitemap regen is `node scripts/generate-sitemap.mjs` (writes `site/public/adr-index.json`)
- Commit `7cdeec2f` on `feat/response-type-selection` in the wave-rts worktree holds every document and the breakdown; nothing pushed

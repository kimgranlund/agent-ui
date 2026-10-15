---
id: T-0060
title: "Response type selection: the agent chooses text, A2UI surface, or both per turn"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L4             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-09
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A chat turn picks its response type deliberately: plain text, an A2UI surface, or text then a surface, with text streaming first so the chat feels fast. Decided inside the turn by the model through a `render_surface` tool (text is the default), not by a router model call in front of it.

## Intent
- Why: today the choice is implicit and unmeasured. Users should get UI when it helps (structured data, comparisons, input, long lists, multi-step actions) and a short text answer otherwise, with no extra model hop.
- Do (the architect decides the exact shape; these are the requirements):
  1. Write the requirements as a PRD under `.claude/docs/prd/` (doc-standards grammar), including the KPIs below with MEASURED baselines (measure them, never invent them).
  2. Write the SPEC and an LLD or implementation plan (ADR if a ruled contract changes; ADR-0073 trust boundary and the neutral ActivityStep contract must hold).
  3. Mechanism to evaluate first: `render_surface` tool, text default, persona hint `prefers: surface|text|auto`, user override ("just tell me" / "show me" / a toggle), open-surface bias toward update, degrade to text when a surface fails validation after N repairs. Name rejected alternatives (router-first classifier) with reasons.
  4. Escalation hook: a repair/retry is the trigger for a heavier tier (Haiku think, Sonnet think); keep the tier policy a separate seam, out of scope to build now unless trivially cheap.
- KPIs (targets proposed; the PRD fixes final numbers after baselines):
  - K1 selection accuracy on a labelled set (>= 40 prompts tagged text/surface/both): >= 90% overall.
  - K2 false-surface rate (UI where text was right): <= 5%; missed-surface rate: <= 10%.
  - K3 added model calls per turn vs today: 0; text-turn time to first token: no regression (within 5% of baseline).
  - K4 turns that end with a user-visible answer after a surface validation failure: 100%.
  - K5 user override honored: 100% in tests.
  - K6 tokens per turn: no more than +10% vs baseline (prompt rubric included).
  - K7 all keyless gates green: check, npm test, selection eval selftest.
- Non-goals: model-tier routing build, new components, UI redesign of the strip, any key/produce() entering devtools.
- Done when: PRD, SPEC, plan, ADR (if needed) landed; implementation merged; K1 to K7 measured and recorded in the PRD result section (live legs that need ANTHROPIC_API_KEY are Kim's manual run: mark those KPIs `pending-live` and ship the keyless scripted-transport measurement); no em dashes.

## Context
Kim's design discussion 2026-10-09: tool-call decision over classifier-first. Read first: `packages/agent-ui/a2ui/src/agent/` (produce.ts, prompts/, tool-dispatch), `packages/agent-ui/a2ui/tools/agent-eval/` (selection leg), `a2ui/tools/testkit/` (keyless scripted transport), ADR-0073, ADR-0137, ADR-0236, ADR-0240, ADR-0241, `.claude/docs/references/agent-model.md`, persona manifest work (.sdlc/tickets/.0012-persona-manifest). Check how `produce()` decides its output today before designing.

## Constraints
No key printed or committed. Never hand-edit generated files (assets.gen.ts and friends: regenerate). Ratification: ADRs from this change may be ratified under Kim's standing grant, reported after. Imports inward only. Commit in worktrees; PRs merge on CI green plus verifier pass.

## Decisions
- 2026-10-09 (Kim, /ask): live KPIs. Land the eval leg and labelled set first as its own step and PR; the conductor then runs the live leg once on main (baseline) and once on the built branch (result), both under a hard cap of 2 USD total, key only through the script own path, never printed or committed. Anything beyond the cap stops and asks.

## Plan review
plan review: replan: .sdlc/0060-response-type-selection/plan-reviewer-L1.md
plan review: replan: step 8: acceptance criteria: the override kit scenario cannot discriminate. The Do says the scenario "shows the `render_surface` call recorded as `unavailable`", but no scenario expectation can see that record: `expect.tools` is `{ tool, input }[]` with no result field, and the judge compares only calls that reached a scripted-tools executor, never the provider's own `unavailable` record; `heal` and `verdict` assert parse and validator outcomes, not line counts or surface absence. A `render_surface` call that produce() captures (tool NOT withheld) also never reaches scripted-tools, so `expect.tools: []` plus `expect.produce.outcome: 'first-pass'` pass both when the override works and when it is ignored. The fix (a `result` arm on `expect.tools`, or a surface-absence expectation) lives in `tools/testkit/scenario.ts`, `producer-leg.ts` and the judge, outside the step's scope criterion, so the builder cannot make the scenario bite as written; the PRD names this scenario as K5 evidence. The planner picks: widen step 8's scope to the kit format, or drop the override scenario and let step 4's `user override` describe and the agent-eval `response-type-text-override` turn carry K5. Evidence: `packages/agent-ui/a2ui/tools/testkit/scenario.ts:93-100` (`heal?: { ok, repairs? }`, `verdict?: { valid, failures }`, `tools?: { tool: string; input: Record<string, unknown> }[]`); `packages/agent-ui/a2ui/tools/testkit/producer-leg.ts:49-50,59,71` (`toolCalls: scripted.calls`, dispatch `{}` when the scenario declares no tools) and `:106-108` (`judgeProduce` compares `result.toolCalls` by name and input only); `packages/agent-ui/a2ui/tools/testkit/scripted-provider.ts:14-24` (`ProviderToolCall.result` `unavailable` lives on the provider, which the judge never reads); plan step 8 scope criterion allows only `tools/testkit/scenarios/response-type-*.scenario.json` under testkit; `.claude/docs/prd/response-type-selection.prd.md:60` (K5 row names `response-type-override`).
plan review: replan: step 7: notes-fix: `site/lib/plan-runner.ts` does not track the note today: `drainTurn` drops every `note` arm and `TurnOutcome` has no note field, so the four `appendAssistantTurn(session, outcome.content)` calls need `drainTurn` to capture `meta.a2uiMeta.note` into `TurnOutcome` first (same file, in scope). Evidence: `site/lib/plan-runner.ts:215-222` (`continue // note/ask/trace/plan are never ingested as content`), `:407,426,480,489`; the Do's "each already tracks the note it read through `readMetaLine`" holds for `admin-live-runner.ts:290-291`, `a2ui-chat.ts:229`, `a2ui-live.ts:766,784`, `devtools-harness.ts:343`, `gen-ui-live.ts:425,439`, not for plan-runner.
plan review: replan: step 6: notes-fix: "the request body type gains optional `responsePreference` and `prefers`" means the inline produce-route body types at `dev-proxy-plugin.ts:371-384` and `worker/index.ts:222-235`; `chat-validation.ts` gains only `validateResponsePreference` (its `isChatBody` at `:194-213` types the `/chat` prose arm, which bypasses `produce()` and is out of scope per LLD section 1). Evidence: `packages/agent-ui/a2ui/tools/agent/chat-validation.ts:194-213`; `packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts:371`; `packages/agent-ui/a2ui/tools/agent/worker/index.ts:222`; `.claude/docs/lld/response-type-selection.lld.md:10`.
plan review: replan: step 5: notes-fix: the K6 probe also prints `pref('text').text.length + JSON.stringify(renderSurfaceTool([])).length` and `pref('surface')` likewise, and both stay at or under 46,400, since PRD section 6 counts the tool, the teaching and the preference paragraph together. Evidence: `.claude/docs/prd/response-type-selection.prd.md:61` ("for the tool definition, the teaching and the preference paragraph together"); plan step 5 criterion computes `total` from `base.text.length` only.
plan review: replan: step 2: notes-fix: write every import in `response-type.ts` on one line; the import-purity criterion matches `^import .*$` per line, so a multi-line `import type {\n...\n} from './agent-transport.ts'` reds it even when correct. Evidence: plan step 2 criterion `re.findall(r'^import .*$', s, re.M)` requires each matched line to contain `agent-transport.ts`.
plan review: replan: plan: scope: the step file lists are not disjoint, unlike `breakdown.md:3` ("One writer per file: the file lists below are disjoint"): steps 1 and 8 both write `tools/agent-eval/{observe,legs,eval-agent-behavior}.ts`, `legs.test.ts`, `fixtures/scripted-turns.json`, `fixtures/pins.json`; steps 4 and 5 both write `src/agent/produce.ts`, `src/agent/meta-line.ts`, `src/live-agent/produce-response-type.test.ts`. Safe only because every `Depends on` line makes the order strictly sequential (1 then 8; 4 then 5); none of these pairs may be built in parallel. Evidence: plan steps 1, 4, 5, 8 Do and scope criteria; `.sdlc/0060-response-type-selection/breakdown.md:3,7`.
plan review: replan: plan: scope: SPEC RTS-R7 is left contradicting the code from step 4 until step 9 (step 4 implements the `responsePreference`/`prefers` split while `response-type-selection.spec.md:67` still says `ProduceOptions.responsePreference` threads to the prompt); the repo rule is that the record is repaired in the same change. No builder blocks on it, so it does not force the verdict. Evidence: `.claude/docs/spec/response-type-selection.spec.md:67`; plan step 4 "Settled decisions" and step 9 Records; root `CLAUDE.md` "Stale context is a defect".

## Notes
Plan-review notes-fix items for the builders (plan-reviewer-L1-2.md, verdict pass):
- step 1: the RTS-R6 SPEC edit also changes the signature to `detectUserOverride(input: TurnInput)` (LLD and step 2 already use it); before reporting run step 9's em-dash check over this step's own diff plus untracked files and quote its exit code (the PR merges before step 9 and doc_lint has no em-dash rule).
- step 7: write each `appendAssistantTurn(` call on a single line (the criterion matches per line).
- LOOSE END (fix-now, from the step 2 verifier): the SPEC RTS-R6 lexicon over-triggers on ordinary prompts. Forces surface wrongly: "show me the capital of Finland", "Can you render my resume summary?", "what is a Render farm", "How do I build a house", "Please make me a sandwich recipe", "the render() function". Forces text wrongly: "tell me a story in words of one syllable". Fix in the Loose ends step after step 8: tighten the lexicon (for example a surface noun must follow "show me" / "make me" / "build", and drop bare "render" and "in words") in SPEC RTS-R6 and response-type.ts, with these seven phrases as red-now tests and "show me the plans as a table" still giving surface.
scope widened: step 4: packages/agent-ui/a2ui/src/live-agent/mcp-enablement.test.ts (explicit file list via steps.py widen --reason; render_surface offered on every a2ui-enabled turn changes the exact req.tools asserted on the produce arm)
scope widened: step 4: packages/agent-ui/devtools/src/transports/replay.test.ts (explicit file list via steps.py widen --reason; one fixture line for the new textDelta arm)
- cosmetic (step 6 verifier): in worker/index.ts the new spreads sit on the effort line, so its trailing comment reads as covering all three; move the comment in the Records step.
- note (step 7 verifier): the agent-admin.ts branch mapping a text-delta event to handle.textDelta has no direct test; add one in the Records step if cheap.
- RESIDUAL (step 10 verifier, for step 9 to record in the PRD and ADR-0242 as a known limitation): surface nouns that are also ordinary words still force a surface within four words: "build a list of reasons", "make me a table of contents", "show me the list of files in my home folder", "show me how a table join works", "show me what a card game looks like", "build a wizard character". Not caught: "show me a diagram", "Build me a form". Decide at close-out whether to tighten further.
- DECISION 2026-10-09 (Kim, AskUserQuestion): ship with the 6 carried em-dash lines (pre-existing on origin/main; verified by the step 9 L3 verifier). Not new text.

## Closed

2026-10-09: Merged in #1876, #1877, #1878, #1879. Live result: first line p50 3.4s to 1.0s, but missed-surface 8/20; follow-up T-0061

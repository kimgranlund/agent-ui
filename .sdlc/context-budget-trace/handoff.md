---
id: T-0003
title: "Per-turn context budget, assembled-prompt trace and provider usage (GH #1809, #1797)"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L
priority: P2
depends: [file:packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts, file:packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts]
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Make each turn report what it assembled and what the provider billed: a declared whole-prompt budget with a structured over-budget result (never silent truncation), prompt-section sizes on `TurnTrace`, and token usage from the provider on the trace and the devtools timeline. Tracks GH #1809 and the token accounting remainder of GH #1797.

## Intent
- Do: budget report, section trace, provider usage events, devtools surface, every doc on the scrub list.
- Non-goals: truncating prompts, retrieval by family (separate), hard-coding prices, any change to the composed prompt bytes.
- Done when: the acceptance outline passes, the scrub list is fully applied, and an independent verifier passes each step.

## Context (verified against the working tree by a read-only agent, 2026-10-05; re-verify what you rely on)
- `TurnTrace` (`packages/agent-ui/a2ui/src/agent/meta-line.ts:84`) has `turnIndex, query, exemplarIds, rounds, healed, failureCodes, model`; no byte, token, section or usage field. Assembled by `traceFor` (`produce.ts:977`, called at `produce.ts:1143` and `1238`).
- `buildSystemPrompt` (`system-prompt.ts:399`) concatenates grammar, `## Available components`, functions, few-shot, mini-skills, genui, authoring, mission, persona; `produce.ts` builds it once per turn outside the round loop (about line 966), so per-section sizes can be captured there.
- Provider usage is dropped: `parseAnthropicSSE` (`providers/anthropic.ts:113-141`) forwards `message_start` as `{kind:'message_start'}` and reads only `stop_reason` from `message_delta`; no `usage` anywhere. `ProviderEvent` (`agent-transport.ts:100`) has no usage member.
- Devtools `turn-end` is `{status, lines, ms}` (`packages/agent-ui/devtools/src/timeline/events.ts:68`); `DEVTOOLS_EVENT_KINDS` is closed (`events.ts:30`); `turn-end` validated in `capture/format.ts:79`. The trace already flows into the timeline inside `meta` events (`events.ts:130`).
- Budget today: `SELECTION_GUIDANCE_CHAR_BUDGET = 8_600` (`selection-guidance.ts:239`), enforced by `prompt-drift.test.ts:153`, not at runtime. Whole-prompt size is pinned only as exact bytes by `prompt-equivalence.baseline.json`.
- Unverified: Anthropic usage field shapes and any prices (check with the claude-api skill; never hard-code prices).

## Design forks (the architect settles these; forks 2, 4, 6 need Kim)
1. Budget unit: recommend characters, tokens reported after the fact from provider usage (no zero-dep tokenizer).
2. Over-budget behavior: recommend a structured `PromptBudgetReport {limit, total, sections[], over}` and a trace flag; whether a hard budget halts the turn is Kim's call.
3. Scope: a budget per prompt family (default, derived), declared beside `SELECTION_GUIDANCE_CHAR_BUDGET`.
4. Usage seam: recommend an optional `usage` event on `ProviderEvent` summed across rounds and tool rounds onto `TurnTrace.usage`. This extends the ADR-0073 provider seam: needs Kim.
5. Cost: token counts only; cost computed in the devtools or site layer from an injected rate table.
6. Trace location: optional additive fields on `TurnTrace` (`prompt: {chars, sections}`, `usage?`), but `TurnTrace` is the ADR-0088 wire contract: ADR or amendment needed (next free number likely 0233, unchecked).
7. Keep prompt bytes unchanged so `prompt-equivalence.baseline.json` is not recaptured.

## Constraints
`meta-line.ts` stays zero-dep and pure; devtools must not import a provider (`layering.test.ts`); provider-agnostic seam, no keys or `produce()` in devtools (ADR-0073); no silent truncation; no prompt byte change (if one happens, the deliberate recapture flow in skill `a2ui-prompt-authoring`); ADR-0232 gets append-only notes at most; no em dashes.

## Scrub and upsert list (done in the same change; historical ADRs and dated reports stay)
- `.claude/docs/spec/a2ui-live-agent.spec.md`, `.claude/docs/lld/a2ui-live-agent.lld.md` (LLD-C3, TurnTrace entry): new trace fields, budget report.
- `.claude/docs/spec/devtools-harness.spec.md` (SPEC-R7, about lines 115-125): timeline payload additions.
- `.claude/docs/spec/a2ui-chat.spec.md`, `.claude/docs/lld/a2ui-chat.lld.md`, `.claude/docs/lld/app-surfaces-m2.lld.md`: only if they restate the TurnTrace field list. `.claude/docs/spec/genui-surface.spec.md`: likely no change.
- `.claude/skills/a2ui-jsonl-mcp/references/record-and-replay.md` (event list, about line 37); `producer-order-and-yield.md` (about line 22), probably no change.
- `.claude/skills/a2ui-prompt-authoring/SKILL.md` (about lines 56-59): add the whole-prompt budget gate beside the selection-guidance one.
- `packages/agent-ui/a2ui/AGENTS.md` and root `AGENTS.md` (the gates line): add the budget gate if it becomes a standing rule.
- `.claude/docs/references/agent-model.md`: one glossary line. `selection-guidance.ts` doc comment (about lines 227-239): cross-reference. `.claude/docs/roadmap.md` and `plan.md`: check for #1797 or #1809 entries.
- New ADR (proposed, never self-ratified) or an amendment for the `TurnTrace` and provider-seam changes.

## Dependencies and conflicts
- Blocked until PRs #1805 and #1806 merge (both edit `providers/anthropic.ts`); the `depends` file entries above are met once `anthropic-timeouts.test.ts` and `anthropic-retry.test.ts` exist on main. Rebase after.
- Same-doc contention: `a2ui-live-agent` SPEC/LLD and `a2ui-prompt-authoring` are also touched by T-0004's prompt path (if any), the no-barrels and registry work, and the behavior-evals ticket. Order: this ticket lands its SPEC/LLD edits first; later tickets rebase on them.
- No conflict with #1804 or gap (b) (`tool-dispatch.ts`).

## Size and lane
L, due-process four-phase loop (size:big). Architect first (forks 2, 4, 6), then two planner-M slices: A = budget report plus trace prompt fields; B = provider usage, `TurnTrace.usage`, devtools surface.

## Acceptance outline
- Red then green: a test that `parseAnthropicSSE` extracts `usage` from `message_start` and `message_delta` (fails now).
- Red then green: a scripted multi-round `produce()` turn yields `TurnTrace.usage` as the sum across rounds, absent when the provider reports none.
- Section sizes sum to the built prompt's `length`; an over-budget fixture returns a structured result and the prompt is unchanged.
- `prompt-equivalence` baseline byte-unchanged; `prompt-drift` green; devtools capture round-trip passes with new fields and an old capture still parses; `layering.test.ts` green; `npm run check` and the a2ui and devtools package tests exit 0.
- Every scrub-list item applied in the same change; `doc_lint` passes.

## Architecture and decisions (Kim, 2026-10-05)
Architect L1 done: `.sdlc/context-budget-trace/architect-L1.md` (read it fully; manifest and report in `decompose/`). Kim's answers: fork 2 report-only by default, halt opt-in via `ProduceOptions.promptBudget.mode`; fork 4 yes, an optional `usage` kind on `ProviderEvent`, one event per upstream request at `message_stop`; fork 6 a new proposed ADR-0234 (never self-ratified), not an amendment of ADR-0088. Slices (one writer per file): S0 serial prep (meta-line types, ProviderEvent kind, ADR-0234 proposed), A (system-prompt sections, prompt-budget, produce wiring incl. usage sum, drift gate, barrel export), B1 (anthropic adapter; the only slice blocked on PRs #1805 and #1806, rebase after them), B2 (devtools events and format) in parallel with B1, then D serial docs scrub. ADR-0233 belongs to no-barrels; this ticket's ADR is 0234.

## Plan review
- builder block: step 1: plan defect: three existing stream-equality pins (`a2ui-surface-toggle.test.ts:199`, `genui-exclusive.test.ts:95`, `produce-loop.test.ts:1372`) compare two `produce()` runs differing only in a prompt-composition gate, and now differ in `trace.prompt` section sizes. Two are outside the step's edit list; step 7's claim that only `produce-loop.test.ts:903` pins the trace is wrong. Replan: widen the edit list to all three and compare streams with `trace.prompt` stripped (one approach for all three). Builder work is left in the tree at base-sha; keep `prompt` always attached.
- dependency block: step 3: lane lacked #1805/#1806/#1819; conductor committed steps 1-2 as a wip commit, rebased onto origin/main (dce7f6fe), superseded step-3, rebuilt same plan step at L3 (no plan defect)

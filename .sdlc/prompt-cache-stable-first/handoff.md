---
id: T-0206
title: "Producer prompt caching: stable-first system blocks with a cache_control breakpoint"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The producer sends `system` as one content-block array ordered stable-first (grammar, components, functions, then the rest), with a `cache_control` ephemeral breakpoint after the last stable section, so repeat turns of one agent read the prefix from cache. A second identical-config turn shows `cache_read_input_tokens` > 0 in the trace.

## Context
Evidence: T-0205 map `.sdlc/runtime/tasks/context-archaeology/archaeologist-L1.md`. Ticket A of the five routing-stability tickets Kim approved 2026-10-14.
- `system` is one plain string today: `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts:451`; no `cache_control` anywhere in packages, site or scripts.
- Section order: `system-prompt.ts:450-488` (grammar, components, functions, few-shot, mini-skills, genui, authoring, mission, response-preference, persona). Few-shot and mini-skills vary per turn, so the breakpoint goes after functions; move genui, authoring and mission ahead of the volatile sections only if the prompt-equivalence baseline flow (skill a2ui-prompt-authoring) allows it.
- Cache usage is already read at `anthropic.ts:110-111`; T-0185 carries the per-model cache TTL row: use it.
- Keep the persona block last (ADR-0138 precedence sentence).

## Done when
- A unit test on the request body shows the block array and exactly one breakpoint after the stable prefix.
- One live two-turn probe (`npm run chat:probe`, Haiku 5.5) shows cache reads on turn 2. Spend under $1.
- `npm run check` plus the touched a2ui agent tests.

## Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-cache.test.ts` exits 0: the body sends `system` as a block array with exactly one `cache_control` breakpoint whose block ends at the functions section, the blocks join to the composed prompt, the persona sits in the uncached tail, and a second turn after a surface opened sends identical tools and the same cached prefix.
- `npx vitest run --project packages packages/agent-ui/a2ui` exits 0, including the prompt-equivalence baseline (recaptured once for the grammar.md phrase "the user turn lists the open surfaces").
- `npm run check` exits 0.
- A live two-turn Haiku 5.5 `npm run chat:probe` (no override phrase on turn 2) shows `cacheReadInputTokens` > 0 on turn 2 in `.agent-traces/`, spend under $1.

## Constraints
No em dashes. Never hand-edit generated files; rerun their scripts. Live spend only through `chat:probe` under the stated cap.

## Lane verify scope (conductor)
One batched verifier for this lane (Kim's ruling: one verifier per bundle). Verify this handoff AND each of these, criterion by criterion, in the same tree; give one verdict per ticket under Criteria and one overall Verdict:
- .sdlc/prompt-budget-real-presets/handoff.md

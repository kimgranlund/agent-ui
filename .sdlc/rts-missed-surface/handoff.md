---
id: T-0061
title: "response-type selection: the model skips render_surface too often on Haiku 5.5 (missed-surface 8/20, K2 bound 10%)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-09
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
On Haiku 5.5 the built response-type loop (T-0060, #1879) picks the right type for at least 90% of the 43 labelled prompts, with missed-surface at most 10% and false-surface at most 5%, without losing its speed gain.

## Intent
- Evidence (live, Haiku 5.5, 43 cases): baseline on the old loop: 42/43 right, false-surface 1/23, missed-surface 0/20, first line p50 3.4 s. Built loop: 35/43 right, false-surface 0/23, missed-surface 8/20, first line p50 1.0 s, repair rounds 0 (was 8). Full outputs: `.sdlc/response-type-selection/live-baseline.txt` and `live-result.txt`.
- The 8 misses (expected surface or both, answered in text only, no tool call): surface-compare-phones, surface-checkout-steps, both-explain-compound-interest-table, both-compare-languages-explain, both-trip-plan, both-recipe, both-workout-intro-plan, session-both-explain-and-update. Zero were repaired or halted: the model simply answered in prose.
- Do: find why (read `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` as rewritten in T-0060 step 5, the `render_surface` tool description in `src/agent/response-type.ts`, the preference paragraphs, and how an old-style tool-less turn differed) and fix the teaching with the smallest change: a clearer when-to-call rule plus two or three short examples (a comparison, a multi-step input, "explain and show a table" = both), and a tool description that says a structure the user must scan, compare, fill in or act on belongs in a surface. Do not make text lose: the 23 text cases must stay text (false-surface <= 5%). Consider whether `tool_choice` or an `auto` default needs changing only if prompt wording cannot fix it, and say so rather than doing it.
- You may NOT run the live leg or read any key. The conductor runs the live checks on your branch: after your keyless work, report, and the conductor runs the 8 failing ids alone (cheap) then the full set once. Expect up to two rounds.
- Non-goals: new components, the lexicon, the admin UI, devtools.
- Done when: `npm run check` and the touched tests exit 0; the prompt-equivalence baseline recaptured once via the documented flow (skill a2ui-prompt-authoring) if grammar.md changes; K6 probe still at or under 46,400; generated files regenerated, never hand-edited; no new em dash text (carried legacy lines excepted); PRD K1/K2/K3-TTFT Result cells filled from the live results after the conductor's runs.

## Context
T-0060 spec/prd/adr: `.claude/docs/{prd,spec,lld}/response-type-selection.*`, `.claude/docs/adr/0242-*.md` (draft). Eval leg: `packages/agent-ui/a2ui/tools/agent-eval/` (cases in `fixtures/response-type-cases.json`). Prompt skill: a2ui-prompt-authoring. The live leg costs about 1 USD per full run on Haiku 5.5; Kim capped this follow-up at roughly 1.5 USD more in total.

## Constraints
No key printed or committed. ADR-0242 stays proposed unless Kim rules otherwise (ratification of own-change ADRs is under his standing grant: report after). Commit in a worktree; PR merges on CI green plus verifier pass.

## Closed

2026-10-11: Merged in #1880; live result 42/43, missed-surface 1/20

---
id: T-0592
title: "The GAME_HUD_MISSING repair asks to resend ask-1 whole"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Round 21 cluster H closes: the GAME_HUD_MISSING repair asks the model to resend ask-1 whole, its createSurface included, beside the HUD.

## Intent
- Do: the hidden-state-checks.ts wording change the row below proposes. Keyless tests that fail on base with false-positive guards, and `--from-trace` replays of the failing runs (copy the r21 traces to a temp `.agent-traces/` and remove them after). Any new or changed model-read text (repair asks, finding messages, parse notes) is named in the report for a Fable review. Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0; `node scripts/measure-size.mjs` stays within budget (report the a2ui/agent size).

## Context
Round 21 report (`.sdlc/evals/rounds/2026-10-29-r21-pattern/report.md`, PR 2394; until it merges, read it at `../agent-ui.worktrees/T-0589-wave-w0589/.sdlc/evals/rounds/2026-10-29-r21-pattern/`). Kim approved these fixes 2026-10-29.

| H. The GAME_HUD_MISSING repair says "Keep ask-1 as it is", and the last round sends only `updateComponents` for ask-1, which the rejected round had created | 1: `smoke-negotiator-first-offer-haiku-2` (:46) | (b) check wording, with (c) model | r1 a note-only ask (SURFACE_CLAIMED), r2 ask-1 alone (GAME_HUD_MISSING, detail "Keep ask-1 as it is and, in this same answer, create the game's HUD surface"), r3 a text round with `createSurface` hud-1 but no `createSurface` ask-1, so SURFACE_NOT_CREATED on the last round degraded the turn to text and `no-surface-loss` fails on ask-1 and hud-1 | (b) check: the GAME_HUD_MISSING detail asks to resend ask-1 whole, its `createSurface` included, beside the HUD (the produce.ts:1417 "resend it" wording) | `packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts` (line 496) | `hidden-state-checks.test.ts` asserts the detail asks to resend the ask surface with its createSurface; replay of :46 | H1 |

## Constraints
No em dashes. No paid runs. Never rewrite a round archive. Never change grammar.md. Regenerate generated files with their scripts.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L3 (fable) · base: be8f9dae80e4
- Changed: The GAME_HUD_MISSING repair asks to resend ask-1 whole, closing round 21 cluster H
- Commits: none
- Check: 1 The new tests fail on base and pass after: pass
- Check: 2 The replays pass after: pass
- Check: 3 The a2ui suites, probe replays and `npm run check` exit 0: pass
- Check: 4 `node scripts/measure-size.mjs` stays within budget, report the a2ui/agent size: pass
- Check: 5 Any new or changed model-read text is named in the report for a Fable review: pass
- Follow-up: decide: scripts/e2e-admin/probe/replays/smoke-negotiator-first-offer-haiku-... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/produce.ts:1238: decide... -> notes.md

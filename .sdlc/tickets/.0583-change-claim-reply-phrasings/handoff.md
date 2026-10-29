---
id: T-0583
title: "CHANGE_CLAIM_IN_REPLY catches order and total phrasings"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Round 19 cluster Z closes: `CHANGE_CLAIM_IN_REPLY` catches a note-only reply that changes surface state in order and total phrasings such as "you've got ... in your order", "total is $" and "come down to $".

## Intent
- Do: widen the check's phrasing set as the row below proposes, keyless tests that fail on base with guards against false positives on plain informational replies, and `--from-trace` replays of the two failing runs.
- Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0.

## Context
Round 19 report (`.sdlc/evals/rounds/2026-10-29-r19-pattern/report.md`, PR 2386; until it merges, read it at `../agent-ui.worktrees/T-0581-wave-w0581/.sdlc/evals/rounds/2026-10-29-r19-pattern/`). Kim approved these fixes 2026-10-29.

| Z. A note-only say reply that changes surface state in wording `CHANGE_CLAIM_IN_REPLY` does not match ships with no surface update and no repair | 2: `reach-shopkeeper-cart-amount-haiku-1` (:124), `smoke-negotiator-first-offer-haiku-3` (:84) | (c) model, with a (d) producer heuristic gap | :124 r1 answers a `target: storefront-1` meta line and prose "You've got two Brass Desk Lamps in your order, at $68 each. Your cart total is $136."; no failure code, the turn ships note-only and `action-updates-surface` fails. :84 r1 answers a meta note targeting `ask-1` (the GameHud deal) "...I come down to $165, and not one coin lower..."; no code, no update. Running the `CHANGE_CLAIM_IN_REPLY` literal from `produce.ts` (line 1274) against both texts returns false (observed); it is true on :139 and :154's notes ("Added...") and on :43's prose, which is why those turns got CHANGE_CLAIMED. "'ve got ... in your order" misses the `is|are|'s|'re ... in your order` branch, and "total is $136" misses `comes to $`. | producer repair loop (heuristic) | `packages/agent-ui/a2ui/src/agent/produce.ts` `CHANGE_CLAIM_IN_REPLY`: add a `(?:'ve|have) got [^.?!]* in your (?:order|cart|basket)` branch, a `\btotal is (?:now )?\$?\d` branch, and a price-move branch (`(?:come|comes|coming) down to \$?\d`); the claim still needs a target surface and a say turn, so plain Q and A turns stay clean | a `produce-narration.test.ts` (or `produce-empty-repair.test.ts`) case per text: a scripted model answers :124's and :84's r1 text note-only with their targets, then a valid update: asserts r2 is forced to `render_surface` with CHANGE_CLAIMED; negatives: "Is there anything in your order you want to change?" and "Late check-out is possible until 13:00" stay unflagged | "Change claims in 'you've got', 'total is' and 'come down to' wording are sent back" (L1) |

## Acceptance criteria
1. `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-narration.test.ts` exits 0; its two T-0583 cases (four claim texts incl. :124's and :84's, six non-claims incl. the two the row names) fail on base where they should.
2. `npx vitest run scripts/e2e-admin/probe/replays/shopkeeper-haiku-cart-total-claim.test.mjs scripts/e2e-admin/probe/replays/negotiator-haiku-come-down-claim.test.mjs` exits 0; both fixtures come from `--from-trace` of 2026-10-29.jsonl :123,124 and :83,84 with round 1 verbatim and round 2 authored, and both tests fail on base.
3. `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0.
4. `npm run check` exits 0.
5. Model-read text unchanged: no diff under `packages/agent-ui/a2ui/src/agent/prompts/`; no round archive written.

## Constraints
No em dashes. No paid runs. Model-read text unchanged; never rewrite a round archive.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 219f14a51a91
- Changed: CHANGE_CLAIM_IN_REPLY catches order and total phrasings, closing round 19 cluster Z
- Commits: none
- Check: 1 produce-narration.test.ts exits 0 and its two T-0583 cases fail on base where they should: pass
- Check: 2 both replay tests exit 0, fixtures from the trace with round 1 verbatim, both fail on base: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 model-read text unchanged, no round archive written: pass
- Follow-up: note: the regex branch for "have got" excludes "nothing|no" and questions... -> notes.md

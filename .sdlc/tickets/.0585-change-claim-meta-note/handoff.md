---
id: T-0585
title: "The change-claim check also reads the reply's meta-line note"
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
Round 20 cluster Z closes: `CHANGE_CLAIM_IN_REPLY` also tests the peeled meta-line note, and catches "started your order".

## Intent
- Do: the produce.ts change the row below proposes. Keyless tests that fail on base with false-positive guards, and `--from-trace` replays of the failing runs (copy the r20 traces to a temp `.agent-traces/` and remove them after). Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0.

## Context
Round 20 report (`.sdlc/evals/rounds/2026-10-29-r20-pattern/report.md`, PR 2389; until it merges, read it at `../agent-ui.worktrees/T-0584-wave-w0584/.sdlc/evals/rounds/2026-10-29-r20-pattern/`). Kim approved this fix 2026-10-29.

| Z (recurrence). A note-only say reply whose prose claims the change in wording the regex misses ships unrepaired, although the meta-line note matches | 1: `smoke-shopkeeper-browse-and-add-haiku-2` (:43) | (c) model, with a (d) producer heuristic gap | :43 r1 prose "...so I've started your order on this same page. You can change the quantity below, and the total will follow." (regex false), meta note "Added the Brass Dome Table Lamp to your order." with `target: storefront-1` (regex true). `note = reply` at `produce.ts` line 1893 means only the prose is tested at line 2035. No code fired. | producer repair loop (heuristic) | `packages/agent-ui/a2ui/src/agent/produce.ts`: test `CHANGE_CLAIM_IN_REPLY` against the peeled meta-line note as well as the prose (the model's own declaration), and add a `\b(?:I['’]ve\|I have) started your (?:order\|cart\|basket)\b` branch; the claim still needs a say turn and a target surface | a `produce-narration.test.ts` case: a scripted model answers :43's r1 text (prose plus meta note plus target) note-only, then a valid update; asserts r2 is forced to `render_surface` with CHANGE_CLAIMED. A second case with the prose alone. Negatives: a meta note "Here are our lamps." with prose that claims nothing stays clean; "Shall I start your order?" stays clean. Then the :43 fixture replay as the end-to-end check | "A change claim in the meta-line note, or 'I've started your order', is sent back" (L1) |

## Acceptance criteria
1. `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-narration.test.ts` exits 0, and its T-0585 positive case (meta-note claim with neutral prose, leading and trailing meta line, "I've started your order", "I have started your cart") fails on base b8f022ba4 while the negatives ("Here are our lamps.", "Shall I start your order?", an untargeted meta claim) stay clean.
2. `npx vitest run scripts/e2e-admin/probe/replays/shopkeeper-haiku-started-order-claim.test.mjs` exits 0; its fixture comes from `--from-trace` of r20 :42,:43 with turn 1 round 1 verbatim and an authored round 2, and it fails on base.
3. `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0 (the lexicographer-haiku-guess-prose pin now also lists CHANGE_CLAIM_UNCORRECTED for the give-up's "The board now shows the result." meta note).
4. `npm run check` exits 0.
5. Model-read text unchanged (no prompt or hint string edited), no round archive written, no `.agent-traces/` left in the tree.

## Constraints
No em dashes. No paid runs. Never rewrite a round archive. Regenerate generated files with their scripts. Model-read text unchanged unless the ticket names it; any new model-read string needs a Fable review.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: b8f022ba437c
- Changed: The change-claim check also reads the reply's meta-line note and catches started your order, closing round 20 cluster Z
- Commits: none
- Check: 1 produce-narration.test.ts exits 0 and its T-0585 positive case fails on base while the negatives ...: pass
- Check: 2 shopkeeper-haiku-started-order-claim replay exits 0, fixture from r20 :42,:43 with turn 1 round 1...: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0 incl. the lexicographer pin: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 Model-read text unchanged, no round archive written, no `.agent-traces/` left: pass
- Follow-up: note: produce.ts metaNote is set only when a text or capture reply... -> notes.md

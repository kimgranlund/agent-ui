---
id: T-0578
title: "An unparseable forced-repair round keeps its repair ask and the forced render_surface"
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
When a forced repair round (CHANGE_CLAIMED and the other forced asks) comes back non-empty but unparseable and a round is left, the next round is still forced to `render_surface` with the original repair ask plus the parse location, so cluster R from live round 18 closes.

## Intent
- Do: the producer repair-loop fix in `packages/agent-ui/a2ui/src/agent/produce.ts` (near line 2086, where T-0499 and T-0501 keep a forced repair only for an empty round), the scripted keyless case in `produce-empty-repair.test.ts`, and a fixture re-derived with `--from-trace` from the round 18 trace (`smoke-shopkeeper-browse-and-add-haiku-2`, trace lines :42 and :43), as T-0498 did.
- Non-goals: prompt or grammar text; the last round stays plain PARSE as today.
- Done when: the new test fails on base and passes after; the replay of the failing trace passes after; the a2ui suites, the probe replay suites and `npm run check` exit 0.

## Context
Round 18 report (`.sdlc/evals/rounds/2026-10-29-r18-pattern/report.md`, PR 2381; until it merges, read it at `../agent-ui.worktrees/T-0572-wave-w0572/.sdlc/evals/rounds/2026-10-29-r18-pattern/`), cluster R row:

| R. A forced CHANGE_CLAIMED repair round that comes back unparseable is filed plain PARSE, so the last round loses the repair ask and the forced `render_surface`, answers note-only, and the change ships tallied CHANGE_CLAIM_UNCORRECTED with no surface | 1 failed run: `smoke-shopkeeper-browse-and-add-haiku-2` (:42, :43) | (c) model, with a (d) producer repair-loop gap | :43 r1 ("Add the first one to my order.") answers a `target: storefront` meta line and a note only, so CHANGE_CLAIMED fires (a forced repair). r2 calls `render_surface` with `messages` as a string holding the right repair (the storefront plus an `order` ConfirmReceipt) but one closing brace short after the `updateComponents` message (`JSON.parse` fails at position 2028), so the turn files PARSE. r3, the last round, gets the PARSE ask unforced and returns the same meta line and note; `changeClaimFedBack` is already set, so the claim ships tallied and the probe sees no update to `storefront`. T-0499 and T-0501 keep a forced repair's ask only for an empty round (`raw.trim() === ''`, `produce.ts` near line 2086); an unparseable non-empty round falls through to plain PARSE. | producer repair loop | `packages/agent-ui/a2ui/src/agent/produce.ts`: when `forcedRepair` is set and `assembleFromRaw` fails on a non-empty round while a round is left, keep the failure being repaired plus a PARSE failure carrying `parseNote`, and keep `forceSurfaceRound` and `forcedRepairPending`, so the next round is still forced to `render_surface` with the original ask and the parse location. On the last round it stays PARSE as today. | a `produce-empty-repair.test.ts` case whose scripted model answers r1 note-only with a change claim (CHANGE_CLAIMED), r2 a `render_surface` whose string `messages` is :43 r2's (one brace short), and r3 a valid update: asserts r3's request forces `render_surface` and its feedback names CHANGE_CLAIMED and the parse location, and the turn ships the ConfirmReceipt; the negative is today's code, where r3 is unforced with a PARSE-only ask. Plus a fixture re-derived from :43 with `--from-trace` (as T-0498 did) | "An unparseable forced-repair round keeps its repair ask and the forced render_surface" (L2) |

Kim approved the fix 2026-10-29.

## Constraints
No em dashes. No paid runs. Never rewrite a finished round archive. Model-read text unchanged.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-empty-repair.test.ts` exits 0; its T-0578 case (r3 forced to render_surface, feedback naming CHANGE_CLAIMED and the parse location, ConfirmReceipt shipped) fails with base `produce.ts`.
- `npx vitest run scripts/e2e-admin/probe/replays/shopkeeper-haiku-repair-parse-keeps-ask.test.mjs` exits 0: the fixture derived with `--from-trace` from 2026-10-29.jsonl:42,43 shows the forced r3 ask, and an authored r3 ships the order with every probe check green.
- `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
- Model-read text unchanged: the diff adds no string the model reads.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: ff5ebf0daa41
- Changed: An unparseable forced-repair round keeps its repair ask and the forced render_surface, closing round 18 cluster R
- Commits: none
- Check: 1 produce-empty-repair.test.ts exits 0 and its T-0578 case fails on base: pass
- Check: 2 shopkeeper-haiku-repair-parse-keeps-ask.test.mjs exits 0, fixture from --from-trace of :42,43: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 Model-read text unchanged: pass
- Follow-up: note: redck.py deviations printed no process deviation: lines for this... -> notes.md
- Follow-up: note: the last-round leg plain PARSE, failureCodes... -> notes.md

---
id: T-0588
title: "Heal moves a stray envelope surfaceId into its op"
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
Round 20 cluster S, part 2: the heal step moves an envelope-level `surfaceId` into the one op object that lacks it, and names the repair.

## Intent
- Do: the closed-list arm in `packages/agent-ui/a2ui/src/corpus/heal.ts` the row below proposes; record Kim's ruling that widens the ADR-0061 closed list in the owning reference or the heal module's doc (ADRs stay frozen); the negative where envelope and op `surfaceId` disagree stays for SCHEMA. Keyless tests that fail on base with false-positive guards, and `--from-trace` replays of the failing runs (copy the r20 traces to a temp `.agent-traces/` and remove them after). Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0.

## Context
Round 20 report (`.sdlc/evals/rounds/2026-10-29-r20-pattern/report.md`, PR 2389; until it merges, read it at `../agent-ui.worktrees/T-0584-wave-w0584/.sdlc/evals/rounds/2026-10-29-r20-pattern/`). Kim approved this fix 2026-10-29. Kim ruled 2026-10-29 to widen the ADR-0061 closed heal list with this one arm.

| S. "What services could I add" spends the 3-round bound: r1 hand-builds priced DescriptionList rows (PRODUCT_CARD_MISSING) or fails PARSE, the next round fixes that, and the last round carries a message-local slip, so the turn degrades to text and the surface it created is lost | 2: `regress-concierge-facilities-then-tour-haiku-2` (:61), `-3` (:98) | (c) model, with an (a) catalog contract gap and a (d) heal gap | :61: r1 PRODUCT_CARD_MISSING `stay-services:spaList`; r2 sends text-channel JSONL with dangling ids (IDGRAPH, CONTAINMENT, SURFACE_NOT_CREATED); r3 sends the ProductCard Grid, but its `updateDataModel` has `surfaceId` beside the op instead of inside it: `validate-payload.ts` on r3's messages exits 1 with `SCHEMA [1].updateDataModel.surfaceId` (observed). :98: r1 PARSE, r2 PRODUCT_CARD_MISSING `stay-services:list`, r3 templates `ProductCard` with `actionLabel: {path: "actionLabel"}`: `validate-payload.ts --catalog agent-ui--hospitality` exits 1 with `CATALOG service-card.actionLabel` (observed). In `catalog/default/catalog.json` ProductCard's `title`, `price` and `priceNote` are `bindable: true` and `actionLabel` is not. The same binding also failed `long-concierge-spa-services-haiku-3` r2 (`CATALOG tmpl.actionLabel`, saved), so it is 2 fires this round. `git grep surfaceId packages/agent-ui/a2ui/src/corpus/heal.ts` finds no heal arm for a misplaced `surfaceId`. Both final turns ship SURFACE_DEGRADED. | catalog contract (S1), heal arm (S2) | S1: `packages/agent-ui/a2ui/src/catalog/default/catalog.json` ProductCard `actionLabel` (mark it `bindable: true` like its siblings, with the descriptor and renderer reading a bound value). S2: `packages/agent-ui/a2ui/src/corpus/heal.ts`, a closed-list arm (ADR-0061) that moves an envelope-level `surfaceId` into the one op object that lacks it | S1: `validate-payload.ts` on :98 r3's three messages with `--catalog agent-ui--hospitality` goes from exit 1 to exit 0, plus a catalog conformance case binding `actionLabel` in a templated Grid. S2: a `heal.test.ts` case from :61 r3's `updateDataModel` message heals to a valid op with the repair named; negative: a message whose envelope and op `surfaceId` disagree is left for SCHEMA | "ProductCard actionLabel binds like title and price" (L2); "Heal moves a stray envelope surfaceId into its op" (L2, needs Kim's word on widening the ADR-0061 closed list) |

## Constraints
No em dashes. No paid runs. Never rewrite a round archive. Regenerate generated files with their scripts. Model-read text unchanged unless the ticket names it; any new model-read string needs a Fable review.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
1. `npx vitest run packages/agent-ui/a2ui/src/corpus/heal.test.ts packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts` exits 0; the four `(e)` heal cases name the repair `surface-id-move`, the disagreeing-surfaceId negative heals to `changed:false` with the message untouched, and the two positive `(e)` cases plus the T-0588 produce-loop case fail on base b8f022ba4.
2. `npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-services-stray-surface-id.test.mjs` exits 0; the fixture comes from `--from-trace` of 2026-10-29.jsonl :57 to :61 with every round verbatim, and the test fails on base.
3. `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0.
4. `npm run check` exits 0.
5. Kim's 2026-10-29 ruling is recorded in the `corpus/heal.ts` header and the `a2ui-jsonl-mcp` heal reference; nothing under `.claude/docs/adr/` changed; no round archive written; no `.agent-traces/` left in the tree.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: b8f022ba437c
- Changed: Heal moves a stray envelope surfaceId into its one op, closing round 20 cluster S part 2
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/corpus/heal.test.ts packages/agent-ui/a2ui/src/live-ag...: pass
- Check: 2 `npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-services-stray-surface-id.test.mj...: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 Kim's 2026-10-29 ruling is recorded in the `corpus/heal.ts` header and the `a2ui-jsonl-mcp` heal ...: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/renderer/validate.ts:287 decide: tier-1... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/produce.ts:827 decide... -> notes.md
- Follow-up: decide: .sdlc/tickets/0588-heal-stray-envelope-surface-id/handoff.md:30... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/corpus/heal.test.ts:124-191 note... -> notes.md

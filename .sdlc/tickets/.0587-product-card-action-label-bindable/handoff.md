---
id: T-0587
title: "ProductCard actionLabel binds like title and price"
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
Round 20 cluster S, part 1: ProductCard `actionLabel` is bindable like `title` and `price`, so templated service rows validate.

## Intent
- Do: mark `actionLabel` bindable in `packages/agent-ui/a2ui/src/catalog/default/catalog.json` and wherever else ProductCard's catalog row is declared, update the descriptor and renderer to read a bound value, regenerate generated files, and add a conformance case binding `actionLabel` in a templated Grid; `validate-payload.ts` on the :98 r3 messages goes from exit 1 to 0. Keyless tests that fail on base with false-positive guards, and `--from-trace` replays of the failing runs (copy the r20 traces to a temp `.agent-traces/` and remove them after). Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0.

## Context
Round 20 report (`.sdlc/evals/rounds/2026-10-29-r20-pattern/report.md`, PR 2389; until it merges, read it at `../agent-ui.worktrees/T-0584-wave-w0584/.sdlc/evals/rounds/2026-10-29-r20-pattern/`). Kim approved this fix 2026-10-29.

| S. "What services could I add" spends the 3-round bound: r1 hand-builds priced DescriptionList rows (PRODUCT_CARD_MISSING) or fails PARSE, the next round fixes that, and the last round carries a message-local slip, so the turn degrades to text and the surface it created is lost | 2: `regress-concierge-facilities-then-tour-haiku-2` (:61), `-3` (:98) | (c) model, with an (a) catalog contract gap and a (d) heal gap | :61: r1 PRODUCT_CARD_MISSING `stay-services:spaList`; r2 sends text-channel JSONL with dangling ids (IDGRAPH, CONTAINMENT, SURFACE_NOT_CREATED); r3 sends the ProductCard Grid, but its `updateDataModel` has `surfaceId` beside the op instead of inside it: `validate-payload.ts` on r3's messages exits 1 with `SCHEMA [1].updateDataModel.surfaceId` (observed). :98: r1 PARSE, r2 PRODUCT_CARD_MISSING `stay-services:list`, r3 templates `ProductCard` with `actionLabel: {path: "actionLabel"}`: `validate-payload.ts --catalog agent-ui--hospitality` exits 1 with `CATALOG service-card.actionLabel` (observed). In `catalog/default/catalog.json` ProductCard's `title`, `price` and `priceNote` are `bindable: true` and `actionLabel` is not. The same binding also failed `long-concierge-spa-services-haiku-3` r2 (`CATALOG tmpl.actionLabel`, saved), so it is 2 fires this round. `git grep surfaceId packages/agent-ui/a2ui/src/corpus/heal.ts` finds no heal arm for a misplaced `surfaceId`. Both final turns ship SURFACE_DEGRADED. | catalog contract (S1), heal arm (S2) | S1: `packages/agent-ui/a2ui/src/catalog/default/catalog.json` ProductCard `actionLabel` (mark it `bindable: true` like its siblings, with the descriptor and renderer reading a bound value). S2: `packages/agent-ui/a2ui/src/corpus/heal.ts`, a closed-list arm (ADR-0061) that moves an envelope-level `surfaceId` into the one op object that lacks it | S1: `validate-payload.ts` on :98 r3's three messages with `--catalog agent-ui--hospitality` goes from exit 1 to exit 0, plus a catalog conformance case binding `actionLabel` in a templated Grid. S2: a `heal.test.ts` case from :61 r3's `updateDataModel` message heals to a valid op with the repair named; negative: a message whose envelope and op `surfaceId` disagree is left for SCHEMA | "ProductCard actionLabel binds like title and price" (L2); "Heal moves a stray envelope surfaceId into its op" (L2, needs Kim's word on widening the ADR-0061 closed list) |

## Constraints
No em dashes. No paid runs. Never rewrite a round archive. Regenerate generated files with their scripts. Model-read text unchanged unless the ticket names it; any new model-read string needs a Fable review.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `packages/agent-ui/a2ui/src/catalog/default/catalog.json` ProductCard `actionLabel` carries `"bindable": true`; ServiceCard and AmountPicker `actionLabel` stay non-bindable.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/conformance.test.ts packages/agent-ui/a2ui/src/catalog/default/index.test.ts packages/agent-ui/a2ui/src/renderer/product-card-action.test.ts` exits 0; the T-0587 conformance cases and the replays below fail with the base `catalog.json` and pass after; the two negative controls pass on both.
- `npx vitest run --project tools --project scripts packages/agent-ui/a2ui/tools scripts/e2e-admin/probe` exits 0, including `concierge-haiku-services-bound-action-label.test.mjs` (r20 :94 to :98) and `concierge-haiku-spa-bound-action-label.test.mjs` (r20 :107).
- `validate-payload.ts` on the :98 round 3 messages with `--catalog agent-ui--hospitality` exits 1 on base and 0 after.
- `npm run check` exits 0, and `npx vitest run --project packages packages/agent-ui/a2ui packages/agent-ui/components` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: b8f022ba437c
- Changed: ProductCard actionLabel binds like title and price, closing round 20 cluster S part 1
- Commits: none
- Check: 1 ProductCard actionLabel carries bindable true; ServiceCard and AmountPicker stay non-bindable: pass
- Check: 2 the three vitest files exit 0; T-0587 cases and replays red on base, green after; negative contro...: pass
- Check: 3 `npx vitest run --project tools --project scripts packages/agent-ui/a2ui/tools scripts/e2e-admin/...: pass
- Check: 4 validate-payload.ts on the :98 round 3 messages with --catalog agent-ui--hospitality exits 1 on b...: pass
- Check: 5 `npm run check` exits 0 and `npx vitest run --project packages packages/agent-ui/a2ui packages/ag...: pass
- Follow-up: note: factories.ts:1493 doc comment updated; no renderer change was... -> notes.md

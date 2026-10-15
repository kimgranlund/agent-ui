---
id: T-0240
title: "Domain exemplars: CardTable, BookingForm and BoardGrid examples the producer can retrieve, plus a preset-to-domain mapping"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0245]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: feat/domain-exemplars-plumbing
worktree: .claude/worktrees/wave-dx
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Each game and hospitality preset retrieves at least one exemplar of its own composite: a Croupier turn gets a CardTable round, the Concierge a BookingForm, and the Lexicographer and Admiral a BoardGrid.

## Context
Split from T-0238 (fix/exemplar-routing-off-domain), whose retrieval now filters by the turn's selected domains and ranks them first. Two blockers it found:
- Persona-fragment types (CardTable, BookingForm) cannot enter the agent-ui corpus shard: admission validates against the base catalog, and persona seeds are page fixtures only. Needs a per-catalog or per-domain shard, or admission against the composed catalog.
- BoardGrid admission needs an `a2ui-review-agent` verdict (corpus law), which a sub-agent cannot spawn; the conductor must dispatch the review.
- Lexicographer and Admiral are base-catalog presets with no domain, so they still match on vocabulary alone; a preset category to catalog domain mapping (or the W1 games domain) fixes that.
Round 2 evidence: T-0225 report; trace exemplar counts in T-0238.

## Done when
- The retrieve-presets pin test (from T-0238) shows a domain-composite exemplar in the top 3 for croupier, concierge, lexicographer and admiral.
- Corpus admission law holds (review verdict recorded per new record).
- npm run check plus corpus and agent tests exit 0.

## Conductor note (2026-10-15, Kim: split)
Blocked in lane E: all three candidate seeds failed review at 2. Seeds move to T-0245. T-0240 is resized to L3 and covers only the per-persona corpus shard plumbing (widen `SeedCatalogId`, `catalog-files.ts` loads `<base>--<persona>`, an `import-seeds` persona shelf, register persona catalogs in the corpus-data test, the 4 shard loaders, the `retrieve.ts` scope rule, drop the allowlist entry, re-pin 15 presets), then admits the T-0245 seeds. The lane's simulation: with the scope rule and the seeds, croupier, concierge and lexicographer each get a composite in their top 3.

## Conductor note (2026-10-15, after T-0245 #2011)
The four seeds are in `packages/agent-ui/a2ui/src/examples/domain-seeds.ts` (review verdicts in `.sdlc/domain-seeds/review-verdicts.json`, all 4). Admit them: add `domain-seeds.ts` to the importer's `SEEDS_BY_MODULE`. The T-0245 verifier found two properties no test covers: a seed that sends its data model with each action (`sendDataModel`), and the miss glyph (a cross, not a circle). Add tests for both while touching this path, with each test red when the property is removed.

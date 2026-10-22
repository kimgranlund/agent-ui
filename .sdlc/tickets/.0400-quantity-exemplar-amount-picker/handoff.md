---
id: T-0400
title: "Re-curate the product-options-quantity exemplar onto AmountPicker through the judged replace path"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The admitted `product-options-quantity` exemplar models its quantity with the AmountPicker the quantity mini-skill teaches (T-0196), so a quantity turn no longer retrieves a Field plus number TextField beside that mini-skill.

## Intent
- Do: change the seed at `packages/agent-ui/a2ui/src/examples/commerce-hospitality.ts` (about 140-142) to an AmountPicker for the quantity (per `prompts/mini-skills/quantity.md`), validate it, then re-admit it through the judged `import-seeds --replace product-options-quantity` path (ADR-0068 cl.5, skill a2ui-corpus-curation step 6) with a verdict from the a2ui-review-agent critic (obtained by the conductor); commit the verdicts archive with the shard; re-pin any retrieval test the change moves.
- Non-goals: other exemplars.
- Done when: the corpus tests, `npm run check` and the whole jsdom suite once exit 0; archive and shard land in one commit.

## Context
- Raised by the T-0196 verifier (`.sdlc/notes/notes.md:601`).
- Decided by the conductor under Kim's 2026-10-21 overnight goal.

## Constraints
- Admission only through the judged pipeline; no hand-written shard lines; no em dashes.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21
- Conductor: the verdict came from the a2ui-review-agent critic (PASS 4); the solo ran phase 1 (seed) and phase 2 (judged --replace) in one resumed session. Confirm the shard row matches the judged seed, the archive lands with it, and the index.json reorder is the tool's own output.

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 9914f9f926f1
- Changed: product-options-quantity re-curated onto AmountPicker and re-admitted through the judged replace path (PASS 4)
- Commits: 92d8ff8 T-0400: product-options-quantity re-curated onto AmountPicker through the judged replace path; archive with the shard
- Check: 1 Seed at commerce-hospitality.ts models quantity as an AmountPicker per quantity.md: pass
- Check: 2 Re-admitted through the judged `--replace` path with a critic verdict, no hand-written shard line: pass
- Check: 3 Verdicts archive committed with the shard, in one commit: pass
- Check: 4 index.json reorder is the tool's own output: pass
- Check: 5 Corpus tests: pass
- Check: 6 `npm run check` exit 0: pass
- Check: 7 Whole jsdom suite once exit 0: pass
- Check: 8 Scope (Non-goal: other exemplars): pass
- Follow-up: note: scratch dir... -> notes.md

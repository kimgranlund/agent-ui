---
id: T-0396
title: "Admit the six shelved seeds to the A2UI corpus through one judged run"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The six seeds shelved this wave (OptionDeck T-0193, ConfirmReceipt T-0195, AmountPicker T-0196, StepFlow T-0198, Itinerary T-0199, OptionCompare T-0393) are judged and admitted to the corpus in one judged run, so retrieval can rank them.

## Intent
- Do: follow skill `a2ui-corpus-curation` (procedure steps 3 to 7): one verdicts file graded by the `a2ui-review-agent` critic against `.claude/docs/rubrics/a2ui-corpus.md` (obtained by the conductor, since a sub-agent cannot spawn that critic), `import-seeds.ts --verdicts <file>`, back-score if the skill requires it, drain the "NO VERDICT SOUGHT YET" disposition-allowlist entries and the import-seeds.test.ts verdict stubs for the admitted seeds, commit the verdicts archive with the shard, and re-pin any retrieval test that ranked a seed as Known poor (T-0199's travel pin in retrieve-presets.test.ts).
- Non-goals: re-curating older corpus records (backable-wizard and the rest).
- Done when: the a2ui corpus tests (admission-coverage, import-seeds, every-catalog-coverage, retrieve-presets), `npm run check` and the whole jsdom suite once exit 0; the verdicts archive and the shard land in one commit.

## Context
- Each ticket above shelved its seed because a judged run needs a verdict for every pending shelf seed at once.
- Decided by the conductor under Kim's 2026-10-21 overnight goal ("you make the decisions while I sleep").

## Constraints
- Admission only through the judged pipeline (ADR-0068); no hand-written shard lines; no em dashes.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/corpus packages/agent-ui/a2ui/src/examples packages/agent-ui/a2ui/tools/corpus/import-seeds.test.ts packages/agent-ui/a2ui/tools/registry/generate.test.ts` exits 0.
- The six seeds are rows in `agent-ui.jsonl` (five) and `agent-ui--hospitality.jsonl` (the Itinerary), and `packages/agent-ui/a2ui/corpus/verdicts/2026-10-22--shelf-wave.json` is in the tree.
- `disposition-allowlist.ts` holds no "NO VERDICT SOUGHT YET" entry for the six seeds.
- `npm run check` and `npm test` exit 0.
- Conductor 2026-10-22: verdicts came from the a2ui-review-agent critic (first pass five PASS and StepFlow FAIL D1; the solo fixed the StepFlow seed: root Column wrapper, Field-wrapped Calendar; rejudged PASS 4). The solo's phase 1 and 2 were one resumed session; judge the seed fix too. Check that the admitted rows match the judged verdicts, the archive and shard land together, the re-pinned retrieval rows are measured (not hand-picked), and say whether the new Known-poor game rows (admiral, alchemist, dungeon-master pulling booking seeds) are a retrieval regression worth a ticket.

## Outcome

2026-10-21 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 05650993413d
- Changed: Six shelved seeds judged by the a2ui-review-agent critic and admitted in one judged run (StepFlow seed fixed and rejudged); verdicts archive committed with the shard
- Commits: ecae62c T-0396: admit the six shelved seeds through one judged run; verdicts archive with the shard
- Check: 1 corpus, examples, import-seeds and registry generate tests exit 0: pass
- Check: 2 six seeds are rows in the shards and the verdicts archive is in the tree: pass
- Check: 3 no "NO VERDICT SOUGHT YET" entry for the six seeds: pass
- Check: 4 `npm run check` and `npm test` exit 0: pass
- Follow-up: note: the retrieve-presets "Known poor" rows for admiral, alchemist and... -> notes.md

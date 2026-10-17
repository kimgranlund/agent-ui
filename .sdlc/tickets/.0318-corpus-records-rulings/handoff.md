---
id: T-0318
title: "Replace two corpus records that teach what the rulings forbid (frontier-booking-receipt, frontier-greet-card)"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The scored corpus records `frontier-booking-receipt` (a summary read back before confirming; T-0266 pre-filled BookingForm, T-0289 confirm) and `frontier-greet-card` (a Card around each starter choice; T-0172 one row of buttons) match Kim's rulings. Found by T-0307's sweep.

## Process
Per skill `a2ui-corpus-curation`: author the replacement, a fresh judged review (a2ui-review-agent, never self-graded), then `import-seeds --verdicts` with `--replace`.

## Done when
- Both records replaced through the judged quarantine exit with their verdict files; the corpus tests and `npm run check` exit 0.

## Acceptance criteria
- `node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts` exits 0 as the all-E_DUP no-op (96 already present): both replaced records are admitted and judged.
- `npx vitest run packages/agent-ui/a2ui/src/corpus packages/agent-ui/a2ui/tools/corpus packages/agent-ui/a2ui/src/examples` exits 0: the corpus shard gate, the defended retrieval pin prefixes, and the T-0318 case that two booking confirm phrasings on `agent-ui--concierge` and `agent-ui` do not retrieve `frontier-booking-receipt` (red on the pre-T-0318 shard).
- `node scripts/dogfood-compose.mjs --gate` exits 0 with the `catalog-frontier.ts#lone-button-frame` allowlist line removed.
- `npm run check` exits 0.

## Outcome

2026-10-17 · lane: full L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 946d95dc5ab6
- Changed: Receipt became a post-commit expense-claim receipt, greet a plain Row of buttons; confirm turns no longer retrieve the receipt (#2078)
- Commits: none
- Check: 1 import-seeds all-E_DUP no-op: pass
- Check: 2 corpus, tools/corpus and examples vitest exits 0: pass
- Check: 3 dogfood-compose gate with the lone-button-frame allowlist line removed: pass
- Check: 4 npm run check exits 0: pass
- Check: 5 Goal check (confirm turns no longer retrieve the receipt; receipt is post-commit with no read-bac...: pass
- Follow-up: decide: confirmation-view and backable-wizard still read back a booking... -> notes.md
- Follow-up: note: catalog-frontier.ts receipt record name stays... -> notes.md
- Follow-up: note: pins in retrieve-presets.test.ts now compare only a defensible... -> notes.md

---
id: T-0238
title: "Few-shot exemplar retrieval ignores catalog and domain: card games get booking and roster exemplars"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Few-shot exemplars match the agent's catalog and domain, as mini-skills already do (selectMiniSkills filters on catalogId and domain before ranking). A Croupier turn gets card-table exemplars, the Concierge gets booking exemplars, and the word and battleship games get board exemplars.

## Evidence (round 2 traces, wave-r2 .agent-traces/2026-10-15.jsonl, trace.exemplarIds)
- Croupier, 187 turns: frontier-round-outcome 73, booking-reservation 44, frontier-button-icon-actions 44, pattern-schedule-picker 43, agent-roster-drawer 41; no card-table exemplar.
- Concierge, 28 turns: travel-itinerary, listing-photo-grid, five-day-weather; no BookingForm exemplar.
- Base-catalog presets (Lexicographer, Admiral), 66 turns: agent-roster-drawer 26, restaurant-menu 24, agent-task-status 24, wallet-summary-card 18.
Likely a cause of composite non-use beside T-0208 and T-0231. Retrieval: produce.ts:1107-1122 (T-0205 map).

## Done when
- Retrieval filters (or hard-boosts) by catalog id and selected domain; a domain with no exemplar gets a fallback that is not a different domain's composite.
- A ranking-pin test: for each shipped preset and a representative user turn, the top 3 exemplar ids are pinned; it fails on today's code.
- Add a corpus exemplar where a domain has none (CardTable round, BookingForm, BoardGrid) if needed, via the a2ui-corpus-curation flow.
- npm run check plus the touched tests exit 0; prompt-equivalence baseline recaptured only through its flow.

## Lane note (conductor)
Parallel lanes: T-0208 (feat/composite-moment-checks: catalog/composite-moments.ts, compose.ts semantic-check wiring) and T-0230/T-0229 (fix/hidden-state-text-shape: Lexicographer and Admiral state, produce.ts text-shape parsing). Stay in exemplar retrieval and the corpus; if a change in produce.ts is unavoidable, keep it to the retrieval call and say so in the report.

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/corpus/retrieve.test.ts packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts` exits 0; the domain-rule block covers exclusion of another domain's composite, own-domain-first ranking, no zero-score fill, and a base turn keeping every record.
- `retrieve-presets.test.ts` pins the top 3 for all 15 shipped presets and fails (croupier, concierge, admiral) against `git show e20f10bf:packages/agent-ui/a2ui/src/corpus/retrieve.ts`.
- `npm run check` exits 0; `npx vitest run packages/agent-ui/a2ui/src/corpus packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent` exits 0 (no prompt-equivalence recapture needed).
- No `produce.ts` edit; no shard, record schema, or persona-seed change.
- Held: Done-when 3 (new CardTable, BookingForm, BoardGrid corpus exemplars) is not delivered: persona-fragment types cannot enter the agent-ui shard (admission validates against the base catalog, persona seeds are page fixtures only), and a BoardGrid admission needs an a2ui-review-agent verdict.

---
id: T-0240
title: "Domain exemplars: CardTable, BookingForm and BoardGrid examples the producer can retrieve, plus a preset-to-domain mapping"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
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

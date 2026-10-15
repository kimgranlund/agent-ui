---
id: T-0253
title: "Within the games domain, retrieval ranks a preset's own composite family first"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0240]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A games preset's exemplar top 3 leads with its own composite family: CardTable for croupier, BoardGrid for lexicographer and admiral, a quiz form for quizmaster. Boards from another game do not crowd a card table's turn.

## Context
Found by the T-0240 L3 verifier (`retrieve-presets.test.ts:35`): croupier "Deal again" ranks `domain-admiral-battleship-board` and `domain-lexicographer-word-board` 2nd and 3rd behind the CardTable, and quizmaster gets the same two first. The T-0238 games-domain rule ranks every games composite first, and nothing tunes by preset within the domain. Mentalist "Read my mind" ranks the word board first on vocabulary alone (`:44`). Kim filed it 2026-10-15 so live round 3 tests croupier with on-target examples.

## Done when
- `retrieve-presets.test.ts` pins: croupier's top 3 holds no BoardGrid; lexicographer and admiral keep their own board first; quizmaster's top 3 is not two boards. The pins are red on the current rule.
- `npm run check` exit 0.

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts packages/agent-ui/a2ui/src/corpus/retrieve.test.ts` exits 0; the T-0253 describe pins croupier's top 3 with a CardTable first and no BoardGrid, lexicographer and admiral with their own board first, and quizmaster with fewer than two BoardGrid records.
- With `retrieve.ts` reverted to the T-0238 rule, the croupier and quizmaster pins and both T-0253 family cases fail.
- The family rule applies to the games domain only: the concierge pin (`frontier-service-gateway` second) is unchanged.
- `npm run check` exit 0.

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged: games examples rank by the persona's own composite family; verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none

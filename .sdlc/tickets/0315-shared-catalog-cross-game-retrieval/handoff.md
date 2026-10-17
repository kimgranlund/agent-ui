---
id: T-0315
title: "Admiral and Lexicographer share the agent-ui catalog: 'New game' ranks the word board first on the Admiral's opening"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A game agent's turn never frames another game's exemplar, even when two personas share a catalog.

## Context
Found by the T-0313 solo (2026-10-16): the Admiral and the Lexicographer share the `agent-ui` catalog and retrieval queries only the turn text, so "New game" ranks the word-board exemplar first on the Admiral's opening, and any record gaining "play again" would show for both. The Croupier's domain exclusion (T-0238, T-0253) does not cover this pair. Separate catalog ids per persona is one option; a persona or domain filter in retrieval is another.

## Process
Per Kim's debate rule (2026-10-16): a proposer writes the options with costs, an adversary on another model family challenges them, Kim decides, then build. Status stays proposed until then.

## Debate
Proposal: .sdlc/runtime/tasks/0315-shared-catalog-cross-game-retrieval/architect-L1.md (Opus). Challenge: plan-reviewer-L1.md (fable, pass). Kim 2026-10-17: parse the /secret keys from personaSystem now, with the coupling pin; exclusion only. Build notes from the challenge: committedSecretKeys reads a2uiOutput and priorOutput; the Mentalist re-pin is a defensible prefix with a known-poor comment (T-0318 style), not three new ranks; state the live target per opening phrasing (every Admiral 'New game...' variant frames no /secret/word record), attributed by runId prefix.

## Acceptance criteria
verifier: L3

- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/corpus/retrieve.test.ts` exits 0: with `hiddenState` omitted every record stays in scope; with `[]` a record committing any `/secret` key drops; a record whose committed keys are all declared stays and one with an undeclared key drops; a multi-turn record whose `priorOutput` commits the key is scoped by it; a hyphenated key reads the same on both sides; a scalar or array committed whole at `/secret` is the opaque key.
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts` exits 0: every Admiral "New game..." phrasing and "I surrender." frames no `/secret/word` record, no Lexicographer phrasing (including "Fire at B3") frames the Battleship board, the Mentalist "Read my mind" frames no record that commits hidden state (known poor, T-0318), the preset keys are read from the real foundations, and each persona keeps its own board on its pinned turn.
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts` exits 0: a persona naming `/secret/fleet` and `/secret/playerFleet` sends `hiddenState` `['fleet', 'playerFleet']`, a mention outside the `## Foundation` block neither adds nor drops a key, a persona naming none sends `[]`, and no or a blank persona section sends no `hiddenState` field.
- `npx vitest run --project site site/pages/agent-admin-presets.test.ts` exits 0, including the coupling pin: every `/secret/<key>` a shipped exemplar commits is named by its own preset's foundation, through the shared helpers. Green at base by construction (the shipped data already agrees), so it is a guard, not a red control.
- `npm run check` exits 0.
- Live target, not a gate: on the next live round every Admiral "New game..." opening (traces attributed by `runId` prefix `regress-admiral-`) frames no `/secret/word` record in `trace.exemplarIds`; baseline 12 of 12 "New game of Battleship." openings framed `domain-lexicographer-word-board` (2026-10-14 to 10-17).

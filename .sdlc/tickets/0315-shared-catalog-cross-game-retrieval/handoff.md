---
id: T-0315
title: "Admiral and Lexicographer share the agent-ui catalog: 'New game' ranks the word board first on the Admiral's opening"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

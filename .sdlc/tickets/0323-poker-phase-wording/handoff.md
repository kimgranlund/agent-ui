---
id: T-0323
title: "Poker phases: a post-deal betting round is phase playing; the BET_CONTROL_DUPLICATE repair must not strip the moves"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 8 cluster E, `.sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` (`## Why it failed and how to fix it`): game-table-chrome reads "Phases: betting (`betAction` deal ...), playing, settled", but a poker hand has betting rounds after the deal; Haiku opened five-card draw in phase betting with Check, Bet and Fold, and BET_CONTROL_DUPLICATE stripped them (:61, :65).

## Process
Kim's debate rule: this changes what the model reads. A proposer drafts the wording and check change with options; an adversary on another model family challenges it; then build.

## Done when
- The debate record is in the handoff; the agreed wording (library or persona text, never grammar.md) and check change land with a test from :61 red at the base; the Croupier replays, presets and manifests (seedVersion bump if a seed changes) and `npm run check` exit 0.

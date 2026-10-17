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

## Debate
Proposer (Opus) and adversary (Fable) debated on HEAD `4de395ed`; Kim ruled option C as revised (`.sdlc/notes/notes.md`, T-0323 2026-10-16).
- Premise: poker stays on a Card frame; CardTable is the blackjack family's table. Rounds 3 to 7 shipped zero poker CardTables outside one repair-induced Haiku turn; the persona entry and the SURFACE_MISSING hint already said Card for poker.
- Sources that sent Haiku to a CardTable: the unscoped "If the catalog has CardTable" in `game-table-chrome.md` and `card-layout.md`, the unscoped persona card-layout entry, and the ACTION_NOT_APPLIED new-round repair text in `checks.ts` (round 3 :83).
- Wording (A, re-cut): both modules scope the CardTable to blackjack inside the 200-token budget, keeping the pinned literals; the phase gloss ("betting is before the deal") goes to the persona entries, not the module. Both persona entries (card-layout, game-table-chrome) are scoped; seedVersion 15; no catalog type names in persona prompt sections.
- Checks (B, changed): `betControls` and `newRoundFindings` honour `namesOtherGame` like their siblings; a poker CardTable in phase betting with dealt cards gets one DEALT_IN_BETTING asking for phase playing, its message branching on whether move Buttons exist; `movesMissing` (blackjack moves) skips a poker surface. The new-round ACTION_NOT_APPLIED and opening SURFACE_MISSING texts get a poker branch. Known gap: a poker CardTable whose words name no game falls through to the blackjack rules.
- Live proof (`five-card-draw-haiku` ships PlayingCard on turn 0) is a measurement, never the gate; the gate is the keyless tests below.

## Acceptance criteria
verifier: L3

- (red) `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts -t T-0323` exits 0: the round 8 :61 round 2 payload yields exactly one DEALT_IN_BETTING on `table-1:root` naming checkBtn, betBtn and foldBtn and no BET_CONTROL_DUPLICATE; the :65 round 1 payload on deal_again yields no NEW_ROUND_NOT_BETTING and one DEALT_IN_BETTING asking for Check, Bet and Fold; the blackjack strip cases stay as they were; the new-round ACTION_NOT_APPLIED and the poker SURFACE_MISSING texts name the Card frame for poker.
- (red) `npx vitest run packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts -t T-0323` exits 0: game-table-chrome and card-layout scope the CardTable to blackjack, keep the pinned literals, and stay within the 200-token budget.
- (red) `npx vitest run site/pages/agent-admin-presets.test.ts -t T-0323` exits 0: the croupier card-layout and game-table-chrome entries scope the table to blackjack, gloss betting as before the deal, and seedVersion is 15.
- `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/tools/registry scripts/e2e-admin/probe site/pages/agent-admin-presets.test.ts site/lib/agent-manifest` exits 0 (the T-0314 contract cross-run with the DEALT_IN_BETTING probes, the prompt-equivalence baseline after one deliberate recapture, assets freshness, the Croupier replays, the manifests).
- `npm run check` exits 0.

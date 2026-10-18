---
id: T-0345
title: "Haiku poker and blackjack openings deal on the first turn instead of asking for a stake (round 10 cluster B)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Haiku hold'em openings deal cards on turn 0 and Haiku blackjack openings render a CardTable in round 1 at round 8's rate.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 10 clusters.
- Done when: Haiku N=10 on 'Let's play blackjack.' and 'Let's play Texas hold'em.' with old and new text: round 1 CardTable and turn 0 PlayingCard at round 8's rate or better. `npm run check` plus the touched folders' tests exit 0.

## Context
Round 10: 1 of 6 Haiku poker openings asked for a stake first (round 9: 0 of 12); BET_TABLE_MISSING on 7 of 15 Haiku blackjack openings, all repaired. The T-0323 phrase 'betting is the stake pick before the deal' (then site/pages/agent-admin-presets.ts:224, :234; since T-0160 site/agent-content/personas/croupier/skills/{card-layout,game-table-chrome}/SKILL.md, loaded index-only on openings) is implicated again. T-0329 closed as noise at N=30 on the mini-skill text; this points at the persona text. Needs Kim's go before build (debate rule; model-read text). Round 10 report .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md cluster B.

## Constraints
None beyond AGENTS.md.

## Debate
Kim 2026-10-17: run the debate (Opus proposal, then a different-family challenge), then Kim rules; build only after. The proposal names one cause from the round 10 traces, the exact text change (file:line, old and new), its byte budget and pinned tests, and a relative measurement plan (OLD, NEW, MIX at Haiku N=10, about $1, cap $3).

Ruling (Kim, 2026-10-18): measure the Opus proposal (architect-L1.md) with the relative rule, ceiling fixed: NEW must beat OLD by 3 of 10 at N=10 per opening, extending to +9 of 30; if OLD scores 8 or more, both arms go straight to N=30. The Done-when "round 8's rate" bar is retired for this rule. Arms OLD, NEW, MIX on Haiku 5.5, "Let's play blackjack." and "Let's play Texas hold'em.", about $0.30, `run-capped.ts --cap 3`. A failing NEW returns to Kim. The poker stake-ask check is the sibling T-0357.

## Acceptance criteria
- Ruling (Kim, 2026-10-18 close-out): ship NEW. Blackjack NEW 30 of 30 against OLD 22 of 30 is the ceiling, so the +9 of 30 bar is waived.
- The NEW text is present as measured: `grep -qF 'Open each round on its table, never an ask for the stake: in blackjack the table’s own bet strip takes the bet and deals (hands empty until then); poker deals the hands at once.' site/agent-content/personas/croupier/workflows/round-loop/WORKFLOW.md` exits 0.
- The touched folders' tests pass: `npx vitest run site/pages/agent-admin-presets.test.ts site/pages/agent-admin-seed-digests.test.ts site/pages/agent-admin-prompt-budget.test.ts site/lib site/agent-content scripts/e2e-admin/probe` exits 0.
- The arms are archived: `test -f .sdlc/evals/rounds/2026-10-18-t0345-README.md -a -f .sdlc/evals/rounds/2026-10-18-t0345-old/ledger.jsonl -a -f .sdlc/evals/rounds/2026-10-18-t0345-new/ledger.jsonl -a -f .sdlc/evals/rounds/2026-10-18-t0345-mix/ledger.jsonl` exits 0.
- `npm run check` exits 0.
- The README table matches a recount of round 1 from each round's `ledger.jsonl` and `traces/` (OLD blackjack 22 of 30, NEW 30 of 30; hold'em 28 and 29 of 30; MIX 9 and 7 of 10), with `signals.md` BET_TABLE_MISSING 8 in OLD and 0 in NEW as the independent cross-check.

## Kim ruling (2026-10-18, close-out round)
Ship the NEW opening line: 30/30 vs OLD 22/30 is the most a 30-run set can show, so the +9 bar is waived as a ceiling effect.

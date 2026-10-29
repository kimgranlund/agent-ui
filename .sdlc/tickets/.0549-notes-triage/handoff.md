---
id: T-0549
title: "Unrouted notes follow-ups are triaged: fixed, stale or real, with at most five tickets proposed"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Every `- decide:` and `- fix-now:` line in `.sdlc/notes/notes.md` that carries no routing mark is classified as fixed (with the commit or ticket), stale (with why), or still real, and the still-real ones are grouped into at most five proposed tickets.

## Intent
- Do: list the unrouted lines; for each, check the cited file:line or behavior on main and classify it; append a routing mark to each classified line in notes.md using the file's existing mark convention (read how earlier lines were marked routed); write `## Findings` in this handoff with the counts per class and the proposed tickets (title, size, the notes lines each covers).
- Non-goals: fixing anything; filing tickets (the conductor files them after Kim picks).
- Done when: no unrouted `decide:` or `fix-now:` line remains; `## Findings` lists the proposed tickets; only `.sdlc/notes/notes.md` and this handoff changed (`git status --short`).

## Constraints
No em dashes. No paid runs.
- Lane: solo because size L1 (steps.py lane)

## Findings
20 unrouted lines (19 `decide:`, 1 `fix-now:`), each now marked ` -> ...` in `.sdlc/notes/notes.md` (the file's routing mark).

| Class | Count | Lines in notes.md |
| --- | --- | --- |
| fixed | 9 | 929 (T-0482), 952 (T-0482), 960 (T-0481), 961 (T-0516), 962 (T-0480), 972 (T-0485), 974 (fix-now, done by marking 929 here), 978 (T-0484), 1143 (T-0522, T-0525) |
| stale | 10 | 933, 953, 954, 955, 956, 963, 979, 980, 981, 982: informational or by-design notes on closed tickets, nothing owed |
| real | 1 | 986 |

### Proposed tickets (1 of at most 5)
1. F1, L1 chore: "The r15-recheck round folder holds its live-commands.sh". `.sdlc/evals/rounds/2026-10-27-r15-recheck/report.md:14,44` and `round.json` `liveCommands` name `live-commands.sh`, but the folder has no such file on main; add the 12-command extract (round 15's commands, each `--out` retargeted by `run-capped.ts`) so the Reproduce line runs. Covers notes.md line 986.

Nothing else is real: every other line is fixed on main or an informational note on a closed ticket.

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 28364f644b58
- Changed: The unrouted notes follow-ups are triaged: 9 fixed, 10 stale, 1 real
- Commits: none
- Check: 1 No unrouted `decide:` or `fix-now:` line remains in notes.md: pass
- Check: 2 `## Findings` lists counts per class and the proposed tickets: pass
- Check: 3 Only notes.md and this handoff changed: pass
- Follow-up: note: .sdlc/tickets/roadmap.md: generated roadmap churn rides in the lane... -> notes.md

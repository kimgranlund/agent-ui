---
id: T-0573
title: "Unrouted notes follow-ups are triaged, round 2"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P3
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Every `- decide:` and `- fix-now:` line in `.sdlc/notes/notes.md` that carries no routing mark is classified as fixed (commit or ticket), stale (why), or still real, and the still-real ones are grouped into at most five proposed tickets.

## Intent
- Do: same method and routing mark as T-0549 (`.sdlc/tickets/.0549-notes-triage/handoff.md`): check each cited file:line or behavior on main, classify, mark the line, write `## Findings` here with counts and proposed tickets.
- Non-goals: fixing anything; filing tickets.
- Done when: no unrouted `decide:` or `fix-now:` line remains; `## Findings` lists the proposed tickets; only notes.md and this handoff changed.

## Constraints
No em dashes. No paid runs. Security-related lines are summarized as hardening only, with no exploit detail.
- Lane: solo because size L1 (steps.py lane)

## Findings
14 unrouted lines (12 `decide:`, 2 `fix-now:`), each now marked ` -> ...` in `.sdlc/notes/notes.md` (the file's routing mark), checked against main at 11d20e79f.

| Class | Count | Lines in notes.md |
| --- | --- | --- |
| fixed | 6 | 1195 (T-0562), 1204 (T-0561), 1220 (T-0563), 1225 (T-0558), 1280 (T-0565), 1302 (T-0529, Kim's ADR-0197 cl.5 ruling) |
| stale | 4 | 1221, 1230, 1251, 1307: by-design or informational notes, nothing owed |
| real | 4 | 1231, 1244, 1266, 1267 |

### Proposed tickets (3 of at most 5)
1. G1, L1 chore: "The Select undeclared-label test asserts the element's label property". `packages/agent-ui/a2ui/src/renderer/renderer.test.ts` (the aria-label span assertion near line 436) passes whether the label was skipped or the span is absent; assert `ui-select`'s `label` is empty. Covers line 1231.
2. G2, L1 chore: "measure-size drops the stray packageEntryOver line in the control-count failure block". `scripts/measure-size.mjs:467` reads `packageEntryOver` before its `let` at line 1247, so that path would throw instead of printing; delete the line. Covers line 1244.
3. G3, L1 chore: "The regex guard's header comment states what its caps bound, and a per-pattern quantifier cap is decided". `packages/agent-ui/a2ui/src/catalog/regex-guard.ts:6` overstates the length caps; reword it, and settle with Kim whether a cap on unbounded quantifiers per pattern is worth adding (hardening only). Covers lines 1266 and 1267.

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 11d20e79fa13
- Changed: Notes triage round 2: 14 unrouted lines classified, 6 fixed, 4 stale, 4 real in three proposed tickets
- Commits: none
- Check: 1 No unrouted `decide:` or `fix-now:` line remains: pass
- Check: 2 `## Findings` lists the proposed tickets: pass
- Check: 3 Only notes.md and this handoff changed: pass
- Check: 4 Constraint no em dashes: pass
- Follow-up: note: .sdlc/runtime/tasks/0573-notes-triage-2/0573-solo-L1.md: redck... -> notes.md

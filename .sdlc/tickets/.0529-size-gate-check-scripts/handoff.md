---
id: T-0529
title: "npm run size gates in check:scripts"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: [T-0525, T-0526, T-0527]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
`npm run size` (`scripts/measure-size.mjs`) runs inside `check:scripts`, so a size overrun reds the local check and CI, per Kim's 2026-10-28 ruling.

## Intent
- Do: add the size run to the `check:scripts` chain in package.json (through `scripts/gate_lock.py` if the chain already uses it for heavy steps); record the standing rule where gate rules live (`.claude/docs/process.md` section 1 or the references doc that lists the gates, and the AGENTS.md Gates list) as Kim's ruling, since ADRs are frozen; note that it supersedes the manual-only stance of ADR-0040 section 3.
- Done when: `npm run check` runs measure-size and exits 0 on the green tree; a temporary budget cut on one row makes `npm run check` exit nonzero (mutation noted, then reverted); the rule is written where gates are documented.

## Context
From the T-0523 bundle-size sweep (#2328):

From the T-0523 bundle-size sweep (#2328): the root cause of the drift was that size runs in no gate (manual by ADR-0040 section 3). Kim ruled 2026-10-28: gate it in check:scripts once the rows are green.

## Constraints
Budgets live in `scripts/measure-size.mjs`; every budget change carries a dated reason comment naming its mover (existing precedent around :205 and :265). Generated files only through their scripts. No em dashes.

Waits on PR 2331 (T-0528) merging.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 1e59e50b555c
- Changed: npm run size gates in check:scripts, so a size overrun reds the local check and CI
- Commits: none
- Check: 1 `npm run check` runs measure-size and exits 0 on the green tree: pass
- Check: 2 a temporary budget cut on one row makes the check exit nonzero: pass
- Check: 3 the rule is written where gates are documented: pass
- Follow-up: decide: scripts/measure-size.mjs:266 overlay budget raised to 2688 on the... -> notes.md
- Follow-up: note: in a throwaway worktree with a symlinked node_modules, measure-size... -> notes.md

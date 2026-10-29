---
id: T-0577
title: "The regex guard comment is accurate and patterns carry a per-pattern repeat cap"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The A2UI regex guard states exactly what its caps bound, and each pattern carries a cap on unbounded repeats, so a payload pattern stays cheap to run.

## Intent
- Do: reword the header comment at `packages/agent-ui/a2ui/src/catalog/regex-guard.ts:6` to say what the length caps do and do not bound; add a per-pattern cap on unbounded repeats (`*`, `+`, `{n,}`) that the guard enforces, refusing a pattern over the cap the same way it refuses an over-length one; first count the repeats in every pattern the shipped catalogs, corpus and examples use and set the cap above the largest with a stated margin; tests that fail on base.
- Done when: the new tests fail on base and pass after; no shipped catalog, corpus or example pattern is refused (report the census); the a2ui suites and `npm run check` exit 0.

## Context
From T-0573 notes triage (PR 2376), lines 1266 and 1267, following the T-0554 hardening batch (PR 2348). Kim approved adding the repeat cap 2026-10-29.

## Constraints
No em dashes. No paid runs. Public repo: describe the change as hardening only, with no exploit detail in code, comments, commits or the PR.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The guard tests pass, including the repeat-cap cases and the shipped-pattern census: `npx vitest run packages/agent-ui/a2ui/src/catalog/regex-guard.test.ts` exits 0 (on base it exits 1).
- The a2ui jsdom suites pass: `npx vitest run packages/agent-ui/a2ui` exits 0.
- The standing gate passes: `npm run check` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: b7dea60d460a
- Changed: The regex guard comment is accurate and patterns carry a per-pattern repeat cap
- Commits: none
- Check: 1 The guard tests pass, including the repeat-cap cases and the shipped-pattern census: `npx vitest ...: pass
- Check: 2 The a2ui jsdom suites pass: `npx vitest run packages/agent-ui/a2ui` exits 0: pass
- Check: 3 The standing gate passes: `npm run check` exits 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/regex-guard.ts:13 says the cap... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/regex-guard.test.ts:97 the... -> notes.md
- Follow-up: note: .sdlc/notes/notes.md:1266-1267 are the two T-0554 follow-ups this... -> notes.md

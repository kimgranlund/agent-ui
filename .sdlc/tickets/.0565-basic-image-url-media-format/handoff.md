---
id: T-0565
title: "a2ui-basic Image.url uses the media URL format"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The a2ui-basic catalog's `Image.url` declares the same media URL format as the default catalog's media props.

## Intent
- Do: set `Image.url` in `packages/agent-ui/a2ui/src/catalog/a2ui-basic/catalog.json` to the `media-src` format T-0563 added; regenerate generated files with their scripts; add a validator test that fails on base.
- Done when: the new test fails on base and passes after; the a2ui suites and `npm run check` exit 0.

## Context
Hardening follow-up from T-0563 (PR 2359): its verifier noted a2ui-basic `Image.url` (maps to `src`) still declares `safe-href`, which does not match the media render gate.

## Constraints
No em dashes. No paid runs. Public repo: describe the change as hardening only, with no exploit detail in code, comments, commits or the PR.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 4b1be4538010
- Changed: a2ui-basic Image.url declares the media URL format
- Commits: none
- Check: 1 Image.url in a2ui-basic catalog.json uses the media-src format: pass
- Check: 2 The new validator test fails on base and passes after: pass
- Check: 3 Generated files regenerated with their scripts: pass
- Check: 4 The a2ui suites and `npm run check` exit 0: pass
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/a2ui-basic/factories.ts:78 doc... -> notes.md

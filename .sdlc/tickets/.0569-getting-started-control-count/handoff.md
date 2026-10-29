---
id: T-0569
title: "Getting-started per-control import list counts and labels only control modules"
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
The getting-started page's per-control import list counts and labels only the control module subpaths, not the `.css` sheet subpaths.

## Intent
- Do: fix H1 below; add a test that pins the printed count to the module subpaths.
- Done when: the new test fails on base and passes after; the site tests for the page and `npm run check` exit 0.

## Context
From the T-0537 docs-site sweep (PR 2367):

### High

- H1 `site/pages/getting-started.ts:190`, `:196`, `:200` (Per-control imports, the getting-started page). The filter keeps every `./controls/*` key, sheets included, so the page says "184 controls ship their own subpath today" (92 are `.css` sheets, so 92 controls) and prints lines such as `import '@agent-ui/components/controls/amount-picker.css' // registers ui-amount-picker.css`. Confirmed by running the page's own derivation against `packages/agent-ui/components/package.json`: 184 keys, 92 ending `.css`, second output line as quoted. Fix: filter `!k.endsWith('.css')` for the module list and count modules only (optionally pair each with its sheet line).
- Proposed ticket: "Getting-started per-control import list stops counting and labelling sheet subpaths as controls" (L1, site-only, one test pinning the count to module subpaths).

## Constraints
No em dashes. No paid runs. ADRs are frozen.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 0d03f6fe4c64
- Changed: The getting-started per-control import list counts and labels only control modules
- Commits: none
- Check: 1 The new test fails on base and passes after: pass
- Check: 2 Site tests for the page and `npm run check` exit 0: pass
- Follow-up: note: scripts/reap-scratch-clones.mjs selftest "same root twice" case is... -> notes.md

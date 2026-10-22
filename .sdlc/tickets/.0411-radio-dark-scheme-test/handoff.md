---
id: T-0411
title: "The radio 'one solid circle' browser test also runs in the dark scheme, where it can tell a solid fill from a ring on primary"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The ui-radio browser test "default: one solid circle" (packages/agent-ui/components/src/controls/radio/radio.browser.test.ts:274) discriminates: in the light scheme primary and primary-fill are both tone 550, so it passes against a ring-on-primary build too. A dark-scheme leg (where they differ) makes it fail on such a build.

## Intent
- Do: add the dark-scheme case beside the existing one (follow how other browser tests in the controls folder set the dark scheme), asserting the same solid-circle reading. Prove it discriminates: with a temporary local mutation that draws the checked dot as a ring on primary, the dark leg goes red while the light leg stays green; revert the mutation and report both runs. Change no product CSS.
- Non-goals: radio CSS or tokens; other controls.
- Done when: `npx vitest run --config vitest.browser.config.ts packages/agent-ui/components/src/controls/radio` and `npm run check` exit 0; the report shows the mutation run red on the dark leg.

## Context
From .sdlc/notes/notes.md :265 (a T-0340 verifier finding). Skill component-testing.

## Constraints
No em dashes. Never re-monolith the browser shards.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-22 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 6fd386ba64f7
- Changed: The radio one-solid-circle browser test runs in light and dark; the dark leg goes red on a ring-on-primary build
- Commits: none
- Check: 1 `npx vitest run --config vitest.browser.config.ts packages/agent-ui/components/src/controls/radio...: pass
- Check: 2 `npm run check` exits 0: pass
- Check: 3 The mutation run is red on the dark leg: pass

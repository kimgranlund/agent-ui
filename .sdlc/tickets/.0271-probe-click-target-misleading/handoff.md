---
id: T-0271
title: "click-target reports a listed button as missing when the click lands but starts no turn"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
`click-target` tells "no such button" apart from "clicked, but no turn followed".

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``runs/regress-croupier-omaha-haiku-1/report.json`, check `click-target` t7.

## Expected
A detail that says the click landed (or hit a stale history button) and no produce request followed.

## Actual
`no surface button reading "Deal again" (buttons: Deal again, 25, 50, 75, 100, 250, Deal, bet 50)`. The button is listed.

## Context
`scripts/e2e-admin/probe/run.ts:313-321` records any `playStep` throw on a click as `clickMissing`. `clickSurfaceButton` (`scripts/e2e-admin/admin-page.ts:306`) clicks the last visible match, which may belong to an older table. Found by T-0261.

## Acceptance criteria
- `node scripts/chat-probe.mjs selftest` exits 0; its T-0271 cases pin the click-target detail for a click that landed on an older surface and started no turn, and for one whose request went out and never settled.
- `npx vitest run scripts/e2e-admin/admin-page.test.mjs` exits 0; `clickSurfaceButton` reports whether the clicked button sat in the newest surface host.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged in #2031 (round 3 probe and scenario fixes); verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none

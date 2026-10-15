---
id: T-0244
title: "widget/Drill overflows the 400px column by a varying amount (419 to 442px), red on main since T-0237"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The dogfood render lint passes for widget/Drill at 400px on every run, so the merge queue's dogfood gate is trustworthy again.

## Repro
1. `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts -t 'widget/Drill'`

## Expected
No finding: `<ui-drill-panel>` stays inside the 400px column (right <= 403).

## Actual
`widget/Drill#column at 400px light: <ui-drill-panel> right=439 limit=403`. The amount varies per run: 419 at 6fdee39d (T-0237), 441 at 3d186ef5, 442 at 7558540a, 432 and 439 at 1ced986c, 413 in the queue run for #2005.

## Context
Found 2026-10-15 when the queue's dogfood gate went red on #2005, a `.sdlc`-only PR that matched the gate's `dogfood` path pattern. Red at every main commit checked back to T-0237, so it predates rounds 2 and 3 merges. Guess: a width measured before layout or a transition settles (load average was 24), or content whose length varies per render (random seed or timestamp in the Drill demo). Also: the queue's dogfood trigger matches `.sdlc/dogfood-*` folder names; it should ignore `.sdlc/`.

## Constraints
The failing test lands before or with the fix, never after. Fix the cause (deterministic width), never an allowlist line.

## Done when
- The Drill test passes 5 runs in a row in isolation and once under `gate_lock` with another gate running.
- `npm run check` exit 0.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged in #2010: dogfood render lint waits for animations to settle; stale T-0186 allowlist line removed) · verifier: none · base: none
- Changed: see commits
- Commits: none

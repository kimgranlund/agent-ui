---
id: T-0166
title: "Product md: eval-catalog B3g red, AudioPlayer and Table roots overflow the eval canvas"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0152]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The last red on `feat/root-product-md`: `npm run test:eval-catalog` fails gate B3g on two cards: AudioPlayer ("root 256x54 overflows canvas") and Table ("root 240x179 overflows canvas"). Every other shard is green.

## Intent
- Do:
  - First check whether it reproduces on origin/main (run the same gate in a main worktree, or read the runner's canvas sizing). If it is red on main too, say so and still fix it.
  - Find the cause. The A2UI canvas is ruled to stay widget / md (ADR-0245 Amendment 8): if the eval canvas or its card inherits the new product / md page root instead of the widget / md canvas register, that is the bug; fix the canvas scoping, not the gate. If the canvas width itself is a fixed px that no longer fits the derived geometry, derive it.
  - The runner and gate live with `test:eval-catalog` (see package.json and its script); report the B3g rule you found.
- Done when: `npm run test:eval-catalog` exit 0; any touched folder's tests exit 0; `npm run check` exit 0; render lint (`site/pages/dogfood-render.browser.test.ts`) exit 0 if site CSS changed.

## Context
- Branch base `feat/root-product-md`; commit on `chore/rootmd-eval-catalog`, never push. Heavy tests through `gate_lock.py run` in the foreground; never idle on a monitor.

## Constraints
- No literal px geometry (census gate). Do not loosen B3g. No em dashes.

## Closed

2026-10-14: merged as PR #1969

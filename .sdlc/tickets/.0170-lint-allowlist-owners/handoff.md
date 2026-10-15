---
id: T-0170
title: "Every lint allowlist entry has an owner ticket or a specimen marker; migrate or exempt the 50 compose day-one entries"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0152]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
No allowlist entry points at a lane that no longer exists: each is fixed, owned by a ticket id, or replaced by an explicit specimen marker.

## Intent
- Do:
  1. `scripts/dogfood-render-allowlist.json`: entries for code-demo, drill-demo, split-pane-demo, game-hud glyph gap (demo and widget), list avatar disc, line-chart dash, playing-card type floor. Fix the small ones here (game-hud gap derived from n, avatar disc role, code block scrolls in its own frame); for the rest, the reason names a ticket id (create proposed tickets with tickets.py) or a ruling.
  2. `demo/card-demo#nested-card` is a permanent specimen: replace the entry with a `data-dogfood-ok="nested-card"` style marker the render lint honours (marker requires a reason attribute), plus a negative control.
  3. `scripts/dogfood-compose-allowlist.json`: 50 "day one T-0136, the site lane migrates it" entries. Migrate the mechanical ones (codemod where possible); for demo scaffolding that is legitimately literal, add a path-level exemption in `dogfood-rules.json` with a reason, so the allowlist holds only real debt with owners.
  4. Both lints: an entry whose reason lacks a `T-NNNN` or a ruling reference fails (format check, with a negative control).
- Done when: `npm run check` exit 0; `node scripts/dogfood-compose.mjs --gate` exit 0; render lint exit 0 in both engines; every remaining entry carries an owner; touched demos' screenshots viewed.

## Context
- Lint audit 2026-10-14. Start after T-0152. Commit locally, never push. Heavy tests via `gate_lock.py run`, foreground.

## Constraints
- Never add an entry to turn a red green without an owner. No em dashes.

## Acceptance criteria
verifier: L3
- `npm run check` exits 0.
- `node scripts/dogfood-compose.mjs --gate` exits 0 and `node scripts/dogfood-compose.mjs selftest` exits 0 (owner check and exemption cases included).
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0 in chromium and webkit, including the `nested-card marker without a reason` and `nested-card marker for another rule` plants and the owner-check test.
- Every reason in scripts/dogfood-render-allowlist.json and scripts/dogfood-compose-allowlist.json, and every `exempt` reason in scripts/dogfood-rules.json, names a T-NNNN, an ADR-NNNN or a ruling; no reason says "day one" plus a lane.
- site/pages/card-demo.ts's inner card carries `data-dogfood-ok="nested-card"` and a non-empty `data-dogfood-reason`, and `demo/card-demo#nested-card` is gone from the render allowlist.

## Closed

2026-10-14: merged as PR #1982

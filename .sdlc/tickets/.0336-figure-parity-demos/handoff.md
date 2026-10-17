---
id: T-0336
title: "Site demos align captioned figures to a shared top edge (figure-parity allowlist debt)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0336-figure-parity
worktree: ../agent-ui.worktrees/wave-w336
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The 10 site demos with captioned figures align them to start, so figure tops match.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: Remove the 10 allowlist lines; site/pages/dogfood-render.browser.test.ts green in both engines. `npm run check` plus the touched folders' tests exit 0.

## Context
T-0168 added the figure-parity render rule; debt allowlisted in scripts/dogfood-render-allowlist.json: button, checkbox, icon, otp-field, radio, rating, slider, slider-multi, switch, text-field demos center-align figures, tops differ 2 to 26px. Fix: align start on those rows.

## Constraints
None.

## Outcome

2026-10-17 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 6a049c6a2f34
- Changed: Captioned figures share a top edge with level captions through the shared figure layer (#2091)
- Commits: none
- Check: 1 Remove the 10 allowlist lines: pass
- Check: 2 site/pages/dogfood-render.browser.test.ts is green in both engines: pass
- Check: 3 Goal (shared layer): pass
- Follow-up: note: shots/after/button-chromium.png: captions are bottom-aligned... -> notes.md
- Follow-up: decide: scripts/dogfood-render-allowlist.json:3: the icon-demo... -> notes.md

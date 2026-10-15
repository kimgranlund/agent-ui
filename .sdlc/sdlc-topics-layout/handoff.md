---
id: T-0242
title: "Move the ticket store to the sdlc-lite topics layout (.sdlc/tickets/, notes/, work/), committed"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0208, T-0241, T-0239]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every ticket, open and closed, lives under `.sdlc/tickets/<slug>/`, in git, using the sdlc-lite topics layout (Kim, 2026-10-15), and every reference to a moved path still resolves.

## Plan (conductor-run, after T-0208, T-0241 and T-0239 merge; no lane running)
1. Main checkout on fresh `main` (it sits on merged `chore/catalog-w0`). Reap finished lane worktrees.
2. Commit the whole ticket store in one chore change: 252 ticket folders exist, only 58 are tracked. Include handoff.md, skips.md, plans and reports, notes.md, roadmap.md, board.md and config; keep `runtime/`, `messages/` and screenshots ignored. migrate-layout refuses on any untracked change, so this goes first.
3. `python3 <plugin>/scripts/tickets.py --root .sdlc migrate-layout --dry-run`, review every move and rewrite, then run it with `--rewrite-refs`. It moves ticket folders to tickets/, other task dirs to work/, roadmap into tickets/, notes.md to notes/notes.md, and adds `ticket_root: tickets` and `layout: topics` to config.
4. `onboard.py setup` to refresh the root AGENTS.md block; fix paths in CLAUDE.md, AGENTS.md, .sdlc/AGENTS.md, skills (seat-map, doc-standards), docs that cite `.sdlc/<slug>` and the conductor's lane helper (mk-lane-from.sh copies `.sdlc/<slug>`).
5. `tickets.py check` exits 0; `npm run check` exits 0; one PR through the queue.

## Done when
- `tickets.py --root .sdlc check` exits 0 with the topics layout; no ticket folder left directly under `.sdlc/`.
- `git grep` finds no live reference to a moved `.sdlc/<slug>/` path outside dated records.
- The next `tickets.py new` writes to `.sdlc/tickets/`.

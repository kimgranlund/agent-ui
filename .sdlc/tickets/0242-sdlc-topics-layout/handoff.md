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

## Acceptance criteria
Run from the repo root.
1. `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.23.1/scripts/tickets.py --root .sdlc check` exits 0 with `ticket_root: tickets` and `layout: topics` in `.sdlc/config`.
2. No ticket folder directly under `.sdlc/`: `test -z "$(find .sdlc -mindepth 2 -maxdepth 2 -name handoff.md -not -path '.sdlc/tickets/*' -not -path '.sdlc/work/*' -exec grep -lE '^id: T-[0-9]+' {} +)"` exits 0.
3. No live reference to a moved ticket path outside the dated records: `! git grep -nE "\.sdlc/($(awk -F' -> ' '/ -> /{print $1}' .sdlc/tickets/0242-sdlc-topics-layout/rehearsal/number-dry.txt | paste -sd'|' -))/" -- ':!.sdlc/tickets' ':!.sdlc/work'` exits 0.
4. The next ticket lands in `tickets/`: `grep -qx 'ticket_root: tickets' .sdlc/config && grep -qx 'layout: topics' .sdlc/config` exits 0 (a `tickets.py new` probe after the commit wrote `.sdlc/tickets/0256-probe-topics-t0242/handoff.md` and was discarded).
5. `npm run check` exits 0.

## Conductor note (2026-10-15, Kim)
Work items live in `.sdlc/tickets/` for now. Follow the sdlc-lite migration (`ticket` skill, topics layout): `ticket_root: tickets` and `layout: topics` in `.sdlc/config`, `migrate-layout --dry-run` then `--rewrite-refs`, `tickets.py roadmap` to write the generated router blocks in `.sdlc/AGENTS.md` and `.sdlc/tickets/AGENTS.md`, then `onboard.py setup` for the root block. `.sdlc` is fully tracked in git since 2026-10-15.

## Conductor note (2026-10-15, sdlc-lite author's answers)
Order: `tickets.py number --dry-run` then `number`, `archive` (closed tickets into history, fewer folders to move), `migrate-layout --dry-run` then `--rewrite-refs`, `tickets.py roadmap` (writes the router blocks in `.sdlc/AGENTS.md` and `.sdlc/tickets/AGENTS.md`, keeps hand text outside the markers), then `onboard.py setup`. Rehearse the whole sequence in a throwaway clone first and diff the result before running it in the main checkout. Do NOT move worktrees: plugin 0.24.0 (T-0563) relocates them. `.sdlc` is tracked except `runtime/`, `*.running`, `*.lock`, `.owner.json`, `*.png`. Path consumers to repair: `scripts/e2e-admin/probe/run-capped.ts` (`.sdlc/evals/` stays where it is unless migrate-layout moves it), skills and docs that cite `.sdlc/<slug>`, `~/.claude/lane/queue-merge.sh` and `ship.sh` (conductor fixes those).

## Verify base
Diff base: main at b9523d03 (`git diff b9523d03..HEAD`), the commit before both T-0242 commits; the base sha printed in the dispatch is the T-0242 commit itself.

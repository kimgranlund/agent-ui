---
id: T-0250
title: "Repo cleanup: reap merged worktrees, prune merged branches, delete ignored build dirs"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Local disk and branch clutter from three months of lanes is gone without losing any record.

## Context
Source: the 2026-10-15 repo scrub audits (https://claude.ai/artifact/WKiuHupQFWhonnQbKA2GQT). Kim's rulings 2026-10-15: work items live in `.sdlc/tickets/` (topics layout, T-0242); CHANGELOG.md becomes a pointer to merged PRs and releases (old text archived); the npm publish scope is `@agent-ui-kit/*` (renamed at publish time; READMEs note the alias). No em dashes. ADRs stay frozen and cited.
Audit: 20 `wave-*` worktrees whose PRs merged (1.79 GB; 7 hold untracked `.sdlc` records: cl, d3, e3, mc, n3, pb, w3); 117 remote and 43 local branches with merged PRs; ignored build and scratch dirs (`dist`, `dist-lib`, `dist-shared-build-cache`, `.publish`, `.vitest-attachments`, `screenshots`, `.ruff_cache`, `.wrangler`, `.claude-scratch-npmtest.log`, ~50 MB). `.sdlc` is now fully tracked (Kim 2026-10-15), so do not delete `.sdlc` evidence.

## Constraints
Use the gated `npm run ops:reap-worktrees`, `ops:reap-branches` scripts (dry run first). Never touch a worktree with a live lane, a `*.running` marker, or an open PR. Copy each dirty worktree's untracked `.sdlc` records into the main checkout's matching folder before removal. Remote branch deletion only for merged PRs.

## Done when
- The dry-run lists are saved beside this handoff; every removed worktree and branch maps to a merged PR.
- No `.sdlc` record from a dirty worktree is lost (copied first, listed in the report).
- `git worktree list` shows only live lanes; `npm run check` exit 0.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Done locally (no tracked change): 20 merged worktrees and 44 local branches reaped, 2 remote branches deleted, ~50 MB build dirs removed; verifier L1 pass) · verifier: verifier-L1 (opus) · base: 563b00cc25ea
- Changed: see commits
- Commits: none
- Check: 1 Dry-run lists saved beside the handoff; every removed worktree and branch maps to a merged PR: pass
- Check: 2 No `.sdlc` record from a dirty worktree lost, copied first and listed: pass
- Check: 3 `git worktree list` shows only live lanes; `npm run check` exit 0: pass

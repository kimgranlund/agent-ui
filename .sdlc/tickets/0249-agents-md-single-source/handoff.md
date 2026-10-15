---
id: T-0249
title: "AGENTS.md is the single cross-harness source; CLAUDE.md is @AGENTS.md only"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0242]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every harness reads the same truth: root `AGENTS.md` holds the commands, layout, conventions, inner loop, gates, never-hand-edit list, process and landmines; root `CLAUDE.md` is `@AGENTS.md` (plus the sdlc-lite managed block and nothing Claude-specific unless one truly exists).

## Context
Source: the 2026-10-15 repo scrub audits (https://claude.ai/artifact/WKiuHupQFWhonnQbKA2GQT). Kim's rulings 2026-10-15: work items live in `.sdlc/tickets/` (topics layout, T-0242); CHANGELOG.md becomes a pointer to merged PRs and releases (old text archived); the npm publish scope is `@agent-ui-kit/*` (renamed at publish time; READMEs note the alias). No em dashes. ADRs stay frozen and cited.
Audit findings: CLAUDE.md carries ~140 lines Codex never sees (Commands 12-56, Layout 68-100, Conventions 104-131, Inner loop 133-141); AGENTS.md points back to CLAUDE.md for layout (:8) and inner loop (:51); AGENTS.md:36 and CLAUDE.md:96-97 say work items are GitHub issues. Long command detail may move to `.claude/docs/references/commands.md` and be linked.

## Done when
- `CLAUDE.md` is `@AGENTS.md` plus managed blocks only; `grep -n 'CLAUDE.md' AGENTS.md` finds no pointer that sends a reader to CLAUDE.md for content.
- Every fact the audit listed as CLAUDE.md-only is in AGENTS.md or a doc it links.
- AGENTS.md names `.sdlc/tickets/` as the work-item home and the local gate once (`npm run check` plus touched tests; CI runs the full suite).
- `tickets.py check` and `npm run check` exit 0.

## Acceptance criteria
- `CLAUDE.md` holds only the sdlc-lite managed block whose body is `@AGENTS.md`; `grep -n 'CLAUDE.md' AGENTS.md` shows no line that sends a reader to CLAUDE.md for content.
- Each audit fact (Commands, Layout, Conventions, Inner loop, the gate paragraph) is in `AGENTS.md` or `.claude/docs/references/commands.md`, which `AGENTS.md` links.
- `AGENTS.md` names `.sdlc/tickets/` as the work-item home and states the local gate once (`npm run check` plus touched folders' tests; CI runs the full suite).
- Live section pointers to the old CLAUDE.md sections (skills, doctrine manifest, layering test comments, getting-started page) name AGENTS.md.
- `python3 <sdlc-lite>/scripts/tickets.py check` and `npm run check` exit 0.

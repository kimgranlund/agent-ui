---
id: T-0248
title: "Round folders ingest into context-fog-of-war as session bundles; mapping manifest committed; T-0239 adapter retired or kept with reason"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: chore/fog-bundle-rounds
worktree: .claude/worktrees/wave-fb
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every live round folder under `.sdlc/evals/rounds/<date>-<slug>/` hydrates into a context-fog-of-war report through the skill's native session-bundle path, with one committed mapping manifest, so round analysis needs no repo-local adapter.

## Context
The context-fog-of-war skill (`~/.claude/skills/context-fog-of-war`) now reads Codex, Claude Code and custom web-chat harness output. Folder bundles go through `engineer.py ingest` and a declarative mapping manifest (`references/bundles.md`). T-0239 (#2004) shipped `scripts/agent-traces-to-fog.py`, a repo adapter for `.agent-traces` lines, before this existed. Kim chose (2026-10-15): ingest round 2 now, commit the manifest, compare, retire the adapter if the bundle path covers it, and mark `.sdlc/evals/context-fog-of-war-claude-parity.md` superseded.

## Constraints
Never execute bundled code. Never read or print key values; traces are already redacted. Keep finished round records unmoved. The manifest lives beside the rounds (for example `.sdlc/evals/fog-manifest.json`) and is referenced from `.sdlc/evals/README.md` through the generator in `scripts/e2e-admin/probe/run-capped.ts --index`, not by hand-editing the generated index.

## Done when
- `engineer.py ingest` on `.sdlc/evals/rounds/2026-10-15-r2-presets` with the committed manifest produces a session that `fog.py validate` accepts, and it is published with `library.py publish`; the report id is recorded in that round's README (regenerated with `--describe`).
- The same manifest ingests r1 and the T-0208 probe round without edits, or the gaps are listed.
- A side-by-side of the bundle report versus the T-0239 adapter (events, sources, routing fields) decides: retire `scripts/agent-traces-to-fog.py` and its `check:scripts` selftest and CLAUDE.md line, or keep it with a stated reason.
- The parity report gets one superseded line at the top.
- `npm run check` exit 0.

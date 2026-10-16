---
id: W-fog-skill-checklist-fixes
title: "context-fog-of-war: the four checklist gaps from the round 6 field test"
status: done
size: L1
created: 2026-10-16
---

## Goal
An agent following only `SKILL.md` on a runtime-harness bundle needs no step from its ticket (Kim 2026-10-16). Source: `~/.claude/skills/context-fog-of-war/updates-log/20261016-round-6-field-test/changelog.md` (Open), proven by agent-ui round 6 (`.sdlc/evals/rounds/2026-10-15-r6-matrix/report.md`, `## Skill improvements, verified` row 1).

## Scope (skill folder only)
1. Checklist step 1: say where a reused mapping manifest is found (a prior run's record, e.g. the project's fog records or the previous report's mapping), not only "create or reuse".
2. Checklist step 4: when the mapping cannot carry pass and fail verdicts, cluster from the per-run reports outside the bundle and cite them as outside the bundle.
3. Checklist: a step before the deliverable, "turn each useful failure into a keyless replay" (learnings lesson 24), marked as the project's step when the project has a replay mechanism.
4. Routing table, runtime-harness bundle, Visualize cell: hydrate and `fog.py validate` before `library.py publish`.
5. A new `updates-log/20261016-checklist-fixes/changelog.md` per `updates-log/AGENTS.md`, citing the field-test entry; leave the candidate lesson and the script-fix item open there.

## Constraints
SKILL.md stays at most about 100 lines. No script, test, asset or schema change. No em dashes. Backup: `/private/tmp/claude-501/scratch/cfow-backup-1792159498`.

## Done when
- Each of the four items is present in SKILL.md (one grep each, written into this handoff by the builder; each exits 1 on the backup SKILL.md):
  - `grep -q "reuse a mapping manifest from a prior run" /Users/kimgranlund/.claude/skills/context-fog-of-war/SKILL.md`
  - `grep -q "cluster from the per-run reports outside the bundle and cite them as outside the bundle" /Users/kimgranlund/.claude/skills/context-fog-of-war/SKILL.md`
  - `grep -q "keyless replay pinned to its failing checks.*When the project has a replay mechanism, this is the project's step" /Users/kimgranlund/.claude/skills/context-fog-of-war/SKILL.md`
  - `grep -q 'then .fog.py validate., then .library.py publish.; read \[viewer\]' /Users/kimgranlund/.claude/skills/context-fog-of-war/SKILL.md`
- `python3 -B -m unittest discover -s tests` exits 0 in the skill root.
- The changelog entry exists with front matter (authors solo, verifier pending, conductor); no em dash on added lines (diff against the backup).

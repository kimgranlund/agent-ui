---
id: W-fog-skill-playbook
title: "context-fog-of-war skill: a general-purpose generative UI harness playbook"
status: done
size: L2
created: 2026-10-16
---

## Goal
The user-level `context-fog-of-war` skill (`~/.claude/skills/context-fog-of-war/`) carries a general-purpose, harness-agnostic playbook distilled from five live rounds on a generative UI harness (skills, tools, A2UI catalogs, a JS runtime), so any engineer using the skill can turn a fog analysis into fixes (Kim 2026-10-16).

## Context
Source of the lessons (read, do not copy project specifics): agent-ui `.sdlc/evals/rounds/2026-10-15-r{3-routing,4-fixes,5-fixes}/report.md` (sections on why it failed), `.claude/docs/spec/agent-closed-loop.spec.md` CL-R3, CL-R11, CL-R12 and section 5, `.claude/skills/a2ui-prompt-authoring/SKILL.md` Triage item 6, `.claude/docs/references/agent-model.md`. The conductor's distilled list (use as the outline): instrument retrieved vs framed, tool results received vs submitted, completion and run id; rule out lost context first; cause classes (a) exposure, (b) conflicting or ambiguous guidance, (c) model ignored clear guidance, (d) check, oracle or scenario defect; an index-only entry reaches the model as one line; small models follow general rules literally; settle guidance conflicts in one place; fix per agent before the shared layer; content changes can create failures; semantic checks beyond schema; repair text is a prompt (frame as a check result, ask for a shape that passes the schema); judge the final turn as a whole; show users codes, not internals; lints follow the design system's own exemptions; capped live rounds rerunning only failures; failures become keyless replays; oracles must be specific; an authored repaired round proves mechanics, not live compliance; cheapest model per agent; read reasoning traces; one cause per ticket with a failing test first; generated files from one source, drift-gated.

## Scope
1. New `references/harness-playbook.md` (about 80 to 120 lines): sections Instrument, Triage, Guidance authoring, Validation and repair, Test loop, Model choice, and How this skill's detectors, decisions, guidanceEdges and findings map to each step (so a run ends in a cause-classified why-and-fix table). Each lesson: one rule, one line of evidence ("observed in a five-round study of one generative UI harness"), and the check that would confirm it in a new project. Harness-agnostic: no agent-ui paths, preset names or ticket ids; generic terms (persona text, shared grammar, catalog, composite, repair round).
2. `SKILL.md`: one short section (at most 8 lines) after "Context engineering investigations" that names the triage order and cause classes and links the new reference; one line in the frontmatter-adjacent intro or the engineering paragraph pointing to it if needed. Keep the frontmatter description within its current scope.
3. `references/engineering.md` and `references/decision-analysis.md`: one cross-link each to the playbook where a run's diagnosis turns into actions.

## Constraints
Do not change scripts, schema, assets or tests. No em dashes. Evidence discipline the skill already demands: label field lessons as observed in one study, never as universal law. A backup of the skill folder exists at the path in the brief.

## Done when
- `references/harness-playbook.md` exists with the six sections and at least 20 lessons, each with an evidence line and a confirming check; `grep -c` for agent-ui-specific names (agent-ui, Concierge, Croupier, Lexicographer, T-0) returns 0 in it.
- `SKILL.md` links it in a section of at most 8 lines; `engineering.md` and `decision-analysis.md` each link it.
- No em dashes in changed files (`grep -c '—'` on the diff lines is 0).
- The skill's own tests pass: `python3 -m pytest ~/.claude/skills/context-fog-of-war/tests -q` (or `python3 -m unittest` if pytest is absent) exits 0.

## Rulings and revised Done when (Kim, 2026-10-16)
Kim: fix the skill's three red tests first; organize the learnings in `references/learnings/` with an index and add an `AGENTS.md` at the skill root; make it unmistakable that the learnings come from a runtime harness, not a CLI harness. These supersede the original Scope items 1 and 3 and the "do not change scripts or tests" constraint (for the three red tests only). Revised Done when (all paths under `~/.claude/skills/context-fog-of-war`):
- `python3 -B -m unittest discover -s tests` exits 0, with no assertion weakened against the backup at `/private/tmp/claude-501/scratch/cfow-backup-1792151864` (compare `tests/` and `scripts/`).
- `references/learnings/README.md` opens with a Scope block naming the runtime harness and contrasting a CLI harness, indexes seven lesson files, and states the lesson format (rule, "Observed in" evidence, "Check:", "Applies to:"); `references/harness-playbook.md` no longer exists.
- The seven lesson files hold 29 lessons, each with an "Observed in" line, a "Check:" line and an "Applies to:" line; the agent-ui name grep (agent-ui, Concierge, Croupier, Lexicographer, T-0) returns 0 across `references/learnings/`.
- `AGENTS.md` exists (about 30 lines): layout, where a learning goes and its format, the runtime-vs-CLI rule, the test command, the no em dash rule, back up before large edits.
- `SKILL.md` has a section of at most 8 lines linking `references/learnings/README.md`; `engineering.md` and `decision-analysis.md` each link it.
- No em dash on any added line (diff against the backup).

## Outcome
2026-10-16 · verifier L2 pass · the skill gained references/learnings/ (index with runtime-harness scope, 29 tagged lessons in six files plus a mapping file), AGENTS.md, a 2-line SKILL.md pointer, two cross-links, and fixes for its three red tests (scripts/wrapped.py, scripts/diagnostics.py); tests 20 of 20. Backup at /private/tmp/claude-501/scratch/cfow-backup-1792151864.

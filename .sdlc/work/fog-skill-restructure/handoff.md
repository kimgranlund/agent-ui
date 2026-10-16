---
id: W-fog-skill-restructure
title: "context-fog-of-war SKILL.md: routing table, autonomous-run checklist, detector prerequisites, viewer spec moved out"
status: done
size: L2
created: 2026-10-16
---

## Goal
An agent loading `~/.claude/skills/context-fog-of-war/SKILL.md` can run an analysis autonomously to its intended end state (a cause-classified why-and-fix table backed by hydrated decisions and findings), for both a CLI-session trace and a runtime-harness bundle, without a human spelling out the steps (Kim 2026-10-16).

## Context (field evidence, agent-ui 2026-10-15/16)
- Round 4: a solo ingested and published a bundle with 0 findings and stopped; two follow-up messages did not move it; a fresh agent needed an explicit step list (cluster, exposure chain, hydrate decisions/guidanceEdges/findings, classify a to d). Nothing in SKILL.md names that end state.
- About two thirds of SKILL.md's 176 lines specify the viewer (canvas, camera, inspector, toolbar), ahead of and around the analysis path.
- SKILL.md frames inputs as Codex/Claude Code session traces; runtime-harness bundles (`references/bundles.md`) are a side path, the case that needed most help.
- Detectors abstain unless the trace records retrieval, framed context, tool results and completion; agents learned this only after "0 findings" reports.
- The learnings (`references/learnings/`, runtime-harness scope) and `AGENTS.md` landed earlier today (see `updates-log/20261016-runtime-harness-learnings/`).

## Scope
1. SKILL.md opens (right after the frontmatter title) with a short routing table: input kind (CLI session trace vs runtime-harness bundle vs existing v2 session.json) by goal (diagnose and fix vs visualize vs compare/experiment) to the exact entry steps and reference to read.
2. An "Autonomous run checklist" section (numbered, at most about 12 lines) ending in the deliverable: hydrated report published with its id, and a cause-classified why-and-fix table (cause classes a to d from `references/learnings/README.md`), with "0 findings is not a result" and the stop conditions.
3. A "Prerequisites for detectors" line or short block: what a trace or bundle must record (retrieval, framed context, tool results received and submitted, completion, a run or conversation key) and what to do when it lacks them (report the blocked prerequisite as the finding).
4. Move the viewer and UI specification sections (canvas, camera, step cards, indicator strip, focused inspection, navigation, story overview, sunburst, inspector placement, diagnostic focus UI detail) into a new `references/viewer.md`, verbatim where possible; SKILL.md keeps a 2 to 4 line pointer for visual exploration. Keep the evidence rules, report library, candidate territory and exposure-versus-retention semantics in SKILL.md if they govern analysis, else move them with a pointer.
5. Keep the frontmatter `name`; the `description` may add "runtime-harness bundles" but stays one sentence.
6. Add `updates-log/20261016-skill-md-restructure/changelog.md` per `updates-log/AGENTS.md` (front matter with authors: conductor, solo, verifier; harness Claude Code CLI; backup path below).

## Constraints
No content lost: every sentence removed from SKILL.md lands in a reference or is a duplicate (state which). Do not change scripts, assets, schema or tests. No em dashes. Backup of the skill: `/private/tmp/claude-501/scratch/cfow-backup-1792154787`.

## Done when
- SKILL.md is at most about 90 lines and its first section after the title is the routing table.
- The checklist, the prerequisites block and the viewer pointer are present; `references/viewer.md` exists and holds the moved sections.
- A sentence-level coverage check (a script comparing the backup SKILL.md sentences against the new SKILL.md plus references) reports every old sentence present somewhere or listed as an intentional duplicate removal.
- `python3 -B -m unittest discover -s tests` exits 0 (20 tests).
- The changelog entry exists with front matter; no em dash on any added line.

## Conductor note for the verifier (2026-10-16)
The solo reports checklist step 8 overrides the engineering default "no HTML publication unless requested". Judge whether the new SKILL.md now contradicts itself or references/engineering.md; a self-contradiction in the skill counts against the Goal (an agent must be able to follow it autonomously). Also walk the routing table and checklist once against an existing runtime bundle (`.sdlc/evals/rounds/2026-10-15-r5-fixes/` with `.sdlc/evals/fog-manifest.json`) as far as the keyless steps go, writing outputs only under your scratch dir, and say whether an agent following only SKILL.md would reach the why-and-fix table.

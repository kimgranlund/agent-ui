---
id: W-closed-loop-run-series
title: "closed-loop-run skill: running a series of live, stochastic, paid cycles"
status: done
size: L3
created: 2026-10-17
---

## Goal
Kim 2026-10-17: improve and upsert the user-level skill `~/.claude/skills/closed-loop-run/` with what nine live closed-loop rounds on a generative UI runtime taught about running experiment SERIES against a live, nondeterministic, paid system. Domain-general: no agent-ui names, paths or ticket ids in the skill.

## Evidence (read, do not copy specifics)
agent-ui `.sdlc/evals/rounds/*/report.md` (r3 to r8), `.sdlc/notes/notes.md` (rulings and process rules), `.claude/docs/spec/agent-closed-loop.spec.md`, and the context-fog-of-war learnings `~/.claude/skills/context-fog-of-war/references/learnings/` (link, do not duplicate). The conductor's lesson list (in the brief) is the outline.

## Scope
1. `references/experiment-series.md` (new): the H4 series: a fixed comparison set rerun unchanged; alternating targeted and full cycles; regression accounting (pass to fail churn, not only pass rate); one mechanism metric per fix; an approval gate before each paid cycle; when a cycle's tooling gaps are fixed before the next.
2. `references/live-evaluation.md` (new): single-sample noise and when to sample N; cheapest-first ordering under a hard cap; dry run before spend; key and quota preflight; quarantine provider errors (rate or usage limits, overload, auth) from results; freeze useful failures as keyless replays; recorded versus authored repair rounds (mechanism, not compliance).
3. SKILL.md sections 6, 7, 13: rule out lost context first; uniform errors point at your own pipeline until proven otherwise (a root-cause step, not a repair); read the cause-class mix (guidance versus model); under Evaluation name "check narrower than its rule" and "oracle too generic".
4. SKILL.md sections 14, 15: every fix shifts a cost somewhere (name it, measure it next cycle); adversarial review on a different model family for changes to anything a model reads; a rulings register plus pin tests; regenerate derived artifacts in the same change.
5. Structure: SKILL.md toward about 250 lines by moving detail into references, a short "Running a series" section linking the new references, every invariant kept verbatim or strengthened; an `updates-log/` folder with `AGENTS.md`, `CHANGELOG.md` (newest first) and this change set's `changelog.md` with front matter (authors, harness, verification pending), modeled on `~/.claude/skills/context-fog-of-war/updates-log/`.
6. Templates: `templates/cycle-report.yaml` gains series fields (comparison set id, regressions, mechanism metrics, quarantined provider errors, spend vs cap).

## Constraints
No content lost: every removed SKILL.md sentence lands in a reference or is listed as an intentional duplicate (a sentence-coverage script, as the context-fog-of-war restructure used). No em dashes. Back up first (path in the brief). Domain-general wording; examples may say "a generative UI runtime" generically.

## Done when
- The two references exist with every scope item; SKILL.md links them from a "Running a series" section and is at most about 260 lines.
- The sentence-coverage script reports every old SKILL.md sentence present or listed.
- A grep for agent-ui-specific names (agent-ui, Concierge, Croupier, Lexicographer, Admiral, T-0) over the skill returns 0.
- The updates-log exists per scope 5; no em dash on added lines (diff against the backup).

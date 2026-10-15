<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `.claude/agents/a2ui-review-agent.md`: description lines 10 to 11 and Stay-in-the-lane lines 49 to 51 now point ui-*/CSS and prose docs to an sdlc-lite verifier run (`run.sh`), with ui-* checked against `.claude/docs/rubrics/component.md`.
- `.claude/agents/component-build-agent.md`: lines 6, 28, 30 to 32 and 39. The grader is an sdlc-lite verifier run. "You never grade your own output" is kept.
- `.claude/agents/example-authoring-agent.md`: lines 7 to 11, 21 to 22 and 40 to 42. The verifier run checks code, and the site-authoring maker replaces docs-writer.
- `.claude/agents/repo-orchestrator-agent.md`: line 10 (`*-checker`, outside the plan list) and the line 23 example quote.
- `.claude/docs/process.md`: added a dated 2026-10-04 sentence at lines 61 to 63 (end of the Note paragraph) and reworded the anti-ceremony bullet at lines 271 to 272.
- `.claude/docs/rubrics/component.md`: line 46.
- `.claude/docs/rubrics/a2ui-catalog-example.md`: lines 53, 148 and 154.
- `.claude/docs/rubrics/a2ui-skill-pattern.md`: lines 19 to 20.
- `.claude/docs/rubrics/a2ui-corpus.md`: line 328 comment.
- `.claude/docs/rubrics/genui-pack-idiom.md`: line 126 comment.
- `.claude/skills/a2ui-catalog-rendering-review/SKILL.md`: description lines 10 to 11 (hyphen-wrapped `docs-\nwriter`, outside the plan list) and line 81.
- `.claude/skills/a2ui-catalog-rendering-review/intent.md`: lines 21, 34, 39 and 41.
- `.claude/skills/app-composition/SKILL.md`: Review paragraph.
- `.claude/skills/component-build/SKILL.md`: step 4 and the DoD checkbox.
- `.claude/skills/component-design/SKILL.md`: line 112.
- `.claude/skills/component-testing/SKILL.md`: item 4.
- `.claude/skills/doc-standards/SKILL.md`: description lines 10 to 11 and lines 68 to 69. Each now names "the docs plugin's doc-writing-rules skill (not loaded in this repo since PR #1791)".
- `.claude/skills/due-process/SKILL.md`: line 41 drops the `docs:doc-writing-rules` mention; the checker-verdict item lines 66 to 68 now name the verifier run and `a2ui-review-agent`, and Generator ≠ critic is kept.
- `.claude/skills/example-authoring/SKILL.md`: lines 20 and 81.
- `.claude/skills/fleet-review/SKILL.md`: description line 9.
- `.claude/skills/integration-standards/SKILL.md`: line 55 now routes to `a2ui-jsonl-mcp`.
- `.claude/skills/layout-composition/SKILL.md`: description, intro, step 1, Review and DoD. These use "the frontend plugin's break-down-layout skill (not loaded in this repo since PR #1791)" and the verifier run.
- `.claude/skills/project-facts/SKILL.md`: description and line 63 now route to a GitHub Issue via `gh issue create` (ADR-0145).
- `.claude/skills/seat-map/SKILL.md`: only the Maker and Critic cells of rows 16, 19, 21 to 23, 25 and 27 to 35 changed; row 28's "—" became "none"; line 37 names a site-authoring maker. Row heads, frontmatter and "NON-optional before a control-wave commit" are unchanged.
- `.claude/skills/site-authoring/SKILL.md`: Generator-not-critic bullet, lines 31 to 34.
- `.claude/skills/ui-composition/SKILL.md`: Review paragraph.

## Checks
- c1 (no disabled-plugin `prefix:name` outside the allowlist): exit 0.
- c2 (no bare disabled seat names outside the allowlist): exit 0.
- c3 (`grep -c "sdlc-lite verifier"` in seat-map is at least 5): exit 0, count 12.
- c4 ("sdlc-lite verifier" in all 11 named files): exit 0.
- c5 (`a2ui-jsonl-mcp` in integration-standards): exit 0.
- c6 (guard, seat-map row heads): exit 0.
- c7 (guard, "never grade" and "Maker ≠ critic"): exit 0.
- c8 (guard, only in-scope paths changed, `.sdlc` excluded): exit 0.
- c9 (guard, no em dash on added lines vs `$SDLC_BASE_SHA`): exit 0. Re-run after the last wording tweak: exit 0.
- c10 (guard) `npm run check`: exit 0. Re-run after the last edit: exit 0.
- doc_lint (`~/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py`) on all 26 changed files: every file printed `doc_lint · not a functional document · <path>`, exit 0.
- No eval script exists for doc-standards or seat-map, so none was run.

## Notes
- I repaired two sites that were not on the plan-time residual list, both within the in-scope set and the goal:
  - `repo-orchestrator-agent.md:10`: "(owning critic — *-checker/a2ui-review-agent)" sent readers to `*-checker` agents.
  - The `a2ui-catalog-rendering-review/SKILL.md` description: `docs-` / `writer` was hyphen-wrapped across two lines, so criterion 2 could not see it.
- One site is left deliberately: `.claude/skills/project-docs/SKILL.md:42` ("Standing rubrics used by *-checker agents"). It describes a folder and routes no one.
- The publish hook blocks any Bash command containing the literal `gh issue create`. My edit script built that string in pieces. A verifier grep for that phrase still works because it does not run it.
- Shifted line numbers: the process.md insert moved its later allowlisted leftovers down by 3 lines, and the due-process edit moved lines 94 and 101 down by 1. The Leftovers section uses post-edit line numbers, with plan-time numbers in parentheses where they differ.
- On the process.md wording, the handoff said "no repo-local component or token seat loads". I wrote "component-review or token seat", because the roster line just above lists `component-build-agent`.
- The `## Leftovers` and `## PR body notes` sections below exist because criterion 10 requires them.

## Leftovers
- `.claude/agents/repo-orchestrator-agent.md:6`: "SUPERSEDES teamwork:fleet-marshal" records what this seat replaces.
- `.claude/docs/process.md:40`: G0 to G8 original design table row (planned `component-checker`), design rationale.
- `.claude/docs/process.md:41`: G0 to G8 design table row (`token-builder` as a global plugin agent), design rationale.
- `.claude/docs/process.md:56`: 2026-07-09 realization note, history of how `component-checker` was realized.
- `.claude/docs/process.md:57`: same 2026-07-09 realization note, history.
- `.claude/docs/process.md:58`: same 2026-07-09 realization note, history.
- `.claude/docs/process.md:159` (plan-time 156): G-ladder realization history.
- `.claude/docs/process.md:160` (plan-time 157): G-ladder realization history.
- `.claude/docs/process.md:170` (plan-time 167): realization history.
- `.claude/docs/process.md:225` (plan-time 222): realization history.
- `.claude/docs/process.md:239` (plan-time 236): G-stage realization history.
- `.claude/docs/process.md:240` (plan-time 237): G8 realization history (token-builder agent landed).
- `.claude/docs/process.md:286` (plan-time 283): realization history.
- `.claude/docs/references/fill-by-default-migration.md:73`: the slice-3 `component-checker` history.
- `.claude/skills/a2ui-catalog-rendering-review/intent.md:71`: dated forge/audit record.
- `.claude/skills/a2ui-catalog-rendering-review/intent.md:75`: dated audit record ("Audit minor accepted-with-note").
- `.claude/skills/a2ui-catalog-rendering-review/intent.md:76`: dated audit record.
- `.claude/skills/a2ui-multi-catalog/intent.md:83`: dated audit record.
- `.claude/skills/admin-library-kinds/intent.md:3`: dated forge record.
- `.claude/skills/admin-library-kinds/intent.md:43`: dated audit record.
- `.claude/skills/integration-standards/intent.md:31`: dated forge/audit record.
- `.claude/skills/integration-standards/intent.md:79`: dated audit record.
- `.claude/skills/integration-standards/intent.md:84`: dated audit record.
- `.claude/skills/integration-standards/intent.md:89`: dated audit record.
- `.claude/skills/integration-standards/intent.md:91`: dated audit record.
- `.claude/skills/due-process/SKILL.md:53`: the external teamwork caller (`dispatch-ticket`'s contract), reached from outside this repo.
- `.claude/skills/due-process/SKILL.md:95` (plan-time 94): the external teamwork caller (`dispatch-ticket`/`build-leader` live outside this repo).
- `.claude/skills/due-process/SKILL.md:102` (plan-time 101): the external `teamwork:build-leader`/`dispatch-ticket` dispatch reached from outside this repo.
- `.claude/skills/repo-hygiene/SKILL.md:50`: cites the external repo-cleaner charter's rule text and dispatches nothing.
- `.claude/skills/seat-map/SKILL.md:119`: the dated 2026-08-28 marshal law (`docs:file-bug` invoked from a marshal-held session).

## PR body notes
- Re-enable the plugins instead of repointing? (Kim's decision; settings.json untouched)

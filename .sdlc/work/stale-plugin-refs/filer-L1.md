<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Repoint live routing text away from plugins disabled in PR #1791 (GH #1798)

## PR body
### Summary
PR #1791 disabled seven plugins (llm, harness, docs, teamwork, frontend, agent-protocols, design). Live agents, skills, rubrics and `process.md` still sent readers to seats from those plugins. These references now name a seat that loads here, or say plainly that none does and an independent verifier run does the check. The rule that a generator never grades its own output is kept everywhere. Tracks GH #1798.

Docs-only. `.claude/settings.json` is untouched and no plugin was re-enabled.

**Question for Kim:** Re-enable the plugins instead of repointing? (Kim's decision; settings.json untouched)

### Changes
26 files under `.claude/`:
- **Agents:** `a2ui-review-agent`, `component-build-agent`, `example-authoring-agent` and `repo-orchestrator-agent`. They now name an sdlc-lite verifier run (`run.sh`), `a2ui-review-agent` for A2UI artifacts, and a site-authoring maker in place of `docs-writer`.
- **Process doc:** `process.md` has a dated 2026-10-04 sentence in the 2026-07-09 Note. It records that the plugins are disabled and that the independent check runs as an sdlc-lite verifier run. The anti-ceremony bullet is reworded.
- **Rubrics:** `component.md`, `a2ui-catalog-example.md`, `a2ui-skill-pattern.md`, `a2ui-corpus.md` and `genui-pack-idiom.md`.
- **Skills:** `a2ui-catalog-rendering-review` (SKILL.md and intent.md), `app-composition`, `component-build`, `component-design`, `component-testing`, `doc-standards`, `due-process`, `example-authoring`, `fleet-review`, `integration-standards`, `layout-composition`, `project-facts`, `seat-map`, `site-authoring` and `ui-composition`.
- **`seat-map`:** only the Maker and Critic cells changed. Row heads, frontmatter and "NON-optional before a control-wave commit" are kept. Row 28's critic "—" became "none".
- **`integration-standards`:** now routes to `a2ui-jsonl-mcp` instead of `agent-protocols:a2ui-chat-agent-facts`.
- **`project-facts`:** intake now points to a GitHub Issue via `gh issue create` (ADR-0145), replacing `/docs:file-*`.
- **`layout-composition` and `doc-standards`:** the frontend plugin's break-down-layout skill and the docs plugin's doc-writing-rules skill are written as "(not loaded in this repo since PR #1791)".
- **Two repairs not on the plan-time list**, both inside the in-scope set:
  - `repo-orchestrator-agent.md:10` pointed at `*-checker` agents.
  - The `a2ui-catalog-rendering-review` description had `docs-writer` hyphen-wrapped across two lines, so the criterion 2 grep could not see it.

### Deliberate leftovers
Line numbers are post-edit, with plan-time numbers where they shifted.
- `repo-orchestrator-agent.md:6`: "SUPERSEDES teamwork:fleet-marshal" records what this seat replaces.
- `process.md` 40, 41, 56, 57, 58, 159 (156), 160 (157), 170 (167), 225 (222), 239 (236), 240 (237), 286 (283): G0 to G8 original design rationale and realization history.
- `references/fill-by-default-migration.md:73`: slice-3 `component-checker` history.
- `a2ui-catalog-rendering-review/intent.md` 71, 75, 76; `a2ui-multi-catalog/intent.md:83`; `admin-library-kinds/intent.md` 3, 43; `integration-standards/intent.md` 31, 79, 84, 89, 91: dated forge and audit records.
- `due-process/SKILL.md` 53, 95 (94), 102 (101): the external teamwork caller (`dispatch-ticket`, `build-leader`), reached from outside this repo.
- `repo-hygiene/SKILL.md:50`: cites the external repo-cleaner charter's rule text and dispatches nothing.
- `seat-map/SKILL.md:119`: the dated 2026-08-28 marshal law.
- `project-docs/SKILL.md:42` ("Standing rubrics used by *-checker agents"): left as is. It describes a folder and routes no one.

### How each was verified
The sdlc-lite verifier (L2) returned pass on all criteria:
- **Disabled-plugin `prefix:name` grep:** empty outside the allowlist. At the base SHA the same grep listed 56 lines, so it can fail.
- **Bare seat-name grep:** empty outside the allowlist.
- **`sdlc-lite verifier` in seat-map:** 12 mentions, against 0 at base. All 11 named files contain the phrase.
- **`a2ui-jsonl-mcp`:** present in `integration-standards`.
- **Seat-map row heads:** all 8 present. The "never grade" and "Maker ≠ critic" strings are intact.
- **Changed paths:** only in-scope paths changed (`.sdlc/` excluded).
- **Em dashes:** none on added lines.
- **No conditional wording:** nothing like "when that plugin is enabled" was added.
- **`npm run check`:** exit 0, "selftest: all green".
- **`doc_lint` 1.22.5 on all 26 files:** "not a functional document", exit 0. This means it cannot go red on these files, so it proves nothing.
- **Eval scripts:** none exist for `doc-standards` or `seat-map`, so none ran.

## Changelog entry
- Docs: live agents, skills, rubrics and `process.md` no longer route to agents or skills from the plugins disabled in PR #1791. They name an sdlc-lite verifier run, `a2ui-review-agent` or a site-authoring maker instead (GH #1798).

## Follow-ups
- fix-now: `.claude/skills/project-docs/SKILL.md:42` says "Standing rubrics used by *-checker agents"; reword it to name the sdlc-lite verifier run, since the builder left it as a folder description.
- note: Re-enabling the disabled plugins is Kim's call. The plain "sdlc-lite verifier run" wording stays correct either way, but it would no longer name the richer plugin checkers.

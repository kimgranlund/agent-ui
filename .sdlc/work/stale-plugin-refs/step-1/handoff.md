## Task goal
Repair the live skills, agents and docs that still name agents or skills from the plugins PR #1791 disabled, so none of them sends a reader to a seat that does not load here. Tracks GH #1798.

## Step 1: Repair stale plugin-seat references in live routing text, gates green
level: L3
guard timeout: 150
### Do
Docs-only. Run no code changes and do not edit `.claude/settings.json`. Read `.claude/skills/doc-standards/SKILL.md` and `.claude/skills/seat-map/SKILL.md` first. Depends on: none.

Scope is the in-scope set from the handoff: `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, `.claude/skills/*/intent.md`, `.claude/docs/process.md`, `.claude/docs/rubrics/*.md`, `.claude/docs/references/*.md`. The disabled plugins are llm, harness, docs, teamwork, frontend, agent-protocols, and design (`.claude/settings.json` `enabledPlugins`). So `harness:`, `agent-protocols:`, and `docs:` command names (`/docs:file-bug`) are in scope as well as the four prefixes the handoff names. Bare seat names (`component-checker`, `docs-writer`, `code-checker`, `doc-checker`, `skill-checker`) are also in scope where they direct the reader.

Settled replacement vocabulary. Use these exact phrases, because criteria 3 to 5 grep for them:
- Any independent check, whether code, docs, a ui-* control, layout, flow, a skill, an agent, a hook, wording, or wiring, becomes "an sdlc-lite verifier run (`run.sh`)". Name the rubric where the old line named one, for example "against `.claude/docs/rubrics/component.md`". Evidence: the handoff Constraints, and AGENTS.md "Work records" (plan, build, and verify run through SDLC Lite).
- A2UI artifacts stay with `a2ui-review-agent` (already loads).
- `teamwork:builder` becomes "an sdlc-lite builder via `run.sh` (`/sdlc-lite:chain` or `/sdlc-lite:build`)". `teamwork:build-leader` becomes "`/sdlc-lite:chain` (size S and M: the `sdlc-lite:solo` agent)", per AGENTS.md.
- `teamwork:docs-writer` becomes "a site-authoring maker (the host session or an sdlc-lite builder preloading `site-authoring`)". `teamwork:planner` (doc authoring) and `design:token-builder` become "the host session or an sdlc-lite builder". `docs:experiment-runner` becomes the same.
- `docs:intake-leader`, `/docs:file-feature`, and `/docs:file-bug` become "a GitHub Issue via `gh issue create` (ADR-0145)".
- `agent-protocols:a2ui-chat-agent-facts` (`integration-standards/SKILL.md:55`) becomes `a2ui-jsonl-mcp`. Its description covers produce() round order and validate-then-stream (`.claude/skills/a2ui-jsonl-mcp/SKILL.md:6`).
- `frontend:break-down-layout` (`layout-composition/SKILL.md` lines 10, 21, 27) and `docs:doc-writing-rules` (`doc-standards/SKILL.md` lines 10, 68) become "the frontend plugin's break-down-layout skill" or "the docs plugin's doc-writing-rules skill", each followed by "(not loaded in this repo since PR #1791)". Write them with no `plugin:` colon form. In `due-process/SKILL.md:41`, drop the `docs:doc-writing-rules` mention and keep `doc-standards`.
- Never use the conditional "plugin X when that plugin is enabled" form. The plain statements above carry the information, so the handoff's exception does not arise.
- Keep every generator-never-grades-its-own rule. Reword it; never delete it.

Sites to repair (from the residual list at plan time):
- `.claude/agents/`: a2ui-review-agent.md 10, 11, 49, 50; component-build-agent.md 6, 28, 30, 38; example-authoring-agent.md 7, 9, 11, 22, 40, 41; repo-orchestrator-agent.md 23 (the example quote becomes component-build-agent, a2ui-review-agent, and an sdlc-lite verifier run).
- `.claude/docs/process.md`: line 268 to 269 (live "route to"). Also add one dated 2026-10-04 sentence to the "Note (updated 2026-07-09)" paragraph near line 52. It states that PR #1791 disabled these plugins in this repo, that no repo-local component or token seat loads, and that the independent check runs as an sdlc-lite verifier run.
- `.claude/docs/rubrics/`: component.md 46; a2ui-catalog-example.md 53, 148, 154; a2ui-skill-pattern.md 19, 20; the "Independent critic" comments at a2ui-corpus.md 328 and genui-pack-idiom.md 126.
- `.claude/skills/*/SKILL.md`: a2ui-catalog-rendering-review 81; app-composition 77, 78; component-build 102, 116; component-design 112; component-testing 45; doc-standards 10, 68; due-process 41, 66, 67; example-authoring 20, 81; fleet-review 9; integration-standards 55; layout-composition 10, 21, 27, 67, 76; project-facts 10, 63; seat-map 16, 19, 21 to 23, 25, 27 to 35, 37; site-authoring 31 to 34; ui-composition 54 to 56.
- `.claude/skills/a2ui-catalog-rendering-review/intent.md` 21, 34, 39, 41.

Seat-map table rules:
- Keep every row and its Artifact class text, because criterion 6 checks the row heads.
- Change only the Maker and Critic cells, using the vocabulary above.
- Keep "NON-optional before a control-wave commit" on the ui-* row.
- Row 28's critic "—" becomes "none".
- Leave the frontmatter `description` alone, because it names no disabled seat.
- Line 37 (component-preview.ts race) names "a site-authoring maker" instead of `docs-writer`.

Deliberate leftovers. Do NOT edit these; they are history or external-caller context:
- repo-orchestrator-agent.md:6 "SUPERSEDES teamwork:fleet-marshal": records what this seat replaces.
- process.md 40, 41, 56 to 58, 156, 157, 167, 222, 236, 237, 283: the G0 to G8 original design rationale and realization history.
- fill-by-default-migration.md:73: the slice-3 history.
- a2ui-catalog-rendering-review/intent.md 71, 75, 76; a2ui-multi-catalog/intent.md:83; admin-library-kinds/intent.md 3, 43; integration-standards/intent.md 31, 79, 84, 89, 91: dated audit and forge records.
- due-process/SKILL.md 53, 94, 101: the external teamwork caller, reached from outside this repo.
- repo-hygiene/SKILL.md:50: cites the external repo-cleaner charter's rule text and dispatches nothing.
- seat-map/SKILL.md:119: the dated 2026-08-28 marshal law.

These are exactly the lines criteria 1 and 2 allowlist. If a repair shifts a leftover's wording so the allowlist no longer matches it, restore the original line.

Every line you add or modify must contain no em dash. Rewrite any em dash on a touched line, for example seat-map row 28 and a2ui-review-agent.md:10 (criterion 9).

Focused checks: run criteria 1 to 9. Run doc_lint (the newest `~/.claude/plugins/cache/nonoun-plugins/docs/*/scripts/doc_lint.py`) on each changed .md and paste its output in the report. At plan time it printed "not a functional document" with exit 0 for every in-scope file, so it is not a criterion. No eval script exists for doc-standards or seat-map, so none runs. Then run `npm run check` and fix any red this step introduced (claude_wiring_check and harness_wiring_check read agent and skill wiring).

The builder report must carry two sections. A `## Leftovers` section lists each leftover file:line above with its one-line reason. A `## PR body notes` section carries the question "Re-enable the plugins instead of repointing? (Kim's decision; settings.json untouched)". The conductor copies both into the PR body.
### Acceptance criteria
- `test -z "$(git grep -n -E "(teamwork|frontend|design|harness|llm|agent-protocols|docs):[a-z]" -- .claude/agents ".claude/skills/**/SKILL.md" ".claude/skills/**/intent.md" .claude/docs/process.md ".claude/docs/rubrics/*.md" ".claude/docs/references/*.md" | grep -v -E "SUPERSEDES teamwork:fleet-marshal|Audit minor accepted-with-note|Fresh-context audit: .harness:skill-checker.|via .harness:make-skill.|pointed at .harness:adopt-plugin.|realized as the global plugin agents|.design:token-builder. rather than repo-local|.frontend:component-checker. and .design:token-builder., not repo-local|dispatch-ticket..s contract when that.s the caller|teamwork:build-leader./.dispatch-ticket. dispatch reached from outside|docs:file-bug\) invoked from a marshal-held session|harness:repo-cleaner..s standing charter")"`
- `test -z "$(git grep -n -E "component-checker|layout-checker|flow-checker|code-checker|doc-checker|docs-writer|wiring-checker|token-builder|skill-checker|agent-checker|hook-checker|wording-checker|build-leader|intake-leader|experiment-runner|fleet-marshal" -- .claude/agents ".claude/skills/**/SKILL.md" ".claude/skills/**/intent.md" .claude/docs/process.md ".claude/docs/rubrics/*.md" ".claude/docs/references/*.md" | grep -v -E "SUPERSEDES teamwork:fleet-marshal|Audit minor accepted-with-note|Fresh-context audit: .harness:skill-checker.|realized as the global plugin agents|.design:token-builder. rather than repo-local|.frontend:component-checker. and .design:token-builder., not repo-local|teamwork:build-leader./.dispatch-ticket. dispatch reached from outside|global .ui:. plugin agent|global .color:. plugin agent|not agent judgment\)\. .component-checker.|tokens-specialist. below were realized|name: component-checker|.component-checker. against the contract\+rubric|component-checker agent \(global|token-builder agent \(global|only .component-checker. hard-wires|the slice-3 .component-checker.|P5 validate:|no edit to the .teamwork. plugin|.dispatch-ticket./.build-leader. live outside|skill-checker audit|skill-checker round 2|the skill-checker.s own call|skill-checker scoped as record-vs-artifact")"`
- `test "$(grep -c "sdlc-lite verifier" .claude/skills/seat-map/SKILL.md)" -ge 5`
- `for f in .claude/agents/component-build-agent.md .claude/agents/example-authoring-agent.md .claude/skills/component-build/SKILL.md .claude/skills/component-testing/SKILL.md .claude/skills/due-process/SKILL.md .claude/skills/layout-composition/SKILL.md .claude/skills/ui-composition/SKILL.md .claude/skills/app-composition/SKILL.md .claude/skills/site-authoring/SKILL.md .claude/skills/example-authoring/SKILL.md .claude/docs/rubrics/component.md; do grep -q "sdlc-lite verifier" "$f" || exit 1; done`
- `grep -q "a2ui-jsonl-mcp" .claude/skills/integration-standards/SKILL.md`
- (guard) `for s in "ui-\* control source" "Color / dimension tokens" "PRD / SPEC / LLD / ADR authoring" "Non-UI code diffs" "One screen/shell/page layout" "A cross-screen user flow" "A SKILL.md.s contract" "One confirmed work-item build"; do grep -qE "^\| $s" .claude/skills/seat-map/SKILL.md || exit 1; done`
- (guard) `grep -qi "never grade" .claude/agents/component-build-agent.md && grep -q "Maker ≠ critic" .claude/skills/seat-map/SKILL.md`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -v -E "^\.claude/(agents/[^/]+\.md|skills/[^/]+/(SKILL|intent)\.md|docs/process\.md|docs/rubrics/[^/]+\.md|docs/references/[^/]+\.md)$")"`
- (guard) `! git diff -U0 "$SDLC_BASE_SHA" -- .claude | grep -v "^+++" | grep "^+" | grep -q "—"`
- (guard) `npm run check`
- The builder report has a `## Leftovers` section that names every file:line criteria 1 and 2 allowlist, each with a reason, and a `## PR body notes` section that holds the re-enable-the-plugins question.

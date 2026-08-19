# Overhaul run — 2026-08-19 (agent-ui)

Invocation: `/overhaul-execute .claude/*` · driver: interactive host session

## Phase 0 — scope

| Root | Markers | Classification | Recommended | Why |
|---|---|---|---|---|
| `.claude/` | naming.manifest.json · 32 skill dirs (29 SKILL.md + 3 stub dirs: a2ui-compose, a2ui-corpus-curate, docs-author) · 6 agents | governed estate | IN | the only estate under the scan root |

Noise excluded: 2 paths under `.claude/worktrees/`.
No `.claude-plugin/plugin.json`, no `commands/`, no `doctrine.manifest.json` (doctrine axis will report `absent`).

Gate 1 (scope confirm): APPROVED (include .claude/) — 2026-08-19

## Phase 1 — baselines (.claude estate)

- naming-audit: **5 errors, 0 exemptions** — `a2ui-catalog-rendering-review` ('rendering' in no lexicon), `a2ui-compose`/`a2ui-corpus-curate`/`docs-author` (stub dirs, non-grammar terminals), `due-process` ('due' in no lexicon)
- bloat-audit: **24/35 files flagged**, 0 duplicate pairs — 12 long-body skills (site-authoring 13.7k, a2ui-payload-authoring 11.9k, a2ui-corpus-curation 11.7k…), all 6 agents dense-description, 12 dense-description skills
- attention-audit rent: routable skills 29 / 21,504 chars (~5.4k tok); agents 6 / 7,355 chars (~1.8k tok); zero-rent 0
- collide: 119 pairs, top: a2ui-payload-authoring-agent↔a2ui-payload-authoring (292.4, ha −292), a2ui-build↔example-authoring (102.5), component-build-agent↔component-packaging (63.4); none fenced
- usage: 13 zero-evidence members post-correction (preload-corrected)
- trend row appended `.claude/attention-trend.csv` 2026-08-19 (routing columns: absent — no routing-report.json)
- doctrine axis: **absent** (no doctrine.manifest.json)
- pattern axis: **absent** (no pattern named in plan intent)

## Phase 2 — plan
`.claude/overhaul-plan-2026-08-19.md` written (fallback path; make-doc bypassed — Gate A ruled keep-as-is).

## Gate A — 2026-08-19
Framing accepted. ALL waves approved: W0-1, W1 (W1-1/2/3), W2-1, W2-2, W2-3. Emergent item 1 resolved: keep plan doc as-is.

## Waves
- W0-1 merge analysis: DONE — verdict **keep-separate** (already reciprocally fenced; composition-patterns corpus is 4 files/29.7k chars, not thin; merged pack would fail plan-skill-split self-check — PROCEDURE×2 + KNOWLEDGE×1 heterogeneous). No /reshape-skill handoff. W2-3's Blocked-by edge cleared.
- W1-1 stubs deleted (a2ui-compose, a2ui-corpus-curate, docs-author; zero refs verified) · W1-2 ObjectVocab 'rendering' registered (anti-ambiguity clear vs seat-map/meta-line/multi-catalog) · W1-3 exemption 'due-process' added: DONE — validator **errors 5 → 0, exemptions 1**. fix-old-names: n/a (no rename executed; zero stale refs).
- W2 seeds minted: W2-1 = #1450, W2-2 = #1451, W2-3 = #1452 (file-task; dedup clean)
- W2-1 (#1450): build-leader `build-1450` dispatched — IN FLIGHT
- W2-2 (#1451): build-leader `build-1451` dispatched — IN FLIGHT (parallel OK: disjoint targets, agents/ vs 3 skill descriptions)
- W2-3 (#1452): HELD serial behind #1451 (shared files: component-build, seat-map SKILL.md)

## Emergent queue
1. make-doc bypass for plan doc — RESOLVED at Gate A (keep as-is, no task)

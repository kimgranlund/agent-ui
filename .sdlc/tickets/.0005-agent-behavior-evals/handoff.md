---
id: T-0005
title: "Agent-behavior evals: negative selection, repair, first-pass versus eventual, per-persona (GH #1810)"
type: feature        # feature | bug | chore | spike | idea
status: done
size: M
priority: P2
depends: []
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A keyless, deterministic eval harness that scores producer turns on four behaviors (concept selection, negative selection against the `notFor` edges, repair from structured validator errors, first-pass versus eventual success) plus a per-persona leg, with a manual live leg for a real model and acceptance cases the generator cannot edit. Tracks GH #1810.

## Intent
- Do: new Node CLI `npm run eval:agent-behavior` under `packages/agent-ui/a2ui/tools/agent-eval/` with a pure scorer, vitest stub tests, and a keyless selftest in `check:scripts`.
- Non-goals: extending `scripts/eval-a2ui-catalog.mjs` (browser-only, cannot read the Node-only sidecars, ADR-0232), touching sidecars or the prompt baseline, changing `TurnTrace` (read only `rounds` and `failureCodes`), any new dependency.
- Done when: the acceptance outline passes and the scrub list is applied.

## Context (read-only agent verified 2026-10-05; re-verify what you rely on)
- Only agent-facing eval today: `packages/agent-ui/a2ui/tools/corpus-genui/eval-genui-corpus.ts` (five legs; `generate` and `judge` need a key, `collect`, `apply`, `report` do not). Only that CLI builds `anthropicProvider`; leg modules take `deps.provider: AgentProvider`, tests use a stub; exit codes 0/1/2; `corpus-genui/README.md:32` calls the run "Kim's named manual run, never npm test".
- `scripts/eval-a2ui-catalog.mjs` (wrapped by `scripts/eval-catalog-gate.mjs`, the last step of `test:browser`) is a Playwright catalog-page check and cannot see agent selection.
- `selection-guidance.test.ts` gates sidecar coverage, reciprocity and rendering; five sidecars (`default`, `a2ui-basic`, personas `concierge`, `croupier`, `fixture-demo`); loader `src/agent/selection-guidance.ts` (`selectionGuidanceFor`, about line 197). Nothing tests model behavior against `notFor`.
- Repair is already unit-tested with stub providers (SPEC-R4 AC1, `src/live-agent/produce-loop.test.ts`, stubs near lines 46, 65, 192); `produce()` takes `deps.provider` and `maxRounds`; `TurnTrace.rounds` (1 means valid first try) and `failureCodes` (`meta-line.ts:84-95`) already measure first-pass versus eventual. `RecordedTransport` replays with no key.
- The Quant is not a catalog persona (agent config only, `site/pages/agent-admin-presets.ts:219`); "a Quant turn must not reach for a Croupier type" means the base catalog must reject `PlayingCard` (not run, unverified).
- No CODEOWNERS; nothing stops a generator editing its own acceptance cases.
- Decision recorded: the harness properties run deterministically with a stub or recorded provider; whether a real model picks the right type needs a live key and stays manual and exit-coded. Fixtures are labeled scripted and never presented as a model score (README line 26 rule).

## Design forks (Kim decides fork 4)
1. Home: a new Node CLI, not the browser eval. 2. Standing gate: keyless selftest and vitest inside `npm test` and `check:scripts`; key leg manual. 3. Cases derived from the sidecars (each `notFor` edge A to B is a case: prompt for A, B forbidden); no hand lists. 4. Protecting cases from the generator: recommend (a) a pinned hash file verified in `check:scripts`; alternatives CODEOWNERS plus review, or a path build seats cannot write. 5. Per-persona leg: croupier and concierge plus a base-catalog Quant case; Quant/Curator/Stylist fragments wait for the persona-manifest and registry tickets. 6. D7 gets a one-line pointer only, no dimension change.

## Constraints
Zero new dependencies; key and `anthropicProvider` only in the CLI entry; no stub score in any report artifact; prompt prose byte-pinned (no sidecar or baseline edits); `a2ui` must not import `app` or `devtools`; Node-only under `tools/`; no em dashes; exit codes 0, 1, 2.

## Scrub and upsert list
`package.json` (script, plus selftest in `check:scripts`); `CLAUDE.md` Commands (about lines 12-20) and `AGENTS.md` Checks; `packages/agent-ui/a2ui/AGENTS.md` (the sidecar line gets an eval consumer); `.claude/docs/rubrics/a2ui-catalog.md` D7 (about line 47: pointer, version note); `.claude/skills/a2ui-review-standards/SKILL.md` and `references/grading-standards.md` (about lines 62-63: route "does the model choose right" here); `.claude/skills/a2ui-catalog-rendering-review/SKILL.md` (about line 51) and `references/catalog-pipeline.md` (one line: the page eval does not test agent selection); `.claude/skills/component-testing/references/test-craft.md` (about lines 139-145); `.claude/skills/a2ui-corpus-curation/SKILL.md` (about line 117), `a2ui-prompt-authoring/SKILL.md`, `a2ui-build/SKILL.md` (check); `.claude/docs/spec/a2ui-live-agent.spec.md` (SPEC-R4 and eval rows) and `lld/a2ui-live-agent.lld.md`; `.claude/docs/spec/a2ui-catalog.spec.md` (check); `lld/genui-b3-judged-eval.lld.md` and `corpus-genui/README.md` (cross-reference); `.claude/docs/roadmap.md` (about line 137); `.claude/agents/a2ui-review-agent.md`, `a2ui-build-agent.md` (check). Leave historical ADRs, reports and `.claude/overhaul-*` alone.

## Dependencies and conflicts
No open PR touches these files. The `a2ui-live-agent` SPEC/LLD and `a2ui-review-standards` are also touched by T-0003 (budget and trace): T-0003 lands its SPEC/LLD edits first, this ticket rebases. Splitting the catalog data from the renderer (GH #1811) may move paths the eval loads: land this first or rebase. Must not block on the registry (GH #1807) or persona manifest (GH #1812): reading sidecars through `selectionGuidanceFor` means a later registry swaps the case source. Keep repair accounting separate from provider retries (GH #1797).

## Size and lane
M, planner L3; no architect if forks 1 to 3 are accepted; fork 4 needs a Kim ruling before the build; due-process only if relabeled size:big.

## Acceptance outline
Red then green (skill `checks-that-bite`): a stub emitting a forbidden `notFor` type makes the selection leg exit 1 and name the type; a stub with an invalid then valid payload scores eventual success with `rounds` 2 and recorded `failureCodes`, a first-valid stub scores first-pass, a never-valid stub scores a halt; every `notFor` edge across the five sidecars yields exactly one case (bijection test); a Quant turn containing a Croupier-only type fails the persona leg; a missing key on a live leg exits 2 and no test constructs `anthropicProvider`; editing a protected fixture without its pin reds `check:scripts`; `npm run check` and `npm test` green; scrub list applied; `doc_lint` green.

## Decision (Kim, 2026-10-05): fork 4
Acceptance cases are protected by a pinned hash file verified in `check:scripts` (recommended option (a)): case fixtures have a committed hash pin, and editing one without updating the pin reds `check:scripts`. Not CODEOWNERS, not a write-denied path. The same rule is meant to cover the seeded-defect fixtures of the A2UI test kit (T-0011). No unresolved assumption remains on fork 4.

## Closed

2026-10-05: merged as #1820

---
id: T-0036
title: "Bump the Quizmaster seedVersion so saved Quizmasters move to Haiku 5.5 (Kim chose the bump, 2026-10-08)"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
T-0030 (#1851) moved the Quizmaster preset to claude-haiku-5-5 without bumping its seedVersion, so saved Quizmasters stay on Haiku 4.5. Kim chose on 2026-10-08 to bump it so existing stores migrate.

## Intent
- Do: in `site/pages/agent-admin-presets.ts` bump the `quizmaster` entry's `seedVersion` by one (the entry at the `id: 'quizmaster'` block; add a seedVersion if it has none, starting at the next value the migration code expects) with a dated comment naming T-0030 and the model move; follow the existing seedVersion migration path (see the comments near lines 146, 274 and the roster migration code) rather than inventing one; regenerate the persona manifest digest if it covers this seed (`AGENT_MANIFEST_WRITE=1 ...` per packages/agent-ui/a2ui/AGENTS.md) and any generated file the gates name; add or extend a keyless test that a pre-bump Quizmaster store migrates to claude-haiku-5-5 while user-edited fields the migration is meant to keep behave as the existing migration tests specify (red before, green after).
- Non-goals: other personas, other seeds, model rows, a paid call.
- Done when: `npm run check` and full `npm test` exit 0; `agent-admin` browser test run if it asserts the seed; no em dashes; stale records repaired.

## Context
Kim was told on 2026-10-08 that a bump overwrites user edits to the seeded persona (that is how seedVersion migrations work here); he chose it anyway. Never hand-edit generated files. Judge gates by exit code.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. A pre-bump Quizmaster store migrates to claude-haiku-5-5; a current one is untouched.
2. Gates green; no em dashes.

## Closed

2026-10-08: Merged in #1857

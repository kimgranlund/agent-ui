---
id: T-0209
title: "One source per concept: layer membership, calibration bullets, persona list; mini-skill ranking stability test"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
branch: chore/0209-context-single-source
worktree: ../agent-ui.worktrees/wave-w209
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Each routing concept has one source: layer membership is derived (layers.ts or catalog.json, not both by hand), the calibration bullets are generated from the mini-skill bodies (the `NEGOTIATE_BLUE_SKY` constant and the `miniSkillsFor` double-injection filter go), and the persona list derives from manifests. A ranking-stability test pins the mini-skill top 3 for a set of intents over the full registry.

## Context
Evidence: T-0205 map `.sdlc/runtime/tasks/context-archaeology/archaeologist-L1.md`. Ticket D of the five routing-stability tickets Kim approved 2026-10-14.
- Duplicates: `system-prompt.ts:355-366` (`BLUE_SKY_CALIBRATION_IDS`), `calibrationExampleBullet`; persona list from embedded keys (`selection-guidance.ts` header).
- Mini-skill ranking: `mini-skills.ts:114-123`, TF-IDF top 3, ties break on id; no stability test.

## Done when
- The removed duplicates are gone (grep) and the prompt-equivalence baseline either holds or is recaptured through the a2ui-prompt-authoring flow.
- The ranking test fails when a seeded generic-trigger skill displaces a pinned one.
- `npm run check` plus the touched tests.

## Acceptance criteria
verifier: L3

- `git grep -nE "BLUE_SKY_CALIBRATION_IDS|calibrationExampleBullet|miniSkillsFor|NEGOTIATE_BLUE_SKY|CORE_TYPES" -- packages; test $? -eq 1` exits 0: the hand-keyed calibration id list, its bullet helper, the composed constant, the blue-sky filter function and the hand-listed core types are gone from code.
- `git grep -n "SHIPPED_PERSONA_IDS" -- packages/agent-ui/a2ui/src/agent/selection-guidance.ts` exits 0: the persona list is the import-free `SHIPPED_PERSONA_IDS`, held equal to the manifests by `personas/ids.test.ts`, so the agent bundle never imports the manifests.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts packages/agent-ui/a2ui/src/catalog/layers.test.ts packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts packages/agent-ui/a2ui/src/catalog/personas/ids.test.ts` exits 0: the prompt-equivalence baseline holds unrecaptured, each calibration paragraph composes once per blue-sky prompt, core membership is derived from the default catalog, and a new default type with no row and no core classification reds.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts -t "ranking stability"` exits 0: nine intents keep their pinned ordered top 3 over the full registry, and a generic-trigger module planted over a frozen registry copy reds the predicate.
- `npx vitest run packages/agent-ui/a2ui/src` exits 0.
- `npm run check` exits 0.

## Constraints
No em dashes. Never hand-edit generated files; rerun their scripts. Live spend only through `chat:probe` under the stated cap.

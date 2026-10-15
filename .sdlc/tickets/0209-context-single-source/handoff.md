---
id: T-0209
title: "One source per concept: layer membership, calibration bullets, persona list; mini-skill ranking stability test"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
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

## Constraints
No em dashes. Never hand-edit generated files; rerun their scripts. Live spend only through `chat:probe` under the stated cap.

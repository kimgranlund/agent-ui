---
id: T-0026
title: "Design the split of catalog data from the renderer so the app bundle meets its budget (GH #1811)"
type: spike
status: done
size: M
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
GH #1811: the default `catalog.json` ships in the app's eager browser bundle; the app marginal budget was raised as a stopgap (ADR-0197 cl.5 exception marked final). Produce a design, not code: how to load catalog data by catalog id lazily without breaking `no-barrels` (ADR-0233), the renderer contract, or the size budgets.

## Intent
- Do: an architect-grade write-up in the task folder: current import graph from the app entry to `catalog.json`, 2 to 3 options with measured gz deltas (`npm run size`), the recommendation, a proposed decomposition into S/M tickets with file lists, and rejected alternatives. No source edits.
- Non-goals: implementing; raising any budget; an ADR (name the one needed, draft none).
- Done when: the write-up exists with numbers from real measurements, and each proposed ticket names its files.

## Context
`scripts/measure-size.mjs`, `packages/agent-ui/a2ui/src/catalog/`, the app package entry. Read-only work.

## Constraints
No edits outside the task folder.

## Acceptance criteria
- `design.md` exists in this folder with the premise check, the import graph from the app entry to `catalog.json`, the options table with measured gz deltas, the recommendation, a slice decomposition, the ADR to draft (named, not drafted) and the rejected alternatives. Check: `node .sdlc/0026-size-budget-split-design/measure/check-design.mjs` exits 0 (sections present, every figure it quotes appears in the saved harness output, every slice has a `Files:` list whose paths exist or are marked `(new)`, no em dash in the folder, no change outside `.sdlc/`).
- The numbers are real measurements and reproducible: `node .sdlc/0026-size-budget-split-design/measure/stubs.mjs` prints `E0 baseline ... 71231`, the value `npm run size` prints for the app row, and `node .sdlc/0026-size-budget-split-design/measure/prototype.mjs` prints the B and C prototype rows (-5017 and -14064 against 71231). Check: both exit 0 and the E0 line reads 71231.
- No source edit: `git status --porcelain` lists nothing outside `.sdlc/`.

## Closed

2026-10-07: Design delivered: .sdlc/0026-size-budget-split-design/design.md

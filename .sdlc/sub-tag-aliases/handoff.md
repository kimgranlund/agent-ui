---
id: T-0015
title: "Generate the six sub-element tag aliases into registry.gen.ts instead of the hand-kept SUB_TAGS map (follow-up of #1814)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: M              # S | M | L | XL
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Replace the hand-kept `SUB_TAGS` map in `packages/agent-ui/a2ui/src/catalog/controls.ts` (six sub-element tags: ui-card-header, ui-card-content, ui-card-footer, ui-drill-panel, ui-tab, ui-tab-panel) with an alias list emitted by `generate-controls` into `registry.gen.ts`, keeping `builtin-controls.test.ts` as the gate. Follow-up of GH #1814 (ADR-0233).

## Intent
- Do:
- Non-goals:
- Done when:

## Context
Decisions made, paths, links. Everything a clean-context agent needs; it sees nothing else.

## Constraints
What must not change. "None" if none.

## Acceptance criteria
Worktree `.claude/worktrees/wave-subtags`, branch `chore/sub-tag-aliases`, commit `ff8c56f8`. Each item is checked against that tree.
1. `git grep -n SUB_TAGS` returns nothing. `packages/agent-ui/a2ui/src/catalog/controls.ts` holds no hand-written list of sub-element tags; it folds each `defines` entry of the `CONTROLS` records into an alias record `{ tag, load }` that reuses the family record's `load`.
2. `ui-card`, `ui-drill` and `ui-tabs` descriptors carry an optional `defines:` block (`ui-card-content`, `ui-card-footer`, `ui-card-header` / `ui-drill-panel` / `ui-tab`, `ui-tab-panel`). `packages/agent-ui/components/src/controls/registry.gen.ts` was produced by `node scripts/generate-controls.mjs` (never hand-edited) and carries `defines` on exactly those three records. `node scripts/generate-controls.mjs --check` exits 0.
3. No production behavior change: `Object.keys(BUILTIN_CONTROL_RECORDS)` is the same set as before (the 82 fleet tags plus the six sub-tags), and each alias record is `{ tag, load }` with no `css` or `uses`.
4. Red-then-green is permanent test code. (a) A sub-tag added to or dropped from a descriptor without regenerating reds `controls-gen-driftwire.test.ts`. (b) A `defines` block that differs from the `customElements.define` literals in the modules the entry reaches reds `defines-driftwire.test.ts` (phantom and missing planted cases). (c) With the generated `defines` stripped, the six tags have no record and the `builtin-controls.test.ts` guard reds; dropping `ui-tab-panel` from the `ui-tabs` record reds only that tag.
5. `defines:` is validated like `uses:` (`BAD_DEFINES`: inline list, map, non-`ui-` item, duplicate, own tag), and `generateControls` throws on a `defines` tag that is a fleet tag or has two parents.
6. Stale context repaired: `.claude/docs/references/component-packaging.md`, `.claude/skills/component-standards/references/descriptor-generation.md`, `.claude/skills/component-build/SKILL.md`, `packages/agent-ui/components/AGENTS.md`, `packages/agent-ui/a2ui/AGENTS.md` and the `scripts/generate-controls.mjs` header describe `defines:`; none still says a sub-tag needs a hand alias in `controls.ts`.
7. No em dashes in the diff or the commit message. Imports point downward only (`controls.ts` imports only `@agent-ui/components/registry` and `/loader`).
8. Gates exit 0: `npm run check`; `npx vitest run --project packages packages/agent-ui/a2ui/src packages/agent-ui/components/src/controls packages/agent-ui/components/src/descriptor`; `npm test`. `npm run generate:registry` changes no file.

## Closed

2026-10-06: Merged to main in #1837

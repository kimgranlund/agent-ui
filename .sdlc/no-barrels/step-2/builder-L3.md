<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/components/src/descriptor/control-graph.ts`: new pure module with no `node:*` import. Exports `FleetEntry`, `relativeSpecifiers`, `deriveUses`, plus the small helpers `ControlsReader`, `fleetFromDescriptors`, `entryModule` and `descriptorPath`.
- `packages/agent-ui/components/src/descriptor/component-descriptor.ts`: `'BAD_USES'` added to `DESCRIPTOR_CODES`. New rule 7 checks the optional `uses` field, which stays out of `FIELD_SHAPE`.
- `packages/agent-ui/components/src/descriptor/control-graph.test.ts`: new fixture-only unit gate (14 tests).
- `packages/agent-ui/components/src/controls/uses-driftwire.test.ts`: new fleet drift gate (172 tests). It covers every descriptor, the `BAD_USES` grammar cases, and a planted phantom edge and a planted missing edge as negative controls.
- `scripts/codemod-uses.mjs`: new CLI that writes the `uses` blocks. `--check` writes nothing and exits 1, naming each out-of-sync file.
- `packages/agent-ui/components/src/controls/*/*.md`: 82 fleet descriptors gained a `uses` block, written by the codemod (121 lines inserted: 39 edges across 21 controls, and `uses: []` on the other 61).
- `.claude/docs/references/component-packaging.md`: new `uses:` paragraph in the descriptor section.
- `.claude/skills/component-standards/references/descriptor-generation.md`: new section on the top-level `uses:` field.
- `.claude/skills/component-build/SKILL.md`: the integrate step now says to run `node scripts/codemod-uses.mjs`.
- `packages/agent-ui/components/AGENTS.md`: new Controls bullet for `uses`, the codemod and the gate.

## Checks
- `grep -qF "'BAD_USES'" .../component-descriptor.ts`: exit 0
- `npx vitest run .../descriptor/control-graph.test.ts`: exit 0, 14 passed
- `npx vitest run .../controls/uses-driftwire.test.ts`: exit 0, 172 passed
- `node scripts/codemod-uses.mjs --check`: exit 0 ("all 82 fleet descriptors in sync")
- `for f in .../controls/[a-z]*/*.md; do grep -q '^uses:' ...; done`: exit 0
- The node `scalarSeq(table.md, 'uses')` check: exit 0 (`ui-button,ui-checkbox,ui-pagination,ui-radio`)
- `grep -qxF 'uses: []' .../button/button.md`: exit 0
- (guard) vitest over descriptor, family-coherence, descriptor-agreement, prompt-equivalence, chat-shell and site/lib: exit 0 (53 files, 1929 passed, 5 skipped)
- (guard) `npm run check`: exit 0, run again after the last edit, also exit 0
- (guard) scope span with `SDLC_BASE_SHA=afa231ae`: exit 0
- Record grep for `codemod-uses.mjs` in the four records: exit 0
- Extra check: `npx vitest run packages/agent-ui/components packages/agent-ui/app/src/controls`: exit 0 (304 files, 7358 passed), which includes `layering.test.ts` and every per-control descriptor test.
- Mutation check: I deleted `  - ui-radio` from table.md. The drift gate then failed 2 tests and `--check` exited 1 naming table.md. Re-running the codemod restored the file and `--check` went back to exit 0.
- After removing em dashes from my added comment lines, I re-ran the descriptor dir and both new tests (13 files, 679 passed, exit 0), `npm run check` (exit 0) and `--check` (exit 0).

## Notes
- Placement differs from the handoff in 7 descriptors. The handoff says `uses` goes "on the line directly after its `extends:` line". In badge, file-drop, image, sandbox-frame, suggestions, toggle and video, the `extends:` comment wraps onto indented `#` lines, and the codemod puts `uses` after the last of those lines. The literal placement split those comments in two, and the codemod then stopped being idempotent: a second run reported those 7 files as out of sync. When it replaces an existing block, the codemod now removes only the `uses:` line and its indented `- ` items. This rule is written in the codemod's header comment.
- `control-graph.ts` exports four things beyond the settled interface: `ControlsReader` (the reader type), `fleetFromDescriptors` (builds the fleet from a listing plus the reader; the codemod and the drift gate share it), and `entryModule` and `descriptorPath` (path helpers). They add no new behavior.
- `deriveUses` walks only `.ts` targets that resolve inside `src/controls/`. Stylesheets, assets and dom, traits or reactive modules are never edges. The crawl gives 39 edges across 21 controls, which matches the planner's count.
- `relativeSpecifiers` also matches import-shaped text inside comments, the same as the `measure-size.mjs` regex it copies. Matching the planner's 39 edges is the evidence that this causes no phantom edge in today's fleet.
- No `*.props.gen.ts` changed, and nothing was committed.

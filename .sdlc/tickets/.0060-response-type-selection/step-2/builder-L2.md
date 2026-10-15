<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- /Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/packages/agent-ui/a2ui/src/agent/response-type.ts (new): `RESPONSE_TYPES`, `RESPONSE_PREFERENCES`, `RENDER_SURFACE_TOOL_NAME`, `renderSurfaceTool`, `detectUserOverride`, `classifyResponse`, `isLegacyShape`. Its only import is the one-line `import type { ToolDef, TurnInput } from './agent-transport.ts'`.
- /Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-rts/packages/agent-ui/a2ui/src/agent/response-type.test.ts (new): covers every rule in the handoff.

## Checks
- `redck.py record` was run before any edit: 4 pre-edit controls recorded red.
- `npx vitest run --project packages --maxWorkers=4 response-type.test.ts layering.test.ts`: 2 files and 36 tests passed.
- The renderSurfaceTool node one-liner exited 0.
- The detectUserOverride node one-liner exited 0.
- The isLegacyShape / classifyResponse node one-liner exited 0.
- The import-purity python check exited 0.
- The scope guard (with base sha 385c136f) exited 0.
- `npx tsc -p tsconfig.json` exited 0.

## Notes
- Committed locally as f7ff6c64 on feat/response-type-selection. Nothing was pushed.
- Lexicon matching is case-insensitive, and a phrase only matches as whole words: a letter or apostrophe directly before or after it blocks the match. Curly apostrophes are converted to `'` before matching.
- `isLegacyShape` trims each line and skips blank lines before checking.

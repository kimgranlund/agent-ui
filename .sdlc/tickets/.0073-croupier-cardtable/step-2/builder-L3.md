<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/card-layout.md`: replaced the body with the handoff text (782 chars). Frontmatter is unchanged.
- `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/game-table-chrome.md`: replaced the body with the handoff text (763 chars). Frontmatter is unchanged.
- `packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts`: added the describe `card-layout + game-table-chrome: the CardTable teaching (ADR-0243, T-0073)`. It pins the card-layout phrase and both hand bindings, the two game-table-chrome phrases, and that both modules are selected for `agent-ui--croupier`. All existing pins are kept.
- `packages/agent-ui/a2ui/src/agent/assets.gen.ts`: regenerated.
- `packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`: recaptured. Only the `miniSkills` entries for `card-layout` and `game-table-chrome` moved.
- `site/pages/agent-admin-presets.ts`: croupier entry only. `seedVersion` goes from 7 to 8 with the new T-0073 comment head. The `card-layout` and `game-table-chrome` descriptions and contents are replaced with the handoff text. The `localPatterns` comment and the skills comment block are rewritten to name CardTable (ADR-0243), and no touched line has an em dash.
- `site/lib/agent-manifest/croupier.manifest.json`: the writer refreshed `seedDigest`. I changed `seedVersion` from 7 to 8 by hand (see Notes).

## Checks
- `redck.py record` before the first edit: exit 0, 4 red controls recorded.
- `RECAPTURE_BASELINE=1 npx vitest run --project packages .../recapture-baseline.test.ts`, first run: passed, but the baseline did not move because the recapture reads the embedded `assets.gen.ts`. After `node scripts/generate-agent-assets.mjs`, a second recapture moved only `miniSkills` (card-layout, game-table-chrome).
- `npm run generate:registry`: exit 0, no file changed (the registry output does not depend on mini-skill bodies).
- `AGENT_MANIFEST_WRITE=1 npx vitest run --project site .../agent-manifest.write.test.ts`: passed.
- (red) grep for `If the catalog has CardTable` in both modules and the new describe title: exit 0.
- (red) baseline diff, only `miniSkills` changed against `$SDLC_BASE_SHA`: exit 0.
- (red) croupier `seedVersion` is base + 1 (8): exit 0.
- (red) awk/grep finds `CardTable` in both preset skills: exit 0.
- (guard) `npx vitest run --project packages` over mini-skills, prompt-equivalence and prompt-budget: exit 0, 143 passed.
- (guard) `npx vitest run --project site` over agent-manifest.test.ts and agent-admin-presets.test.ts:
  - First run: exit 1. The `seed-version` drift leg failed: "manifest seedVersion 7 is not the preset's effective 8".
  - After the manifest bump: exit 0, 34 passed.
- (guard) `npx vitest run --project tools .../registry/generate.test.ts && node scripts/generate-agent-assets.mjs --check`: exit 0.
- (guard) `npm run check`:
  - First run: exit 1. The only failure was the `reap-scratch-clones` selftest line "discovery: passing the same root twice does not duplicate candidates (833 vs 832)".
  - Rerun: exit 0.
- (guard) `npm test`: exit 0. 720 files passed and 2 skipped; 14986 tests passed and 7 skipped.
- Em-dash criterion: exit 0 (no em dash in added lines).
- Scope criterion: exit 0 (no out-of-scope path).

## Notes
- Handoff step 5 says the manifest writer moves the seedVersion, but it does not. `agent-manifest.write.test.ts` keeps `seedVersion` as written ("A `seedVersion` bump stays a human edit to the manifest"). I changed `"seedVersion": 7` to `8` by hand in `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-p1/site/lib/agent-manifest/croupier.manifest.json`, which is in scope.
- The first `npm run check` red came from the `reap-scratch-clones` selftest. It walks the shared harness scratchpad, and the candidate count changed between its two scans (833 vs 832) while other sessions were running. The rerun passed with no code change, so I did not run a base-worktree comparison.
- Step 7 did not apply: this tree has no R1 (T-0072) changes, so `seedVersion` is base + 1 = 8.
- Nothing is committed. The tree holds step 1's WIP commit `cc021553` (the base) plus these uncommitted changes.

<!-- role=builder level=L3 model=opus effort=high -->
## Status
blocked

## Changes
Plan step 8 stopped at its own stop condition: the family size row measures over its 72192 B gz budget. Everything below is still in the tree, uncommitted.
- `packages/agent-ui/components/src/controls/index.ts`: deleted.
- `packages/agent-ui/components/src/component-styles.css`: deleted.
- `packages/agent-ui/components/package.json`: removed the `./components` and `./component-styles.css` exports keys.
- `packages/agent-ui/{shared,icons,a2a,a2ui,app,router,code,data,devtools}/package.json`: added `sideEffects` with the exact values from the handoff.
- `scripts/side-effects.test.mjs`: every workspace package must now declare `sideEffects`, and each one is checked for honesty. The glob fixture no longer names `component-styles.css`.
- `packages/agent-ui/components/src/controls/barrels.test.ts`:
  - T4 is now three-way over controls/ folders, the `registry.gen.ts` records and the `exports` JS keys, with its three negative controls kept (exportsOnly, registryOnly, uncoveredFolders).
  - Dropped the barrel import and side-effect tests and the `./components` and `./component-styles.css` export tests.
  - The dogfood crawl now targets `src/all.gen.ts`, with an anti-vacuous size check. The IDENTITY leg now targets the root `.` barrel.
- `packages/agent-ui/components/src/controls/family-coherence.test.ts`: C1 now checks the `registry.gen.ts` records against the fleet, with two negative controls. The header and C2 comments were updated.
- `vitest.config.ts`: removed the `component-styles.css?url` alias and updated two comments. The `./components` alias went with the exports key, because those aliases are built from the exports map.
- `vite.config.ts`: the comment at line 27 no longer names the barrel.
- `scripts/measure-size.mjs`:
  - The header comment and the family row now point at `'../packages/agent-ui/components/src/all.gen.ts'` (label `@agent-ui/components/all`), budget still 72192 B gz.
  - New absolute row for `'../packages/agent-ui/components/src/controls/registry.gen.ts'` plus `loader.ts`, entry chunk only. It is pinned at 3840 B gz (measured 3155, rounded up to 3328, plus 512), citing ADR-0233.

## Checks
- `npx vitest run scripts/side-effects.test.mjs`: exit 0, 27 passed.
- `npx vitest run` on `barrels.test.ts`, `family-coherence.test.ts`, `tree-shake.test.ts` and `file-set.test.ts`: exit 0, 610 passed.
- `npm run size`: exit 1. The only failing row is `@agent-ui/components/all (demo-only self-defining ui-* family): 72993 B gz — OVER budget (72192 B gz)`, and the only error line is "a barrel exceeds its budget". Every other row is within budget:
  - registry + loader: 3155 B gz against 3840, 103 lazy chunks excluded.
  - app marginal: 69979 B gz against 106559.
- No other criterion or guard was run: not `npm run check`, `npm test`, the browser shards, the baselines guard, the scope guard, or the sideEffects and records criteria.

## Notes
- The handoff says: "if the measurement exceeds it, stop and report (an upward re-base is not this plan's call)". The family row via `all.gen.ts` measures 72993 B gz, 801 B over 72192.
- The cause is import order, not added code. Rolldown bundles of the same 155 modules, minified bytes 278303 to 280555:

  | Entry form | Order | gz |
  |---|---|---|
  | old `index.ts` (`export *`) | barrel order | 71967 |
  | bare imports | old `index.ts` order | 71032 (within budget) |
  | bare imports, `all.gen.ts` | path-sorted | 72993 |
  | `export *` | path-sorted | 73927 |

  The roughly 1.9 KB spread is gzip reacting to module order.
- So the overage comes from ADR-0233's path-sorted `all.gen.ts`. The ways forward are a planner or Kim call, and I made neither:
  - re-base the budget upward;
  - change the generator's order (`generate-controls.mjs`, plus ADR-0233 and the drift gate, which pin the path sort);
  - measure the row a different way.
- Not done, because the work stopped here:
  - the records and comment scrub (`component-packaging.md`, `goals.md`, the skills, the CSS comments, the remaining code comments; the barrel grep criterion still has hits);
  - the downward `APP_MARGINAL_BUDGET` re-base and its ledger note (measured app marginal 69979, so the target would be 72027);
  - every gate run.
- The tree has the barrels deleted but the scrub not done, so `npm run check` and `npm test` have not been run on this state.
- No scratch files are left. The size-comparison fixtures were removed, and `git status` shows only the two ` D` deletions plus the earlier steps' changes.

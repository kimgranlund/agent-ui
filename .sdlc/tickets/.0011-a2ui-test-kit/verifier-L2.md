<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- `npm run check` exits 0: pass. Evidence: `npm run check` rc=0. Its tail shows the kit selftest running: "selftest: pins ok", 7 scenarios green, "6 DOM-free seeded fixtures red with their pinned codes", "negative control ok". `package.json` `check:scripts` ends with `kit.ts selftest`.
- `npm test` exits 0: pass. Evidence: rc=0, 672 test files passed (2 skipped), 14037 tests passed (7 skipped).
- `env -u ANTHROPIC_API_KEY npm run test:a2ui-kit` and `npm run test:a2ui-kit:browser` exit 0: pass. Evidence: the jsdom leg ran 21 files and 625 tests, the tools leg 2 files and 8 tests, then the selftest. The browser leg ran 4 files and 198 tests. Both rc=0.
- `npm run test:browser:packages:rest` exits 0: pass. Evidence: rc=0, 22 files and 278 tests passed.
- Red-then-green per layer: pass. Evidence: each `kit.ts run` command exited rc=1 and printed its pinned text.
  - validator: `layer=validator code=IDGRAPH path=s:root`
  - interop: `layer=interop code=CATALOG path=root.label`
  - heal: `layer=heal code=HEAL_UNPARSEABLE`
  - producer: `layer=producer code=PRODUCE_HALT`
  - integration: `layer=integration code=MCP_TIMEOUT`
  - catalog: `layer=catalog code=SELECTION_BIJECTION`
  - renderer: `seeded.test.ts` passed (rc=0). It holds a per-layer `it` plus a `runSeeded` test and a wrong-layer test; 20 tests passed together with `offline-wiring.test.ts`.
- Pins loop over the 7 layers: pass. Evidence: every layer has `pins.json` and at least one other `*.json` fixture; the loop printed no failure.
- Matrix generated, never hand-listed: pass. Evidence:
  - The `grep -cF` prints 1.
  - `matrix.test.ts:28` asserts `cells.length` equals the summed `Object.keys(c.components).length` over `allCatalogs()`.
  - `matrix.test.ts:37` is a "NEGATIVE CONTROL" with a planted `Ghost` type, and it passes.
- Interaction loop in Chromium and WebKit: pass. Evidence: the vitest verbose run shows `|packages-rest (chromium)|` and `|packages-rest (webkit)|` ✓ for click-loop, a2ui-basic, no-response and the tripwire test. `vitest.browser.config.ts:255` lists both instances.
- Offline-wiring: pass. Evidence: `offline-wiring.test.ts` is green on the tree. In a throwaway worktree at HEAD, a planted `zz-plant.test.ts` naming `ANTHROPIC_API_KEY` made it fail on "every test file calls armOffline()" and "no file matches the key rule", so the check bites. Removed the worktree afterwards.
- No production behavior change: pass. Evidence: the non-test, non-testkit `src/` diff lists exactly `agent/produce.ts`, `agent/surface-seeds.ts` and `renderer/validate.ts`.
- Baseline and config untouched: pass. Evidence: `git diff --quiet d8417cf1 -- prompt-equivalence.baseline.json vitest.browser.config.ts` rc=0. The `package.json` diff is only the `scripts` key (`check:scripts`, `test:a2ui-kit`, `test:a2ui-kit:browser`).
- No em dashes added: pass. Evidence: the guard command rc=0.
- Scrub list: pass. Evidence: all 34 named files contain `tools/testkit` (count=34, none MISSING). `doc_lint.py` (v1.22.5) passed on all 19 changed `.claude/docs` files. The agent diffs touch body text only, and the `tools:` frontmatter is unchanged.

## Out of scope changes
`vitest.config.ts` gains 4 lines that add `packages/agent-ui/a2ui/tools/testkit/*.test.ts` to the `tools` project include. That is needed for the kit's Node tests and for `test:a2ui-kit`, which runs `--project tools packages/agent-ui/a2ui/tools/testkit`; `npm test` stays green with it. Only `vitest.browser.config.ts` is pinned by the acceptance criteria, not `vitest.config.ts`. Everything else is in the kit or the scrub list.

## For the next attempt
None

<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- #1 board-grid jsdom suites: pass. Evidence: the three test files exist; `npx vitest run --project packages packages/agent-ui/components/src/controls/board-grid` gave 3 files, 40 tests passed, exit 0.
- #2 browser test alone: pass. Evidence: `npx vitest run --config vitest.browser.config.ts --project packages .../board-grid.browser.test.ts` gave 2 files (Chromium and WebKit), 10 tests passed, exit 0.
- #3 registry, package.json export, controls drift: pass. Evidence: both greps matched and `node scripts/generate-controls.mjs --check` exited 0.
- #4 props.gen and drift wire: pass. Evidence: `board-grid.props.gen.ts` exists and `props-gen-driftwire.test.ts` passed, exit 0.
- #5 generated artifacts and exclusion seed: pass. Evidence: all six greps matched (exclusions.ts `['BoardGrid',`, dogfood-fleet.gen.ts, dogfood-assets.ts, both capability-registry.json copies, theme-provider-built.css), exit 0.
- #6 site pages, nav, sitemap, llms: pass. Evidence: the four site files exist; all greps matched, including `board-grid-demo.html` in both sitemap.json copies and `board-grid-doc.html` in `site/public/llms.txt`; exit 0.
- #7 (guard) components gates: pass. Evidence: 8 files, 658 tests passed, exit 0. Gate criterion, so no baseline run was needed.
- #8 (guard) a2ui and site guards: pass. Evidence: 13 files, 599 passed, 5 skipped, exit 0.
- #9 em dash check: pass. Evidence: exit 0 with the base `298fe4ee` as `$SDLC_BASE_SHA`. The `--exclude='*.gen.ts'` exempts `board-grid.props.gen.ts` (generator header). The other exempt generated files embed unchanged text and are not scanned: `dogfood-assets.ts`, `llms-full.txt`, both `capability-registry.json`, both `sitemap.json`, `theme-provider-built.css`. The diff leg against the base found no added em dash in the edited hand-kept files.
- #10 (guard) `npm run check`: pass. Evidence: exit 0 (the tail shows the testkit selftest negative control ok).
- #11 (guard) `npm test`: pass. Evidence: exit 0, 714 files passed, 2 skipped, 14839 tests passed, 7 skipped. The `conversation.test.ts` timing flake did not recur, so no rerun was needed.
- #12 (guard) scope allow-list: pass. Evidence: exit 0. `git diff --name-only 298fe4ee -- . ':(exclude).sdlc'` lists only board-grid files, the generated artifacts, the site pages and nav, `exclusions.ts` and `site-coverage.test.ts`. The working tree has no uncommitted change outside `.sdlc`.

Conductor-requested checks against the ADR-0243 BoardGrid fork sheet and the Styling review:
- Real-engine probe of my own (a throwaway worktree at HEAD, removed afterwards; Chromium and WebKit, 4 tests each, all green).
  - Intent colors: computed `color` of a danger, success or neutral cell equals the resolved `--md-sys-color-{intent}-high` token. Computed `background-color` equals the resolved `-container` token. The corner glyph is one character with the same `-high` ink. A no-intent cell has a different background from a danger cell. Negative control: swapping the expected token to `-low` turned the test red (`expected oklch(0.4693 0.1898 26.87) to be oklch(0.7372 ...)`), so the check discriminates.
  - Enabled cell: a real click emits exactly one `action` with `{action:'fire', context:{row:0, col:0}}`.
  - Disabled cell: a forced click and a dispatched synthetic click emit nothing.
  - Arrow roving: ArrowUp, ArrowLeft and ArrowLeft move (2,2) to (1,2) to (1,0), skipping the disabled (1,1) and stopping at the edge. Exactly one `tabindex=0` throughout.
  - A `cells` write keeps the same cell elements and the roving tab stop, and patches the mark in place without an extra emit.
  - Read-only board (no `actionName`): cells are `<div>`s, a real click emits nothing, there is one tab stop, and the host has no `role` or `aria-label` attribute.
  - Cell side floor: at the default scale the cell width is at least 34px (asserted, passing).
- CSS read: the per-intent legs use `--md-sys-color-{intent}-container` for background and `--md-sys-color-{intent}-high` for ink (`board-grid.css` lines 38-47, 62-85). Marks are text plus a `+ ? - ! i` corner glyph, so intent is never color alone. Hover tint applies only to `button:not(:disabled)`. Transitions sit under `prefers-reduced-motion: no-preference`. The cell side is `max(34px, var(--md-sys-height-md))`. `UIBoardGridElement` is `board-grid.ts`, and the keyboard and Enter/Space handlers emit only from the delegated click (`board-grid.ts:168-203`).

## Out of scope changes
None.

## For the next attempt
None. Notes, not failures:
- The cell side follows `--md-sys-height-md`, which the `[scale]` tiers retable. The control declares no `[size]` repoint, so `size="sm|lg"` on the host does not change the cell side. This matches the settled interface (no `size` prop, one control-height row) and the ServiceCard precedent, but I did not observe the side at a non-default scale. Only the 34px floor at the default was measured.
- Browser test coverage is thinner than my probe on color resolution and the click path for disabled cells. The probe is not kept, since verifiers never add project files.

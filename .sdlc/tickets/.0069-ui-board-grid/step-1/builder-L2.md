<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
None. All 12 criteria passed on the WIP commit 6daa9b62 with no changes, and the tree has no uncommitted changes outside `.sdlc`.

## Checks
I ran these in `/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-c1` with `SDLC_BASE_SHA=298fe4eeca4dae427a11bfaef77d7d05db0234ef`.
- C1, the board-grid folder files plus `npx vitest run --project packages .../controls/board-grid`: exit 0.
- C2, the browser test run alone (`vitest.browser.config.ts`, project `packages`, `board-grid.browser.test.ts`): exit 0. Two test files and 10 tests passed (Chromium and WebKit).
- C3, the registry.gen and package.json greps plus `node scripts/generate-controls.mjs --check`: exit 0.
- C4, `board-grid.props.gen.ts` exists and `props-gen-driftwire.test.ts` passes: exit 0.
- C5, the greps for exclusions, dogfood-fleet.gen, dogfood-assets, both capability-registry copies and the theme-provider fixture: exit 0.
- C6, the site pages and nav, sitemap and llms greps: exit 0. Both sitemaps list `board-grid-demo.html`, and `llms.txt` lists `board-grid-doc.html`.
- C7 (guard), the components gates, 8 files: exit 0.
- C8 (guard), the a2ui and site guards, 13 files: exit 0. 599 tests passed and 5 were skipped.
- C9, the em dash check: exit 0. It excludes generated files that embed unchanged text: `board-grid.props.gen.ts` (the generator header), `dogfood-assets.ts`, `site/public/llms-full.txt`, both `capability-registry.json` copies, both `sitemap.json` copies and `theme-provider-built.css`. The Done-when allows this.
- C10 (guard), `npm run check`: exit 0.
- C11 (guard), `npm test`: exit 0. 714 test files passed and 2 were skipped (14839 tests passed, 7 skipped). The `conversation.test.ts` timing flake did not occur, so the rerun procedure was not needed.
- C12 (guard), the scope allow-list: exit 0.

## Notes
None.

<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- #1 jsdom tests (files, title greps, vitest): pass. Evidence: all six title greps present; `npx vitest run --project packages .../controls/game-hud` gave 3 files, 41 tests passed. Bite check: in a throwaway worktree, `exceptZero` changed to `auto` and the `ariaLive = 'polite'` line removed turned 3 tests red ("renders one stat part...", "deltas are signed...", "role group, aria-label and the polite live region...").
- #2 browser test: pass. Evidence: "pairwise distinct" and "no horizontal overflow" present; `npx vitest run --config vitest.browser.config.ts --project packages .../game-hud.browser.test.ts` gave 2 files (Chromium, WebKit), 10 tests passed.
- #3 props.gen, registry, exports, generator drift: pass. Evidence: all greps matched; `generate-controls.mjs --check` "in sync for 85 fleet controls"; `codemod-uses.mjs --check` "all 85 fleet descriptors and their sheets in sync"; exit 0.
- #4 catalog seed, dogfood, registries, fixture: pass. Evidence: greps matched incl. the exact attrs string; `generate-agent-assets.mjs --check` exit 0.
- #5 site files and wiring greps: pass. Evidence: exit 0.
- #6 sitemap group: pass. Evidence: both `site/sitemap.json` and `site/public/sitemap.json` have ui-game-hud in `Data & reporting`; exit 0.
- #7 (guard) components gates: pass. Evidence: 10 files, 1262 tests passed, exit 0.
- #8 (guard) a2ui and site gates: pass. Evidence: 15 files, 617 passed, 5 skipped, exit 0.
- #9 em dash check: pass. Evidence: run with `SDLC_BASE_SHA=HEAD^1`; exit 0 (no U+2014 in the control folder or site pages, none in added lines of the shared files).
- #10 (guard) `npm run check`: pass. Evidence: exit 0.
- #11 (guard) `npm test`: pass. Evidence: exit 0; 719 files passed, 2 skipped; 14959 tests passed, 7 skipped.
- #12 (guard) tree scope: pass. Evidence: diff against `HEAD^1` outside `.sdlc` is entirely inside the allowed path set; exit 0.

Own real-engine probe (Chromium, throwaway worktree, since removed):
- Host has no attributes (no aria-*, no title, no role). `internals.role` is `group`, `ariaLive` is `polite`, `ariaLabel` is "Table 4 · Blackjack", and "X" after `hud-title="X"` on a second HUD. The title falls back to "Game status" when empty (covered by the jsdom test).
- Signed deltas: `[60, -12, 0, '+5']` render as `+60`, `-12`, `0`, `+5`. No arrow glyphs exist in the CSS or model (grep).
- Progress: `role=progressbar`, `aria-valuemin=0`, `aria-valuemax=24`, `aria-valuenow=9`, `aria-label=HP`. Visible text is "HP 9 / 24". Fill is 145.5px of the 388px track, which is 9/24.
- Status badge: `ui-badge` with `label` "Your turn" and `intent` success. Part order is header, progress, stats.
- Delta ink differs by intent (success is green, danger is red) and the tile background is the same for every stat, so intent never tints the tile and the sign does not pick the color.
- Empty stats: no stats part. An entirely empty HUD paints 26px of padded chrome with no children, and `hud-title` fills it in. This is a cosmetic note, not a criterion.
- A stats update keeps the same stat element (`sameStat` true) and drops surplus parts.

Judged against the ADR-0243 GameHud sheet and the approved styling. The stat value uses the stat type step and the 14px and 10px mockup paddings use the nearest steps (12px and 8px), as the builder note says and the handoff item allows ("nearest `--md-sys-*` role or step").

Conductor checks on the rebased shared files:
- Both earlier controls survive in the conflict-resolved files. `exclusions.ts` keeps the BoardGrid seed and adds GameHud (the ProductCard row was drained in the base). `site-coverage.test.ts` pattern list holds `board-grid`, `product-card` and `game-hud`. The `component-preview.ts` and `generate-sitemap.mjs` diffs against the base touch only ui-game-hud.
- The L1 count comments read 87, which matches the sitemap (87 entries in section Components, 12 groups). The handoff's 84 to 85 was stale after the other merges. The line-27 "Components (84)" comment in `generate-sitemap.mjs` and the "Components (85)" comment at `_page.ts` NAV_TAXONOMY are narrative remnants and were not part of the handoff list.

## Out of scope changes
None. `$SDLC_BASE_SHA` in the brief (71c17b21) equals HEAD itself, so the diff scope was judged against `HEAD^1` (9089a246, the T-0069 merge). The 33 changed files are the control folder, the generated outputs, and the shared files the handoff names.

## For the next attempt
None

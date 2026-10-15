<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- /Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-c3/packages/agent-ui/components/src/controls/game-hud/game-hud.ts: new `UIGameHudElement`, which self-defines `ui-game-hud`. Through internals it sets role group, ariaLabel (the trimmed title, or "Game status") and ariaLive polite. Parts are built once and patched in place.
- .../game-hud/game-hud-model.ts: new pure hardening (`cleanStats`, `formatDelta`, `formatValue`, `statIntent`, `statusIntentOf`, `cleanProgress`, `MAX_STATS`) plus the `statsProp` and `progressProp` codecs.
- .../game-hud/game-hud.css: new `:where()` token block and `@scope` styles block, the badge glyph clip-paths copied verbatim, a forced-colors arm and a reduced-motion arm. codemod-uses wrote the `@import '../badge/badge.css'` prologue.
- .../game-hud/game-hud.md: new descriptor, tier pattern, the six attributes in the pinned order. codemod-uses wrote `uses: [ui-badge]`.
- .../game-hud/game-hud.props.gen.ts: written by generate-props.
- .../game-hud/game-hud.test.ts, game-hud-descriptor.test.ts, game-hud-css.test.ts, game-hud.browser.test.ts: new tests, using the titles the handoff lists.
- packages/agent-ui/components/src/controls/registry.gen.ts, src/all.gen.ts, src/all.gen.css and the components package.json: written by generate-controls.
- packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts: written by generate-agent-assets. `assets.gen.ts` came out unchanged.
- packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts: written by regen:dogfood-assets.
- site/capability-registry.json and site/public/capability-registry.json: written by generate:registry. `selection-projection.gen.ts` came out unchanged.
- site/lib/__fixtures__/theme-provider-built.css: written by regen:theme-provider-fixture.
- site/sitemap.json, site/public/sitemap.json and site/public/llms-full.txt: written by generate-sitemap and generate-llms-full.
- packages/agent-ui/a2ui/src/catalog/default/exclusions.ts: a `GameHud` seed entry citing ADR-0243, T-0072 and the design section 9 kill switch.
- packages/agent-ui/components/src/descriptor/site-coverage.test.ts: `'game-hud'` added to the pattern-tier list, with a comment.
- site/game-hud-doc.html and site/pages/game-hud-doc.ts: new API page built through `loadGameHudDoc`.
- site/game-hud-demo.html and site/pages/game-hud-demo.ts: new demo with the Croupier HUD (a "Win hand" button updates it live), the Quizmaster HUD and the Dungeon Master HUD.
- site/lib/frontmatter.ts: the `gameHudMd` import and `loadGameHudDoc`, placed by the stat and badge loaders.
- site/pages/_page.ts: a NAV group after ui-stat, `'ui-game-hud'` after `'ui-stat'` in Data & reporting, and both L1 count comments changed from 84 to 85.
- scripts/generate-sitemap.mjs: L1_TAXONOMY mirrors `_page.ts` byte for byte, and the count comment changed from 84 to 85.
- site/main.ts: a CARD_GROUPS entry after ui-stat.
- site/lib/component-preview.ts: COMPONENT_INITIAL seeds only `status`, ui-game-hud joins NO_SLOT_TEXT, and COMPONENT_SAMPLE_INIT sets `title`, `statusIntent`, `stats` and `progress` as properties.
- site/public/llms.txt: a ui-game-hud line after the ui-stat line.

## Checks
- Inventory measure (the handoff's node one-liner): 28189 of the 28200 budget. Row: `- ui-game-hud — Game score and status strip. (attrs: title: string, status: string, statusIntent: enum(neutral|info|success|warning|danger), stats: json, progress: json, inline: boolean)`.
- Criterion 1 (file tests, title greps, then `npx vitest run --project packages .../game-hud`): exit 0. 3 files, 41 tests passed.
- Criterion 2 (file tests, greps, then `npx vitest run --config vitest.browser.config.ts --project packages .../game-hud.browser.test.ts`), run on the final file: exit 0. 2 files (Chromium and WebKit), 10 tests passed.
- Criterion 3 (props.gen greps, registry, package.json, `generate-controls.mjs --check`, `codemod-uses.mjs --check`): exit 0.
- Criterion 4 (exclusions, the dogfood attrs string, dogfood assets, both registries, the fixture, `generate-agent-assets.mjs --check`): exit 0.
- Criterion 5 (the site files and greps): exit 0.
- Criterion 6 (both sitemap.json entries in Data & reporting): exit 0.
- Guard 7 (sizing, layering, props and controls drift, naming, styling, uses, css-uses, file-set, family-coherence): exit 0. 10 files, 1233 tests passed.
- Guard 8, first run: exit 1. `dogfood-assets-freshness` was stale because the model changed after the first regen. I reran `npm run regen:dogfood-assets`, and guard 8 then passed: exit 0, 15 files, 609 passed, 5 skipped.
- Criterion 10 (em dash check, with `SDLC_BASE_SHA` set inline): exit 0.
- Guard `npm run check`, first run: exit 2, TS6133 for an unused `STATS` const in game-hud.browser.test.ts. I removed it and the rerun passed: exit 0.
- Guard `npm test`: exit 0. 714 files passed and 2 skipped; 14839 tests passed and 7 skipped.
- Guard tree scope (with `SDLC_BASE_SHA` set inline): nothing outside the allowed path set.

## Notes
- The progress codec does not follow handoff item 2 to the letter. Item 2 says malformed JSON falls back to `null`, but that cannot pass the descriptor trip-wire:
  - `kindOf` (`packages/agent-ui/components/src/descriptor/component-descriptor.ts:517`) classifies a non-throwing codec that returns `null` for `from('')` and `5` for `from('5')` as a number codec, which gives DRIFT_TYPE.
  - A codec that cleans the parsed value is classified `unknown`.
  - So `progressProp` follows the `tableSortProp` precedent (`packages/agent-ui/components/src/controls/table/table-model.ts:409`): well-formed JSON parses verbatim, and malformed JSON gives `undefined`. It never throws.
  - `cleanProgress` runs on every render, so a malformed attribute still renders no bar.
  - `statsProp` still cleans as specified; its array default already classifies as json.
- `$SDLC_BASE_SHA` was empty in this shell. Criterion 10 and the tree guard ran with `SDLC_BASE_SHA=298fe4eeca4dae427a11bfaef77d7d05db0234ef` set inline.
- The stat value uses the stat type step (`headline-small`, 24px at default scale) at weight 700, as ADR-0243:142 requires, not the mockup's 1.25rem. The 14px and 10px mockup spacings use the nearest steps, `--md-sys-space-md` (12px) and `--md-sys-space-sm` (8px).
- `@scope` reads only `--ui-game-hud-*` tokens, plus the private `--_fill` ratio the control writes (the same idiom as stat's `--_ring-pct`). game-hud-css.test.ts allows exactly that one exception.
- No byte-pinned prompt baseline moved, and nothing was committed. The browser run left no screenshot directories.

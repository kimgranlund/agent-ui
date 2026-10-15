<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Ship `ui-game-hud` as an ADR-0233 per-control entry (control, descriptor, generated props and registry, tests, site doc and demo pages with nav) to the ADR-0243 GameHud fork sheet, with no default catalog row (that is R1, T-0072).
guard timeout: 400

## Step 1: Build ui-game-hud with its site pages, gates green
level: L3
### Read first
- `packages/agent-ui/components/AGENTS.md`
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: none. This one-step plan is the gates green step.

Sources:
- The ADR-0243 fork sheet in `.claude/docs/adr/0243-preset-widgets-admission-placement-derived-inheritance.md`: lines 97-106 hold the rows shared by all three controls, lines 134-145 the GameHud rows.
- Design section 4 (GameHud) and section 9 (the kill-switch risk) in `.sdlc/tickets/.0065-preset-widgets-design/design.md`.
- The handoff's Styling review: Kim approved the mockup (stat strip, signed deltas without arrows, quiet next to primary content). The mockup values are inlined in item 2 below; there is nothing else to read for them.
- Skills component-build, component-standards and component-testing.

Reference code:
- `controls/stat/`: the stat tile, the Intl signed-number idiom in `stat-model.ts`, and the type step the value rides.
- `controls/source-list/`: a JSON array data-prop declared through a `*-model.ts` codec (`sourcesProp`, generated into `source-list.props.gen.ts:4`).
- `controls/badge/`: the `INTENTS` tuple in `badge.props.gen.ts:5` and the pairwise-distinct glyph clip-paths in `badge.css:124-160`.
- `controls/service-card/`: a pattern-tier `UIElement` with role group through internals.
- `controls/playing-card/`: the shape of the descriptor test, the CSS test and the browser test.
- `app/src/controls/conversation/conversation-dialog.ts:46`: `this.internals.ariaLive = 'polite'`, tested in jsdom at `conversation-dialog.test.ts:48`.

1. Control folder `packages/agent-ui/components/src/controls/game-hud/` holds these files. No visual-baseline test.
   - `game-hud.ts`: `UIGameHudElement extends UIElement`, self-defines `ui-game-hud`.
   - `game-hud-model.ts`: pure, DOM-free hardening and formatting plus the `statsProp` and `progressProp` codecs.
   - `game-hud.css`.
   - `game-hud.md`: tier `pattern`, base `UIElement`, events `[]`, slots `[]`.
   - `game-hud.props.gen.ts`: written only by `node scripts/generate-props.mjs game-hud`.
   - `game-hud.test.ts`, `game-hud-descriptor.test.ts`, `game-hud-css.test.ts`, `game-hud.browser.test.ts`. A separate `game-hud-model.test.ts` is optional.

2. Settled interface. Each item is decided here. If the build cannot honor a row, report `blocked`; it is not a free choice.
   - Descriptor `attributes[]`, in exactly this order (the dogfood fleet row pins it, criterion 4):
     - `title`: string, default `''`, `reflect: false`, `attribute: hud-title`. The global HTML `title` attribute is never observed or written, so a HUD never paints a native tooltip or gains a duplicate accessible description. Kebab override precedent: `button.md:37`.
     - `status`: string, default `''`, `reflect: false`.
     - `statusIntent`: enum, written as the single-line unquoted `values: [neutral, info, success, warning, danger]` that `badge.md:34` uses (the dogfood reader never unquotes, so quoted values would break criterion 4), default `neutral`, `reflect: false`, `attribute: status-intent` (the playing-card `face-down` row precedent).
     - `stats`: type json, `reflect: false`, `codec: { import: './game-hud-model.ts', name: 'statsProp' }`, live default `[]` (the source-list `sources` row form).
     - `progress`: type json, `reflect: false`, `codec: { import: './game-hud-model.ts', name: 'progressProp' }`, live default `null`. Write the descriptor `default` token the descriptor gates accept for a null live default (progress.md's `current` row writes `default: null`).
     - `inline`: boolean, default false, `reflect: true` (ADR-0223, `controls/sizing-gates.test.ts` enforcing).
   - `game-hud-model.ts` hardening. A property write bypasses the codec, so the render path re-cleans every value (the stat-model and badge note):
     - `MAX_STATS = 6`. `cleanStats(input)`: a non-array gives `[]`. An entry that is not a plain object is dropped. `label`: a string as is, a finite number as `String(n)`, anything else `''`. `value`: a finite number through a module-memoized default-locale `Intl.NumberFormat`, a string verbatim, anything else `''`. An entry whose label and value are both `''` is dropped. Keep the first 6 survivors; extra entries are dropped silently (the catalog warning is R1's job, ADR-0243:140).
     - `formatDelta(raw)`: a finite number formats through `Intl.NumberFormat(undefined, { signDisplay: 'exceptZero' })`, giving `+60`, `-12` and `0`. A string whose trimmed text parses to a finite number formats the same way. Any other non-empty trimmed string passes through verbatim. Anything else gives `null`, and no delta part renders.
     - Stat `intent`: a member of `INTENTS` imported from `../badge/badge.props.gen.ts` other than `neutral` keeps its value; `neutral`, absent or out-of-set gives no intent.
     - `cleanProgress(input)`: a non-object gives `null`. `max` must be a finite number above zero, otherwise `null`, so no bar renders (ADR-0243:143). `value`: a finite number clamped into `[0, max]`, otherwise 0. `label`: a string, otherwise `''`.
     - The codecs parse the JSON attribute form and fall back to `[]` or `null` on malformed JSON, never throwing.
     - A non-finite value never renders a placeholder glyph. The stat-model placeholder is U+2014, which the handoff forbids in added lines, so do not import `formatStatValue`.
   - Host semantics, set in `connected()` through `this.internals`, never as host attributes:
     - `role = 'group'`; `ariaLabel` = the trimmed `title`, or `Game status` when it is empty.
     - `ariaLive = 'polite'`. The whole HUD is one polite live region, so a score change in `stats` is announced (ADR-0243:144).
     - No focus, no tabindex, no keyboard model, no events.
   - Anatomy, in DOM order (the mockup order). All parts are control-built light DOM, created once and patched in place:
     - `[data-part="header"]`, a div present when `title` or `status` is non-empty. It holds `[data-part="title"]` (a span, present when `title` is non-empty), then `[data-part="status"]`, a composed `ui-badge` element with `label` = `status` and `intent` = the hardened `statusIntent` (out-of-set gives `neutral`), present when `status` is non-empty. The badge supplies the ADR-0057 glyph for the status intent.
     - `[data-part="progress"]`, a div present when `cleanProgress` is non-null. It carries the inner-element attributes `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax`, `aria-valuenow` and `aria-label` (the progress label, or `Progress`). Children: `[data-part="progress-text"]` with the visible text `{label} {value} / {max}` (label omitted when empty), then `[data-part="progress-track"]` holding `[data-part="progress-fill"]`, whose inline size comes from a `--_fill` custom property set to value over max (the stat `--_ring-pct` precedent).
     - `[data-part="stats"]`, a div present when at least one stat survives. It holds one `[data-part="stat"]` per stat. The stat parts are reused by index, created or removed only when the count changes.
     - Each stat holds, in order: `[data-part="glyph"]` (`aria-hidden="true"`, present only when the stat has an intent), `[data-part="label"]`, `[data-part="value"]`, and `[data-part="delta"]` (present only when `formatDelta` is non-null). The stat part carries `data-intent="<intent>"` only when it has an intent.
     - Updates set `textContent` only when the text differs and add or remove a part only when its presence changes. After the first render the host is never cleared, so the live region announces only the readout that changed. This is the "announced once" reading of ADR-0243:144.
   - CSS, from the approved mockup:
     - A `:where(ui-game-hud)` token block and an `@scope (ui-game-hud)` styles block that consumes only `--ui-game-hud-*` (component-build step 5, gated by `controls/styling-gates.test.ts`). Map each mockup value onto the nearest `--md-sys-*` role or step in the token block.
     - Host: background `--md-sys-color-neutral-surface`, a 1px `--md-sys-color-neutral-outline-variant` border, radius `--md-sys-shape-corner-base`, padding 12px block and 14px inline, 10px gap between header, progress and stats. Fill by default; `:scope[inline]` hugs.
     - Header: a flex row, space-between, centered, 8px gap; title at .9375rem, bold.
     - Stats: grid `repeat(auto-fit, minmax(84px, 1fr))`, 8px gap, so the tiles wrap.
     - Stat tile: padding 8px 10px, radius 10px, background `--md-sys-color-neutral-container-low` always (an intent never tints the tile), 2px row gap. Label .6875rem, letter-spacing .06em, uppercase, `--md-sys-color-neutral-on-surface-variant`. Value 1.25rem, weight 700, tabular numerals, on the same type step as `stat.css`'s value (ADR-0243:142). Delta .75rem, weight 650.
     - Intent: delta ink and glyph ink come from `--md-sys-color-{intent}-high` when the stat has an intent. With no intent, the delta ink is `--md-sys-color-neutral-on-surface-variant`. The sign never picks the color.
     - Glyph: copy badge.css's clip-path shapes verbatim, one per intent: success tick, danger x, warning triangle, info disc (`badge.css:124-160`). This is the visible non-color signifier ADR-0057 requires.
     - Progress: text .75rem, `--md-sys-color-neutral-on-surface-variant`, tabular numerals. Track 8px tall, fully rounded, `--md-sys-color-neutral-container`. Fill `--md-sys-color-primary`, one color always: the ratified sheet gives `progress` no intent.
     - Forced colors: the fill and the glyph must not vanish (paint them in a system color, the badge.css forced-colors note). Any transition only under `prefers-reduced-motion: no-preference`.
   - Descriptor prose and the dogfood inventory budget:
     - The inventory row summary is the descriptor body's whole first paragraph after `# ui-game-hud`, with the leading self-reference stripped (`a2ui/src/agent/dogfood-descriptor.ts:157-170`).
     - At plan time the inventory measured 28,002 of `DOGFOOD_INVENTORY_CHAR_BUDGET` 28,200. With the six attrs above, the row's fixed part is 158 chars, so the summary may be at most 39 chars.
     - Settled: the first paragraph is exactly the one sentence "`ui-game-hud` is a game score and status strip." It reduces to "Game score and status strip." and lands the inventory at 28,189. Everything else goes in later paragraphs.
     - Do not edit the budget constant in this ticket. Measure after the descriptor lands:

     ```
     node --experimental-strip-types --no-warnings -e "import('./packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts').then(m=>{const s=m.dogfoodInventory();console.log(s.length,m.DOGFOOD_INVENTORY_CHAR_BUDGET);console.log(s.split('\n').find(r=>r.startsWith('- ui-game-hud ')))})"
     ```
   - The descriptor carries the `face`, `aria`, `keyboard`, `geometry` and `forcedColors` blocks in the service-card shape. `aria` records role group, label from `title` with the `Game status` fallback, polite live region through internals, the progressbar part, and the non-color signifiers (badge glyph, stat glyph, signed delta text). `geometry` records sizeClass `pattern` with container spacing and no control-height row. No em dash anywhere in the descriptor: the fleet precedents use them heavily, so do not copy their prose.

3. Run the generators in this order. Never hand-edit their outputs.
   1. `node scripts/generate-props.mjs game-hud`.
   2. `node scripts/codemod-uses.mjs`: writes the descriptor's `uses:` block (`ui-badge`, from the badge imports) and the `@import` prologue of `game-hud.css` that `controls/css-uses.test.ts` enforces.
   3. `node scripts/generate-controls.mjs`: writes `controls/registry.gen.ts`, `src/all.gen.ts`, `src/all.gen.css` and the components `package.json` exports.
   4. `node scripts/generate-agent-assets.mjs`: writes `a2ui/src/agent/dogfood-fleet.gen.ts`. `assets.gen.ts` should come out unchanged.
   5. `npm run regen:dogfood-assets`: writes `controls/sandbox-frame/dogfood/dogfood-assets.ts` (gated by `dogfood-assets-freshness.test.ts` and the a2ui `live-agent/dogfood-tag-set-equality.test.ts`).
   6. `npm run generate:registry`: writes `site/capability-registry.json` and `site/public/capability-registry.json`. `selection-projection.gen.ts` should come out unchanged.
   7. `npm run regen:theme-provider-fixture`: writes `site/lib/__fixtures__/theme-provider-built.css` (gated by `site/lib/theme-provider-build-fixture.test.ts`).
   8. After the site edits in item 5: `node scripts/generate-sitemap.mjs` (both `sitemap.json` copies), then `node scripts/generate-llms-full.mjs` (`site/public/llms-full.txt`).

4. Catalog coverage seed: add `['GameHud', '<reason>']` to `EXCLUSION_ALLOWLIST` in `packages/agent-ui/a2ui/src/catalog/default/exclusions.ts`.
   - The reason says the control shipped ahead of its default catalog row, cites ADR-0243 and T-0072, and notes that R1 either lands the row and drains the seed or, under the design section 9 kill switch, rewrites it as a permanent exclusion. No em dash in the reason.
   - Forced by `packages/agent-ui/a2ui/src/catalog/default/index.test.ts:171-177` (`typesMissingCatalog`). The "shipped ahead of its catalog row" precedent is recorded at `exclusions.ts:6-35`.

5. Site. Tier `pattern` requires `{doc, demo}` (`packages/agent-ui/components/src/descriptor/site-coverage.test.ts:94`).
   - `site/game-hud-doc.html` and `site/pages/game-hud-doc.ts`: the API page, derived from the descriptor through a new `loadGameHudDoc` in `site/lib/frontmatter.ts` (the `loadStatDoc` precedent, `frontmatter.ts:252`). Copy the page shell from `stat-doc`.
   - `site/game-hud-demo.html` and `site/pages/game-hud-demo.ts`, shell from `stat-demo`. Three HUDs, the approved mockup data:
     - Croupier: title `Table 4 · Blackjack`, status `Your turn` (success), stats Chips 1240 delta 60 intent success, Bet 50, Shoe `3.1`. A `ui-button` "Win hand" adds 60 to Chips and writes `stats` again, showing the in-place update.
     - Quizmaster: title `Science round`, status `Question 4 of 10` (info), progress value 4, max 10, label `Round`, stats Score 30 delta 10 intent success, Streak 3.
     - Dungeon Master: title `The Undervault · Room 3`, status `Wounded` (warning), progress value 9, max 24, label `HP`, stats Gold 48 delta -12 intent danger, Pack `4/6`.
   - Nav, placed away from the C1 and C2 edits near ui-playing-card:
     - In `site/pages/_page.ts`, add a NAV group `{label: 'ui-game-hud', links: [Demo, API]}` right after the `ui-stat` group (`_page.ts:550-555`).
     - In the same file, add `'ui-game-hud'` to the NAV_TAXONOMY group `Data & reporting` right after `'ui-stat'` (`_page.ts:973-976`). Group choice: GameHud is a stat strip, next to ui-stat and ui-badge. The group grows from 8 to 9 tags, under the 10-tag ceiling in the comment at `scripts/generate-sitemap.mjs:49-50`. `Containers & chrome` is left alone because C1 takes it to 9 and C2 may add to it.
     - Mirror the taxonomy byte-identically in `scripts/generate-sitemap.mjs` L1_TAXONOMY (`:78-81`).
     - Update every comment that states the L1 component count from 84 to 85: `scripts/generate-sitemap.mjs:49`, `site/pages/_page.ts:915` and `site/pages/_page.ts:1029`.
     - In `site/main.ts`, add a CARD_GROUPS entry with Demo and API cards right after the `ui-stat` entry (`main.ts:1118-1132`).
   - `site/lib/component-preview.ts`:
     - Add `'ui-game-hud'` to `NO_SLOT_TEXT` (`:1497`) with a one-line comment: no light-DOM content model, the playing-card precedent at `:1579-1582`.
     - Add a representative specimen. Knob names are descriptor names applied with `setAttribute` (`#applyKnob`, `:2273-2291`), so a `title` or `statusIntent` seed would write the wrong attribute. `COMPONENT_INITIAL` (`:1323`) therefore seeds only `status`; `COMPONENT_SAMPLE_INIT` (`:1464`) sets `title`, `statusIntent`, `stats` (three stats, one delta) and `progress` as properties.
     - Do not add it to `A2UI_INITIAL` or `SAMPLE_TREES`: `site/lib/component-preview-catalog.test.ts` requires those keys to be catalog types.
   - `site/public/llms.txt` is hand-kept: add one `ui-game-hud` line linking `(./game-hud-doc.html)` and `(./game-hud-demo.html)`, the playing-card line at `:78` as the shape. `site/lib/llms.test.ts:68-70` fails on any unindexed page.
   - `packages/agent-ui/components/src/descriptor/site-coverage.test.ts`: add `'game-hud'` to the pattern-tier list (`:293-297`, alphabetical, between `'form-popover'` and `'menu'`) with a one-line comment.

6. Tests, by title:
   - `game-hud.test.ts` (jsdom):
     - "empty stats renders title and status only"
     - "renders one stat part per entry with label, value and delta"
     - "deltas are signed: numbers and numeric strings get a sign, other strings pass through"
     - "keeps at most 6 stats and drops malformed entries"
     - "an out-of-set intent is dropped; a stat intent renders a glyph part and data-intent"
     - "status renders as a ui-badge carrying statusIntent"
     - "progress renders a progressbar part with label, value and max"
     - "a non-positive max renders no progress part"
     - "role group, aria-label and the polite live region come from internals, never host attributes" (also covers the `Game status` fallback)
     - "a stats update patches text in place and keeps the same stat elements"
     - "the hud-title attribute sets title and the host never gets a title attribute"
   - `game-hud-descriptor.test.ts`: the descriptor-to-source trip-wire in the `playing-card-descriptor.test.ts` shape.
   - `game-hud-css.test.ts`, in the `playing-card-css.test.ts` shape: tokens declared in `:where()`; `@scope` consumes only `--ui-game-hud-*`; each of the four intents has its own glyph clip-path; the delta ink keys on intent, never on sign.
   - `game-hud.browser.test.ts` (packages shard, real engine):
     - "fills its container by default and hugs under inline" (whole-shape bounding box in a realistic container)
     - "six stats wrap inside a 320px container with no horizontal overflow"
     - "the progress fill width tracks value over max"
     - "stat intent glyphs are pairwise distinct shapes" (computed clip-path differs per intent)
     - "the status badge renders its intent glyph"

7. Validation scope:
   - Run the criteria below, then `npm run check` and `npm test` as the whole gates.
   - Contract dependents: `git show --stat befc6f16` (the playing-card mint) plus `git grep -l ui-playing-card -- packages scripts site` gave the file set; the hits under `a2ui/src/catalog/personas`, `a2ui/src/registry`, `a2ui/src/renderer`, `a2ui/tools/testkit` and the two `capability-registry.test.ts` files are croupier-specific and stay untouched. ADR-0233 replaced the old hand-kept barrels with the generated `registry.gen.ts` and `all.gen.*`. `git grep` for a pinned fleet count (82 or 83) in tests found none.
   - Generated files that embed unchanged em dashes are exempt from the em dash check, and the handoff allows it: `game-hud.props.gen.ts` (the generator's own header), `dogfood-assets.ts`, `site/public/llms-full.txt`, both `capability-registry.json`, both `sitemap.json` and `theme-provider-built.css`.
   - A new descriptor row is not expected to move any byte-pinned prompt baseline (the playing-card mint touched none). If one goes red under `npm test`, report `blocked`; never recapture a baseline to get green (AGENTS.md).
   - Builders never commit.
### Acceptance criteria
- `test -f packages/agent-ui/components/src/controls/game-hud/game-hud.test.ts && test -f packages/agent-ui/components/src/controls/game-hud/game-hud-descriptor.test.ts && test -f packages/agent-ui/components/src/controls/game-hud/game-hud-css.test.ts && grep -qF "empty stats renders title and status only" packages/agent-ui/components/src/controls/game-hud/game-hud.test.ts && grep -qF "keeps at most 6 stats" packages/agent-ui/components/src/controls/game-hud/game-hud.test.ts && grep -qF "deltas are signed" packages/agent-ui/components/src/controls/game-hud/game-hud.test.ts && grep -qF "a non-positive max renders no progress part" packages/agent-ui/components/src/controls/game-hud/game-hud.test.ts && grep -qF "never host attributes" packages/agent-ui/components/src/controls/game-hud/game-hud.test.ts && grep -qF "keeps the same stat elements" packages/agent-ui/components/src/controls/game-hud/game-hud.test.ts && npx vitest run --project packages packages/agent-ui/components/src/controls/game-hud`
- `test -f packages/agent-ui/components/src/controls/game-hud/game-hud.browser.test.ts && grep -qF "pairwise distinct" packages/agent-ui/components/src/controls/game-hud/game-hud.browser.test.ts && grep -qF "no horizontal overflow" packages/agent-ui/components/src/controls/game-hud/game-hud.browser.test.ts && npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/game-hud/game-hud.browser.test.ts`
- `test -f packages/agent-ui/components/src/controls/game-hud/game-hud.props.gen.ts && grep -qF "attribute: 'hud-title'" packages/agent-ui/components/src/controls/game-hud/game-hud.props.gen.ts && grep -qF "attribute: 'status-intent'" packages/agent-ui/components/src/controls/game-hud/game-hud.props.gen.ts && grep -qF "stats: statsProp" packages/agent-ui/components/src/controls/game-hud/game-hud.props.gen.ts && grep -qF "progress: progressProp" packages/agent-ui/components/src/controls/game-hud/game-hud.props.gen.ts && grep -qF "'ui-game-hud': { tag: 'ui-game-hud'" packages/agent-ui/components/src/controls/registry.gen.ts && grep -qF '"./controls/game-hud"' packages/agent-ui/components/package.json && node scripts/generate-controls.mjs --check && node scripts/codemod-uses.mjs --check`
- `grep -qF "['GameHud'," packages/agent-ui/a2ui/src/catalog/default/exclusions.ts && grep -qF '"tag":"ui-game-hud"' packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts && grep -qF '"attrs":"title: string, status: string, statusIntent: enum(neutral|info|success|warning|danger), stats: json, progress: json, inline: boolean"' packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts && grep -qF '"ui-game-hud"' packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts && grep -qF ui-game-hud site/capability-registry.json && grep -qF ui-game-hud site/public/capability-registry.json && grep -qF ui-game-hud site/lib/__fixtures__/theme-provider-built.css && node scripts/generate-agent-assets.mjs --check`
- `test -f site/game-hud-doc.html && test -f site/game-hud-demo.html && test -f site/pages/game-hud-doc.ts && test -f site/pages/game-hud-demo.ts && grep -qF loadGameHudDoc site/lib/frontmatter.ts && grep -qF "label: 'ui-game-hud'" site/pages/_page.ts && grep -qF "label: 'ui-game-hud'" site/main.ts && grep -qF "'ui-game-hud'" scripts/generate-sitemap.mjs && grep -qF "'ui-game-hud'" site/lib/component-preview.ts && grep -qF "(./game-hud-doc.html)" site/public/llms.txt && grep -qF "(./game-hud-demo.html)" site/public/llms.txt && grep -qF "'game-hud'" packages/agent-ui/components/src/descriptor/site-coverage.test.ts`
- `for f in site/sitemap.json site/public/sitemap.json; do python3 -c "import json,sys; e=[x for x in json.load(open(sys.argv[1]))['entries'] if x.get('tag')=='ui-game-hud']; sys.exit(0 if e and all(x.get('group')=='Data & reporting' for x in e) else 1)" "$f" || exit 1; done`
- (guard) `npx vitest run --project packages packages/agent-ui/components/src/controls/sizing-gates.test.ts packages/agent-ui/components/src/layering.test.ts packages/agent-ui/components/src/descriptor/props-gen-driftwire.test.ts packages/agent-ui/components/src/controls/controls-gen-driftwire.test.ts packages/agent-ui/components/src/controls/naming-gates.test.ts packages/agent-ui/components/src/controls/styling-gates.test.ts packages/agent-ui/components/src/controls/uses-driftwire.test.ts packages/agent-ui/components/src/controls/css-uses.test.ts packages/agent-ui/components/src/controls/file-set.test.ts packages/agent-ui/components/src/controls/family-coherence.test.ts`
- (guard) `npx vitest run packages/agent-ui/a2ui/src/catalog/default/index.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-tag-set-equality.test.ts packages/agent-ui/a2ui/src/agent/agent-assets-freshness.test.ts packages/agent-ui/a2ui/tools/registry/generate.test.ts packages/agent-ui/components/src/descriptor/site-coverage.test.ts packages/agent-ui/components/src/descriptor/site-toc.test.ts site/lib/controls-coverage.test.ts site/lib/component-preview-slot-text.test.ts site/lib/sitemap.test.ts site/lib/llms.test.ts site/gallery.test.ts site/lib/capability-registry.test.ts site/lib/theme-provider-build-fixture.test.ts packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets-freshness.test.ts`
- `d=$(printf '\342\200\224') && test -f packages/agent-ui/components/src/controls/game-hud/game-hud.md && test -f site/game-hud-doc.html && ! grep -rlF "$d" --exclude='*.gen.ts' packages/agent-ui/components/src/controls/game-hud site/game-hud-doc.html site/game-hud-demo.html site/pages/game-hud-doc.ts site/pages/game-hud-demo.ts && ! git diff "$SDLC_BASE_SHA" -- site/pages/_page.ts site/main.ts site/lib/component-preview.ts site/lib/frontmatter.ts scripts/generate-sitemap.mjs site/public/llms.txt packages/agent-ui/a2ui/src/catalog/default/exclusions.ts packages/agent-ui/components/src/descriptor/site-coverage.test.ts | grep -E '^[+][^+]' | grep -qF "$d"`
- (guard) `npm run check`
- (guard) `npm test`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vE '^(\.worktrees/|packages/agent-ui/components/src/controls/game-hud/|packages/agent-ui/components/src/controls/registry\.gen\.ts$|packages/agent-ui/components/src/all\.gen\.(ts|css)$|packages/agent-ui/components/package\.json$|packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets\.ts$|packages/agent-ui/a2ui/src/agent/(dogfood-fleet|assets)\.gen\.ts$|packages/agent-ui/a2ui/src/catalog/default/exclusions\.ts$|packages/agent-ui/a2ui/src/registry/selection-projection\.gen\.ts$|packages/agent-ui/components/src/descriptor/site-coverage\.test\.ts$|site/game-hud-(doc|demo)\.html$|site/pages/game-hud-(doc|demo)(\.browser\.test)?\.ts$|site/pages/_page\.ts$|site/main\.ts$|site/lib/(frontmatter|component-preview)\.ts$|site/lib/__fixtures__/theme-provider-built\.css$|site/(public/)?(sitemap|capability-registry)\.json$|site/public/llms(-full)?\.txt$|scripts/generate-sitemap\.mjs$)' )"`

## Assumptions
- scope widening, `packages/agent-ui/a2ui/src/catalog/default/exclusions.ts`: forced by `packages/agent-ui/a2ui/src/catalog/default/index.test.ts:171-177`, which requires every fleet type to have a catalog row or an allowlist entry. The seed is the recorded "shipped ahead of its catalog row" precedent (`exclusions.ts:6-35`), and R1 (T-0072) drains or rewrites it.
- scope widening, generated files outside the handoff's list: `dogfood-fleet.gen.ts` (one row per descriptor, drift-gated by `agent-assets-freshness.test.ts` and `generate-agent-assets.mjs --check` in `check:scripts`), `dogfood-assets.ts` (bundles `all.gen.*`, `dogfood-assets-freshness.test.ts`), both `capability-registry.json` (list every control, `tools/registry/generate.test.ts`), `theme-provider-built.css` (embeds all control CSS, `theme-provider-build-fixture.test.ts`), both `sitemap.json` and `site/public/llms-full.txt` (`site/lib/sitemap.test.ts`, `site/lib/llms.test.ts`).
- scope widening, hand-kept site files: `site/game-hud-demo.html` and `site/pages/game-hud-demo.ts` (tier `pattern` requires `{doc, demo}`, `site-coverage.test.ts:94`), `site-coverage.test.ts` (pins the pattern-tier list, `:293-297`), `site/lib/component-preview.ts` (`component-preview-slot-text.test.ts:100` requires every fleet tag in exactly one of three sets), `site/lib/frontmatter.ts` (per-control doc loaders), `site/pages/_page.ts`, `site/main.ts`, `scripts/generate-sitemap.mjs` and `site/public/llms.txt` (`llms.test.ts:68-70`).
- `sitemap.json` indexes each control by its demo page with a `group` field (verified: the `ui-stat` entry has `url ./stat-demo.html`, `group Data & reporting`, and no `stat-doc.html` appears in either copy), so the sitemap criterion checks `tag` and `group` by parse, not a doc-page grep.
- `title` keeps the ratified prop name with `attribute: hud-title`. No fleet control declares a `title` attribute (`grep -n "- name: title"` over the descriptors found only calendar's part), and no gate requires an override to equal the kebab prop name (`component-descriptor.ts:54,261-263` accepts any kebab string).
- The live region is host-level `internals.ariaLive = 'polite'`, read from ADR-0243:144: "status is a polite live region through internals so a score change is announced once". Internals reach only the host, and scores live in `stats`, so a status-part-only region (the `calendar.ts:621` pattern) would drop score announcements. Patch-in-place rendering makes "once" hold.
- Status composes `ui-badge` (the avatar to icon sanctioned sibling import, `avatar.ts:25`). Progress is hand-built rather than a composed `ui-progress`, whose `current` null means indeterminate and `max` floors to 100 (`progress.md:17-26`), both wrong here. `uses:` becomes `[ui-badge]` through `codemod-uses.mjs`.
- Stat intent is carried by a glyph shape plus delta ink, never a tile tint. The mockup shows no per-stat intent; it colors the delta by sign. The plan colors by intent instead, because ui-stat's law is that the sign is direction, not valence (`stat-model.ts:9-13`), and ADR-0057 needs a non-color signifier per intent. The demo reaches the approved look by giving the +60 stat `success` and the -12 stat `danger`.
- Dogfood inventory headroom: verified by running `dogfoodInventory()` at base (28,002 of 28,200) and computing the new row with the settled sentence (28,189).
- Every new-behavior criterion was red at base because its file or entry is missing. `node scripts/generate-controls.mjs --check`, `node scripts/codemod-uses.mjs --check` and `node scripts/generate-agent-assets.mjs --check` each exit 0 at base. The sitemap parse probe passes for `ui-stat` with group `Data & reporting`, so it is not vacuous.
- Rule 11 red for the guards: the focused gate files carry in-file negative controls (for example `controls/sizing-gates.test.ts` "negative control: the scan bites on a synthetic offender", `llms.test.ts` "a page missing from the index is genuinely caught"). Dry-run at base `298fe4ee`: the first focused guard ran 10 files and 1220 tests green, the second 15 files with 605 passed and 5 skipped, and the scope guard passed with `SDLC_BASE_SHA=HEAD` and failed against `HEAD~4`. The em dash criterion's diff leg goes red on the playing-card mint `befc6f16` (its added `site/main.ts` and `_page.ts` lines carry em dashes).
- `npm run check` and `npm test` were not run at plan time (rule 1's broad-suite carve-out). `guard timeout: 400` is about three times a completed `npm test` run of 130.6 s with exit 0, recorded in the main checkout's activity-errors-card-polish verifier log. That record is outside this tree.

## Risks
- C1 (`ui-board-grid`) and C2 (`ui-product-card`) run in parallel and edit the same shared files: `site-coverage.test.ts`, `exclusions.ts`, both taxonomies and the 84-count comments, the `_page.ts` NAV, `main.ts`, `component-preview.ts`, `llms.txt`, and every regenerated artifact. This plan places its NAV, taxonomy and card entries next to `ui-stat` to keep hunks apart, but each merge is still by hand and the generators re-run on the merged tree.
- The three new rows together exceed `DOGFOOD_INVENTORY_CHAR_BUDGET` 28,200 at integration (this lane alone leaves 11 chars). Whoever lands last re-measures, applies the recorded formula (measured, rounded up to the next 100, plus 300) at `dogfood-inventory.ts:84-87`, and updates the SPEC-R13(b) line in `.claude/docs/spec/genui-surface.spec.md` (the playing-card mint `befc6f16` did both).
- C2's ProductCard also has a `title` prop and hits the same global-attribute collision. If C2 settles it differently (for example `attribute: false`), the two controls disagree; the conductor should align them before R1 writes factories.
- A pre-upgrade `el.title = ...` on an undefined element goes through the native setter, writes a host `title` attribute and never reaches the prop. R1's factory must set `title` after `ui-game-hud` is defined; the default catalog factories import their controls first.
- The approved mockup's red HP bar has no prop: the ratified sheet gives `progress` no intent. Adding one is an ADR-0243 amendment, not this ticket.
- Coloring the delta by intent rather than by sign is a judgment against the mockup's look. If Kim wants sign colors, the change is cosmetic and confined to `game-hud.css` and its CSS test.
- The C1 plan (`ui-board-grid`) greps `board-grid-doc.html` in `site/public/sitemap.json`, which indexes only demo pages, so that criterion cannot pass as written.
- The site preview's knobs apply descriptor names as attributes, so the `title` and `statusIntent` knobs cannot drive a live specimen (the same pre-existing gap as button `iconOnly`, playing-card `faceDown` and image `usageHint`). The specimen is set by properties; fixing the knob mapping is outside this ticket.
- `npm run test:browser:site` (including `site/lib/component-preview-fleet.browser.test.ts`) is outside this ticket's Done-when; a red there shows up in CI or the next browser run.
- With three lanes running at once, `npm test` can pass the 400 s guard timeout from load alone. Apply the flaky-gates rule (rerun alone) before treating that red as a regression.

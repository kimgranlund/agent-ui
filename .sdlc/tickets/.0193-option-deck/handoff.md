---
id: T-0193
title: "OptionDeck: a general-purpose 'pick one to start' catalog pattern where each option is a selectable card"
type: feature         # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0172]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "the game picker as a concept should become a new pattern catalog ... a nicer general purpose version ... a bit more creative where each game is presented as a card of some sort." Today the Croupier opens with a row of Buttons, which the model wraps one each in a bordered box. That is a ruled defect: buttons must not sit inside card containers. The new pattern makes the card itself the choice.

## The pattern (working name OptionDeck; name it in the design intake)
- **What it is:** a default-catalog composite for "pick one of a few things to start". Uses (widened 2026-10-14 by the pattern sweep: the default greeting for every preset via the greeting-card mini-skill, replacing T-0172's plain-button row): the game picker (Croupier, Quizmaster topics, Dungeon Master scenarios), concierge experiences (dine, spa, explore), a plan or template chooser, an onboarding path.
- **Each option is one card, and the whole card is the target.** It has:
  - a hero region: an icon from the pack, an emoji-free glyph or illustration slot, or an image;
  - a title;
  - one line of description;
  - up to three meta chips (for example players 1 to 6, 5 min, Easy).
- **No button inside a card.** Pressing a card fires one action with the option's `value`, so the component never contains Button children. A focus ring, a hover lift and a pressed state come from the fleet interaction states.
- **Variety without chaos:** each option may carry an accent from the color roles (one of a small set of named tones, never a raw color), so games read as distinct. The hero region can use a playful pattern, such as the playing-card back motif or a suit glyph for card games, drawn from tokens.
- **Optional "Surprise me" card:** a visually distinct last card (dashed edge or shuffle glyph) that fires the same action with `value: "random"`. Prop `allowRandom`.
- **Layout:**
  - a responsive grid from the geometry (min card width in n), single column at the 400px column, horizontal scroll never;
  - a card count of 2 to 8 (validator rejects more);
  - an optional heading and subheading above the deck.
- **Selected state:** after a pick, the deck collapses to the chosen card with a "changed your mind?" affordance, or stays with the chosen card marked. Decide which in intake.
- **A11y:**
  - a listbox or radiogroup-like role via ElementInternals;
  - arrow-key roving focus; Enter and Space select;
  - each card announces title, description and meta;
  - no native form elements.

## Intent
- Do:
  1. **Design intake** (skill `component-design`): run the precedent sweep against ChoiceCard and ChoiceGroup (value selection inside a form), ProductCard, ServiceCard and ResultCard (single cards with their own action). Say why this is a new composite and not a ChoiceGroup variant, or fold it into one if the sweep says so. Fill the fork sheet, and record decisions in this ticket (ADRs are retired).
  2. **Mockup first:** two or three directions (calm, playful, editorial) at widget / md on the A2UI canvas, light and dark, plus the 400px column. Kim approves one before any build.
  3. **Build:**
     - the `ui-*` control, with a descriptor `{name}.md` and generated props;
     - the default catalog row plus its `selection.json` intents and notFor (notFor: form fields, a single confirm button, more than 8 options);
     - a mini-skill teaching it;
     - a factory test, a browser test in both engines, a visual golden, and the dogfood render lint clean.
  4. **Adopt:**
     - the Croupier greeting uses it for the game picker, and the croupier skill and seeds teach it;
     - check the Quizmaster, Dungeon Master and Concierge for the same "pick one to start" moment and switch them where it fits;
     - bump the touched presets' seedVersion and refresh their manifests.
  5. **Lint:** the compose or render rule from T-0172 (a card whose only child is a Button) stays, and its message points at this pattern.
- Done when:
  - Kim has approved the mockup;
  - `npm run check` exits 0;
  - the control's and catalog's tests pass in Chromium and WebKit;
  - the render lint exits 0;
  - a live `npm run chat:probe -- --agent croupier --say hello --expect-component <Name>` passes on Haiku 5.5 and Sonnet 5.5;
  - screenshots are viewed and match the approved mockup.

## Context
- Geometry: ADR-0245 one-n foundations; the A2UI canvas sits at widget / md (20 / 24 / 28 controls). Standards: `.claude/docs/references/` (component-standards, geometry-sizing-spec), `component-design`, `component-build`, and `a2ui-multi-catalog` skills. Catalog content is hand-curated (`packages/agent-ui/a2ui/AGENTS.md`). Commit off origin/main, never push.

## Constraints
- Zero dependencies. Light DOM, ARIA via ElementInternals. Event `select` (or `action` through the catalog), per ADR-0153 names. No em dashes.

## Design intake
Run 2026-10-20 (T-0193 step 1) per skill `component-design` and its `references/mint-vs-compose.md` TYPE arm. Recorded here, not in an ADR (ADRs are frozen, T-0164).

Job: one card per option for "pick one of a few things to start"; pressing a card fires one action carrying that option's `value`, outside any form.

### Precedent sweep
| Precedent | What it is (source) | Why it is not the OptionDeck |
| --- | --- | --- |
| ChoiceCard | `ui-choice-card` (`controls/choice-card/choice-card.md`): the rich option unit of the `choice` family, `tier: container`, `extends: UIElement`, `events: []`; the whole card is the hit target, children are agent-composed (`children: ChildList` in the default catalog). | It never commits on its own; the owning ChoiceGroup does. Its interior is a ChildList the producer composes, so the hero / title / description / meta anatomy would be re-derived per payload (the ADR-0201 re-derived-rhythm signal). Reused as prior art: whole-card target, `role=option` through ElementInternals. |
| ChoiceGroup | `ui-choice-group` (`choice-group.ts` lines 9 to 12, `choice-group.md`): `extends: UIFormElement`, `role=listbox` via ElementInternals, composes `rovingFocus` + `selectionCommit` (`itemFromTarget` / `reflectSelected` seams), auto-fit grid floor `--ui-choice-group-min: 14rem`. Catalog row binds `value` / `values` on `select`. | A value committed inside a form: FACE, `name` / `required` / validity, and the agent learns the pick only when a separate commit Button sends the data model. The OptionDeck fires one action on press, carries no form value, has no commit Button, and sits outside forms. Reused: the listbox role carriage, `rovingFocus` + `selectionCommit` with the two seams, the auto-fit grid mechanism. |
| ProductCard | `ui-product-card` (`product-card.md`): one product, room or offer with image or icon header, rating, badge, price and a single action; `tier: pattern`, `extends: UIElement`. | A single card with its own action Button. A row of N of them is N cards each framing a Button, the exact defect T-0172 rules out (`framed-choice-check.ts`). Reused: the image-or-icon hero header and the `pattern` tier with hardened data props. |
| ServiceCard | `ui-service-card` (`service-card.md`): availability-stated launch card, one bindable `available` drives dot, title mute and the Open / Unavailable action swap; `tier: pattern`. | Single card, own action Button, availability semantics an option does not carry. Reused: the data-prop display-primitive shape (component-rendered interior, not a ChildList). |
| ResultCard | `ui-result-card` (`result-card.md`): settled outcome card with pill, title, summary, up to four stat tiles and producer action buttons; `tier: pattern`. | Single card that ends a flow, not a choice that starts one. Reused: the capped array data prop (`stats`, up to four) as the model for `meta` (up to three) and `tier: pattern` without a control-height row. |

Verdict: a new composite, not a ChoiceGroup variant. Folding it in would need a mode flag that flips base class (UIFormElement to UIElement), the data contract (form value to fire-and-forget action), the commit path (data model plus commit Button to one press) and the children model (ChildList to a hardened `options` prop) at once; the skill's own test (step 1: a boolean that must flip role, data contract and completion together is two controls) says two controls. TYPE arm (ADR-0220): semantics plus behavior are inexpressible today. A Row of Buttons carries no card anatomy, a Card around each Button is the ruled T-0172 defect, and a ChoiceGroup needs a second commit Button and a form-shaped data model for a greeting that is not an ask (`greeting-card.md`: "a greet is NOT an ask: no commit button, no data model"). The gap is not a teaching gap. Minting is cheap: `UIElement` plus the two shipped traits plus one hardened array codec (the ResultCard `stats` precedent); no new base class, no new event, no new geometry row.

### Fork sheet
- Name: tag `ui-option-deck`, class `UIOptionDeckElement`, A2UI type `OptionDeck` (AGENTS.md naming law, ADR-0078). `git grep -il "option-deck\|OptionDeck" -- packages site` finds nothing; the only `deck` hit is a test fixture twin in `generate-controls.test.ts`, no shipped tag.
- Composite or variant: new composite (the sweep verdict above). Base class `UIElement` composing `rovingFocus` + `selectionCommit` from `connected()` (the ChoiceGroup idiom without the form leg); the option cards are light-DOM parts rendered from the `options` prop, never child elements an agent composes.
- Selected state: the deck stays with the chosen card marked (`aria-selected`, a bindable `value`). The other cards stay pressable, so a re-pick is the "changed your mind" path; no collapse. Evidence: the greet is retired by the stale-affordance rule the next turn (`packages/agent-ui/a2ui/src/agent/prompts/mini-skills/greeting-card.md` line 6: "When the first real task starts, retire the greet buttons per the stale-affordance rule that same turn"), and a finished Croupier surface is left as history (`site/agent-content/personas/croupier/agent.md` line 61: "The finished round's surface is left as history, never edited again"), so a collapse animation buys nothing. No contrary evidence found.
- Role: host `role=listbox` via ElementInternals, each card a light-DOM `[data-part="option"]` element with `role=option` (the ChoiceGroup ElementInternals precedent, `choice-group.ts` lines 9 to 12). Roving tabindex, arrow keys move, Enter and Space select. The accessible name is the title; the description and meta chips are its description. No native form elements and no `ui-button` inside a card. Note from the sweep: ChoiceCard carries `role=option` on its own ElementInternals because it is a custom element; a `[data-part]` div has no internals, so the build sets `role` / `aria-selected` / `aria-labelledby` / `aria-describedby` as attributes on the part through the `reflectSelected` seam. That matches the ruling's letter (ARIA via ElementInternals means never on the HOST); the host itself carries only internals.
- Tones: `tone` per option is one of `neutral | primary | secondary | accent | info | success`, each mapped to `--md-sys-color-{tone}-container` (all six exist in `packages/agent-ui/shared/src/tokens/tokens.css`, one definition each); never a raw color. The container roles are scrims (`-scrim-200`), so they tint over the neutral surface in both schemes; the hero glyph ink reads `--md-sys-color-{tone}-on-surface-variant`. The tone is a hue signifier only; the title text is the non-color identity.
- Count cap: 2 to 8 options. The producer-side cap is a semantic check, because the a2ui validator has no `minItems`/`maxItems` support (`git grep -n maxItems -- packages/agent-ui/a2ui/src` finds only function comments). The control renders whatever it is given.
- Props: `options` (array of `{value, title, description?, icon?, image?, imageAlt?, meta?: string[] up to 3, tone?, index?}`), `value`, `actionName`, `allowRandom`, `randomLabel`, `heading`, `subheading`, `disabled`; events `select` (detail: the picked key string, `"random"` for Surprise me) and `action` (detail `{action, context: {value}}`, only when `actionName` is set) (ADR-0153 names). `options` is a hardened JSON codec (malformed input becomes `[]`, entries without `value` or `title` are dropped, `meta` truncated to 3), the ResultCard `stats` / description-list `rows` precedent. `value` and `disabled` are bindable in the catalog row; the row's value mark is `{prop: "value", event: "select"}` and the row carries the press as an `action` with the option's `value` in its context.
- Layout: a responsive grid with the minimum card width in n from the geometry, one column at the 400px column, never horizontal scroll; a2ui surface at `data-tier="widget" data-scale="md"`. The mockups use `repeat(auto-fit, minmax(min(100%, 40n), 1fr))`: at widget / md n = 6, so the floor is 240px; a 400px column less two widget margins (2 x 12px) leaves 376px, under the 486px two tracks plus a gutter need, so it falls to one column; a 704px surface fits two tracks, so four options sit 2 by 2 instead of 3 plus an orphan, and at one column the card turns to a horizontal row (hero left, text right) so a 4-card picker stays short. Card padding is the widget margin, card radius the widget radius, card gap the widget gutter.
- Tier: `pattern`. An interactive pattern rendered from hardened data props with no control-height row (the ResultCard `tier: pattern` precedent); `site-coverage.test.ts` `PAGES_BY_TIER.pattern` requires `{doc, demo}`, so the build ships `option-deck-doc.html` and `option-deck-demo.html`.

### Mockups
Three static directions in `.sdlc/tickets/0193-option-deck/mockups/`, each loading the shipped tokens (`tokens.css`, `dimensions.css`, `foundations.gen.css`, `foundations-bridge.gen.css`, `base.css` from `packages/agent-ui/shared/src/tokens/`) at `data-tier="widget" data-scale="md"`, showing the Croupier picker (Blackjack, Hold'em, Five-card draw, Surprise me) with Blackjack selected:
- `calm.html`: quiet outlined cards, tone shown only in a round icon well, meta as plain chips.
- `playful.html`: a tone-filled hero band with a card-back pattern and a large suit glyph, a lift on hover, a dashed Surprise me card with a shuffle glyph.
- `editorial.html`: typographic, an index numeral and a hairline rule per card, a thin tone rule at the leading edge, meta as a small kicker line.
Screenshots: `<direction>-light.png`, `<direction>-dark.png`, `<direction>-400.png` beside each file.
- Approved direction: playful (Kim 2026-10-20). Each card has a patterned tone header band with a corner index and a large icon disc, and the pick shows a "Your pick" pill. The deck is general-purpose, so the band pattern and the corner index have to work for every persona: the index is an optional per-option field, and the band comes from the option tone, never a Croupier-only asset.

## Plan review
- plan review: replan: step 3: interfaces: the Do's action mechanism cannot be built as written. "The ProductCard `action` shape" rides `#wireAction`, which listens for host `click` only and builds the context from the node's static `context` through `#collectContext`, so it cannot carry which card was pressed, fires on a click anywhere on the host (heading, subheading) and never fires on Enter or Space (the control emits `select`, not `click`). A `WidgetFactory` has no action sink (`tag`, `create`, `uses`, `applyProp`, `value`, `submitGate` only), so "its `select` event dispatches the row's action with `context.value`" is not something `optionDeckFactory` can do. The per-item channel is `#wireForwardedAction`, which needs a row prop with `actionEvent` whose node value is set (the BoardGrid `actionName` row, `{"type":"string","mapsTo":"actionName","actionEvent":"action"}`) and reads `detail.action` plus `detail.context` off the control's own event; step 2's control fires `select` with `detail.value` and has no action-name prop. The planner has to settle one channel across steps 2 and 3: the control's `select` detail shape, the row prop that names the action, the row shape (the first catalog criterion pins an `'action'` key), and the `{prop: "value", event: "select"}` value mark the fork sheet declares but step 3's Do never mentions. Evidence: `packages/agent-ui/a2ui/src/renderer/renderer.ts:746-766` (`el.addEventListener('click', ...)`, `context: this.#collectContext(context, surface, itemScope)`), `renderer.ts:786-793`, `renderer.ts:701` and `renderer.ts:714-735` (`detail?.action`, `detail?.context`, "A detail with no action name is dropped"), `packages/agent-ui/a2ui/src/catalog/types.ts:20-50`, `python3 -c` dump of `catalog.json` `BoardGrid.properties.actionName`, `.sdlc/tickets/0193-option-deck/handoff.md:88` (`event \`select\` with \`detail.value\``), and the ResultCard factory comment in `packages/agent-ui/a2ui/src/catalog/default/factories.ts` ("there is no row `action` prop (ADR-0244 Alternatives: the renderer wires a row action to any host click, so a click on the summary would restart the game)").
- plan review: replan: step 2: interfaces: the control's `select` event detail (`detail.value`, handoff.md:88) does not meet either renderer action channel (see the step 3 finding); the detail shape and any action-name prop the row needs are set in this step, so the planner settles them here together with step 3. Evidence: `renderer.ts:720-726` reads only `detail.action` and `detail.context`; `handoff.md:88`.
- plan review: replan: step 2: notes-fix: after the descriptor lands, also run `npm run generate:registry` (both `capability-registry.json` copies) and `node scripts/generate-agent-assets.mjs` (`dogfood-fleet.gen.ts`); `tools/registry/generate.test.ts` reds until step 3 otherwise. Evidence: `packages/agent-ui/a2ui/tools/registry/load.ts:40,76` reads every `controls/*/*.md`; `git show --stat ff5271ad4` lists `site/capability-registry.json`, `site/public/capability-registry.json` and `dogfood-fleet.gen.ts`; `generate.test.ts` is in step 3's guard, not step 2's.
- plan review: replan: step 2: notes-fix: `site/lib/frontmatter.ts` gets a `loadOptionDeckDoc` loader on the `loadGameHudDoc` precedent; the Do's wiring list (`site/main.ts`, `_page.ts`, `component-preview.ts`) omits it. Evidence: `site/pages/game-hud-doc.ts:6` imports `loadGameHudDoc` from `../lib/frontmatter.ts`; `git show ff5271ad4 -- site/lib/frontmatter.ts` adds it.
- plan review: replan: step 2: notes-fix: the approved direction adds an optional per-option `index` field to `options` (and step 3's row items schema); the `- Props:` line omits it. Evidence: `handoff.md` Mockups, "Approved direction: playful ... the index is an optional per-option field"; `handoff.md:88` lists `{value, title, description?, icon?, image?, imageAlt?, meta?, tone?}` only.
- plan review: replan: step 3: notes-fix: the pinned greeting sentence regex is `mini-skills.test.ts:376` (the `greeting-card` describe), not line 29; and every mini-skill body is capped at 800 chars (`PER_MODULE_TOKEN_BUDGET = 200`, `estimateTokens = ceil(len/4)`), greeting-card is at 756 now, so the rewrite and the new `option-deck.md` both have to stay under 800. Evidence: `packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts:14-16,27-30,376`; `packages/agent-ui/a2ui/src/agent/mini-skills.ts:76`; `awk ... greeting-card.md | wc -c` = 756.
- plan review: replan: plan: goal coverage: the Done-when item "live `chat:probe` on Haiku 5.5 and Sonnet 5.5" is a manual run in step 4, not a criterion; AGENTS.md makes the live leg never a gate and the plan says so under Risks. Note, not a defect. Evidence: planner-L2.md step 4 Do and Risks; AGENTS.md "Gates".
- plan review: replan: plan: acceptance criteria: every `(red)` criterion of steps 2 to 4 exits nonzero on current HEAD `50a2f67a2` and step 2's unmarked approval criterion exits 0 (the line is recorded); the five `--check`/selftest/`--gate` guards exit 0 and the step 2 and step 4 vitest guards pass (20 files, 1453 tests; 38 files, 1244 tests). Noted as replayed, no defect. Evidence: the replay loop output, `env -u NODE_OPTIONS` runs with `~/.nvm/versions/node/v24.18.0/bin` on PATH.
- Conductor 2026-10-20: step 1 is built and committed (50a2f67a2), and Kim approved the playful direction; the replan keeps step 1 as done and replans steps 2 to 5.
- plan review: replan: step 3: interfaces: the Do adds the `OptionDeck` row to `catalog.json` and never classifies it in the feed partition (`FEED_SURFACE_TYPES` / `FEED_EXCLUDED` in `packages/agent-ui/a2ui/src/agent/feed-catalog.ts`). `feed-catalog.test.ts` requires IN plus OUT to equal `defaultCatalog.components` exactly and pins 37 IN / 47 OUT, and it sits under `src/live-agent`, inside step 3's vitest guard, so the guard reds as written. The choice is load-bearing, not bookkeeping: the greet rides the ask field as `greet-1` (`greeting-card.md` line 6, "declare it on the meta-line ask field with the reserved id greet-1"), and `produce.ts` `feedScopeFailures` rejects every component type on an ask-routed surface that is not in `FEED_SURFACE_TYPE_SET`, so an OptionDeck greet fails `FEED_SCOPE` on every turn unless the planner puts the type IN (with the reasoning comment the array carries, the count pin 37 to 38) and names the dependents that read the partition: `system-prompt.ts` fills `{{FEED_SURFACE_TYPES}}` into GRAMMAR (so the prompt-equivalence recapture and the prompt budget move), `system-prompt-grammar.test.ts`, `plan-and-execute.ts`. Evidence: `packages/agent-ui/a2ui/src/live-agent/feed-catalog.test.ts:22-23,31-36`; `packages/agent-ui/a2ui/src/agent/produce.ts:32-35,1089-1099`; `packages/agent-ui/a2ui/src/agent/system-prompt.ts:55,75`; `git show --stat 3f5aebd65` lists `feed-catalog.ts` and `feed-catalog.test.ts` (the T-0072 rows were each classified OUT with a reason); planner-L3.md step 3 Do names neither file.
- plan review: replan: step 2: interfaces: two `select` events per pick with two detail shapes. The Do composes `selectionCommit` and also has the control call `this.emit('select', { value, action, context })`. `selectionCommit`'s `publish()` unconditionally runs `host.emit('select', selection)` with the string key after `onSelect`, which is exactly the detail `choice-group.md` documents, so the descriptor's `events: [select]` "with the detail above" is wrong: a pick fires one string-detail `select` and one object-detail `select`. The renderer's forwarded-action listener drops the string one (`detail?.action` is undefined), so the wire path survives, but a test or consumer asserting one `select` with the object shape sees both. The planner has to settle this across steps 2 and 3: drop `selectionCommit` and wire click, Enter and Space with one emit, or keep the trait and carry the action on a separate `action` event (the BoardGrid shape), which changes step 3's `actionEvent: "select"` and its first criterion. Evidence: `packages/agent-ui/components/src/traits/selection-commit.ts:150-156` (`publish`), `packages/agent-ui/components/src/controls/choice-group/choice-group.md:69-72`, `packages/agent-ui/components/src/dom/element.ts:262-264`, `packages/agent-ui/a2ui/src/renderer/renderer.ts:714-735`; planner-L3.md step 2 Do lines 44 and 53.
- plan review: replan: step 2: notes-fix: the descriptor row enters `DOGFOOD_INVENTORY_CHAR_BUDGET` (30,100 against 29,767 measured, 333 headroom; the ui-product-card descriptor row alone cost 539) and `dogfood-inventory.test.ts` is only in step 3's and step 5's guards, so when it reds re-measure and raise the constant per its own header formula (round up to the next 100, plus 300, dated MEASURED line, the 3f5aebd65 precedent). Evidence: `packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts:84-96`; `packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts` is under `src/live-agent`, absent from step 2's guard.
- plan review: replan: step 3: notes-fix: the row, its selection clause and the grammar change also enter `SELECTION_GUIDANCE_CHAR_BUDGET` (9,300 against 8,957 at T-0072, before the ResultCard clause), `PROMPT_CHAR_BUDGET_BASE` and `_DERIVED`; when `selection-guidance.unit.test.ts`, `prompt-budget.test.ts` or `agent-admin-prompt-budget.test.ts` reds, re-measure and raise each constant per its own header formula with a dated MEASURED line. Evidence: `packages/agent-ui/a2ui/src/agent/selection-guidance.ts:347-355`; `packages/agent-ui/a2ui/src/agent/prompt-budget.ts:17-54`; `git show 3f5aebd65 -- packages/agent-ui/a2ui/src/agent/prompt-budget.ts` (the T-0072 raise).
- plan review: replan: step 3: notes-fix: also add `optionDeckPickerSeed` to `SEEDS_BY_MODULE` in `packages/agent-ui/a2ui/tools/corpus/import-seeds.ts` and a verdict stub in `import-seeds.test.ts`, then run `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/tools/corpus` (no step's guard covers that folder). Evidence: `import-seeds.ts:288-296,421-435` (`shelfDrift` reds when the grouping drifts from `allSeeds`), `import-seeds.test.ts:990` runs `main()` against the real table; `git show 3f5aebd65` adds the three T-0072 seeds to both files.
- plan review: replan: step 3: notes-fix: the semantic-check assembly pins are in `packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts` lines 147 to 155 (not beside `tools/agent/chat-validation.ts`); the `a2ui-basic--croupier` and `basicCatalog` expected lists stay as they are since the new check requires `OptionDeck`. Evidence: `find . -name chat-validation.test.ts` returns only `./packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts`; its lines 141-155.
- plan review: replan: step 3: interfaces: the Do's "These leave out every greeting word" is false for `start` (`greeting-card.md` line 3 carries "session start"), and `pick choose option choice` overlap `variant-picker`'s triggers. No pinned exact selection moves: `mini-skills.test.ts:114,157,301,365` pin game words, `:527` is `toContain`, `:720-736` select over synthetic modules, `domain-guidance.test.ts:14` is "deal me a round of blackjack", `agent-admin-presets.test.ts:629-635` pin croupier moves. Note, not a defect. Evidence: `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/greeting-card.md:3`, `variant-picker.md:3`, the `grep -rn "selectMiniSkills("` sweep over `packages site scripts`.
- plan review: replan: step 3: interfaces: the `marked` opt-in pin is `index.test.ts:2204`, not 2203. Cosmetic. Evidence: `packages/agent-ui/a2ui/src/catalog/default/index.test.ts:2200-2204`.
- plan review: replan: plan: goal coverage: the Done-when live `chat:probe` on Haiku 5.5 and Sonnet 5.5 is a manual run in step 4 and no criterion; AGENTS.md "Gates" makes the live leg never a gate and the plan says so under Risks. Note, not a defect. Evidence: planner-L3.md step 4 Do and Risks.
- plan review: replan: plan: acceptance criteria: replayed on current HEAD `50a2f67a2`: step 2's approval criterion exits 0 (the line is recorded); step 2's `- Props:` and registry reds, step 3's catalog-row, selection, dogfood-rules reds and step 4's four reds exit 1; the step 3 catalog parse exits 0 on the analogous BoardGrid row; `generate-controls --check`, `generate-agent-assets --check`, `generate-agent-content --check`, `foundations-census --gate`, `dogfood-compose selftest` and `--gate` all exit 0. The heavy vitest, browser and `npm run check` guards were not rerun here; the planner records them green on this same HEAD under Assumptions. Evidence: the replay output (`s2c1=0 s2c2=1 s2c4=1 s3c1=1 True s3c2=1 s3c6=1 s4c1=1 s4c2=1 s4c3=1`, `gc=0 gaa=0 gac=0 census=0 dcs=0 dcg=0`), run with `env -u NODE_OPTIONS` and `~/.nvm/versions/node/v24.18.0/bin` on PATH.
- Kim 2026-10-20: approved one more replan (third planner run) after the second replan verdict. Settle the feed partition (OptionDeck IN, with its dependents) and the single select/action channel; keep step 1 as done.
- 2026-10-20 plan defect at split: step 5: (guard) criterion is red now (exit 1): env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/option-deck
- 2026-10-20 plan defect at split: step 5: (guard) criterion is red now (exit 1): env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/components/src/controls/option-deck/option-deck.visual.browser.test.ts
- Kim 2026-10-20: approved the step 2 render (gate b). The large disc icon is pictorial art; the `demo/option-deck-demo#icon-box` dogfood allowlist entry cites this ruling.
- Kim 2026-10-20: step 3's block is settled. OptionDeck notFor holds ChoiceGroup only; the Button and Select boundaries are taught in the mini-skill (criterion 2 was amended to match). Kim approves the grammar.md lines 50-51 greet rewording (greet = one OptionDeck), with a fable review of the wording per the debate rule. The builder resumes; this is not a replan.

## Outcome

2026-10-20 · lane: full L3 · verdict: skipped (design intake and mockups only (no code), Kim approved the playful direction and the step 2 render (gate b)) · verifier: verifier-L2 (sonnet) · base: 93c14adb1861
- Changed: ui-option-deck and its OptionDeck catalog row (feed IN, actionName pick channel, 2 to 8 count check, reserved random), taught in a mini-skill and the greet grammar, adopted by the Croupier game picker
- Commits: none
- Check: step-2#1 `grep -qE '^- Approved direction: (calm|playful|editorial)' .sdlc/tickets/0193-option-deck/handof...: pass
- Check: step-2#2 (red) `line=$(grep '^- Props:' ...) && ... grep -qF 'actionName' && ... grep -qF 'index?'`: pass
- Check: step-2#3 (red) `env -u NODE_OPTIONS npx vitest run packages/agent-ui/components/src/controls/option-deck` ...: pass
- Check: step-2#4 (red) `grep -qF "'ui-option-deck'" packages/agent-ui/components/src/controls/registry.gen.ts`: pass
- Check: step-2#5 (red) `find .../option-deck/__baselines__ -name 'option-deck-*-chromium-darwin.png' | grep -q .`: pass
- Check: step-2#6 (red) `for f in site/option-deck-doc.html site/option-deck-demo.html site/pages/option-deck-doc.t...: pass
- Check: step-2#7 `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages .../opti...: pass
- Check: step-2#8 (guard) `env -u NODE_OPTIONS node scripts/generate-controls.mjs --check`: pass
- Check: step-2#9 (guard) the 12-path `npx vitest run ...` guard: pass
- Check: step-2#10 (guard) `env -u NODE_OPTIONS node scripts/foundations-census.mjs --gate`: pass
- Check: step-2#11 (guard) `env -u NODE_OPTIONS node scripts/generate-agent-assets.mjs --check`: pass
- Check: step-3#1 (red) catalog row shape (`python3 -c ... catalog.json ... OptionDeck`): pass
- Check: step-3#2 (red) selection sidecar and projection (`python3 -c ... selection.json ... && grep -q OptionDeck ...: pass
- Check: step-3#3 (red) `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/renderer/option-deck-action....: pass
- Check: step-3#4 (red) `sed -n '/^export const FEED_SURFACE_TYPES/,/^] as const/p' feed-catalog.ts | grep -qF "'Op...: pass
- Check: step-3#5 (red) check registered in the four mirrors (`for f in chat-validation.ts trace.ts check-contracts...: pass
- Check: step-3#6 (red) teaching files (`test -f option-deck.md && grep -q OptionDeck greeting-card.md && grep -qF ...: pass
- Check: step-3#7 (red) lint pointer (`python3 -c ... dogfood-rules.json lone-button-frame use ... && grep -q Optio...: pass
- Check: step-3#8 (red) seed (`grep -q optionDeckPickerSeed catalog-frontier.ts && grep -q optionDeckPickerSeed imp...: pass
- Check: step-3#9 (guard) `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/catalog ... scripts/e2e-ad...: pass
- Check: step-3#10 (guard) `env -u NODE_OPTIONS node scripts/generate-agent-assets.mjs --check`: pass
- Check: step-3#11 (guard) `env -u NODE_OPTIONS node scripts/dogfood-compose.mjs selftest`: pass
- Check: step-3#12 (guard) `env -u NODE_OPTIONS node scripts/dogfood-compose.mjs --gate`: pass
- Check: step-4#1 (red) grep OptionDeck and pick_game in croupier agent.md: pass
- Check: step-4#2 (red) no "one row of plain buttons" in agent.md: pass
- Check: step-4#3 (red) croupier seedVersion above base: pass
- Check: step-4#4 (red) grep OptionDeck in persona-exemplars.ts: pass
- Check: step-4#5 (guard) `generate-agent-content.mjs --check`: pass
- Check: step-4#6 (guard) the vitest set (site/agent-content, croupier, corpus, examples, agent-manifest, seed-dige...: pass
- Check: step-5#1 (guard) `env -u NODE_OPTIONS npm run check`: pass
- Check: step-5#2 (guard) vitest unit run over controls, descriptor, a2ui/src, a2ui registry and corpus tools, site...: pass
- Check: step-5#3 (guard) browser `--project packages` option-deck: pass
- Check: step-5#4 (guard) browser `--project visual` option-deck.visual.browser.test.ts: pass
- Check: step-5#5 (guard) browser `--project site` dogfood-render.browser.test.ts: pass
- Check: step-5#6 (guard) `node scripts/dogfood-compose.mjs --gate`: pass
- Check: step-5#7 Do item, screenshots against the approved mockup: pass
- Deviation: step 1 verifier skipped: design intake and mockups only (no code), Kim approved the playful direction and the step 2 render (gate b)
- Follow-up: decide: scripts/dogfood-render-allowlist.json:4 the... -> notes.md
- Follow-up: decide: packages/agent-ui/components/src/controls/option-deck/option-deck-m... -> notes.md
- Follow-up: note: packages/agent-ui/components/src/controls/option-deck/option-deck.c... -> notes.md
- Follow-up: note: site/public/llms.txt:92 is hand-written... -> notes.md
- Follow-up: note: /Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/tmp/0193-s2-v... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl... -> notes.md
- Follow-up: note: site/pages/dogfood-render.browser.test.ts the nested-card walk over... -> notes.md
- Follow-up: decide: site/agent-content/personas/croupier/agent.md:35: criterion 1's... -> notes.md
- Follow-up: decide: the seed has no PERSONA_SEEDS_BY_MODULE entry and no disposition... -> notes.md
- Follow-up: decide: agent.md line 57 foundation paragraph still says to pick a game at... -> notes.md
- Follow-up: note: the manual chat:probe on Haiku 5.5 and Sonnet 5.5 was not run no... -> notes.md
- Follow-up: note: Gates #3 and #5 passed on the first run -> notes.md
- Follow-up: note: The builder's scratch folder was already gone; my own scratch... -> notes.md

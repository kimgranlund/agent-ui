# T-0065 Design: the widgets the 15 agent presets need

Read-only spike, 2026-10-12. Measurements: `measure/probe.ts` (repo root, `node --experimental-strip-types`),
output `measure/probe.out.txt`. Prompt figures are the K6 shape of the response-type LLD section 4:
`buildSystemPromptSections(catalog, [], undefined, [])` plus the serialized `render_surface` tool, in chars.

## 1. Verdict

Build five widgets, not twelve. Three are shared, data-driven `ui-*` controls that join the default
catalog (ProductCard, BoardGrid, GameHud); two are persona composites that live in a persona fragment
(CardTable for the Croupier, QuestionCard for the Quizmaster). The other seven candidates are cut:
each is already one templated ChildList away (Itinerary, CharacterSheet, CommitmentLedger), folds
into another widget (ExhibitCard into ProductCard, SwatchPalette into Swatch and Ramp templates), or
lacks a second consumer (MediaGallery, AvailabilityPicker: deferred, section 6).

Prompt budget: the default turn is at 44,392 of 46,430 chars (K6 bound = 42,209 x 1.1; the handoff's
46,400 is this figure rounded). The three default rows cost 835 chars together (row + selection
clause), landing at 45,227 with 1,203 to spare. All twelve on the default catalog would be 47,125,
over the bound; that is the number that rules the split, not taste. Persona rows cost only their
preset: CardTable +352 on `agent-ui--croupier` (45,087), QuestionCard +235 plus the one-time 143-char
derived-id line on a new `agent-ui--quizmaster` (44,770).

Wave order: W0 derived catalogs inherit base idioms (prerequisite) · C1-C3 the three controls · R1 their
rows · P1, P2 the persona composites · S1 Shopkeeper + pack text repairs (section 8). A Shopkeeper preset
is justified (section 5). Kim's "Hotelier room gallery" is the Hotel Concierge: a Grid or Swiper of
ProductCards in offer mode (photo, rate, badge, Book) plus the Grid+Image template for a pure photo set.

## 2. Mechanics the design stands on (verified)

- One fragment per preset, no stacking: `resolveEffectiveCatalogId(baseId, localPatterns)` derives
  `<base>--<personaId>` from a single persona id (`app/src/controls/agent-admin/agent-admin-schema.ts:399`).
  A "shared opt-in widgets fragment" therefore cannot sit beside a persona's own fragment at runtime.
- A derived catalog retrieves zero mini-skills and zero exemplars today: `produce.ts:1061` scopes
  `selectMiniSkills` to `deps.catalog.catalogId` (`agent-ui--croupier` never equals `agent-ui`), and
  `corpus/retrieve.ts:63` filters on the same id. The Croupier fixture trace shows it: sections
  grammar/components/functions only, `exemplarIds: []` (`croupier/__fixtures__/sonnet-blackjack-turn1.jsonl`).
  The ADR-0234 budget matrix already measures derived catalogs WITH the base's worst mini-skills
  (`prompt-budget.test.ts:60-63,88-92`), so inheriting them needs no re-base. OF2 (`persona-catalog-composition.spec.md`
  section 5) was a sequencing ruling, not a mechanics one; splitting on the first `--` keeps a2ui-basic clean.
- A default-catalog row must agree with a real control descriptor (`catalog/default/descriptor-agreement.test.ts`,
  ADR-0173 cl.5) and every fleet control is in the default catalog or on `EXCLUSION_ALLOWLIST`
  (`catalog/default/index.test.ts`, ADR-0087; PlayingCard is the persona-scoped precedent, ADR-0225).
  So "default catalog" means "a real `ui-*` control plus a row"; a fragment may instead ship a
  composite factory over existing controls (concierge `BookingForm`, `personas/concierge/factories.ts`).
- Only `Button` and `Suggestions` carry an `action` prop in the default catalog; Suggestions is the
  precedent for a non-Button row with an `{action, context}` prop (`default/factories.ts:1404`); BoardGrid rides it.
- A new emittable type needs a `selection.json` entry, an example seed (and T-0064's all-catalog gate
  once it lands), a testkit matrix cell (automatic), `node scripts/generate-agent-assets.mjs`,
  `npm run generate:registry` and a baseline recapture; a new fragment folder also needs a `records.ts`
  record, `registry-wiring.test.ts` and a hand-written `site/lib/agent-manifest/<id>.manifest.json`.

## 3. Widget table

Evidence honesty: only the Croupier has recorded fixtures; every other count is read off the idiom text
(a pack entry, mini-skill or example seed), so it is the composition the prompt prescribes, not one observed live.

| Widget | Tier | Kind | Home | Presets served | Evidence (hand composition today) | Prompt cost | Size |
|---|---|---|---|---|---|---|---|
| ProductCard | 1 | `ui-product-card` control + row | default catalog | concierge (rooms, rate pick), travel (leg comparison), curator (exhibit mode), shopkeeper (new), restaurant (optional) | `product-presentation.md` mini-skill = 9 components per card; `examples/commerce-hospitality.ts:76-89` = 10; `trip-plan` pack: "comparison Cards in a Row (mode, duration, price Badge)" x3; `collection-carousel`: Card+2 Text+Badge per SwiperItem | 387 on every turn | M |
| BoardGrid | 1 | `ui-board-grid` control + row | default catalog | admiral, lexicographer | `board-grid` pack: Grid of 36 cell Buttons with action context; GH #144 note in `agent-admin-presets.ts:604-607`: 72 cells in one turn burned the self-correct budget; `word-tiles`: Grid of 30 Badge tiles | 202 on every turn | M |
| GameHud | 1 | `ui-game-hud` control + row | default catalog | croupier, quizmaster, mentalist, negotiator, alchemist, dungeon-master, admiral (7) | `game-hud.md` mini-skill; `guess-hud`, `deal-sheet`, `color-duel`, `quest-log`, `battle-rounds` packs each compose Stat(s) + Badge + Progress by hand; croupier fixture turn1: 2 Badges + status Text per table | 246 on every turn | M |
| CardTable | 3 | composite factory over `ui-card`, `ui-playing-card`, `ui-badge`, `ui-text` | `personas/croupier` fragment | croupier | `haiku-4-5-blackjack-turn1.jsonl`: 27 components per round (5 Row, 3 Card, 5 Text, 2 Badge, 3 Button, 3 PlayingCard), re-minted every round by design (`surfaceStyle`, one surface per round); `game-table-chrome.md` prescribes the 15-component frame | 352 on croupier turns only | M |
| QuestionCard | 3 | composite factory over `ui-card`, `ui-radio-group`, `ui-radio`, `ui-disclosure`, `ui-progress` | new `personas/quizmaster` fragment | quizmaster (haiku-5-5) | `quiz-round` skill: Text + RadioGroup + 4 Radio + Button + Disclosure = 8 per round, one surface updated round by round; the cheapest model on the roster gets the most structure | 235 + 143 on quizmaster turns only | L (new fragment folder) |
| Shopkeeper preset | S1 | config only | `site/pages/agent-admin-presets.ts` | the ProductCard live consumer | no preset exercises commerce; `product-presentation` and `commerce-hospitality` seeds exist with no persona | 0 | S |

Cut, with the replacement: Itinerary (Timeline + TimelineItem ChildList template over `/stops`; repair the
`itinerary-timeline` pack text to say so) · CharacterSheet (GameHud stats + List inventory) ·
CommitmentLedger (GameHud for asking/offer/mood + the existing Slider and Sparkline) · ExhibitCard
(ProductCard with `icon` and no price or action) · SwatchPalette (Row ChildList template of Swatch;
one preset, 54-char row saves little) · MediaGallery and AvailabilityPicker deferred (section 6).

## 4. Per-widget contracts

ProductCard (`ui-product-card`, tier pattern, `UIElement`, light DOM, ARIA via internals, fill-by-default
with the `inline` opt-out, ADR-0223). Props, all bindable unless noted: `title`, `subtitle`, `image`
(src), `imageAlt`, `icon` (image-free exhibit mode), `price`, `priceNote`, `rating` (number), `badge`,
`badgeIntent` (neutral|info|success|warning|danger), `actionLabel` (not bindable), `action` (the Button
action shape, optional); children model `child` for one extra block. States: no image shows the icon
header; no price and no action renders as an exhibit tile (no empty Stat or Badge, the
product-presentation rule); title clamps at two lines; dark/light through `--md-sys-color-*`; a
malformed `badgeIntent` is a CATALOG failure. Sidecar: use "one product, room or offer to buy or book";
not for Card (content with no price or action), ServiceCard (a thing to open, not buy).

BoardGrid (`ui-board-grid`, tier pattern, `UIElement`). Props: `rows`, `cols` (numbers, not bindable),
`cells` (bindable array of `{row, col, mark, intent, disabled}`), `label`, `actionName` (string; when set
each enabled cell is a button emitting `action: {action: actionName, context: {row, col}}`, the Suggestions
precedent; absent, the board is read-only, the Lexicographer's tile grid). States: empty `cells` renders the
blank board; marks are text plus intent, never color alone; keyboard moves by arrow keys, one tab stop.
Sidecar: use "a board of cells to target or mark"; not for Grid (a layout of components), Table (rows of data).

GameHud (`ui-game-hud`, tier pattern, `UIElement`). Props, all bindable: `title`, `status`,
`statusIntent`, `stats` (array of `{label, value, delta, intent}`, max 6), `progress` (`{value, max,
label}`). States: empty stats renders title and status only; deltas are signed. Sidecar: use "a game score and status strip"; not for Stat (one metric
outside a game), Toolbar (actions, not readouts).

CardTable (croupier fragment composite). Props: `title`, `dealerHand`, `playerHand` (arrays of
`{rank, suit, faceDown}`, the PlayingCard enums), `dealerTotal`, `playerTotal`, `bankroll`, `bet`,
`status`, `statusIntent`; children model `children` for the action Buttons (the Deal again Button and
its `newRound` context are unchanged). The data paths stay `/dealerHand`, `/playerHand`, `/dealerTotal`,
`/playerTotal`, `/bankroll` so the bankroll mirror keeps working. The ADR-0238 hand check inspects
PlayingCard components and their templates (`croupier/checks.ts:24-95`), so P1 gives it a CardTable arm:
`dealerHand`/`playerHand` must be `{path}` bindings to those lists, totals computed from them. Sidecar: use
"a card table with both hands and the actions"; not for PlayingCard (one card), Card (a content surface).

QuestionCard (quizmaster fragment composite). Props: `question`, `options` (array `{value, label}`),
`value` (two-way value mark, event `change`, the BookingForm precedent), `name`, `revealed` (boolean),
`explanation`, `progress` (`{value, max}`). States: `revealed` false hides the explanation and keeps the
options live; true disables the options and opens the explanation. Sidecar: use "one quiz question with
its choices"; not for RadioGroup (a form choice, no reveal).

## 5. Per-preset coverage

| Preset | Widgets used | Still composed from existing types |
|---|---|---|
| croupier | CardTable, GameHud, PlayingCard (exists) | Slider bet ask |
| quant | none | Stat, charts, Table (dashboard-kpi-grid) |
| concierge | ProductCard (rooms, rates), BookingForm/Confirmation (exist) | Grid+Image gallery template, Timeline itinerary, Calendar |
| restaurant | ProductCard optional (a dish with a price badge) | menu as Card + List; seatings as RadioGroup |
| travel | ProductCard (legs) | Timeline itinerary template, Stat total |
| curator | ProductCard (exhibit mode) in Swiper | Tabs per day, Avatar |
| stylist | none | Swatch, Ramp, Ladder (templates) |
| quizmaster | QuestionCard, GameHud | Modal reveal, Table per round |
| mentalist | GameHud | Timeline, SegmentedControl, Modal |
| negotiator | GameHud | Slider, Sparkline, Badge |
| lexicographer | BoardGrid (read-only marks) | TextField with regex check, List |
| admiral | BoardGrid (actionName "cell"), GameHud (ships) | Toast |
| alchemist | GameHud | Swatch, ColorPicker, Ramp |
| dungeon-master | GameHud (HP, Gold) | Timeline, List, Disclosure |
| builder | none (prose; the ask arm) | ChoiceGroup for an option pick |
| shopkeeper (new) | ProductCard in Grid or Swiper | SegmentedControl + TextField quantity (`product-options-quantity` seed) |

Shopkeeper: yes. Evidence: ProductCard would otherwise have no live persona for the `eval:agent-behavior`
persona leg and no recorded fixture; the commerce seeds and mini-skill already exist unused by any
preset. Config only: an `AGENT_PRESETS` entry (no `category`, generic packs, like quant), a
`site/lib/agent-manifest/shopkeeper.manifest.json`, two seeded skills (`product-grid`, `cart-summary`)
in a new `COMMERCE_SKILLS` pack. No fragment.

## 6. Rejected alternatives

- A shared opt-in `widgets` fragment as the home for Tier 1: a preset selects one fragment, so Croupier
  and Concierge could never add it; and a derived catalog drops base mini-skills and exemplars until W0.
- Fragment stacking (`agent-ui--croupier+widgets`): changes `derivedCatalogId`, the records bijection,
  the manifests and `resolveEffectiveCatalogId` for a problem three default rows solve inside budget.
- All twelve on the default catalog: 47,125 chars, over K6.
- MediaGallery now: Grid+Image with a ChildList template is two components for n photos (`media-grid`
  mini-skill); build it only if a Hotelier run shows the template failing. The `gallery-swiper` pack text
  ("No Image type exists in the catalog") is stale; S1 repairs it.
- AvailabilityPicker now: two seatings or n spa slots are a RadioGroup or ChoiceGroup with `disabled`
  options; no preset repeats it per turn.
- Real `ui-*` controls for CardTable and QuestionCard: one preset each; a composite factory costs no
  descriptor, no fleet gates and no site page (the BookingForm precedent). Promote later if a second
  preset appears (the PlayingCard route, ADR-0225).

## 7. ADR route

One new ADR-0243 "Preset widgets: data-driven controls on the default catalog, persona composites in
fragments, derived catalogs inherit base idioms". Clauses: (1) the admission test: a widget exists only
when the hand composition it replaces is 8 or more components per instance and is re-minted per turn or
per item; (2) placement: two or more presets and a real control means a default row; one preset means a
fragment composite; (3) derived catalogs retrieve the base's mini-skills and exemplars (split on the
first `--`, as `selectionGuidanceForId` already does): amends ADR-0172 OF2 / `persona-catalog-
composition.spec.md` SPEC-R6 and the matching line in `packages/agent-ui/a2ui/AGENTS.md`; (4) the
K6 room is the budget for default rows and each row carries a sidecar clause (ADR-0232); (5) the
Shopkeeper preset. The ADR also carries the three component-design fork sheets (tier pattern,
`UIElement`, geometry row, anatomy, ARIA via internals) so the component-build seat is not asked to do
design intake. Contracts touched: ADR-0087 (three new controls join the default catalog), ADR-0233
(per-control entries), ADR-0223 (sizing), ADR-0225 (CardTable composes over PlayingCard, which stays
persona-scoped), ADR-0235 and ADR-0241 (one new fragment folder and record), ADR-0238 (paths unchanged),
`a2ui-catalog.spec.md` (three rows), PRD response-type-selection K6 row (re-measured in R1).

## 8. Build children (sequenced; the shared single-file registries make full disjointness impossible)

Shared files, touched by one child at a time: `catalog/default/{catalog.json,factories.ts,selection.json}`,
`src/examples/*.ts`, the prompt baseline and `assets.gen.ts` (R1 only); `agent-admin-presets.ts` and
`agent-admin-libraries.ts` (R1, then P1, P2, S1 in sequence). Levels: controls are component-build seats
(L3); rows, fragments and config are a2ui or solo seats.

| Id | Child | Level | Size | Depends | Files |
|---|---|---|---|---|---|
| W0 | Derived catalogs inherit base mini-skills and exemplars | L2 | S | ADR-0243 | `a2ui/src/agent/mini-skills.ts`, `src/agent/produce.ts:1061`, `src/corpus/retrieve.ts:63` (+ tests), `persona-catalog-composition.spec.md` SPEC-R6, `a2ui/AGENTS.md` |
| C1 | `ui-board-grid` control | L3 | M | ADR-0243 fork sheet | `components/src/controls/board-grid/**`, `registry.gen.ts` and `all.gen.*` (generated), `site/` doc page + nav |
| C2 | `ui-product-card` control | L3 | M | ADR-0243 fork sheet | `components/src/controls/product-card/**`, generated registry, `site/` doc page |
| C3 | `ui-game-hud` control | L3 | M | ADR-0243 fork sheet | `components/src/controls/game-hud/**`, generated registry, `site/` doc page |
| R1 | The three default rows, seeds, sidecar entries, previews, mini-skill and pack text, K6 re-measure into the PRD | L2 | M | C1, C2, C3 | the shared default files above, `prompts/mini-skills/{product-presentation,game-hud}.md`, `agent-admin-libraries.ts` (`board-grid`, `word-tiles`, `trip-plan`, `guess-hud`, `deal-sheet`, `color-duel`, `quest-log`, `battle-rounds`), presets.ts croupier `game-hud` skill, `a2ui-catalog.spec.md`; GameHud's kill switch (section 9) is decided here |
| P1 | CardTable in the croupier fragment | L3 | M | W0, R1 | `personas/croupier/{catalog.json,factories.ts,selection.json,checks.ts}`, `croupier.manifest.json` (writer), `prompts/mini-skills/{card-layout,game-table-chrome}.md`, presets.ts croupier skills + `seedVersion` 8, croupier seeds for the T-0064 gate |
| P2 | Quizmaster fragment with QuestionCard | L3 | L | W0, R1, T-0064 (seed format) | new `personas/quizmaster/**`, `personas/{index,manifests}.ts`, `catalog/records.ts`, `registry/registry-wiring.test.ts`, `site/lib/agent-manifest/quizmaster.manifest.json`, presets.ts quizmaster `localPatterns` + `seedVersion` 3 |
| S1 | Shopkeeper preset + commerce pack + `gallery-swiper`/`itinerary-timeline` text repair | L2 | S | R1, P1, P2 | `agent-admin-presets.ts`, `agent-admin-libraries.ts`, `shopkeeper.manifest.json`, the e2e persona-picker fixture if it pins the count |

C1, C2 and C3 run in parallel; R1 after all three; P1 and P2 in parallel after R1; S1 last.

## 9. Risks and unknowns

- [U] T-0064's persona-seed format is unplanned (`.sdlc/catalog-previews-all/` holds no plan); P1 and P2 follow it or land `src/examples` entries first.
- [U] `agent-manifest.ts` pins a preset's `localPatterns` to a shipped folder; P2 names the folder `quizmaster`.
- [U] GameHud's structural gain is the smallest of the three (a Row template of Stat already works); its
  case is spread (7 presets) and the data contract for ADR-0238-style checks. If R1's K6 re-measure or a
  persona eval shows no gain, drop its row and keep the mini-skill.
- W0 changes what every derived turn is taught; replay the Croupier fixtures (`recorded-replay.test.ts`) before P1.
- The e2e-admin persona-picker fixture may pin the preset count; S1 re-records or widens it. Each default
  row moves the byte-pinned baseline; the rows children recapture deliberately, never to get green.

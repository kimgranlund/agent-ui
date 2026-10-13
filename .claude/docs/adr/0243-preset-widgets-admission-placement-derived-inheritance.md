# ADR-0243 — Preset widgets: a widget earns a type only when its hand composition is large and re-minted, data-driven controls join the default catalog, one-preset composites live in fragments, and derived catalogs inherit the base's mini-skills and exemplars

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-12 |
> | **Proposed by** | the sdlc-lite run `preset-widgets` (architect L1 design spike T-0065, ticket T-0067), on Kim's request for the widgets the 15 agent presets need. Number 0243 claimed against the file tree (0242 the highest), every sibling worktree under `.claude/worktrees/` and every local branch |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-12, via the [`ratify ADR-0243` utterance](https://github.com/kimgranlund/agent-ui/pull/1886#issuecomment-6128314029) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification and build: [`../spec/persona-catalog-composition.spec.md`](../spec/persona-catalog-composition.spec.md) SPEC-R6 (the catalogId filter becomes base-aware) · `packages/agent-ui/a2ui/AGENTS.md` (the derived-catalog line) · [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md) (three default rows) · the PRD `response-type-selection` K6 row (re-measured by the rows child) · code: `packages/agent-ui/a2ui/src/agent/mini-skills.ts`, `src/agent/produce.ts`, `src/corpus/retrieve.ts`, `src/catalog/default/{catalog.json,factories.ts,selection.json}`, `src/catalog/personas/{croupier,quizmaster}/**`, `src/catalog/records.ts`, `packages/agent-ui/components/src/controls/{board-grid,product-card,game-hud}/**`, `packages/agent-ui/app/src/controls/agent-admin/agent-admin-{presets,libraries}.ts` |
> | **Supersedes / Superseded by** | none · **Extended by** [ADR-0244](./0244-next-preset-widgets-result-card-contrast-pair.md) · **Amends** [ADR-0172](./0172-persona-catalog-composition-intake.md) cl.3 and its OF2 ruling as absorbed by SPEC-R6 (a derived catalog was left with no mini-skills and no exemplars; cl.3 below ends that) · **Composes** [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (three new controls join the default catalog) · [ADR-0232](./0232-catalog-selection-guidance-sidecar.md) (every row carries a sidecar clause) · [ADR-0233](./0233-per-control-entries-and-generated-control-registry.md) (per-control entries) · [ADR-0223](./0223-fill-by-default-fleet-sizing-contract.md) (fill-by-default sizing) · [ADR-0224](./0224-service-card-availability-stated-launch-card.md) (the pattern-tier card precedent) · [ADR-0225](./0225-ui-playing-card-mint-persona-scoped.md) (CardTable composes over PlayingCard, which stays persona-scoped) · [ADR-0234](./0234-turn-trace-prompt-budget-and-token-usage.md) (the budget the rows are measured against) · [ADR-0235](./0235-agent-manifest-drift-gate.md) and [ADR-0241](./0241-lazy-catalog-bodies-behind-an-eager-manifest.md) (one new fragment folder and record) · [ADR-0238](./0238-persona-semantic-checks-in-the-repair-loop.md) (data paths unchanged) |

## Context

The 15 agent-admin presets compose their surfaces by hand from fleet primitives. Where that
composition is large and re-minted every turn it is expensive, fragile and slow: the Croupier
re-mints 27 components per blackjack round (5 Row, 3 Card, 5 Text, 2 Badge, 3 Button, 3 PlayingCard;
the `haiku-4-5-blackjack-turn1.jsonl` fixture); the `board-grid` pack asks for 36 cell Buttons and the
GH #144 note in `agent-admin-presets.ts` records 72 cells in one turn burning the self-correct budget;
the `product-presentation` mini-skill prescribes 9 components per product card and
`examples/commerce-hospitality.ts` spends 10. A design spike (T-0065) weighed twelve candidate widgets
against that evidence and against the prompt budget. Only the Croupier has recorded fixtures; every
other count is read off idiom text (a pack entry, mini-skill or seed), so it is the composition the
prompt prescribes, not one observed live.

Three mechanics bound the answer, each verified in the tree:

- **The prompt budget rules the split.** The default turn is 44,392 chars against the PRD K6 bound of
  46,430 (42,209 x 1.1). Each default-catalog row costs its inventory line plus its selection clause on
  every turn of every agent: ProductCard 387, GameHud 246, BoardGrid 202 (835 together, landing at
  45,227 with 1,203 spare). All twelve candidates on the default catalog would be 47,125, over the bound.
  A persona row costs only its own preset (CardTable +352 on `agent-ui--croupier`, 45,087; QuestionCard
  +235 plus the one-time 143-char derived-id line, 44,770).
- **A preset selects exactly one fragment.** `resolveEffectiveCatalogId(baseId, localPatterns)` derives
  `<base>--<personaId>` from a single persona id (`agent-admin-schema.ts`), so a shared opt-in
  "widgets" fragment cannot sit beside a persona's own fragment at runtime.
- **A derived catalog is taught less than its base.** `produce.ts` scopes `selectMiniSkills` to
  `deps.catalog.catalogId` and `corpus/retrieve.ts` filters on the same id; `agent-ui--croupier` never
  equals `agent-ui`, so a derived turn retrieves zero mini-skills and zero exemplars (the Croupier
  fixture shows sections grammar/components/functions only and `exemplarIds: []`). The ADR-0234 budget
  matrix already measures derived catalogs with the base's worst mini-skills, so inheriting them
  needs no budget re-base. OF2 of the persona-catalog-composition spec was a sequencing ruling, not a
  mechanics one.

## Decision

**We will admit a widget only when the hand composition it replaces is large and re-minted, put
the data-driven ones that two or more presets need on the default catalog as real `ui-*` controls
(ProductCard, BoardGrid, GameHud), keep one-preset composites as factories inside that persona's
fragment (CardTable, QuestionCard), and make a derived catalog retrieve its base's mini-skills and
exemplars so a fragment preset is taught what a default preset is.** Five of the twelve candidates
build; seven are cut (clause 1).

1. **The admission test.** A widget earns a catalog type only when the hand composition it replaces
   is 8 or more components per instance AND is re-minted per turn or per item. Below that, a
   templated ChildList over existing types is the answer and the pack or mini-skill text teaches it.
   The seven cut candidates and their replacements: Itinerary (Timeline + TimelineItem ChildList
   template over `/stops`; the `itinerary-timeline` pack text is repaired to say so) · CharacterSheet
   (GameHud stats plus a List inventory) · CommitmentLedger (GameHud for asking, offer and mood, plus
   the existing Slider and Sparkline) · ExhibitCard (ProductCard with `icon` and no price or action) ·
   SwatchPalette (a Row ChildList template of Swatch; one preset, a 54-char row saves little) ·
   MediaGallery and AvailabilityPicker (deferred, see Alternatives).

2. **Placement.** Two or more presets AND a real `ui-*` control means a default-catalog row (the row
   must agree with the control's descriptor, ADR-0173 cl.5, and the control joins the catalog per
   ADR-0087). One preset means a composite factory in that persona's fragment over existing controls
   (the concierge `BookingForm` precedent): no descriptor, no fleet gates, no site page. A composite
   is promoted to a real control only when a second preset appears (the PlayingCard route, ADR-0225).
   Three controls join the default catalog: `ui-product-card` (concierge, travel, curator, restaurant
   optionally, and the new shopkeeper), `ui-board-grid` (admiral, lexicographer) and `ui-game-hud`
   (croupier, quizmaster, mentalist, negotiator, alchemist, dungeon-master, admiral). Two composites
   stay in fragments: `CardTable` in `personas/croupier`, `QuestionCard` in a new `personas/quizmaster`
   fragment (a record in `catalog/records.ts` and a hand-written agent manifest, ADR-0235 and ADR-0241).

3. **Derived catalogs inherit the base's idioms.** `selectMiniSkills` and the corpus retrieval filter
   split a catalog id on its first `--` and match on the base segment, the way `selectionGuidanceForId`
   already does; `a2ui-basic` ids contain no `--` and stay clean. This amends ADR-0172 cl.3 and OF2
   (SPEC-R6 of the persona-catalog-composition spec) and the matching line in
   `packages/agent-ui/a2ui/AGENTS.md`. It lands first (child W0) because it changes what every derived
   turn is taught; the Croupier recorded fixtures are replayed before CardTable builds.

4. **The K6 room is the budget for default rows.** The three default rows spend 835 of the 2,038 chars
   between today's default turn and the K6 bound. Each row carries a `selection.json` sidecar clause
   (ADR-0232: a "use" sentence and a "not for" naming the confusable sibling). Each row moves the
   byte-pinned prompt baseline; the rows child recaptures it deliberately, re-measures K6 into the PRD
   row, and never recaptures to get green. A fourth default row is not admitted without a fresh
   measurement against the remaining room (1,203 after these three).

5. **A Shopkeeper preset gives ProductCard a live consumer.** Without one, ProductCard has no persona
   for the `eval:agent-behavior` persona leg and no recorded fixture, while the commerce seeds and
   the `product-presentation` mini-skill exist unused by any preset. The preset is config only: an
   `AGENT_PRESETS` entry (no `category`, generic packs, like quant), a
   `site/lib/agent-manifest/shopkeeper.manifest.json` and two seeded skills (`product-grid`,
   `cart-summary`) in a new `COMMERCE_SKILLS` pack. No fragment.

## Component fork sheets

One sheet per new control, so the component-build seat is not asked to do design intake. Every row
below is decided; a row the build cannot honor is an escalation, not a free choice. Shared to all
three: tag under the `ui-{name}` law; base `UIElement` (a display primitive with data-props, not a
container, not form-associated: no `value`); light DOM; ARIA through `ElementInternals`, never host
attributes; tier `pattern`; sizing fill-by-default with the reflected `inline` boolean opt-out
(ADR-0223, `sizing-gates.test.ts` enforcing); events drawn only from the closed set (`action` here);
interaction states per the four-state standard with no deviation; tokens `--ui-{name}-*` consuming
`--md-sys-color-*` roles, intent never carried by color alone; every prop bindable unless noted.

### ProductCard (`ui-product-card`)

| Row | Decision |
|---|---|
| Tag, class | `ui-product-card`, `UIProductCardElement`; descriptor `product-card.md` beside the control |
| Anatomy | Host is a card surface. `[data-part="media"]` (image, or icon header when there is no image) · `[data-part="body"]` holding title, subtitle and a price row (`price` with `priceNote`, `rating`, `badge`) · `[data-part="action"]` (one internal `<button data-part>`, the sanctioned class). A `child` model slot takes one extra block |
| Props | `title`, `subtitle`, `image` (src), `imageAlt`, `icon` (image-free exhibit mode), `price`, `priceNote`, `rating` (number), `badge`, `badgeIntent` (neutral, info, success, warning, danger), `actionLabel` (not bindable), `action` (the Button action shape, optional) |
| Events | `action` only, emitted from the action part with the bound `action` payload; no `change` or `input` |
| Geometry | `pattern` tier: container spacing off `--md-sys-space` x density plus ONE control-height action row (the ADR-0224 cl.1 ServiceCard precedent). Media aspect box reserved so a late image does not shift layout. Title clamps at two lines. No new geometry row |
| States | No image: icon header. No price and no action: an exhibit tile (no empty Stat or Badge, the `product-presentation` rule). A malformed `badgeIntent` is a catalog failure, not a silent default |
| A11y | Role `group` with `ariaLabel` from `title`; the action part is a real button named by `actionLabel` and the title; the image gets `imageAlt` (decorative when empty); rating is text plus a numeric label, not stars alone |
| Catalog | Default row `ProductCard`; sidecar: use "one product, room or offer to buy or book"; not for Card (content with no price or action), ServiceCard (a thing to open, not buy) |

### BoardGrid (`ui-board-grid`)

| Row | Decision |
|---|---|
| Tag, class | `ui-board-grid`, `UIBoardGridElement`; descriptor `board-grid.md` |
| Anatomy | Host is the board (`role` grid via internals). `[data-part="cell"]` per cell, positioned by `row`/`col` on a CSS grid sized from `rows` and `cols`. When `actionName` is set each enabled cell is a `<button data-part="cell">` (sanctioned class); otherwise a non-interactive cell |
| Props | `rows`, `cols` (numbers, not bindable) · `cells` (bindable array of `{row, col, mark, intent, disabled}`) · `label` · `actionName` (string; absent means a read-only board) |
| Events | `action` only, `{action: actionName, context: {row, col}}`, the `Suggestions` precedent; one event per activation, never per render |
| Geometry | `pattern` tier. Cell side is the control-height row at the active `[size]` (square, meeting the target-size floor); gap and frame off `--md-sys-space` x density. No new geometry row. 72 or more cells must render in one pass without a per-cell component (the GH #144 reason this exists) |
| States | Empty `cells` renders the blank board. A mark is text plus intent, never color alone. Disabled cells are skipped by the tab order and not activatable. Marks update in place with no board re-mount |
| A11y | Host `role=grid` with `ariaLabel` from `label`, cells `gridcell`; roving tabindex gives ONE tab stop, arrow keys move by cell, Enter and Space activate an enabled cell; the accessible name of a cell is mark, intent and its row and column |
| Catalog | Default row `BoardGrid`; sidecar: use "a board of cells to target or mark"; not for Grid (a layout of components), Table (rows of data) |

### GameHud (`ui-game-hud`)

| Row | Decision |
|---|---|
| Tag, class | `ui-game-hud`, `UIGameHudElement`; descriptor `game-hud.md` |
| Anatomy | `[data-part="title"]` and `[data-part="status"]` (a status mark with `statusIntent`) in a header row · `[data-part="stats"]` one `[data-part="stat"]` per entry (label, value, signed delta) · optional `[data-part="progress"]` (value over max with a label). No action part |
| Props | `title`, `status`, `statusIntent`, `stats` (array of `{label, value, delta, intent}`, at most 6; extra entries are dropped, a catalog warning), `progress` (`{value, max, label}`); all bindable |
| Events | None. A read-out has no activation; the closed event set is untouched |
| Geometry | `pattern` tier with container spacing and no action row (no control height). Stats flow in a wrapping row; value type rides the stat type step. No new geometry row |
| States | Empty `stats` renders title and status only. Deltas are signed text (a leading plus or minus), intent never the only carrier. `progress.max` of zero or less renders no bar rather than a broken one |
| A11y | Role `group` with `ariaLabel` from `title` (or "Game status"); status is a polite live region through internals so a score change is announced once; the progress part is a `progressbar` with its label, value and max |
| Catalog | Default row `GameHud`; sidecar: use "a game score and status strip"; not for Stat (one metric outside a game), Toolbar (actions, not readouts) |

### Persona composites (not fleet controls)

No descriptor, no geometry row, no site page: factories over existing controls in the persona
fragment. **CardTable** (`personas/croupier`, over `ui-card`, `ui-playing-card`, `ui-badge`, `ui-text`):
props `title`, `dealerHand`, `playerHand` (arrays of `{rank, suit, faceDown}`, the PlayingCard enums),
`dealerTotal`, `playerTotal`, `bankroll`, `bet`, `status`, `statusIntent`; a `children` model for the
action Buttons. The data paths stay `/dealerHand`, `/playerHand`, `/dealerTotal`, `/playerTotal`,
`/bankroll` so the bankroll mirror keeps working, and the ADR-0238 hand check
(`croupier/checks.ts`) gains a CardTable arm: the two hands must be `{path}` bindings to those lists
with totals computed from them. **QuestionCard** (`personas/quizmaster`, over `ui-card`,
`ui-radio-group`, `ui-radio`, `ui-disclosure`, `ui-progress`): props `question`, `options` (array of
`{value, label}`), `value` (two-way, event `change`, the BookingForm precedent), `name`, `revealed`
(boolean), `explanation`, `progress` (`{value, max}`); `revealed` false hides the explanation and
keeps the options live, true disables the options and opens the explanation.

## Consequences

- **Fewer components per turn where it hurts.** A Croupier round drops from 27 hand-minted components
  toward a CardTable plus its actions; a board of 72 cells becomes one BoardGrid with a `cells` array.
  These are projections from idiom text and the Croupier fixtures, not live measurements; the live
  `eval:agent-behavior` persona leg (Kim's manual run) is where they are confirmed.
- **Every turn pays 835 chars.** The three default rows cost every agent, including ones that never
  show a product, a board or a HUD. That is the price of two-or-more-preset reuse; clause 4 caps the
  remaining room at 1,203.
- **W0 changes what every derived turn is taught.** Every fragment preset starts receiving the base's
  mini-skills and exemplars. The ADR-0234 matrix already budgets for it, but the byte-pinned baseline
  and the recorded Croupier turns must be replayed (`recorded-replay.test.ts`) before CardTable builds.
- **Contracts touched on build:** ADR-0087 (three controls join the default catalog), ADR-0233
  (per-control entries and generated registry), ADR-0223 (sizing), ADR-0225 (CardTable composes over
  PlayingCard, which stays persona-scoped), ADR-0235 and ADR-0241 (one new fragment folder and record),
  ADR-0238 (paths unchanged), `a2ui-catalog.spec.md` (three rows), the PRD K6 row (re-measured).
- **Build sequence and ownership.** W0 (derived catalogs inherit, L2) first; then C1 to C3 (the three
  controls, L3, in parallel, each with its doc page and nav entry); R1 (the three rows, seeds,
  sidecars, previews, mini-skill and pack text, K6 re-measure; L2) after all three; P1 (CardTable) and
  P2 (Quizmaster fragment with QuestionCard) in parallel after W0 and R1; S1 (Shopkeeper preset and the
  `gallery-swiper` and `itinerary-timeline` text repairs) last. The shared single-file registries
  (`catalog/default/*`, `src/examples/*.ts`, the prompt baseline and `assets.gen.ts`, the preset and
  library files) force this order; no two children touch them at once. Generated files are never
  hand-edited: `registry.gen.ts`, `all.gen.*`, `assets.gen.ts` and the selection projection regenerate.
- **A new emittable type is a longer checklist than a row.** Each needs a `selection.json` entry, an
  example seed (and the all-catalog preview coverage gate once T-0064 lands), a testkit matrix cell
  (automatic), `generate-agent-assets.mjs`, `generate:registry` and a baseline recapture; the new
  fragment folder also needs a `records.ts` record, `registry-wiring.test.ts` and a manifest.
- **Open items (carried to the build children, not decided here):**
  - The component fork sheets' visual details (anatomy proportions, spacing, media treatment, stat
    layout, mark rendering) are subject to Kim's separate review of the widget styling mockup; the
    sheets bind the contract (props, events, ARIA, tier), not the final look.
  - T-0064's persona-seed format is unplanned; P1 and P2 follow it, or land `src/examples` entries
    first.
  - `agent-manifest.ts` pins a preset's `localPatterns` to a shipped folder; P2 names the folder
    `quizmaster`.
  - GameHud's structural gain is the smallest of the three (a Row template of Stat already works); its
    case is spread (7 presets) and the data contract for ADR-0238-style checks. R1 decides its kill
    switch: if the K6 re-measure or a persona eval shows no gain, drop its row and keep the
    `game-hud` mini-skill.
  - The e2e-admin persona-picker fixture may pin the preset count; S1 re-records or widens it.
  - Kim ratifies this ADR before any child dispatches; nothing in the build children is started on a
    `proposed` record.

## Alternatives considered

- **A shared opt-in `widgets` fragment as the home for the Tier 1 controls.** Rejected: a preset
  selects one fragment, so the Croupier and the Concierge could never add it beside their own, and a
  derived catalog drops base mini-skills and exemplars until clause 3 lands.
- **Fragment stacking (`agent-ui--croupier+widgets`).** Rejected: it changes `derivedCatalogId`, the
  records bijection, the manifests and `resolveEffectiveCatalogId` for a problem three default rows
  solve inside the budget.
- **All twelve candidates on the default catalog.** Rejected: 47,125 chars, over the K6 bound of
  46,430. The number, not taste, rules the split.
- **MediaGallery now.** Rejected: a Grid of Image with a ChildList template is two components for n
  photos (the `media-grid` mini-skill); build it only if a Hotelier run shows the template failing. The
  `gallery-swiper` pack text ("No Image type exists in the catalog") is stale and S1 repairs it.
- **AvailabilityPicker now.** Rejected: two seatings or n spa slots are a RadioGroup or ChoiceGroup
  with `disabled` options, and no preset repeats it per turn.
- **Real `ui-*` controls for CardTable and QuestionCard.** Rejected: one preset each; a composite
  factory costs no descriptor, no fleet gates and no site page. Promote later if a second preset
  appears.
- **Leave derived catalogs untaught and put idioms in each fragment.** Rejected: it duplicates the
  base's mini-skills per persona and drifts; the base-segment match is one rule that every present and
  future fragment inherits.

## Amendment 1: QuestionCard matches the approved mockup (2026-10-12, T-0082)

> Status: recorded by T-0082 from Kim's review of the widget styling mockup, the open item in
> Consequences ("the sheets bind the contract ... not the final look"). Append-only; the Decision and the
> Persona composites paragraph above are unchanged, and this section extends the QuestionCard contract.

The built card (T-0074) drew plain radios under a progress bar and a closed disclosure, and its reveal only
disabled the options, because the wire carried neither the correct answer nor the header text. The
approved mockup needs both.

1. **Three wire props and a children slot.** `answer` (string, the correct option's `value`), `label`
   (string, the header pill text) and `meta` (string, the right-aligned header text such as topic and
   difficulty) join the row, all bindable. The row gains `children: "ChildList"`, the CardTable slot: the
   producer's action Buttons (a Check answer Button) are appended inside the card after the explanation,
   at their content width. The value and change contract (`a2uiQuestionValue`) is unchanged.
2. **Composition.** The factory mints `ui-badge`, `ui-radio-group`, `ui-radio` and `ui-text` inside
   `ui-card`; it no longer mints `ui-progress` or `ui-disclosure`. `progress` `{value, max}` fills the pill
   as `Question n of m` when `label` is absent, and the explanation is a plain panel under the options,
   shown in place only while `revealed` is true and the text is not empty. No element carries a
   border-left (Kim's ruling on the mockup's explanation panel).
3. **Option rows.** Each option stays a `ui-radio`, so keyboard, roving focus and checked state still come
   from the group. It is drawn as a bordered row at least 44px tall with a circular letter badge A, B, C,
   D. States: idle; selected (a dot glyph, primary tint); and, once `revealed` with `answer` set, correct
   (a check glyph and the label "Correct", success tint) and wrong for a pick that is not the answer (a
   cross glyph and "Your answer", danger tint), with the other rows idle. No state rests on color alone.
   `revealed` disables the group and each radio (a disabled group alone still let a click check a radio).
   Without `answer`, `revealed` keeps the pick selected and marks nothing.
4. **Seeds and teaching.** Both quizmaster seeds and the `quiz-round` skill carry `answer`, `meta`,
   `progress`, `revealed` bound to a path, and the in-card Check answer Button whose action context
   carries the answer path, held disabled by a `required` check on that path until a pick. The
   Quizmaster preset's `seedVersion` moves to 4 so a saved store picks up the new teaching.
5. **Budget.** The props live only in the quizmaster fragment, so the default turn does not move: K6
   (default `agent-ui` composition plus the tool) measures 45,377 chars, 1,053 under the 46,430 bound.
   The `agent-ui--quizmaster` default composition grows from 45,151 to 45,224 chars (+73).

## Amendment 2: the merged widgets match the approved mockups (2026-10-12, T-0083)

> Status: recorded by T-0083 from Kim's review of the widget styling mockup against the merged ProductCard,
> BoardGrid, GameHud and CardTable (QuestionCard was Amendment 1). Append-only; the Decision, the fork sheets
> above and Amendment 1 are unchanged, and this section extends the ProductCard and BoardGrid contracts and
> replaces one Geometry row.

The built widgets passed their behaviour gates but not mockup parity: the action buttons sat at 24px (the
ProductCard `sm` row) and 28px (the producer Buttons in CardTable and QuestionCard, the button's default `md`),
the card showed one star and none of the mockup's offer states, board cells were 34px, and the seeds used an
info pill where the mockup was green.

1. **Action buttons at the large step.** The primary actions render at the button ramp's `lg` step (36px and
   the 16px `lg` font at the default scale), never a custom height. The mockup drew them at 39px, 14px, weight
   600, which is not a ramp step; the weight stays the button's own. ProductCard's native action reads
   `--md-sys-height-lg` and `--md-sys-font-lg`. CardTable's Hit, Stand and Double and QuestionCard's Check
   answer are the producer's own Buttons, and neither base's `Button` row carries a size, so each composite
   stamps `size="lg"` on every `ui-button` the renderer appends inside it (`personas/action-row.ts`, a
   subtree observer); no Button wire prop is added. QuestionCard option rows stay at least 44px.
2. **ProductCard rating and states.** The rating draws five stars rounded to the nearest half (full, half or
   empty, the warning ink), then the number and the hidden "out of 5". Four bindable wire props join the
   default row and the descriptor, additively: `priceOld` (string, struck through after the price, announced
   with a hidden "was"), `ratingCount` (number, "(318)" after the number, 0 shows none), `selected` (boolean,
   reflected: a 2px primary outline and the action drawn as a ghost; `actionLabel` carries the words, so the
   state never rests on the outline) and `disabled` (boolean, reflected: the media desaturates and the action
   button is natively disabled; the renderer's host click guard reads the same host prop, so a disabled card
   dispatches nothing). The sidecar is unchanged: it holds intents and `notFor` edges, never props. The rooms
   seed carries a struck rate, rating counts and a sold-out room.
3. **BoardGrid cell side.** This replaces the BoardGrid Geometry row's "cell side is the control-height row
   at the active `[size]`": each track is `minmax(34px, 46px)`, so a cell is the mockup's 46px where the
   container has room and gives way to the 34px target-size floor where it does not. One side serves both
   modes. The mockup's battle cells measure 46px and its word tiles 48px (46px plus a border); the 52px the
   T-0083 ticket named for tiles is not in the mockup (52px is its playing-card width), and the default row
   has no field that tells a battle board from a word board. The board seed gains the mockup's battle board:
   hit (a filled dot, danger), miss (a ring, neutral) and sunk (a boxed square, success), the danger-high and
   success-high inks Kim asked for, each with the control's corner glyph.
4. **Seed payloads.** The GameHud and CardTable seeds show "Your turn" on the success pill. CardTable deals at
   the playing card's `md` size (wider than the mockup's 52px card, which the old `sm` matched). The dealer
   total reads "showing 9" while the hole card is face down, a string total the factory renders verbatim.
5. **Budget.** K6 (the default `agent-ui` composition plus the tool) measures 45,454 chars, +77 for the four
   props on the inventory line, 976 under the 46,430 bound. The worst-case derived prompt (ADR-0234) measures
   140,801 chars (`agent-ui--croupier`, +154 with the dogfood row), so `PROMPT_CHAR_BUDGET_DERIVED` is
   re-measured to 141,200 by its own formula; BASE holds at 139,883 against 140,000.

## Amendment 3: CardTable runs the whole hand, betting included (2026-10-12, T-0088)

> Status: recorded by T-0088 from Kim's ask (2026-10-12) that the blackjack table take the bet in its own step
> of the hand, with chips plus a stepper as the chosen input. Append-only; the Decision, the Persona composites
> paragraph and Amendments 1 and 2 are unchanged, and this section extends the CardTable contract additively.

The built table showed a hand already dealt: the bet was a read-only number and the result lived in the status
pill. A round has three steps, and the table now carries each one.

1. **Three wire props and a value mark.** `phase` (`betting`, `playing` or `settled`; absent reads as
   `playing`, so every earlier payload renders and behaves as before), `chips` (array of numbers, the chip
   amounts; absent, empty or invalid falls back to 10, 25, 50, 100) and `result` (string, the settled result
   line: winner, hands, chip delta) join the row, all bindable. The row gains the QuestionCard value contract on
   `bet`: `{ prop: 'bet', event: 'change', readProp: 'a2uiCardTableBet' }`, so a bet bound to `/bet` is
   two-way. The handoff's "existing result prop" did not exist on the row; `result` is that prop, added.
2. **Betting.** The felt stays and empties (cards and totals hidden; the hand lists are not touched) and the
   bet row shows: one soft `+n` `ui-button` per chip, a `ui-text-field type=number` stepper (min 1, max the
   bankroll, step 5) for an exact amount, and a ghost Clear `ui-button`, all at the button and field `lg` step
   (36px). The chips hug their labels (the ADR-0223 `inline` opt-out) on the first line; the stepper takes the
   second line's slack beside Clear. A chip adds to the bet and stops at the bankroll (every chip goes inert
   once the bet equals it), Clear sets 0, a stepper commit sets the amount clamped to 0 to the bankroll; each
   sends one bubbling `change` the input binding reads. The readout keeps showing the bankroll and the live bet.
3. **Deal gate.** The factory, not a Button `checks` entry, keeps Deal disabled while the bet is below 1 or
   above the bankroll: the default base's only check function is `required`, which cannot state a range
   against a bound bankroll. In `betting` the first producer Button root child (Deal) is disabled out of range
   and restored to its own prior `disabled` when the bet comes back into range, the Button changes, or the
   phase leaves `betting`. The factory never touches a Button in `playing` or `settled`. The producer gives
   Deal no `checks`.
4. **Playing and settled.** `playing` is the table as built, the bet read-only in the readout, the moves
   (Double included) as children. `settled` shows the `result` line above the readout, tinted by
   `statusIntent` (the words carry the result, never the tint alone), with a Deal again child.
5. **Composition and the hand check.** `uses` adds `ui-button` and `ui-text-field` (ADR-0233). The root order
   is head, the two zones, result, bet, readout, then the producer Buttons. The ADR-0238 hand check is
   unchanged: HAND_BINDING, HAND_COUNT and HAND_TOTAL judge a betting or settled table exactly as a playing one.
6. **Seeds and teaching.** Betting and settled seeds join the shelf on both bases, `phase` bound to `/phase`;
   the playing seeds are unchanged. `card-layout` and `game-table-chrome` teach the phases within their
   200-token module budget, and the Croupier preset's skills and `round-loop` teach bet, deal, play, settle. Its
   `seedVersion` moves to 9.
7. **Budget.** K6 (the default `agent-ui` composition plus the tool) measures 45,454 chars, unchanged (the
   props live in the croupier fragment, and K6 composes no mini-skill), 976 under the 46,430 bound. The
   `agent-ui--croupier` default composition grows from 45,729 to 45,791 chars (+62, the three props on the
   inventory line). The worst-case derived prompt (ADR-0234) measures 140,891 chars (`agent-ui--croupier`,
   +90) against 141,200, and BASE 139,911 (+28, the two re-authored modules) against 140,000; neither budget
   moves.

## Amendment 4: the renderer forwards a control's own action event, so BoardGrid cells fire on the wire (2026-10-13, T-0081)

> Status: recorded by T-0081 from the T-0072 R1 verifier finding that BoardGrid shipped read-only on the wire.
> Append-only; the Decision, the BoardGrid fork sheet, and Amendments 1 to 3 are unchanged, and this section
> extends the BoardGrid contract and the renderer's action wiring additively.

BoardGrid emits a DOM `action` event with `{action, context: {row, col}}` once `actionName` is set, but the
renderer wired A2UI actions only from a catalog prop whose `mapsTo` is `'action'` (a host `click` listener with
a static `context`), so a clicked cell never reached the agent and the row held `actionName` back.

1. **One catalog mark, `PropDef.actionEvent`.** A prop may name a DOM event the control fires on its own host.
   Where `mapsTo: 'action'` strips the prop and answers a click, an `actionEvent` prop is applied to the control
   as usual (it is what turns BoardGrid's cells into buttons) and the renderer additionally listens for the named
   event on the element. The mark is opt-in per prop and validated at load as a non-empty string. Only
   `BoardGrid.actionName` carries it (`'action'`); ProductCard's own `action` event stays unread, as before.
2. **Forwarding.** The listener emits one A2UI action per event: `name` is `detail.action`, `context` is
   `detail.context` as the control built it (BoardGrid: the cell's 0-based `row` and `col`), `wantResponse`
   absent. It counts only an event fired on the host itself, drops a detail with no action name, and never
   emits for a disabled host. It shares the `#actionWiring` abort controller, so a structural resend re-wires
   without stacking (GH #1164) and surface or list-item teardown removes it.
3. **The row.** `BoardGrid` gains the non-bindable string `actionName`. Unset, the board stays read-only and
   fires nothing, so every existing payload and corpus record is unchanged.
4. **Corpus grounding.** `checkActionGrounding` accepts an action whose source component carries an
   `actionEvent` prop whose string value equals the action name, alongside the `mapsTo: 'action'` rule.
5. **Teaching.** The BoardGrid sidecar gains the intent "a board with clickable cells" (cut to fit the dogfood
   clause and derived-prompt budgets, no ceiling moved); the prop itself rides the inventory line as
   `actionName: string`. Presets that still build a Grid of cell Buttons (the Admiral) are unchanged here; moving
   them to `actionName` is a separate ticket.

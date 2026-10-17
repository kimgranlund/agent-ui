# SPEC: A2UI catalog architecture (core, agentic and shared domain catalogs)

> Status: proposed · v0.1 · 2026-10-14 · Layer: SPEC (execution contract) · solo seat, T-0201
> Scope: how the A2UI catalogs split into three layers (core, agentic, domain), how a layer is chosen for a type, how catalog ids compose, how a preset declares its domains, and the ordered migration from today's one default catalog plus four persona fragments. It builds and moves nothing; each wave and each pattern lands under its own ticket.
> Fills the carve-out reserved by [`persona-catalog-composition.spec.md`](./persona-catalog-composition.spec.md) SPEC-N2 (the "shared system patterns" tier ADR-0172 cl.3 said is needed and left unbuilt). Composes on: [`a2ui-catalog.spec.md`](./a2ui-catalog.spec.md) (catalog format, coverage law SPEC-N2, the a2ui-basic partition SPEC-R10), the persona composition mechanism (SPEC-R1 to SPEC-R7 there, reused), [`agent-content.spec.md`](./agent-content.spec.md) (T-0160 derives the agent manifests from the registry), [`agent-closed-loop.spec.md`](./agent-closed-loop.spec.md) (the `chat:probe` smoke each wave runs).
> Decisions cite their tickets; the ADR log is frozen (T-0164) and this SPEC adds no ADR clause. Status flips are Kim's. IDs are file-scoped: `CA-R#` requirements, `CA-N#` negative requirements, `D#` open decisions, `W#` waves. Every requirement is planned; none is shipped.
> Terms: [`references/agent-model.md`](../references/agent-model.md) (agent config, a2ui producer, skill vocabulary).

## 1. Definitions

- Core layer: primitives, layout, containers, overlays, form controls and data viz. Domain-neutral and conversation-neutral: a design system would ship it with no agent in sight. Every agent loads it.
- Agentic layer: composites for a moment that every agent conversation has, whatever the domain: the agent cites, suggests, asks, confirms, reports progress, settles an outcome, recovers from failure, hands off, remembers. Domain-neutral by construction.
- Domain catalog: a shared fragment of types whose meaning belongs to one field (games, hospitality, commerce, design, knowledge). Shared across every preset in that field, never one per persona. Composes onto a base catalog with the persona-composition mechanism.
- Persona fragment: today's `catalog/personas/<persona-id>/` folder (concierge, croupier, quizmaster, stylist, fixture-demo). After the migration only `fixture-demo` remains one (it is the mechanism's test fixture, persona SPEC-N6).
- Base catalog: `agent-ui` (core plus agentic, D1) or `a2ui-basic` (the upstream interop partition). Unchanged from persona SPEC §2.
- Effective catalog: the catalog one turn renders, validates and teaches against: a base alone, or a base with the preset's domains composed on.

## 2. Requirements

### CA-R1: the layer test (planned, W0)

Every emittable type belongs to exactly one layer. The test runs top to bottom; the first line that holds decides.

1. Domain: the type's props or its meaning carry one field's vocabulary (rank and suit, a price, a booking, board cells, design token tiers), so that an agent outside that field would never pick it correctly. It goes to that field's domain.
2. Agentic: the type stands for a moment between agent and user (what the agent knows, needs, did, or offers next) and no prop names a field. It goes to the agentic layer.
3. Core: everything else, including every form control and every chart, however specialized.

Tie-breakers: a type two domains both need, whose props name neither, is core or agentic, not domain (the test is about vocabulary, not about who uses it today). A type whose name names a field but whose props are generic (GameHud) stays in the domain its name claims until a second field needs it; then it is renamed into the agentic or core layer, never shared across domains. A form control is core even when one domain motivated it (the Amount picker, T-0196).

- AC1: a layer map (one table in `packages/agent-ui/a2ui/src/catalog/`, name chosen in W0) lists every type of the default catalog and of every domain fragment with its layer, and a gate holds it equal to the catalogs: a type missing from the map, or mapped to a layer its catalog does not hold, reds the gate.
- AC2: §5's classification is the map's first content.

### CA-R2: catalog ids and composition (planned, W0 and W1)

- The agentic layer is part of the `agent-ui` base, not its own id (D1). Its types live in `catalog/default/catalog.json` beside the core types; the layer map (CA-R1) is what separates them. No new wire id, no new lazy record, and every agent gets the agentic moments with no preset change.
- A domain is a fragment folder `packages/agent-ui/a2ui/src/catalog/domains/<domain>/` with the persona fragment's shape (persona SPEC-R1: `catalog.json` fragment, `factories.ts`, optional `functions.ts`, `controls`, `index.ts`, server-safe `manifest.ts`, `selection.json`).
- One domain composes exactly as a persona fragment does today: `composeCatalog(base, fragment)`, reject-loud on any name collision with the base (persona SPEC-R2 AC3), one derived catalog per targeted base, id `<base>--<domain>` (for example `agent-ui--games`).
- More than one domain on one turn is an open decision (D2). The id grammar is strictly two-segment today, and these call sites read it that way:
  - `promptBudgetFor` (`src/agent/prompt-budget.ts`) keys on `includes('--')`;
  - `selectionGuidanceForId` (`src/agent/selection-guidance.ts`) takes everything after the first `--` as one persona id and looks it up whole, so `agent-ui--games--design` resolves to base-only guidance;
  - `selectMiniSkills` and `corpus/retrieve.ts` match the base segment (persona SPEC-R6 AC4);
  - `semanticChecksForCatalog` and `derivedCatalogIdsFor` (`src/catalog/compose.ts`), the lazy records (`src/catalog/records.ts`), and `sanitizeCatalog` / `sanitizeLocalPatterns` (`packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts`).
  The recommended grammar is `<base>--<d1>+<d2>` with the domains sorted, composed in that order onto the base. Each step is reject-loud, so two domains that share a type name can never both compose. A shipped gate composes every domain pairwise to prove all domains are mutually disjoint. The renderer knows a multi-domain id by parsing it (known base, known domains), not from an enumerated record per combination.
- Composition order never changes the result: domains are disjoint, so the union is order-free. The sort only fixes the wire id.
- AC1: `agent-ui--games` (one domain) registers and renders a games type, and the bare `agent-ui` catalog does not hold it.
- AC2: a seeded domain that redeclares a core type, or a type another domain declares, fails its gate with the colliding name.
- AC3 (if D2 picks the `+` grammar): `agent-ui--design+games` composes, validates and teaches both domains; the reversed spelling is refused or normalized, never a second id for the same catalog.

### CA-R3: a preset declares its domains (planned, W1)

- `AgentPreset.localPatterns?: string` (`site/pages/agent-admin-presets.ts`) becomes `domains?: readonly string[]`, each a shipped domain id. Absent or empty means the base alone, the same fail-closed default `localPatterns` has today.
- The persisted key `A2UI_LOCAL_PATTERNS_KEY` (`agent-admin-schema.ts`) becomes a domains key holding the canonical joined string (the D2 id tail), sanitized fail-closed: an unknown domain drops to none, never to a wrong domain. It stays in `PERSONA_STATE_KEYS` (`site/pages/agent-admin-persona-file.ts`): the persona file carries the selection, never a definition (persona SPEC-R5).
- Old values migrate through one alias table read by the sanitizer: `croupier` and `quizmaster` read as `games`, `concierge` as `hospitality`, `stylist` as `design`. The alias table lives one wave after W1 (D6).
- A preset's domain set and its base must line up: a domain that does not target the preset's base degrades to the base alone (persona SPEC-R5 AC3, reused).
- AC1: a persona exported with `domains: ['hospitality', 'commerce']` and re-imported round-trips byte-identically, and the export holds no `components` bytes.
- AC2: an exported file from before W1 holding `a2uiLocalPatterns: "croupier"` imports as `games`.

### CA-R4: selection guidance per layer (planned, W0 and W2)

- Core and agentic entries live in `catalog/default/selection.json`; each domain's entries live in its own folder's `selection.json`. A derived catalog's guidance is the base's merged with each domain's, as `selectionGuidanceForId` merges a persona's today.
- Edge law (`notFor`):
  - a core or agentic entry may name only core or agentic types, because it must resolve on the bare base (`renderSelectionClause` throws `UNRESOLVED` otherwise);
  - a domain entry may name its own domain's types (reciprocal, as today) and base types (one-way, exempt from reciprocity, as persona fragments are today);
  - a domain entry never names another domain's type, because each domain must also compose alone;
  - a domain sidecar never replaces a base type's entry (the guidance twin of reject-loud); it may only append `notFor` edges to one, inside its derived catalog (CA-R9, D8).
- Moving a type out of the default removes every default edge that points at it. The edges cut by §5's moves are: `Card` to `ProductCard` and `ServiceCard`, `Grid` to `BoardGrid`, `Stat`, `Toolbar` and `ResultCard` to `GameHud`, `Swatch` to `Ramp`, and the cross-domain pair `ProductCard` and `ServiceCard` (commerce and hospitality). The moved types keep their one-way edges to base types (`ProductCard` to `Card`, `GameHud` to `Stat`, `Ramp` to `Swatch`), and `Ramp` and `Ladder` stay reciprocal inside design. On the bare base these edges are gone; on a turn that loads the domain, the domain appends them back onto the base entries (`Card` to `ServiceCard` on hospitality), so the base-side teaching survives exactly where the composite exists (CA-R9, D8). `npm run eval:agent-behavior -- live --leg selection` (Kim's manual run) measures selection before and after W2.
- Mini-skills: a module whose body names a domain type declares that domain in its frontmatter and is selected only when the effective catalog holds the domain. Today four modules name domain or fragment types: `card-layout.md`, `game-table-chrome.md` (names `CardTable`, a croupier-only type, while scoped `catalogId: agent-ui`, so a plain turn can already be taught a type it cannot emit), `game-hud.md`, `product-presentation.md`. (T-0207: `game-table-chrome.md` now declares `domain: games`, and a persona catalog selects its fragment's domain (`selectedDomains`, `catalog/layers.ts`), so only a games turn selects it. The inventory drops the clause and edges of a domain type the catalog does not select, exempting rows still homed in `default` until W2.)
- Exemplars: retrieval keeps only records whose `meta.componentsUsed` is a subset of the effective catalog's types. Corpus records in `packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl` that use a moved type (ServiceCard 1, Ramp 1, Ladder 1 today) re-home through the corpus admission flow or are filtered, never left to teach a type the turn cannot emit. Shipped (T-0238, `src/corpus/retrieve.ts`): retrieval also follows the turn's selected domains, ranks own-domain records first, never returns another domain's composite and never fills with zero-score records; `retrieve-presets.test.ts` pins the top 3 for every shipped preset. Shipped (T-0240): per-persona exemplar shards. A seed whose composite lives in a persona fragment is admitted against the composed `<base>--<persona>` catalog into `corpus/exemplar/v1_0/<base>--<persona>.jsonl` (a CardTable round for `agent-ui--croupier`, a BookingForm for `agent-ui--concierge`), and retrieval takes a persona shard only on a turn whose catalog id is that persona's; the base shard gained a word BoardGrid and a battleship BoardGrid. Every live loader reads the base shard plus the persona shards (`tools/corpus/exemplar-shards.ts`, the Worker imports each).
- AC1: `src/catalog/selection-guidance.test.ts` gains the cross-domain rule, the no-replace rule and the append-only rule, each with a seeded negative control.
- AC2: a plain `agent-ui` turn selects none of the domain-scoped mini-skills and retrieves no exemplar holding a domain type.

### CA-R5: the prompt-budget effect (measured 2026-10-14, re-measured per wave)

Measured at `1a8f6e1a` with `buildSystemPromptSections` (mode default, no exemplars, no mini-skills, no persona text, a2ui on): the default prompt is 45,314 chars, of which the `## Available components` section is 19,530 chars for 84 types (about 232 per inventory line, selection clause included).

| Slice | Types | Inventory chars |
|---|---|---|
| Default types §5 moves to domains | BoardGrid 210, GameHud 295, ProductCard 494, ServiceCard 248, Ramp 165, Ladder 113 | 1,525 (7.8% of the section, 1.1% of the 141,100 BASE budget) |
| Persona fragment types today | BookingForm 371, BookingConfirmation 263, PlayingCard 402, CardTable 436, QuestionCard 337, ContrastPair 191 | 2,000 |
| Games domain after W2 | PlayingCard, CardTable, QuestionCard, BoardGrid, GameHud | 1,680 per games turn |
| Agentic backlog (§7.1, 12 new types; Summary card folds into ResultCard) | at about 250 each | about 3,000 on every turn |
| Domain backlog (§7.3, 24 new types; BookingForm field kinds add none) | at about 250 each | about 6,000 in all, each domain paying only its own |

A derived prompt also pays the one `catalogIdTeaching` line (the concierge derived prompt is 785 chars over the default: 634 of rows plus the line).

Reading: the split does not shrink today's prompt much (about 1.5k chars per turn that loads no domain). Its budget value is that the domain backlog never lands on every turn, while the agentic backlog does, on purpose. Its larger value is selection: fewer candidate types and fewer cross-field `notFor` edges on each turn.

- The genui dogfood rows (`src/agent/dogfood-fleet.gen.ts`) derive from the component descriptors, not from catalog membership, so a move does not change them; only a dogfood turn pays them.
- W2 re-measures `PROMPT_CHAR_BUDGET_BASE` and `PROMPT_CHAR_BUDGET_DERIVED` (`src/agent/prompt-budget.ts`) and `SELECTION_GUIDANCE_CHAR_BUDGET` (`src/agent/selection-guidance.ts`) and records the new figures in their comments. Lowering a ceiling to the new measure is allowed; raising one only to get green is not.
- AC1: after W2, `src/live-agent/prompt-budget.test.ts` passes with BASE re-measured, and the change states the before and after figures.

### CA-R6: the a2ui-basic interop catalog (planned, W1)

- `a2ui-basic` stays the upstream partition (catalog SPEC-R10). It never gains agentic types: they are not upstream types, and SPEC-R10 forbids any type outside the upstream set.
- A domain may target `a2ui-basic` (`targetCatalogs`) only when every one of its `notFor` edges to a base type resolves on `a2ui-basic` too and its factories render on that base. Otherwise it targets `agent-ui` alone, as `stylist` does today.
- A `a2ui-basic--<domain>` turn keeps the `basic-dialect` mini-skill and no `agent-ui` module (persona SPEC-R6 AC2).
- AC1: `src/catalog/records.test.ts` composes every shipped domain against every base it targets.

### CA-R7: records, registry and manifests (planned, W0 to W2)

- Lazy records (`src/catalog/records.ts`): one record per (base, domain) pairing beside the base records; multi-domain ids resolve per D2. `packages/agent-ui/app/src/catalog-lazy.bundle.test.ts` keeps every domain body out of the static graph.
- `SHIPPED_PERSONA_CATALOGS` and `SHIPPED_PERSONA_CATALOG_MANIFESTS` split into a domain list and a persona list (fixture-demo only). The capability registry loader's hard-coded list (`tools/registry/`) follows, held by `src/registry/registry-wiring.test.ts`; `npm run generate:registry` regenerates `site/capability-registry.json` and `src/registry/selection-projection.gen.ts`.
- Agent manifests (`site/lib/agent-manifest/<id>.manifest.json`, persona SPEC-R7): `fragment` becomes `domains`, with one digest pair (catalog, selection) per domain. When T-0160 lands, the digests come from the registry (agent-content SPEC), not a writer run.
- Semantic checks move with the vocabulary they read: the Croupier's checks (`personas/croupier/checks.ts`) read `CardTable` and `PlayingCard` and the `/dealer*` and `/player*` paths, so they attach to the games domain and each check returns no finding when its component types are absent from the surface (D4). Today they key on the derived id, so without this step every games preset would run blackjack checks.
- The coverage law (catalog SPEC-N2, ADR-0087: every shipped `ui-*` control resolves to a default-catalog type or sits on `catalog/default/exclusions.ts`) reds on the first move. W2 needs D3 decided first.
- `src/catalog/default/descriptor-agreement.test.ts` and the testkit matrix (`src/testkit/matrix.test.ts`) cover domain rows as they cover default rows.
- AC1: after W1, the four persona id lists persona SPEC-R7 AC3 holds coherent are the domain lists, and `list-coherence` still reds on a missing id.

### CA-R8: naming (planned, W0)

- Domain ids: one lowercase noun, kebab if ever two words: `games`, `hospitality`, `commerce`, `design`, `knowledge`. Folder name equals id.
- Type names: PascalCase, no domain prefix or suffix (the persona OF1 ruling rejected a namespacing tax), unique across all layers, which the pairwise gate (CA-R2) enforces. A domain composite names the thing, not the persona (`CardTable`, not `CroupierTable`).
- Agentic types name the moment (working names in §7), fixed at each pattern's design intake.
- Controls: tag `ui-{name}`, class `UI{Name}Element`, events from the fixed set (ADR-0153), as every control.

### CA-R9: steering is a mechanism, not prose (moment checks shipped, T-0208; rest planned, W0 to W3)

Evidence that teaching alone does not steer: after T-0200 taught the existing composites in the preset skills, live Haiku 5.5 probes still hand-built the moment. The Concierge answered "What facilities do you have?" with Card and DescriptionList, not ServiceCard, and the Lexicographer answered "Let's play" with Card and TextField, not BoardGrid or GameHud. The Croupier did the same until a semantic check forced CardTable (`BET_TABLE_MISSING`, T-0172, `personas/croupier/checks.ts`). Live round 2 (T-0225, per-turn `--expect-turn` on Haiku and Sonnet 5.5) confirmed it: the Concierge drew its composite on 1 of 24 turns (one ServiceCard, Sonnet) and the Lexicographer on 0 of 28, while the Croupier, held by its semantic checks, drew CardTable on every model. A composite counts as adopted only when a check or a probe shows it on the wire.

Three levers, weakest first:

1. Sidecar guidance (CA-R4). Intents and `notFor` on the inventory line, on every turn, cheaply. Each domain composite's intents name its moment in the user's words ("what facilities", "let's play", "show the board"). The model picks the generic type from that type's own line, so a domain may append `notFor` edges to a base entry inside its derived catalog (on a hospitality turn, `Card` reads "not for: ServiceCard (a facility or service to open)"). Appending is additive: the base entry's intents and its own edges never change, the bare base never sees the edge, and the reciprocity gate exempts it as it exempts domain-to-base edges today (D8, revised by this evidence). Necessary, not sufficient: the guidance is still prose.
2. A smaller per-turn inventory (CA-R2, CA-R5). A domain loads only for the presets that declare it, so its composite sits on the inventory exactly where its moment occurs and is absent elsewhere. This narrows the choice but does not force it: the Concierge already had ServiceCard on its inventory and still built a Card.
3. Per-domain moment checks (ADR-0238 contract, `src/catalog/semantic-check.ts`). A check reads the surfaces and the answered action (`SemanticCheckInput`: `surfaces`, `action`, and on a say turn `intent`, the user's typed words, T-0232, and `target`, the open surface its meta-line declares, T-0214), recognizes a moment built from primitives with no domain composite, and returns a finding that names the composite, as `BET_TABLE_MISSING` does. `produce()` feeds the finding into the repair round; a false positive costs one round and ships tallied at the bound, never a halt.
   - A moment check belongs to its domain (D4) and runs only when the effective catalog holds that domain, so it never demands a type the turn cannot emit.
   - Its detector is structural and narrow. For example: a games board built as a Grid of Buttons or of Badge tiles with no BoardGrid (the `board-grid` rule in `scripts/dogfood-rules.json` already names this shape at authoring time); a hospitality Card holding a service name and an open action, with no ServiceCard. A facility-hours answer is not that moment: ONE Card holding a DescriptionList, one row per facility with its hours and location, is the ruled shape (T-0285), and the concierge `SURFACE_MISSING` check repairs a facility ask toward it.
   - Each check ships with a seeded negative control and a keyless replay of the live trace that showed the miss (agent-closed-loop CL-R3), so the check is red before its fix and green after.

Recommendation: use all three, with the check as the guarantee. Write intents in user words and let domains append base edges (lever 1); load domains only where declared (lever 2, already this architecture); and give every domain composite that a live probe shows hand-built one moment check (lever 3). Skill prose stays short and is never the only steer. Measure adoption with the probe's `expect-component` check (CL-R2) per preset moment. Do not add a check for a composite until a probe shows the miss: each check is a detector to maintain, and a false positive costs a repair round.

- AC1: the first two moment checks, ServiceCard on hospitality and BoardGrid or GameHud on games, are each red on a replay of the trace above and green after the repair round. Games met (T-0208): `scripts/e2e-admin/probe/replays/lexicographer-haiku-composite-repair` and `admiral-haiku-composite-repair` capture `BOARD_GRID_MISSING` and `GAME_HUD_MISSING` repairing the turn. Hospitality open: the booking rows (BookingForm, BookingConfirmation) ship, but the Concierge probe drew no surface, so no code fired and no replay exists; ServiceCard has no row yet.
- AC2: a plain `agent-ui` turn and a turn on another domain run neither check.

T-0208 ships the moment checks before W2 as one data table, `src/catalog/composite-moments.ts`, whose one generator turns each row (composite, `selection.json` moment, structural detector) into a semantic check with code `<COMPOSITE>_MISSING`; a new moment is a row, never a hand-written check. The table is keyed on the composite's catalog presence (`requires`) rather than on a domain, so a plain `agent-ui` turn runs the games rows (BoardGrid, GameHud, ResultCard) until W2 moves the games types, and the gate then follows them with no code change.
- AC3: `chat:probe` scenarios for the Concierge facilities ask and the Lexicographer start carry `expect-component` for the composite, on Haiku 5.5 and Sonnet 5.5.

## 3. Negative requirements

- CA-N1: no per-persona catalog for new work. A type one persona needs goes to its field's domain or waits for a second consumer; `fixture-demo` is the only persona fragment that remains.
- CA-N2: no agentic type in `a2ui-basic` (CA-R6).
- CA-N3: no type in two layers or two domains; no domain replaces a base type or its guidance entry (appending `notFor` edges, CA-R9, is the one allowed addition).
- CA-N4: no prompt-budget ceiling raised to get a wave green (ADR-0234 rule, `packages/agent-ui/a2ui/AGENTS.md`).
- CA-N5: no hand edit of a generated file; every wave regenerates with its script.
- CA-N6: this SPEC adds no ADR clause; a decision here cites its ticket.

## 4. Preset to domain map

| Preset | Category today | `localPatterns` today | Domains (recommended) | Evidence |
|---|---|---|---|---|
| croupier | games | croupier | games | CardTable, PlayingCard, GameHud skill |
| quant | none | none | none (knowledge later, D7) | `dashboard-kpi-grid`, `drilldown` skills use core types |
| concierge | hospitality | concierge | hospitality | BookingForm, `amenity-service-card` (ProductCard per priced service, T-0279); Kim's rulings below the table |
| restaurant (Maitre d') | hospitality | none | hospitality | T-0197 wants BookingForm; T-0200 wants ServiceCard |
| travel | hospitality | none | hospitality, commerce | `trip-plan` ProductCards (T-0200 item 4), itinerary (T-0199) |
| curator | none | none | none (knowledge later, D7) | `collection-carousel`, `itinerary-tabs` use core types |
| stylist | none | stylist | design | ContrastPair, `palette-presentation` (Swatch, Ramp, Ladder) |
| shopkeeper | none | none | commerce | ProductCard live consumer (T-0075) |
| quizmaster | games | quizmaster | games | QuestionCard |
| mentalist | games | none | games | `guess-hud` skill |
| negotiator | games | none | games (commerce once offer / counter-offer lands) | `deal-sheet` Slider plus Stat |
| lexicographer | games | none | games | `word-tiles` skill |
| admiral | games | none | games | `board-grid` skill, BoardGrid |
| alchemist | games | none | games, design | tagline: Swatch targets, ColorPicker, Ramp reveals |
| dungeon-master | games | none | games | `quest-log` skill |

Concierge rulings (Kim), each enforced by a check or an oracle, not by prose alone:
- 2026-10-15 (T-0266): a booking ask that already carries every detail shows a BookingForm pre-filled for the guest to confirm, never a read-back Card.
- 2026-10-16 (T-0279, T-0292): a priced, bookable service or add-on is one ProductCard each (price, duration, a Book action), never a Table; ServiceCard stays for a service or agent to open.
- 2026-10-16 (T-0285): facility hours are one compact info Card holding a DescriptionList, one row per facility, never a ServiceCard per facility.

Two presets (travel, alchemist) need two domains once ProductCard and Ramp leave the default in W2, and W0 builds the id mechanism, so D2 must be ruled before W0 unless ProductCard and Ramp stay in core.

## 5. Classification

Every one of the 84 default types and every persona fragment type, by CA-R1.

### 5.1 Core (75 default types)

- Primitives and display: Text, Icon, Image, Video, AudioPlayer, Avatar, Badge, Code, Attachment, Swatch.
- Layout and containers: Row, Column, Grid, List, Split, SplitPane, Card, CardHeader, CardContent, CardFooter, Tabs, Tab, TabPanel, Disclosure, Swiper, SwiperItem, Drill, DrillPanel, Timeline, TimelineItem, DescriptionList, Toolbar, Breadcrumb, Pagination.
- Overlays and feedback: Modal, Drawer, Popover, Tooltip, Menu, MenuItem, Toast, FormPopover.
- Form controls: Button, TextField, Textarea, Field, FormProvider, Checkbox, Switch, Toggle, Select, Option, RadioGroup, Radio, ChoiceGroup, ChoiceCard, SegmentedControl, Segment, Slider, SliderMulti, Rating, Calendar, ComboBox, MultiSelect, FileDrop, ColorPicker.
- Data viz: Sparkline, BarChart, LineChart, PieChart, ColumnChart, Gauge, Table, Stat, Progress.

### 5.2 Agentic (3 default types)

SourceList, Suggestions, ResultCard.

### 5.3 Domain (6 default types)

- games: BoardGrid, GameHud.
- commerce: ProductCard.
- hospitality: ServiceCard.
- design: Ramp, Ladder.

### 5.4 Persona fragment types

| Type | Fragment today | Layer and home |
|---|---|---|
| BookingForm | concierge | hospitality (T-0197 moves it there) |
| BookingConfirmation | concierge | hospitality in W1; replaced by the agentic Confirm and receipt pattern (T-0195), then retired |
| PlayingCard | croupier | games |
| CardTable | croupier | games |
| QuestionCard | quizmaster | games |
| ContrastPair | stylist | design |
| FixtureBanner | fixture-demo | stays a persona fragment: the mechanism's test fixture, never a shipped pattern (persona SPEC-N6) |

### 5.5 Ambiguous types, with recommendations

| Type | Pull one way | Pull the other | Recommendation |
|---|---|---|---|
| ResultCard | `outcome` enum `win, lose, draw` reads as games | the `done` arm and the descriptor's "a game end or a finished booking" are field-neutral; four game presets and booking flows use it | agentic, as the settled-outcome moment; the Summary card candidate (§7) folds into it rather than adding a sibling |
| GameHud | props (`title, status, statusIntent, stats, progress`) are generic | the name and the sidecar ("a game score and status strip") claim games | games; a non-game status strip is the Progress job pattern, not GameHud |
| ServiceCard | descriptor: "service/agent launch card", so Handoff-shaped | its only consumers are the Concierge and the Maitre d' | hospitality now; if the Handoff pattern (§7) adopts it as "open another agent", it moves to agentic under that name in that ticket |
| Ladder | a bar list could be core data viz | `tiers` of size or spacing; only the Stylist uses it | design |
| Swatch | a token-surface type (ADR-0118), so design | a color chip is a field-neutral value (a product variant color, an Alchemist target) | core |
| ColorPicker | the Stylist and the Alchemist use it | it is a form control | core (CA-R1 tie-breaker) |
| ProductCard | "one product, room or offer to buy or book" spans Travel and Concierge rooms | `price`, `priceOld`, `rating` are commerce vocabulary | commerce; hospitality presets that sell load commerce too (D2) |
| CardTable | blackjack only today | a games composite, not a persona one | games (CA-N1) |
| QuestionCard | a teaching or onboarding check could use it | its only consumer is the Quizmaster | games; revisit if a teaching domain is ever opened |
| Amount picker (T-0196) | the handoff lists it as agentic | it is a bounded number input | core (CA-R1 tie-breaker) |

## 6. Migration waves

Each wave is its own ticket and PR off fresh `origin/main`, runs the gates named, and rolls back by reverting that one PR. Persisted stores survive a rollback: a preset migrates only when the stored `<id>.seedVersion` marker is lower than the code's (agent-model SPEC §3.2, record lifecycle), so a reverted bump leaves user edits alone, and an unknown domains value sanitizes to none.

Gate set referenced below, by name:

- G-records: `src/catalog/records.test.ts`, `packages/agent-ui/app/src/catalog-lazy.bundle.test.ts`.
- G-registry: `npm run generate:registry`, `tools/registry/generate.test.ts`, `src/registry/registry-wiring.test.ts`, `src/registry/selection.test.ts`.
- G-selection: `src/catalog/selection-guidance.test.ts`, `npm run eval:agent-behavior -- selftest`.
- G-manifests: `site/lib/agent-manifest/agent-manifest.test.ts` after the armed writer.
- G-baseline: `src/live-agent/prompt-equivalence.test.ts`, recaptured only through the `a2ui-prompt-authoring` flow; `src/live-agent/prompt-budget.test.ts`.
- G-assets: `node scripts/generate-agent-assets.mjs` and its `--check` in `check:scripts`.
- G-coverage: `src/catalog/default/index.test.ts` (catalog SPEC-N2), `src/catalog/default/descriptor-agreement.test.ts`, `src/testkit/matrix.test.ts`.
- G-presets: `site/pages/agent-admin-presets.test.ts` (the T-0159 prose-vs-catalog gate), the persona-file round trip, `npm run e2e:admin`.
- G-eval: `npm run eval:catalog` and `npm run test:eval-catalog`.
- G-probe: `npm run chat:probe` smoke, one turn per touched preset on Haiku 5.5 and Sonnet 5.5 (live, the conductor runs it, agent-closed-loop CL-R6).
- Always: `npm run check` and the touched folders' tests.

### W0: mechanism and decisions (no type moves)

- Built by T-0202: the layer map is `src/catalog/layers.ts` (gate `layers.test.ts`); the id grammar is `src/catalog/catalog-id.ts`; the domain lists are `src/catalog/domains/` (empty until W1); the domains preset key is `A2UI_DOMAINS_KEY` with `sanitizeDomains` and `DOMAIN_ALIASES` (`agent-admin-schema.ts`). Presets keep `localPatterns` until W1, and no preset writes the new key before then.
- Do: Kim rules D1 to D8. Build the layer map and its gate (CA-R1), the `domains/` folder convention, the multi-domain id per D2 at the CA-R2 call sites, the domains preset key and sanitizer with the alias table (CA-R3), the guidance edge rules (CA-R4), mini-skill domain scope and exemplar filtering (CA-R4), semantic-check self-gating (CA-R7), and the append-only base edges (CA-R9). No catalog content changes.
- Gates: G-records, G-registry, G-selection, G-assets, G-presets; G-baseline shows no byte move.
- Rollback: revert; no persisted value is written yet.

### W1: persona fragments become domain fragments

- Do (W1, not yet built; `domains/index.ts` ships the empty W0 list): croupier and quizmaster fragments merge into `domains/games/`; concierge into `domains/hospitality/`; stylist into `domains/design/`. Presets switch `localPatterns` to `domains` (§4 for the four that had a fragment; every other preset may wait for W2). Derived ids change (`agent-ui--croupier` to `agent-ui--games`); the alias table serves old stored values (D6). Bump each touched preset's `seedVersion`.
- Gates: G-records, G-registry, G-selection, G-manifests, G-assets, G-presets, G-eval, G-probe for croupier, quizmaster, concierge, stylist. G-baseline moves only if a pinned mini-skill body changes (`game-table-chrome.md`'s scope line); recapture through the flow.
- Rollback: revert; a store holding `games` sanitizes to none on the old code, and the reverted presets reseed their old `localPatterns` on the next version bump.

### W2: default domain types move out (one PR per domain)

- Do (W2, not yet built), in this order so each preset already loads its domain: give every remaining preset its §4 domains first, then move BoardGrid and GameHud to games; ProductCard to a new `domains/commerce/`; ServiceCard to hospitality; Ramp and Ladder to design. Cut the default edges CA-R4 lists. Re-home or filter the corpus records that use a moved type. Re-measure the budgets (CA-R5). Add the first moment checks, ServiceCard on hospitality and BoardGrid or GameHud on games, each with a replay of the live trace that showed the miss (CA-R9).
- Precondition: D3 decided and the coverage law edited in [`a2ui-catalog.spec.md`](./a2ui-catalog.spec.md) SPEC-N2 by the same PR as the first move.
- Gates: G-coverage, G-selection, G-baseline (the default inventory changes, so the baseline moves: recapture through the flow), G-assets, G-registry, G-records, G-manifests, G-presets, G-eval, corpus admission, G-probe for every preset whose catalog changed.
- Rollback: revert the domain's PR; the types return to the default, the baseline and budgets revert with it.

### W3: agentic layer patterns land

- Do: the in-flight tickets (T-0193, T-0195, T-0198, T-0199 compare half) and the new agentic patterns (§7) land as default-catalog rows marked agentic in the layer map. BookingConfirmation retires once T-0195 adopts its consumers.
- Gates: each ticket's own process (design intake, mockup, build, G-coverage, G-selection, G-baseline, G-presets, G-probe).
- Rollback: per ticket.

### W4: retire the persona vocabulary

- Do: drop the alias table (D6), the `localPatterns` name, and the persona list except `fixture-demo`; repair [`persona-catalog-composition.spec.md`](./persona-catalog-composition.spec.md) SPEC-N2 and SPEC-R7, `packages/agent-ui/a2ui/AGENTS.md` and the `a2ui-multi-catalog` skill to name domains.
- Gates: G-records, G-registry, G-presets, G-manifests, docs-grammar.
- Rollback: revert; the alias table returns.

## 7. Pattern backlog

Evidence names a preset skill, a playbook, a trace or a corpus record name (`packages/agent-ui/a2ui/corpus/`). Priority is a recommendation; the tickets' own priorities stand until Kim moves them.

### 7.1 Agentic

| Pattern | Purpose | Evidence | Priority | Ticket |
|---|---|---|---|---|
| OptionDeck | pick one of a few options to start; the card is the target | Croupier greeting Buttons in Cards (ruled defect), `greeting-card` mini-skill | P2 | T-0193 |
| Confirm and receipt | read back, confirm, then a settled receipt | concierge `booking-flow`, restaurant `table-reservation`, shopkeeper `cart-summary`; corpus `receipt-order-summary`, `confirmation-view` and `frontier-booking-receipt` (both settled; their booking read-backs were replaced in T-0335 and T-0318) | P2 | T-0195 (absorbs BookingConfirmation) |
| Step flow | step n of m with Back and Next over one draft | concierge `booking-flow` (about 2,000 chars of prose); corpus `backable-wizard` (a time-off request since T-0335), `pattern-wizard` | P3 | T-0198 |
| Compare | options as columns by attribute rows, one pick per column | travel `trip-plan`, `comparison-table` mini-skill, shopkeeper `product-grid`; corpus `comparison-pricing-table` | P3 | T-0199 (compare half) |
| Clarify | one structured question before acting | corpus `frontier-card-anatomy-ask`; no trace yet | P2 | new |
| Approval gate | approve, edit or deny a pending action | corpus `plan-and-execute-approve-ask` | P2 | new |
| Plan / task list | live step status for a multi-step job | corpus `plan-and-execute-plan`, `agent-task-status` | P2 | new |
| Progress job | stages, ETA and cancel for long work | corpus `contact-import-progress-to-summary` | P3 | new |
| Summary card | the settled outcome of a task | corpus `wallet-summary-card`, `structured-container-trip-summary` | P3 | fold into ResultCard (§5.5) |
| Recovery | a failure with retry and alternatives | corpus `empty-error-retry-card`; host `failureMessageFor` prose today | P2 | new |
| Feedback | a rating plus a reason that feeds evals | corpus `feedback-form`, `frontier-rating-review`; agent-closed-loop CL-R8 | P3 | new |
| Handoff | pass to a human or agent with context | corpus `agent-roster-drawer`; ServiceCard's "agent launch" role | P3 | new (may adopt ServiceCard, §5.5) |
| Memory / preference | remember or forget a user preference | the bankroll capability (GH #525) is the only persisted precedent; no trace | P3 | new, needs a persistence design first |

### 7.2 Re-homed from the agentic list

| Pattern | Layer | Why | Ticket |
|---|---|---|---|
| Amount picker | core | a bounded number input (CA-R1 tie-breaker) | T-0196 |
| Itinerary / day plan | hospitality | day, stop and time vocabulary | T-0199 (itinerary half; split the ticket) |

### 7.3 Domain

| Domain | Pattern | Purpose | Evidence | Priority |
|---|---|---|---|---|
| games | Dice / spinner | a fair random draw shown as it lands | croupier `shuffle` skill; no dice preset yet | P3 |
| games | Score sheet and leaderboard | running scores across rounds and players | quizmaster `grand-reveal`; T-0200 item 1 | P2 |
| games | Turn order | whose move it is | admiral `battle-rounds` | P3 |
| games | Inventory | what the player holds | dungeon-master `quest-log` (inventory List) | P3 |
| games | Scene choice | the next branch of a story | dungeon-master `quest-log`; overlaps OptionDeck, check convergence | P3 |
| games | Guess grid | a letter or color guess board with per-cell verdicts | lexicographer `word-tiles` (Badge tiles), mentalist `guess-hud` | P2 |
| games | Timer | a round clock | none yet | P3 |
| hospitality | BookingForm field kinds | dateRange, radio, time, stepper | trace 6 (Concierge hand-built form) | P2, T-0197 |
| hospitality | Availability slots | pick a time slot | restaurant `table-reservation` | P2 |
| hospitality | Menu | sections, dishes, dietary marks | corpus `restaurant-menu`; restaurant `dietary-and-cellar-notes` | P3 |
| hospitality | Room or seat picker | choose a room or seat | corpus `frontier-choice-group-rooms` | P3 |
| hospitality | Guest profile | who is staying, preferences | concierge `property-knowledge-base` | P3 |
| commerce | Cart | line items, quantity, total | shopkeeper `cart-summary`; corpus `add_to_cart` action | P2 |
| commerce | Variant picker | size, color, option | `variant-picker` mini-skill | P2 |
| commerce | Order tracking | where an order is | corpus `mt-order-list-select` | P3 |
| commerce | Offer / counter-offer | a two-sided price negotiation | negotiator `deal-sheet` | P3 |
| commerce | Price history | price over time | negotiator tagline (price-history Sparkline) | P3 |
| design | Palette builder | build and edit a palette | corpus `brand-palette`; stylist `palette-presentation` | P3 |
| design | Type specimen | a type scale shown | stylist (no skill yet) | P3 |
| design | Token diff | before and after token values | none yet | P3 |
| design | Before / after | two renderings compared | none yet | P3 |
| knowledge | KPI board | stat tiles above a chart and a table | quant `dashboard-kpi-grid`; corpus `kpi-panel-lifecycle` | P2, D7 decides core or knowledge |
| knowledge | Entry or definition card | one term with its definition | lexicographer (no skill yet) | P3 |
| knowledge | Collection gallery | a browsable set of items | curator `collection-carousel`; corpus `slideshow-gallery` | P3 |
| knowledge | Annotated document | a text with linked notes | none yet | P3 |

T-0200 (teach existing composites) adds no type; its preset prose must name only types its preset's catalog holds after W2 (G-presets), so it lands before W2 or with it.

## 8. Open decisions for Kim

1. D1, agentic layer home: inside `agent-ui` (recommended: no new id, every agent gets it, the layer map separates it) or its own `<base>--agentic` id that presets opt into.
2. D2, more than one domain per preset: the `<base>--<d1>+<d2>` grammar (recommended; travel and alchemist need it from W2, and W0 builds it) or one domain per preset with ProductCard and Ramp kept in core.
3. D3, the coverage law (catalog SPEC-N2, ADR-0087): widen it to "default catalog or a shipped domain fragment" (recommended) or list every moved control on `exclusions.ts` with a reason.
4. D4, semantic checks: attach to the domain, self-gate on their component types, and add one moment check per domain composite that a live probe shows hand-built (recommended, CA-R9), or key checks to the preset id.
5. D5, the ambiguous types in §5.5: accept the recommendations as a set, or rule any one.
6. D6, old derived ids and stored values: one-wave alias table from W1 to W4 (recommended) or a hard cut that resets stored selections.
7. D7, knowledge domain: open it empty and let Quant, Curator and Lexicographer adopt it when the first candidate lands (recommended), keeping charts, Table, DrillPanel and SourceList where §5 puts them.
8. D8, base-side `notFor` edges after W2: let a domain append edges to base entries inside its derived catalog (recommended since the T-0200 probes, CA-R9) or accept losing them and measure with the selection leg.

## 9. Acceptance

- This SPEC: `doc_lint` and `npm run check` exit 0, and `npx vitest run --project site site/lib/docs-grammar.test.ts` exits 0 (S2 status keyword, S3 links).
- Each wave: the gates its §6 entry names, judged by exit code, plus Kim's ruling on the decisions it depends on (W0 needs D1 to D8; W2 needs D3).

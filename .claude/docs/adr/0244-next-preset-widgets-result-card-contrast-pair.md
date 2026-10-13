# ADR-0244 — The next preset widgets: a widget is also admitted when its type is inexpressible or its law lives only in prompt text, ResultCard joins the default catalog, ContrastPair is a Stylist fragment composite, and the other review candidates stay recipes, wire props or a tool

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-12 |
> | **Proposed by** | the sdlc-lite solo run `widget-patterns-next` (design spike T-0087), on Kim's request for the next shared widget patterns after the 2026-10-12 preset review. Number 0244 claimed against the file tree (0243 the highest), every sibling worktree under `.claude/worktrees/` and the history of every ref |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-13, via the [`ratify ADR-0244` utterance](https://github.com/kimgranlund/agent-ui/pull/1909#issuecomment-6136020438) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification: [ADR-0243](./0243-preset-widgets-admission-placement-derived-inheritance.md)'s header cell gains `Extended by ADR-0244` (the two-way Extension link; ADR-0243's body is not edited) · on build: [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md) (one default row) · the PRD `response-type-selection` K6 row (re-measured) · [`../spec/persona-catalog-composition.spec.md`](../spec/persona-catalog-composition.spec.md) (one new fragment) · code: `packages/agent-ui/components/src/controls/result-card/**`, `packages/agent-ui/a2ui/src/catalog/default/{catalog.json,selection.json}`, `src/catalog/personas/stylist/**`, `src/catalog/records.ts`, `site/pages/agent-admin-{presets,libraries}.ts` |
> | **Supersedes / Superseded by** | none · **Extends** [ADR-0243](./0243-preset-widgets-admission-placement-derived-inheritance.md) cl.1 (two admission routes beside its composition test; cl.2 placement and cl.4 budget unchanged) · **Composes** [ADR-0220](./0220-choice-group-rich-card-selection-container.md) (the TYPE arm) · [ADR-0201](./0201-ui-description-list-key-value-receipt-primitive.md) (enforcement locus) · [ADR-0217](./0217-price-currency-formatting-catalog-function.md) (the FUNCTION arm) · [ADR-0225](./0225-ui-playing-card-mint-persona-scoped.md) (promotion on a second preset) · [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) · [ADR-0232](./0232-catalog-selection-guidance-sidecar.md) · [ADR-0223](./0223-fill-by-default-fleet-sizing-contract.md) · [ADR-0046](./0046-container-box-model.md) · [ADR-0238](./0238-persona-semantic-checks-in-the-repair-loop.md) · [ADR-0234](./0234-turn-trace-prompt-budget-and-token-usage.md) |

## Context

ADR-0243 built five widgets and cut seven. The 2026-10-12 preset review then named the gaps that remain:
five games dead-end on win, lose and restart; the Concierge and the Maître d' have no slot picker; the Admiral
and Lexicographer boards carry no semantic check; the Stylist cannot show contrast; Croupier shuffles and
Dungeon Master dice are prose. A design spike (T-0087) weighed ten candidates against ADR-0243 cl.1 (8 or more
components per instance AND re-minted per turn or per item). Every count below is read off the prompt text a
preset is seeded with, not observed live: only the Croupier has recorded fixtures.

- **The composition test admits nothing new.** T-0066 (#1887) added an "End state" line to six game packs:
  a win or lose Badge and a Play again Button, 2 components, once per game
  (`site/pages/agent-admin-libraries.ts:249-300`); the Quizmaster's `grand-reveal` is a Modal with a Stat,
  a Table, a Badge and a Button, 5 (`site/pages/agent-admin-presets.ts:567`). A slot picker is a ChoiceGroup
  over a `/slots` template of ChoiceCard with two Texts, 4, once per booking. The one candidate that clears
  the test, the Admiral's clickable board (a Grid of 36 cell Buttons, `agent-admin-libraries.ts:244`), is
  already the BoardGrid type; what it lacks is wire forwarding of its own `action` event (T-0081, since shipped: ADR-0243 Amendment 4).
- **The component-design doctrine already names two other routes.** `mint-vs-compose.md` carries the TYPE
  arm (ADR-0220: a type is earned when its semantics and behaviour are inexpressible with the shipped
  catalog) and the enforcement-locus signal (ADR-0201: a composition whose law only prompt discipline upholds
  earns a primitive that holds it by construction). ADR-0243 itself admitted GameHud on spread and data
  contract although "a Row template of Stat already works" (its Open items). Cl.1 reads as the only route; the
  doctrine and the GameHud precedent say it is one of three.
- **The end-state law is prompt-only, in seven places.** "Say win or lose, offer Play again" is restated in
  six packs and one workflow, and the Croupier's own rule ("an explicit result line ... never a bare status
  badge", `agent-admin-presets.ts:173-175`) is the same law in an eighth. A Badge plus a Button at game end is
  indistinguishable on the wire from a mid-game Badge plus Button, so no check or eval can tell a game ended.
- **Contrast is inexpressible.** The only wire prop that paints a chosen color is `Swatch.value` (a scan of
  every default row in `catalog/default/catalog.json`); no type draws text in one color on another or computes
  a ratio. The Stylist is seeded with the AA floors (`contrast-floors`, `agent-admin-presets.ts:490-494`) and
  told to explain contrast, and can show neither.
- **ADR-0243's slot-picker premise is half wrong.** Its Alternatives answer AvailabilityPicker with "a
  RadioGroup or ChoiceGroup with `disabled` options". The `Radio` wire row carries `value`, `label` and
  `checked` only, though `ui-radio` has `disabled` (`radio.md:32`); `Option` carries `value` and `label`;
  `ChoiceCard` carries `disabled`. Calendar has `min`, `max` and a whole-control `disabled`, no per-date
  unavailability (`calendar.md:75-90`).
- **The budget.** K6 (the default `agent-ui` composition plus the tool) is 45,454 chars against the 46,430
  bound, 976 spare (PRD `response-type-selection` K6 row, T-0083). A synthetic probe
  (`.sdlc/widget-patterns-next/measure/probe.ts`, the T-0065 script) prices rows at ResultCard +286,
  AvailabilityPicker +205, ContrastPair +191, StatGroup +135, and a `Radio.disabled` wire prop at +19. The
  same probe predicted +835 for ADR-0243's three rows; T-0072 measured +985 once the sidecar gate forced
  reciprocal `notFor` edges, so these figures run about 18 percent low.

## Decision

**We will admit a widget type by any of three routes (ADR-0243's composition test, the TYPE arm, or the
enforcement-locus route), keep ADR-0243's placement and budget rules for every route, build ResultCard as a
default-catalog control and ContrastPair as a Stylist fragment composite, and answer the other candidates with
recipes, wire props, a tool or nothing.**

1. **Three admission routes.** A candidate earns a type when ANY of these holds, and its record names which:
   (A) the composition test of ADR-0243 cl.1, unchanged; (B) the TYPE arm: no composition of shipped types can
   express its semantics or behaviour, shown by an analysis of the shipped rows (ADR-0220); (C) the
   enforcement-locus route: a law the prompt text restates in two or more presets, which a primitive would hold
   by construction (ADR-0201). Cl.1's "only when" is read as "when a route admits it"; that is the whole
   extension. ADR-0243 cl.2 (placement: two or more presets and a real control mean a default row, one preset
   means a fragment composite) and cl.4 (every default row is measured against the K6 room) bind every route.
2. **ResultCard (route C, default catalog).** The end-state law ("state the outcome in words, show the final
   figures, offer the restart") moves into `ui-result-card`: the outcome is an enum drawn as a word and a glyph,
   the final figures are a hardened stats array, and the restart is the producer's own Button inside the card.
   Spread: the six pack-seeded games (Admiral, Mentalist, Lexicographer, Alchemist, Negotiator, Dungeon Master),
   the Quizmaster's grand reveal, and the Travel Agent's closing trip summary (`agent-admin-presets.ts:403`). The
   Croupier keeps CardTable's status and Deal again children.
3. **ContrastPair (route B, Stylist fragment).** One preset needs it, so it is a composite factory in a new
   `personas/stylist` fragment (`agent-ui--stylist`), not a fleet control; it is promoted to `ui-contrast-pair`
   only when a second preset needs it (the ADR-0225 route). Its ratio is computed by a pure function in the
   fragment, never by the model.
4. **The other candidates, with what replaces them.**
   - Templated board with a semantic check (Admiral, Lexicographer): no new type. Clickable cells are BoardGrid
     plus T-0081. A check resolves only for a derived catalog id (ADR-0238 cl.2) and neither preset has a
     fragment, so a check is a new fragment folder per preset; the fleet and the secret word are not on the wire,
     so a check can hold only consistency (a resolved cell never flips; a letter marked absent never returns).
   - Seeded shuffle and dice (Croupier, Dungeon Master): a tool, not a widget: one keyless integration module
     and one import line (`a2ui/tools/agent/integrations/index.ts:7`).
   - AvailabilityPicker (Concierge, Maître d'): a recipe plus a wire prop. The `Radio` row gains the `disabled`
     its control already has (+19 chars); a `slot-pick` recipe teaches ChoiceGroup with bound `disabled`
     ChoiceCards and the Quay Bar fallback. Per-date Calendar unavailability is deferred until a preset carries
     per-date availability as data (a resource or a tool); that is the re-open condition.
   - Collection carousel with detail (Curator): a recipe; a SwiperItem template of ProductCard in exhibit mode
     (ADR-0243 cl.1). The Curator's seed still says "a Card inside each" (`agent-admin-presets.ts:445`) and is
     repaired with it.
   - Stat or KPI group, comparison table, MediaGallery: cut. The `dashboard-kpi-grid`, `comparison-table` and
     `media-grid` mini-skills already teach a Grid template of Stat, Stat tiles over one Table, and a Grid
     template of Image; ADR-0243's MediaGallery re-open condition stands.
   - PlanChecklist (Builder): cut. The Builder is not in the roster (`agent-admin-presets.ts:969-971`) and its
     surface style keeps the interview in prose because the draft panes carry the state (`:1013-1017`).
   - The Alchemist's closeness band: a default-catalog client function on the FUNCTION arm (ADR-0217), not a
     type; recorded here, not decided.
5. **Budget.** ResultCard's row lands at about 45,740 by the probe and nearer 45,790 with the reciprocal-edge
   correction; the build measures it (cl.4) and records the figure in the PRD K6 row. ContrastPair costs only
   Stylist turns (its row plus the one-time derived-id line, 143 chars in ADR-0243's measure), and the build
   re-measures `PROMPT_CHAR_BUDGET_DERIVED` (`prompt-budget.ts:37`, 141,200).

## Fork sheets

Every row is decided; a row the build cannot honor is an escalation. Both widgets follow the approved
visual language (the mockup set's `.stat`, `.btn` and `.actions` rules), the ADR-0046 container box model
(6px inset, region padding 12 inline and 6 block, 8px gap), no border-left highlight, and any action Button
at the `lg` step (36px, ADR-0243 Amendment 2). Neither has a mockup yet: each build starts by drawing one for
Kim's approval, and parity is judged against that.

### ResultCard (`ui-result-card`)

| Row | Decision |
|---|---|
| Tag, class | `ui-result-card`, `UIResultCardElement`; descriptor `result-card.md`; base `UIElement` (display with data props, not form-associated); tier `pattern`; light DOM; fill-by-default with the reflected `inline` opt-out (ADR-0223) |
| Anatomy | Host is a card surface with ADR-0046 regions. `[data-part="header"]`: `[data-part="outcome"]` (a pill: glyph plus outcome word) and `[data-part="title"]` · `[data-part="summary"]` (one or two lines) · `[data-part="stats"]` with one `[data-part="stat"]` per entry (label, value, signed delta; the GameHud stat look) · the producer's children follow as direct host children and form the actions row |
| Props | `outcome` (enum `win`, `lose`, `draw`, `done`; default `done`; reflected), `title`, `summary`, `stats` (the GameHud stat shape `{label, value, delta, intent}`, at most 4; extra entries dropped with a catalog warning, valueless entries dropped, ADR-0201); all bindable. Children: `ChildList`, the producer's action Buttons (the CardTable precedent). No `action` prop |
| Events | None of its own. Each action is the producer's own `Button` with its own action, so no host click wiring exists and a click on the summary never restarts a game (the renderer wires a row `action` to any host click, which T-0081 records) |
| Geometry | `pattern` tier with container spacing; no new geometry row. The control stamps `size="lg"` on every direct `ui-button` child (the `personas/action-row.ts` behaviour, re-homed because components cannot import a2ui) |
| Tokens | `--ui-result-card-*` consuming `--md-sys-color-*` roles: win success, lose danger, draw warning, done neutral |
| States | The outcome always shows its word and glyph (Win with a check, Loss with a cross, Draw with an equals sign, Done with a dot; final words and glyphs follow the approved mockup), never color alone. Empty `summary` or `stats` renders no box. No children renders no actions row; the sidecar and the pack text teach the restart, a named prompt-only residual |
| A11y | Role `group` via internals with `ariaLabel` from the outcome word and `title`; the header is a polite live region so a changed outcome is announced once (the GameHud status precedent); deltas are signed text |
| Catalog | Default row `ResultCard`; sidecar: use "the settled outcome of a game, deal or booking with its next action"; not for GameHud (the live score while play goes on), Toast (a passing round result); the reciprocal edges the sidecar gate forces land with it |
| Site surfaces | Descriptor, doc page and nav entry, a catalog preview seed (the T-0064 coverage gate), a visual baseline |

### ContrastPair (Stylist fragment composite)

| Row | Decision |
|---|---|
| Type, home | `ContrastPair`, a composite factory in `personas/stylist` over `ui-card`, `ui-text` and `ui-badge`; no descriptor, no fleet gates, no site page (ADR-0243 cl.2) |
| Anatomy | A `ui-card` with ADR-0046 regions: a header (the `label` and the ratio as text, such as "4.62:1") · a sample region painted with the pair (`background` behind, `foreground` ink) showing `sample` at a large size and one line at body size · a verdict row of three pills: AA body (4.5), AA large (3), AAA body (7) · a values line naming both colors |
| Props | `foreground`, `background` (hex `#rgb`, `#rrggbb` or `#rrggbbaa`, or `oklch(L C H [/ A])`, the two ColorPicker formats), `label`, `sample` (default "Aa"); all bindable |
| Computation | The WCAG 2.x contrast ratio from relative luminance, by a pure, DOM-less function in the fragment. A translucent foreground is composited over the background first. The ratio is shown truncated to two decimals, never rounded up; pass or fail uses the unrounded value. A translucent background or an unparseable value renders "Unrated" and no verdicts |
| Events | None; a display with no action, so it mints no `ui-button` |
| States | Each verdict pill carries a glyph and a word (Pass with a check, Fail with a cross; success or danger intent), never color alone |
| A11y | Role `group` with an `ariaLabel` composed as text: label, both values, the ratio "to 1", and the floors it passes |
| Catalog | Fragment row `ContrastPair`; sidecar: use "a text color on a background with its contrast rating"; not for Swatch (one color alone) |
| Fragment checklist | `personas/stylist/{catalog.json,factories.ts,selection.json,index.ts,manifest.ts}` and tests · `personas/{index,manifests}.ts` · `catalog/records.ts` and `registry-wiring.test.ts` · `site/lib/agent-manifest/stylist.manifest.json` · the Stylist preset's `localPatterns` and `seedVersion` · the `palette-presentation` skill text · a catalog preview seed (T-0064) · the derived budget re-measure |

## Consequences

- **The end state becomes visible.** A game that ends with a ResultCard carries a machine-readable outcome,
  so the `eval:agent-behavior` persona leg and any future check can assert that a game ended and offered a
  restart. Whether models compose it reliably is unmeasured until that leg runs (Kim's manual run).
- **Every turn pays one more row,** about 290 to 340 chars of the 976 left, so roughly 640 remain for any later
  default row. A fourth candidate on the default catalog needs a fresh measurement first (ADR-0243 cl.4).
- **The routes widen admission, and the budget still caps it.** Route C can admit small widgets; cl.2 and cl.4
  stay the brakes, and each admission names its route so a later review can test it. ResultCard carries the
  GameHud-style kill switch: if the persona leg shows models still end games with a bare Badge and Button, the
  row is dropped and the pack text stays.
- **The Stylist becomes a derived catalog** (`agent-ui--stylist`). Since T-0068 a derived catalog inherits the
  base's mini-skills and exemplars, so its teaching is unchanged; it pays the derived-id line on every turn.
- **Contracts touched on build:** ADR-0087 (one control joins the default catalog), ADR-0233 (per-control
  entry and generated registry), ADR-0223 (sizing), ADR-0232 (two sidecar entries), ADR-0235 and ADR-0241 (one
  new fragment folder and record), `a2ui-catalog.spec.md` (one row), the PRD K6 row. Generated files are never
  hand-edited.
- **Open items carried to the builds:** the two mockups and Kim's approval of each; T-0084's container and
  gutter conformance (ADR-0046) lands first so both widgets start conformant; whether the games presets without
  a `seedVersion` pick up changed pack text in a saved store.

## Alternatives considered

- **Hold cl.1 as the only route and build nothing new.** Rejected: it leaves the end-state law in seven prompt
  strings with no detectable end state, and it leaves contrast with no element at all; ADR-0243 already
  admitted GameHud on spread and contract, so the strict reading was never the practice.
- **AvailabilityPicker as a control.** Rejected: it fails every route. The composition is 4 or 5 components once
  per booking, a ChoiceGroup of ChoiceCards already expresses an unavailable slot, and its law (mark full slots,
  offer a fallback) is taught in two presets' text that a recipe covers; the wire gap is one Radio prop.
- **ResultCard with its own `action` prop.** Rejected: the renderer wires a row action to any click on the host
  (`renderer.ts` `#wireAction`), so a click on the summary would restart the game. Re-open if T-0081 ships
  part-scoped action events and the persona leg shows end surfaces missing their restart Button.
- **GameHud gains an outcome and an action.** Rejected: GameHud is a read-out with no events by its fork sheet,
  and the Quizmaster and Travel Agent end states do not sit in a HUD.
- **ContrastPair on the default catalog beside Swatch, Ramp and Ladder.** Rejected: one preset, and cl.2 sends
  one-preset widgets to a fragment; every agent would pay about 190 chars for the Stylist's need.
- **A `contrastRatio` default-catalog function instead of ContrastPair.** Rejected for now: a function can print
  a ratio in any Text, but no type can paint the sample, which is the gap. Re-open if a second preset needs a
  computed ratio in text.
- **A shared fragment holding ResultCard.** Rejected for the ADR-0243 reason: a preset selects one fragment, and
  seven of the eight consumers have none (only the Quizmaster has one).
